import { assetUrl } from '../utils/assetUrl';
import { getLessonAudioSources, getRecordedVocabularyAudioPath } from '../utils/audioPaths';

const MAX_CACHED_AUDIO_BUFFERS = 18;
const MAX_CONCURRENT_AUDIO_PRELOADS = 3;
// A missing/cached-failed recording must fail promptly instead of leaving a
// lesson question waiting several seconds for network audio.
const AUDIO_FETCH_TIMEOUT_MS = 3_000;
// On slower phones, do not leave a child waiting on an uncached recording.
// The download continues for the next attempt.
const AUDIO_PLAYBACK_BUFFER_WAIT_MS = 1_200;
const AUDIO_CONTEXT_RESUME_TIMEOUT_MS = 1_500;
const HTML_AUDIO_START_TIMEOUT_MS = 6_000;
const AUDIO_PLAYBACK_WATCHDOG_PADDING_MS = 4_000;

type AudioPreloadTask = {
  src: string;
  priority: boolean;
  started: boolean;
  promise: Promise<AudioBuffer | null>;
  resolve: (buffer: AudioBuffer | null) => void;
};

class AudioService {
  private isPlaying = false;
  private audioContext: AudioContext | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private currentAudioSrc: string | null = null;
  private fallbackAudioElement: HTMLAudioElement | null = null;
  private finishCurrent: (() => void) | null = null;
  private audioBufferCache = new Map<string, AudioBuffer>();
  private audioPreloadTasks = new Map<string, AudioPreloadTask>();
  private highPriorityAudioQueue: AudioPreloadTask[] = [];
  private backgroundAudioQueue: AudioPreloadTask[] = [];
  private activeAudioPreloads = 0;
  private playbackVersion = 0;
  private unlockListenersInstalled = false;

  private unlockFromUserGesture = () => {
    const context = this.getAudioContext();
    if (!context) return;
    if (context.state === 'running') return;

    void context.resume()
      .then(() => undefined)
      .catch(() => {
        // The permanent listeners retry on the next trusted interaction.
      });
  };

  private installUnlockListeners() {
    if (this.unlockListenersInstalled || typeof window === 'undefined') return;
    this.unlockListenersInstalled = true;
    window.addEventListener('pointerdown', this.unlockFromUserGesture, true);
    window.addEventListener('keydown', this.unlockFromUserGesture, true);
  }

  private prefersNativeAudio() {
    if (typeof window === 'undefined') return false;
    return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  }

  private resolveCurrent() {
    const finish = this.finishCurrent;
    this.finishCurrent = null;
    this.isPlaying = false;
    if (finish) finish();
  }

  warmup() {
    if (typeof window === 'undefined') return;
    this.getAudioContext();
    this.installUnlockListeners();
    // When warmup is called by a navigation button, this resume request still
    // runs inside the trusted user gesture. The listeners cover effect calls.
    this.unlockFromUserGesture();
  }

  private getAudioContext() {
    if (this.audioContext || typeof window === 'undefined') return this.audioContext;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    this.audioContext = new AudioContextClass();
    return this.audioContext;
  }

  private getCachedAudioBuffer(src: string) {
    const buffer = this.audioBufferCache.get(src);
    if (!buffer) return null;

    // Reinsert the entry so the map acts as a small LRU cache.
    this.audioBufferCache.delete(src);
    this.audioBufferCache.set(src, buffer);
    return buffer;
  }

  private cacheAudioBuffer(src: string, buffer: AudioBuffer) {
    this.audioBufferCache.delete(src);
    this.audioBufferCache.set(src, buffer);

    while (this.audioBufferCache.size > MAX_CACHED_AUDIO_BUFFERS) {
      const oldestSrc = this.audioBufferCache.keys().next().value as string | undefined;
      if (!oldestSrc) break;
      if (oldestSrc === this.currentAudioSrc) {
        const currentBuffer = this.audioBufferCache.get(oldestSrc)!;
        this.audioBufferCache.delete(oldestSrc);
        this.audioBufferCache.set(oldestSrc, currentBuffer);
        continue;
      }
      this.audioBufferCache.delete(oldestSrc);
    }
  }

  private createAudioTask(src: string, priority: boolean) {
    let resolveTask!: (buffer: AudioBuffer | null) => void;
    const promise = new Promise<AudioBuffer | null>((resolve) => {
      resolveTask = resolve;
    });
    return { src, priority, started: false, promise, resolve: resolveTask } satisfies AudioPreloadTask;
  }

  private finishAudioPreload(task: AudioPreloadTask, buffer: AudioBuffer | null) {
    if (buffer) this.cacheAudioBuffer(task.src, buffer);
    this.audioPreloadTasks.delete(task.src);
    this.activeAudioPreloads = Math.max(0, this.activeAudioPreloads - 1);
    task.resolve(buffer);
    this.drainAudioPreloadQueue();
  }

  private async startAudioPreload(task: AudioPreloadTask) {
    task.started = true;
    this.activeAudioPreloads += 1;
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), AUDIO_FETCH_TIMEOUT_MS);

    try {
      const context = this.getAudioContext();
      if (!context) {
        this.finishAudioPreload(task, null);
        return;
      }

      // Fetching the complete file before decoding prevents playback from racing
      // the network, which is the main cause of gaps on slow connections.
      const response = await fetch(task.src, { cache: 'force-cache', signal: controller.signal });
      if (!response.ok) throw new Error(`Audio request failed with ${response.status}`);
      const encodedAudio = await response.arrayBuffer();
      const decodedAudio = await context.decodeAudioData(encodedAudio);
      this.finishAudioPreload(task, decodedAudio);
    } catch (error) {
      console.error(`Audio preload failed for ${task.src}:`, error);
      this.finishAudioPreload(task, null);
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }

  private drainAudioPreloadQueue() {
    while (this.activeAudioPreloads < MAX_CONCURRENT_AUDIO_PRELOADS) {
      const task = this.highPriorityAudioQueue.shift() ?? this.backgroundAudioQueue.shift();
      if (!task) return;
      if (task.started) continue;

      const cachedBuffer = this.getCachedAudioBuffer(task.src);
      if (cachedBuffer) {
        this.audioPreloadTasks.delete(task.src);
        task.resolve(cachedBuffer);
        continue;
      }
      void this.startAudioPreload(task);
    }
  }

  private requestAudioBuffer(src: string, priority: boolean) {
    const cachedBuffer = this.getCachedAudioBuffer(src);
    if (cachedBuffer) return Promise.resolve(cachedBuffer);

    const existingTask = this.audioPreloadTasks.get(src);
    if (existingTask) {
      if (priority && !existingTask.priority && !existingTask.started) {
        existingTask.priority = true;
        const backgroundIndex = this.backgroundAudioQueue.indexOf(existingTask);
        if (backgroundIndex >= 0) this.backgroundAudioQueue.splice(backgroundIndex, 1);
        this.highPriorityAudioQueue.push(existingTask);
        this.drainAudioPreloadQueue();
      }
      return existingTask.promise;
    }

    const task = this.createAudioTask(src, priority);
    this.audioPreloadTasks.set(src, task);
    (priority ? this.highPriorityAudioQueue : this.backgroundAudioQueue).push(task);
    this.drainAudioPreloadQueue();
    return task.promise;
  }

  private async playWithHtmlAudio(src: string, version: number) {
    if (typeof Audio === 'undefined') return false;

    return new Promise<boolean>((resolve) => {
      const audio = new Audio(src);
      this.fallbackAudioElement = audio;
      audio.preload = 'auto';
      let settled = false;
      let watchdogId = globalThis.setTimeout(() => finish(false), HTML_AUDIO_START_TIMEOUT_MS);
      const finish = (played: boolean) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(watchdogId);
        if (this.finishCurrent === cancelPlayback) this.finishCurrent = null;
        audio.onended = null;
        audio.onerror = null;
        audio.onplaying = null;
        if (this.fallbackAudioElement === audio) this.fallbackAudioElement = null;
        this.isPlaying = false;
        resolve(played);
      };
      const cancelPlayback = () => finish(false);
      this.finishCurrent = cancelPlayback;
      audio.onended = () => finish(version === this.playbackVersion);
      audio.onerror = () => finish(false);
      audio.onplaying = () => {
        globalThis.clearTimeout(watchdogId);
        const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration * 1_000
          : 30_000;
        watchdogId = globalThis.setTimeout(
          () => finish(false),
          durationMs + AUDIO_PLAYBACK_WATCHDOG_PADDING_MS,
        );
      };
      this.isPlaying = true;
      audio.play().catch(() => finish(false));
    });
  }

  private resumeAudioContext(context: AudioContext) {
    if (context.state === 'running') return Promise.resolve(true);
    if (context.state === 'closed') return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (resumed: boolean) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timeoutId);
        resolve(resumed);
      };
      const timeoutId = globalThis.setTimeout(() => finish(false), AUDIO_CONTEXT_RESUME_TIMEOUT_MS);

      context.resume()
        .then(() => finish(context.state === 'running'))
        .catch(() => finish(false));
    });
  }

  async playAudioFile(src: string): Promise<boolean> {
    if (!src) return false;

    this.stop();
    const version = this.playbackVersion;
    const resolvedSrc = assetUrl(src);
    const context = this.getAudioContext();

    // Native media playback is substantially lighter on a local development
    // server: it streams the MP3 instead of fetching and decoding several
    // recordings in JavaScript at the same time. Keep Web Audio as the fallback
    // for browsers that reject an automatic HTMLMediaElement play request.
    if (this.prefersNativeAudio()) {
      const playedNatively = await this.playWithHtmlAudio(resolvedSrc, version);
      if (playedNatively || version !== this.playbackVersion) return playedNatively;
    }

    // Start resume while the click still has browser user activation. Decoding
    // continues in parallel if the preload has not completed yet.
    const resumePromise = context ? this.resumeAudioContext(context) : Promise.resolve(false);
    const buffer = await Promise.race<AudioBuffer | null>([
      this.requestAudioBuffer(resolvedSrc, true),
      new Promise<null>((resolve) => {
        globalThis.setTimeout(() => resolve(null), AUDIO_PLAYBACK_BUFFER_WAIT_MS);
      }),
    ]);
    if (version !== this.playbackVersion) return false;
    if (!buffer || !context) return this.playWithHtmlAudio(resolvedSrc, version);

    try {
      const contextIsReady = await resumePromise;
      if (version !== this.playbackVersion) return false;
      if (!contextIsReady) return this.playWithHtmlAudio(resolvedSrc, version);

      return await new Promise<boolean>((resolve) => {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        this.audioSource = source;
        this.currentAudioSrc = resolvedSrc;
        this.isPlaying = true;

        let settled = false;
        const watchdogId = globalThis.setTimeout(
          () => finish(false),
          Math.max(1_000, source.buffer.duration * 1_000) + AUDIO_PLAYBACK_WATCHDOG_PADDING_MS,
        );
        const finish = (played: boolean) => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(watchdogId);
          source.onended = null;
          if (this.audioSource === source) this.audioSource = null;
          if (this.currentAudioSrc === resolvedSrc) this.currentAudioSrc = null;
          if (this.finishCurrent === cancelPlayback) this.finishCurrent = null;
          this.isPlaying = false;
          resolve(played);
        };
        const cancelPlayback = () => finish(false);
        this.finishCurrent = cancelPlayback;
        source.onended = () => finish(version === this.playbackVersion);
        source.start(0);
      });
    } catch (error) {
      console.error('Audio playback failed:', error);
      return false;
    }
  }

  async playPrompt(text: string): Promise<void> {
    if (!text || !text.trim()) return;

    const recordedAudio = getRecordedVocabularyAudioPath(text);
    if (!recordedAudio) return;
    await this.playAudioFile(recordedAudio);
  }

  // Kept as a compatibility alias for older callers. It deliberately plays
  // bundled recordings only and never invokes the browser's speech engine.
  async speak(text: string): Promise<void> {
    await this.playPrompt(text);
  }

  preloadPromptAudio(text?: string | null) {
    if (!text) return;
    const recordedAudio = getRecordedVocabularyAudioPath(text);
    if (recordedAudio) this.preloadAudioFile(recordedAudio, { priority: true });
  }

  preloadLessonAudio(letter: any) {
    const [, ...otherAudio] = getLessonAudioSources(letter);
    // The start screen now plays the letter sound and shows the video instead
    // of the old story, so its narration is deliberately skipped. Loading only
    // the first two word recordings prevents 20+ lesson files competing at startup.
    otherAudio.slice(0, 2).forEach((src) => this.preloadAudioFile(src, { priority: false }));
  }

  preloadAudioFile(src?: string | null, options: { priority?: boolean } = {}) {
    if (!src || typeof window === 'undefined') return;
    // On localhost the visible/active recording uses the browser's native
    // streaming path. Avoid background Web Audio decoding competing with image
    // decoding on slower development machines.
    if (this.prefersNativeAudio()) return;
    void this.requestAudioBuffer(assetUrl(src), options.priority ?? true);
  }

  stop() {
    this.playbackVersion += 1;

    // Stop the physical players before resolving their promises; the resolver
    // deliberately clears their references.
    if (this.audioSource) {
      const source = this.audioSource;
      this.audioSource = null;
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already have ended between the state check and stop().
      }
    }
    if (this.fallbackAudioElement) {
      const audio = this.fallbackAudioElement;
      this.fallbackAudioElement = null;
      audio.pause();
      audio.currentTime = 0;
    }

    this.resolveCurrent();

    this.currentAudioSrc = null;
    this.isPlaying = false;
  }
}

export const audioService = new AudioService();
