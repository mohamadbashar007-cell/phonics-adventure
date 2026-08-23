import { assetUrl } from './assetUrl';

const completedImages = new Set<string>();
const queuedImages = new Map<string, ImageLoadTask>();
const highPriorityQueue: ImageLoadTask[] = [];
const backgroundQueue: ImageLoadTask[] = [];
const MAX_CONCURRENT_IMAGE_PRELOADS = 2;
const IMAGE_PRELOAD_TIMEOUT_MS = 8_000;
let activeImagePreloads = 0;

type PreloadOptions = {
  limit?: number;
  priority?: boolean;
  defer?: boolean;
};

type ImageLoadTask = {
  src: string;
  priority: boolean;
  started: boolean;
};

function normalizeSrc(src?: string | null) {
  if (!src || typeof src !== 'string') return null;
  return assetUrl(src.trim()) || null;
}

function scheduleIdle(callback: () => void) {
  const requestIdleCallback = (window as any).requestIdleCallback as
    | ((cb: () => void, options?: { timeout: number }) => void)
    | undefined;

  if (requestIdleCallback) {
    requestIdleCallback(callback, { timeout: 1500 });
    return;
  }
  globalThis.setTimeout(callback, 80);
}

function finishImageTask(task: ImageLoadTask, loaded: boolean) {
  if (loaded) completedImages.add(task.src);
  queuedImages.delete(task.src);
  activeImagePreloads = Math.max(0, activeImagePreloads - 1);
  drainImageQueue();
}

function startImageTask(task: ImageLoadTask) {
  task.started = true;
  activeImagePreloads += 1;

  const image = new Image();
  image.decoding = 'async';
  image.fetchPriority = task.priority ? 'high' : 'low';

  let finished = false;
  const timeoutId = globalThis.setTimeout(() => finish(false), IMAGE_PRELOAD_TIMEOUT_MS);
  const finish = (loaded: boolean) => {
    if (finished) return;
    finished = true;
    globalThis.clearTimeout(timeoutId);
    image.onload = null;
    image.onerror = null;
    finishImageTask(task, loaded);
  };

  image.onload = () => finish(true);
  image.onerror = () => finish(false);
  image.src = task.src;
}

function drainImageQueue() {
  while (activeImagePreloads < MAX_CONCURRENT_IMAGE_PRELOADS) {
    const task = highPriorityQueue.shift() ?? backgroundQueue.shift();
    if (!task) return;
    if (task.started || completedImages.has(task.src)) continue;
    startImageTask(task);
  }
}

function queueImages(sources: string[], priority: boolean) {
  sources.forEach((src) => {
    const existingTask = queuedImages.get(src);
    if (existingTask) {
      if (priority && !existingTask.priority && !existingTask.started) {
        existingTask.priority = true;
        const backgroundIndex = backgroundQueue.indexOf(existingTask);
        if (backgroundIndex >= 0) backgroundQueue.splice(backgroundIndex, 1);
        highPriorityQueue.push(existingTask);
      }
      return;
    }

    const task: ImageLoadTask = { src, priority, started: false };
    queuedImages.set(src, task);
    (priority ? highPriorityQueue : backgroundQueue).push(task);
  });

  drainImageQueue();
}

export function preloadImages(sources: Array<string | null | undefined>, options: PreloadOptions = {}) {
  if (typeof window === 'undefined') return;

  const uniqueSources = Array.from(new Set(sources.map(normalizeSrc).filter(Boolean) as string[]))
    .filter((src) => !completedImages.has(src))
    .slice(0, options.limit ?? sources.length);

  if (uniqueSources.length === 0) return;

  const loadImages = () => queueImages(uniqueSources, Boolean(options.priority));

  if (options.priority || options.defer === false) {
    loadImages();
  } else {
    scheduleIdle(loadImages);
  }
}

export function getLessonImageSources(letter: any) {
  const sources: string[] = [];
  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return;

    if (typeof value.image === 'string') {
      sources.push(value.image);
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    Object.values(value).forEach(visit);
  };

  visit(letter);
  return sources;
}

export function preloadLessonImages(letter: any, options?: PreloadOptions) {
  preloadImages(getLessonImageSources(letter), options);
}

export function getLessonCriticalImageSources(letter: any) {
  return [letter?.story?.image, letter?.image].filter(
    (source): source is string => typeof source === 'string' && source.length > 0
  );
}

export function preloadLessonCriticalImages(letter: any, options?: PreloadOptions) {
  preloadImages(getLessonCriticalImageSources(letter), options);
}

export function getCurriculumImageSources(curriculum: any) {
  const sources: string[] = [];
  const groups = curriculum?.groups ?? [];

  groups.forEach((group: any) => {
    group.letters?.forEach((letter: any) => {
      sources.push(...getLessonImageSources(letter));
    });
  });

  return sources;
}

export function preloadCurriculumImages(curriculum: any, options?: PreloadOptions) {
  preloadImages(getCurriculumImageSources(curriculum), options);
}

export function preloadGroupImages(group: any, options?: PreloadOptions) {
  const sources = group?.letters?.flatMap((letter: any) => getLessonImageSources(letter)) ?? [];
  preloadImages(sources, options);
}
