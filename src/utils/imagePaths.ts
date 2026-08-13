import type React from 'react';

import { assetUrl } from './assetUrl';

const IMAGE_BASE_PATH = '/images';
export const FALLBACK_IMAGE_SRC = `${IMAGE_BASE_PATH}/placeholder.svg`;

const sanitizeKey = (value: string) => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
};

export const getLetterImagePath = (id: string) => `${IMAGE_BASE_PATH}/letters/${sanitizeKey(id)}.webp`;
export const getStoryImagePath = (id: string) => `${IMAGE_BASE_PATH}/stories/${sanitizeKey(id)}-story.webp`;
export const getVocabularyImagePath = (word: string) => `${IMAGE_BASE_PATH}/vocabulary/${sanitizeKey(word)}.webp`;

export const withFallbackImage = (value?: string | null) => {
  if (!value || !value.trim()) {
    return FALLBACK_IMAGE_SRC;
  }
  return value;
};

const getPngAlternative = (value: string) =>
  /\.webp(?:[?#]|$)/i.test(value) ? value.replace(/\.webp(?=[?#]|$)/i, '.png') : '';

export const getImageSourceCandidates = (...values: Array<string | null | undefined>) => {
  const sources: string[] = [];
  values.forEach((value) => {
    if (!value?.trim()) return;
    sources.push(value);
    const pngAlternative = getPngAlternative(value);
    if (pngAlternative) sources.push(pngAlternative);
  });
  sources.push(FALLBACK_IMAGE_SRC);
  return Array.from(new Set(sources));
};

export const applyFallbackImage = (img: HTMLImageElement | null) => {
  if (!img) return;

  const currentSource = img.currentSrc || img.src;
  if (img.dataset.fallbackCurrent && currentSource !== img.dataset.fallbackCurrent) {
    delete img.dataset.fallbackStage;
    delete img.dataset.fallbackCurrent;
  }

  if (img.dataset.fallbackStage !== 'png') {
    const pngAlternative = getPngAlternative(currentSource);
    if (pngAlternative && pngAlternative !== currentSource) {
      img.dataset.fallbackStage = 'png';
      img.dataset.fallbackCurrent = pngAlternative;
      img.src = pngAlternative;
      return;
    }
  }

  if (img.dataset.fallbackStage !== 'placeholder') {
    const placeholder = assetUrl(FALLBACK_IMAGE_SRC);
    img.dataset.fallbackStage = 'placeholder';
    img.src = placeholder;
    img.dataset.fallbackCurrent = img.src;
  }
};

export const handleImageError = (
  event: React.SyntheticEvent<HTMLImageElement, Event>
) => {
  applyFallbackImage(event.currentTarget);
};
