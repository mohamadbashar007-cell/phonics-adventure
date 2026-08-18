import { assetUrl } from './assetUrl';

const VIDEO_BASE_PATH = '/videos';
const VIDEO_VERSION = 'v20260818-drive-videos';
const MAX_PRELOADED_VIDEOS = 2;
const preloadedVideos = new Map<string, { element: HTMLVideoElement; mode: 'metadata' | 'auto' }>();

const explicitVideoNames: Record<string, string> = {
  s: '(s) sound(1).mp4',
  th: '(th) sounds.mp4',
  'capital-abc': 'Capitals (Lesson 1).mp4',
  'capital-def': 'Capitals (Lesson 2).mp4',
  'capital-ghi': 'Capitals (Lesson 3).mp4',
  'capital-jkl': 'Capitals (Lesson 4).mp4',
  'capital-mno': 'Capitals (Lesson 5).mp4',
  'capital-pqr': 'Capitals (Lesson 6).mp4',
  'capital-stuv': 'Capitals (Lesson 7).mp4',
  'capital-wxyz': 'Capitals (Lesson 8).mp4',
};

const standardVideoLetters = new Set([
  'a',
  'ai',
  'ar',
  'b',
  'ch',
  'ck',
  'd',
  'e',
  'ee',
  'f',
  'g',
  'h',
  'i',
  'ie',
  'j',
  'l',
  'm',
  'n',
  'o',
  'oa',
  'oi',
  'ou',
  'p',
  'qu',
  'r',
  'sh',
  't',
  'u',
  'ue',
  'v',
  'w',
  'x',
  'y',
  'z',
]);

export function getStoryVideoPath(letter: { id?: string; letter?: string }) {
  const key = String(letter.id || letter.letter || '').trim().toLowerCase();
  const fileName = explicitVideoNames[key] ?? (standardVideoLetters.has(key) ? `(${key}) sound.mp4` : null);

  if (!fileName) return null;
  return assetUrl(`${VIDEO_BASE_PATH}/${fileName.split('/').map(encodeURIComponent).join('/')}?v=${VIDEO_VERSION}`);
}

export function preloadVideo(src?: string | null, preload: 'metadata' | 'auto' = 'auto') {
  if (!src || typeof document === 'undefined') return;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (connection?.saveData || connection?.effectiveType === 'slow-2g') return;

  const cached = preloadedVideos.get(src);
  if (cached) {
    preloadedVideos.delete(src);
    preloadedVideos.set(src, cached);
    if (cached.mode === 'metadata' && preload === 'auto') {
      cached.mode = 'auto';
      cached.element.preload = 'auto';
      cached.element.load();
    }
    return;
  }

  const element = document.createElement('video');
  element.preload = preload;
  element.muted = true;
  element.playsInline = true;
  element.src = src;
  preloadedVideos.set(src, { element, mode: preload });
  element.load();

  while (preloadedVideos.size > MAX_PRELOADED_VIDEOS) {
    const oldestSrc = preloadedVideos.keys().next().value as string | undefined;
    if (!oldestSrc) break;
    const oldest = preloadedVideos.get(oldestSrc);
    oldest?.element.removeAttribute('src');
    oldest?.element.load();
    preloadedVideos.delete(oldestSrc);
  }
}

export function preloadLessonVideo(letter?: { id?: string; letter?: string } | null, preload: 'metadata' | 'auto' = 'auto') {
  preloadVideo(letter ? getStoryVideoPath(letter) : null, preload);
}
