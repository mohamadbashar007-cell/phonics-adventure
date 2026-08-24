import { getSoundCharacterForWord } from './initialSound';

export type BalloonOption = {
  id: string;
  label: string;
  isCorrect: boolean;
};

type BalloonSourceOption = string | { word?: string; label?: string };

export const BALLOON_DISTRACTORS = [
  's', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b', 'j', 'z', 'w', 'v', 'y', 'x', 'q',
];

function normalizeLetters(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

export function balloonLabelAppearsInWord(label: unknown, word: unknown) {
  const normalizedLabel = normalizeLetters(label);
  const normalizedWord = normalizeLetters(word);
  return Boolean(normalizedLabel && normalizedWord.includes(normalizedLabel));
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function buildBalloonOptions(question: any, questionIndex: number, pictureWord = ''): BalloonOption[] {
  const rawCorrectAnswer = String(question?.correctAnswer || question?.audioSound || '').trim();
  const correctAnswer = rawCorrectAnswer.toLowerCase() === 'ck'
    ? getSoundCharacterForWord(pictureWord, 'ck') || 'c'
    : rawCorrectAnswer;
  const correctKey = correctAnswer.toLowerCase();
  const suppliedDistractors = (question?.options || [])
    .map((option: BalloonSourceOption) => typeof option === 'string' ? option : option.word || option.label || '')
    .map((option: string) => option.trim())
    .flatMap((option: string) => option.toLowerCase() === 'ck' ? ['c', 'k'] : [option])
    .filter((option: string) => option && option.toLowerCase() !== correctKey);
  const distractors = Array.from(new Set(
    [...suppliedDistractors, ...BALLOON_DISTRACTORS]
      .filter((option) => option.toLowerCase() !== correctKey)
      .filter((option) => !pictureWord || !balloonLabelAppearsInWord(option, pictureWord)),
  )).slice(0, 4);

  const balloons = [
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `q${questionIndex}-correct-${index}`,
      label: correctAnswer,
      isCorrect: true,
    })),
    ...distractors.map((label, index) => ({
      id: `q${questionIndex}-wrong-${index}`,
      label,
      isCorrect: false,
    })),
  ];

  return shuffleItems(balloons);
}
