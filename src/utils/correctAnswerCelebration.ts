export const CORRECT_ANSWER_CELEBRATION_EVENT = 'phonics:correct-answer-celebration';

export function celebrateCorrectAnswer() {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(CORRECT_ANSWER_CELEBRATION_EVENT));
}
