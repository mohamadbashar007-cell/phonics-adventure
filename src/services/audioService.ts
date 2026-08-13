import { assetUrl } from '../utils/assetUrl';
import { getLessonAudioSources, getRecordedVocabularyAudioPath } from '../utils/audioPaths';

const MAX_CACHED_AUDIO_BUFFERS = 18;
const MAX_CONCURRENT_AUDIO_PRELOADS = 3;
const AUDIO_FETCH_TIMEOUT_MS = 8_000;
const AUDIO_CONTEXT_RESUME_TIMEOUT_MS = 1_500;

const FEMALE_VOICE_NAMES =
  /\b(ana|aria|ava(?:multilingual)?|emma|female|fiona|hazel|jenny(?:multilingual)?|joanna|karen|kendra|kimberly|libby|linda|mary|michelle|moira|natasha|samantha|serena|salli|sara|shelley|sonia|susan|tessa|victoria|zira)\b/i;
const MALE_VOICE_NAMES =
  /\b(alex|brian|christopher|daniel|david|eric|fred|guy|james|joey|justin|mark|matthew|michael|ryan|thomas|tom)\b/i;

type AudioPreloadTask = {
  src: string;
  priority: boolean;
  started: boolean;
  promise: Promise<AudioBuffer | null>;
  resolve: (buffer: AudioBuffer | null) => void;
};

class AudioService {
  private isPlaying = false;
  private utterance: SpeechSynthesisUtterance | null = null;
  private audioContext: AudioContext | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private currentAudioSrc: string | null = null;
  private fallbackAudioElement: HTMLAudioElement | null = null;
  private finishCurrent: (() => void) | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;
  private voicesCache: SpeechSynthesisVoice[] = [];
  private preferredVoiceUri: string | null = null;
  private audioBufferCache = new Map<string, AudioBuffer>();
  private audioPreloadTasks = new Map<string, AudioPreloadTask>();
  private highPriorityAudioQueue: AudioPreloadTask[] = [];
  private backgroundAudioQueue: AudioPreloadTask[] = [];
  private activeAudioPreloads = 0;
  private playbackVersion = 0;

  private clearFallbackTimer() {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private resolveCurrent() {
    const finish = this.finishCurrent;
    this.finishCurrent = null;
    this.clearFallbackTimer();
    this.isPlaying = false;
    this.utterance = null;
    if (finish) finish();
  }

  private rememberVoices(voices: SpeechSynthesisVoice[]) {
    const uniqueVoices = [...new Map(voices.map((voice) => [voice.voiceURI, voice])).values()];
    if (uniqueVoices.length > 0) this.voicesCache = uniqueVoices;
    return uniqueVoices;
  }

  private async getVoices() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return [];

    const availableVoices = this.rememberVoices(window.speechSynthesis.getVoices());
    if (availableVoices.length > 0) return availableVoices;
    if (this.voicesCache.length > 0) return this.voicesCache;

    if (!this.voicesPromise) {
      this.voicesPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          window.speechSynthesis.removeEventListener('voiceschanged', finish);
          resolve(this.rememberVoices(window.speechSynthesis.getVoices()));
        };
        const timeout = globalThis.setTimeout(finish, 800);
        window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
      }).finally(() => {
        this.voicesPromise = null;
      });
    }

    return this.voicesPromise;
  }

  warmup() {
    if (typeof window === 'undefined') return;
    if (window.speechSynthesis) void this.getVoices();
    this.getAudioContext();
  }

  private voiceScore(voice: SpeechSynthesisVoice) {
    const name = voice.name.toLowerCase();
    const language = voice.lang.toLowerCase();
    let score = 0;

    // Prefer a known female voice first, then a fast installed English voice.
    if (FEMALE_VOICE_NAMES.test(name)) score += 1000;
    if (MALE_VOICE_NAMES.test(name)) score -= 1000;
    if (voice.localService) score += 200;
    if (language === 'en-us') score += 80;
    else if (language.startsWith('en-us')) score += 70;
    else if (language === 'en-gb') score += 60;
    else if (language.startsWith('en')) score += 40;
    if (voice.default) score += 5;

    return score;
  }

  private getPreferredVoice(voices: SpeechSynthesisVoice[]) {
    const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
    if (englishVoices.length === 0) return undefined;

    if (this.preferredVoiceUri) {
      const savedVoice = englishVoices.find((voice) => voice.voiceURI === this.preferredVoiceUri);
      if (savedVoice) return savedVoice;
    }

    const preferredVoice = [...englishVoices].sort(
      (left, right) => this.voiceScore(right) - this.voiceScore(left)
    )[0];
    this.preferredVoiceUri = preferredVoice?.voiceURI ?? null;
    return preferredVoice;
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

  async speak(text: string): Promise<void> {
    if (!text || text.trim().length === 0) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    this.stop();
    const version = this.playbackVersion;
    this.isPlaying = true;

    // Waiting once for the complete voice list avoids the first phrase using the
    // OS default voice and later phrases suddenly switching to another voice.
    const voices = await this.getVoices();
    if (version !== this.playbackVersion) return;

    return new Promise((resolve) => {
      this.finishCurrent = resolve;

      const utterance = new SpeechSynthesisUtterance(text);
      this.utterance = utterance;
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1.08;
      utterance.volume = 1;

      const preferredVoice = this.getPreferredVoice(voices);
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onend = () => {
        if (this.utterance !== utterance || version !== this.playbackVersion) return;
        this.resolveCurrent();
      };
      utterance.onerror = (event) => {
        if (this.utterance !== utterance || version !== this.playbackVersion) return;
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          console.error('Speech synthesis error:', event);
        }
        this.resolveCurrent();
      };

      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);

      const fallbackMs = Math.min(15_000, Math.max(2_500, text.length * 150));
      this.fallbackTimer = globalThis.setTimeout(() => {
        if (this.utterance !== utterance || version !== this.playbackVersion) return;
        window.speechSynthesis.cancel();
        this.resolveCurrent();
      }, fallbackMs);
    });
  }

  private async playWithHtmlAudio(src: string, version: number) {
    if (typeof Audio === 'undefined') return false;

    return new Promise<boolean>((resolve) => {
      const audio = new Audio(src);
      this.fallbackAudioElement = audio;
      audio.preload = 'auto';
      let settled = false;
      const finish = (played: boolean) => {
        if (settled) return;
        settled = true;
        if (this.finishCurrent === cancelPlayback) this.finishCurrent = null;
        audio.onended = null;
        audio.onerror = null;
        if (this.fallbackAudioElement === audio) this.fallbackAudioElement = null;
        this.isPlaying = false;
        resolve(played);
      };
      const cancelPlayback = () => finish(false);
      this.finishCurrent = cancelPlayback;
      audio.onended = () => finish(version === this.playbackVersion);
      audio.onerror = () => finish(false);
      this.isPlaying = true;
      audio.play().catch(() => finish(false));
    });
  }

  private resumeAudioContext(context: AudioContext) {
    if (context.state !== 'suspended') return Promise.resolve(true);

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

    // Start resume while the click still has browser user activation. Decoding
    // continues in parallel if the preload has not completed yet.
    const resumePromise = context ? this.resumeAudioContext(context) : Promise.resolve(false);
    const buffer = await this.requestAudioBuffer(resolvedSrc, true);
    if (!buffer || version !== this.playbackVersion || !context) {
      if (!context && version === this.playbackVersion) {
        return this.playWithHtmlAudio(resolvedSrc, version);
      }
      return false;
    }

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
        const finish = (played: boolean) => {
          if (settled) return;
          settled = true;
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
    if (recordedAudio) {
      const expectedPlaybackVersion = this.playbackVersion + 1;
      const played = await this.playAudioFile(recordedAudio);
      if (played) return;
      // A newer playback request stopped this one. Do not let the stale request
      // start speech synthesis and cancel the audio the child just requested.
      if (this.playbackVersion !== expectedPlaybackVersion) return;
    }

    await this.speak(text);
  }

  preloadPromptAudio(text?: string | null) {
    if (!text) return;
    const recordedAudio = getRecordedVocabularyAudioPath(text);
    if (recordedAudio) this.preloadAudioFile(recordedAudio, { priority: true });
  }

  preloadLessonAudio(letter: any) {
    const [storyAudio, ...otherAudio] = getLessonAudioSources(letter);
    if (storyAudio) this.preloadAudioFile(storyAudio, { priority: true });
    otherAudio.forEach((src) => this.preloadAudioFile(src, { priority: false }));
  }

  preloadAudioFile(src?: string | null, options: { priority?: boolean } = {}) {
    if (!src || typeof window === 'undefined') return;
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
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    this.currentAudioSrc = null;
    this.isPlaying = false;
    this.utterance = null;
  }
}

export const audioService = new AudioService();
