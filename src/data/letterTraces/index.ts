export type { LetterTrace } from './traceFactory';
import { getLetterTrace as loadTrace, preloadLetterTrace as warmTrace } from './traceFactory';

export function getLetterTrace(letter: string) {
  return loadTrace(letter);
}

export function preloadLetterTrace(letter: string) {
  warmTrace(letter);
}
