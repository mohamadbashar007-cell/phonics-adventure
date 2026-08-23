import curriculum from '../data/curriculum.json';
import { startsWithInitialSoundCharacter, wordHasSound } from './initialSound';

type PictureWordOption = {
  word: string;
  image: string;
};

const CURRICULUM_PICTURE_WORDS: PictureWordOption[] = (() => {
  const words = new Map<string, PictureWordOption>();
  (curriculum.groups || []).forEach((group: any) => {
    (group.letters || []).forEach((lesson: any) => {
      (lesson.vocabulary || []).forEach((item: any) => {
        const word = String(item?.word || '').trim();
        const image = String(item?.image || '').trim();
        const key = word.toLowerCase();
        if (key && image && !words.has(key)) words.set(key, { word, image });
      });
    });
  });
  return [...words.values()];
})();

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function pickCurriculumDistractors(
  target: string,
  correctWord: string,
  seed: string,
  matchesTarget: (word: string) => boolean,
) {
  const candidates = CURRICULUM_PICTURE_WORDS.filter((item) => (
    item.word.toLowerCase() !== correctWord.toLowerCase()
    && !matchesTarget(item.word)
  ));
  if (!candidates.length) return [];

  const offset = stableHash(`${target}-${seed}`) % candidates.length;
  const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  return rotated.slice(0, 2).map((item) => ({ ...item, isCorrect: false }));
}

export function buildQuizQuestions(letter: any, exercise: any, exerciseNumber: number) {
  if (!String(letter.id || '').startsWith('capital-')) {
    const target = letter.letter || letter.id;
    const vocabulary = (letter.vocabulary || []).filter((item: any) => item?.word && item?.image);
    const matchingVocabulary = vocabulary.filter((item: any) => wordHasSound(item.word, target));
    const correctVocabularyWord = matchingVocabulary.length
      ? matchingVocabulary[(Math.max(1, exerciseNumber) - 1) % matchingVocabulary.length]
      : undefined;

    if (correctVocabularyWord) {
      const distractors = pickCurriculumDistractors(
        target,
        correctVocabularyWord.word,
        `${letter.id}-${exerciseNumber}`,
        (word: string) => wordHasSound(word, target),
      );
      return [{
        target,
        options: [{ ...correctVocabularyWord, isCorrect: true }, ...distractors].slice(0, 3),
      }];
    }

    const reviewSounds = (letter.activities || [])
      .filter((activity: any) => activity?.type === 'REVISION')
      .flatMap((activity: any) => activity?.sounds || [])
      .map((sound: string) => String(sound).trim())
      .filter((sound: string) => sound && sound.toLowerCase() !== String(target).toLowerCase());
    const distractors = Array.from(new Set<string>(reviewSounds)).slice(-2);

    return [{
      target,
      letterOnly: true,
      options: [
        { word: target, isCorrect: true },
        ...distractors.map((word) => ({ word, isCorrect: false })),
      ],
    }];
  }

  const lessonLetters = String(letter.letter || '').match(/[A-Z]/g) || [];
  const vocabulary = (letter.vocabulary || []).filter((item: any) => item?.word && item?.image);

  return lessonLetters.map((target: string, targetIndex: number) => {
    const correct = vocabulary.find((item: any) => startsWithInitialSoundCharacter(item.word, target));
    const distractors = correct
      ? pickCurriculumDistractors(
          target,
          correct.word,
          `${letter.id}-${exerciseNumber}-${targetIndex}`,
          (word) => startsWithInitialSoundCharacter(word, target),
        )
      : [];

    return {
      target,
      options: correct ? [{ ...correct, isCorrect: true }, ...distractors] : [],
    };
  }).filter((question: any) => question.options.length > 0).slice(0, 3);
}
