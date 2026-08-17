import { getInitialSoundCharacters, startsWithInitialSoundCharacter, wordHasSound } from './initialSound';

export const MAX_QUESTIONS_PER_TYPE = 3;

export type ActivitySectionKey = 'hear' | 'match' | 'blend' | 'segment' | 'balloons' | 'tap';

export type ActivitySection = {
  key: ActivitySectionKey;
  label: string;
  activities: any[];
  questionCount: number;
};

const SECTION_LABELS: Record<ActivitySectionKey, string> = {
  hear: 'Hear',
  match: 'Match',
  blend: 'Blend',
  segment: 'Segment',
  balloons: 'Balloons',
  tap: 'Tap',
};

function dedupeWords(items: Array<{ word?: string; image?: string }>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item?.word || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getLessonWords(letter: any) {
  const words: Array<{ word?: string; image?: string }> = [];
  const add = (item: any) => {
    if (typeof item === 'string') words.push({ word: item });
    else if (item?.word || item?.label) words.push({ word: item.word || item.label, image: item.image });
  };

  (letter?.vocabulary || []).forEach(add);
  (letter?.choose?.options || []).forEach(add);
  (letter?.exercises || []).forEach((exercise: any) => (exercise?.options || []).forEach(add));
  (letter?.listening || []).forEach((question: any) => (question?.options || []).forEach(add));
  (letter?.activities || []).forEach((activity: any) => {
    (activity?.items || []).forEach((item: any) => add(item?.word));
    (activity?.words || []).forEach(add);
    (activity?.questions || []).forEach((question: any) => {
      (question?.options || []).forEach(add);
      if (question?.picture?.word) add({ word: question.picture.word, image: question.picture.image });
    });
  });

  return dedupeWords(words);
}

function getLessonVocabulary(letter: any) {
  return dedupeWords((letter?.vocabulary || []).map((item: any) => ({
    word: item?.word,
    image: item?.image,
  })));
}

// Keep these fallback words limited to recordings that are bundled with the
// app. A missing recording would make a yes/no question wait before the
// speech fallback can take over.
const HEAR_FALLBACK_WORDS = ['cat', 'dog', 'sun', 'fish', 'pen'];

function getHearDistractors(letter: any, target: string) {
  const sourceWords = [
    ...(letter?.choose?.options || []),
    ...(letter?.listening || []).flatMap((question: any) => question?.options || []),
    ...HEAR_FALLBACK_WORDS,
  ]
    .map((item: any) => typeof item === 'string' ? item : item?.word)
    .filter((word: unknown): word is string => Boolean(String(word || '').trim()));
  return Array.from(new Set(sourceWords.map((word) => word.trim().toLowerCase())))
    .filter((word) => !wordHasSound(word, target));
}

function stepCount(activity: any) {
  if (activity?.type === 'ODD_OUT') return Array.isArray(activity.words) && activity.words.length ? 1 : 0;
  if (activity?.type === 'HEAR_CHECK' || activity?.type === 'BLEND') return (activity.items || []).length;
  if (activity?.type === 'REVISION' && !(activity.questions || []).length) return (activity.sounds || []).length;
  return (activity?.questions || []).length;
}

function trimActivity(activity: any, count: number) {
  const trimmed = { ...activity };
  if (activity?.type === 'HEAR_CHECK' || activity?.type === 'BLEND') trimmed.items = (activity.items || []).slice(0, count);
  else if (activity?.type === 'REVISION' && !(activity.questions || []).length) trimmed.sounds = (activity.sounds || []).slice(0, count);
  else if (activity?.type !== 'ODD_OUT') trimmed.questions = (activity.questions || []).slice(0, count);
  return trimmed;
}

function capActivities(activities: any[]) {
  const capped: any[] = [];
  let remaining = MAX_QUESTIONS_PER_TYPE;

  for (const activity of activities) {
    const count = stepCount(activity);
    if (!count || remaining <= 0) continue;
    const take = Math.min(count, remaining);
    capped.push(trimActivity(activity, take));
    remaining -= take;
  }

  return capped;
}

function makeHearActivity(letter: any, words: Array<{ word?: string }>) {
  const target = letter?.letter || letter?.id;
  const matching = words.filter((item) => wordHasSound(item.word, target));
  const distractors = [
    ...words.filter((item) => !wordHasSound(item.word, target)).map((item) => item.word || ''),
    ...getHearDistractors(letter, target),
  ];
  const falseWord = distractors.find(Boolean);
  const ordered = [matching[0]?.word, falseWord, matching[1]?.word]
    .filter((word, index, items): word is string => Boolean(word) && items.indexOf(word) === index)
    .slice(0, MAX_QUESTIONS_PER_TYPE);

  return {
    type: 'HEAR_CHECK',
    instruction: 'Listen and decide whether the word has the target sound',
    items: ordered.map((word) => {
      const isCorrect = wordHasSound(word, target);
      return { word, answer: isCorrect ? 'yes' : 'no', isCorrect };
    }),
  };
}

function makeCapitalHearActivity(letter: any, words: Array<{ word?: string }>) {
  const target = letter?.letter || letter?.id;
  const matching = words.filter((item) => startsWithInitialSoundCharacter(item.word, target));
  const falseWord = [
    ...words.map((item) => item.word || ''),
    ...getHearDistractors(letter, target),
  ].find((word) => word && !startsWithInitialSoundCharacter(word, target));
  const ordered = [matching[0]?.word, falseWord, matching[1]?.word]
    .filter((word, index, items): word is string => Boolean(word) && items.indexOf(word) === index)
    .slice(0, MAX_QUESTIONS_PER_TYPE);

  return {
    type: 'HEAR_CHECK',
    checkMode: 'starts-with',
    instruction: 'Listen and decide whether the word starts with one of the lesson letters',
    items: ordered.map((word) => {
      const isCorrect = startsWithInitialSoundCharacter(word, target);
      return { word, answer: isCorrect ? 'yes' : 'no', isCorrect };
    }),
  };
}

function makeMatchActivity(letter: any, words: Array<{ word?: string }>) {
  const target = letter?.letter || letter?.id;
  const matching = words.filter((item) => startsWithInitialSoundCharacter(item.word, target));
  const distractors = words.filter((item) => !startsWithInitialSoundCharacter(item.word, target));
  const selected = dedupeWords([...matching.slice(0, 3), ...distractors.slice(0, 3)]).map((item) => item.word);

  return {
    type: 'ODD_OUT',
    instruction: 'Drag the pictures that start with the target sound',
    words: selected,
    correctAnswer: distractors[0]?.word,
  };
}

function makeBlendActivity(words: Array<{ word?: string }>) {
  return {
    type: 'BLEND',
    instruction: 'Blend the sounds together and repeat',
    items: words.slice(0, MAX_QUESTIONS_PER_TYPE).map((item) => {
      const characters = Array.from(String(item.word || ''));
      return {
        left: characters[0] || '',
        right: characters.slice(1).join(''),
        result: item.word,
      };
    }),
  };
}

function makeSegmentActivity(words: Array<{ word?: string }>) {
  const lessonWords = words.slice(0, MAX_QUESTIONS_PER_TYPE);
  const availableSounds = Array.from(new Set(lessonWords.flatMap((item) => Array.from(String(item.word || '').toLowerCase()))));
  return {
    type: 'SEGMENT',
    instruction: 'Listen to the word and tap the sounds in the correct order',
    questions: lessonWords.map((item) => ({
      audioWord: item.word,
      availableSounds,
      correctOrder: Array.from(String(item.word || '').toLowerCase()),
    })),
  };
}

function makeBalloonsActivity(letter: any, vocabulary: Array<{ word?: string; image?: string }> = []) {
  const sounds = getInitialSoundCharacters(letter?.letter || letter?.id).slice(0, MAX_QUESTIONS_PER_TYPE);
  if (String(letter?.id || '').startsWith('capital-')) {
    return {
      type: 'LOOK_SAY_TAP',
      instruction: 'Look, listen, and pop the sound',
      questions: sounds.map((sound) => {
        const picture = vocabulary.find((item) => startsWithInitialSoundCharacter(item.word, sound));
        return picture ? {
          picture: { word: picture.word, image: picture.image },
          // Only the sound that belongs to this picture is repeated as the
          // correct balloon; distractors come from the general sound pool.
          options: [],
          correctAnswer: sound,
        } : null;
      }).filter(Boolean),
    };
  }

  return {
    type: 'REVISION',
    instruction: 'Listen and pop the matching balloons',
    questions: sounds.map((sound) => ({
      audioSound: sound,
      correctAnswer: sound,
      options: sounds,
    })),
  };
}

function makeTapActivity(letter: any, words: Array<{ word?: string; image?: string }>) {
  const target = letter?.letter || letter?.id;
  const matching = words.filter((item) => startsWithInitialSoundCharacter(item.word, target));
  const distractors = words.filter((item) => !startsWithInitialSoundCharacter(item.word, target));

  return {
    type: 'SAY_TAP',
    instruction: 'Tap the picture that starts with the target sound',
    questions: matching.slice(0, MAX_QUESTIONS_PER_TYPE).map((correct, index) => ({
      prompt: `Sound is ${target}`,
      options: [correct, distractors[index % Math.max(1, distractors.length)]].filter(Boolean),
      correctAnswer: correct.word,
    })),
  };
}

export function getLessonActivitySections(letter: any): ActivitySection[] {
  const source = letter?.activities || [];
  const words = getLessonWords(letter);
  const vocabulary = getLessonVocabulary(letter);
  const byType = (types: string[]) => source.filter((activity: any) => types.includes(activity?.type));

  const candidates: Record<ActivitySectionKey, any[]> = {
    // Hear checks must use the vocabulary the learner has just studied, rather
    // than the older mixed-word activity data.
    hear: [String(letter?.id || '').startsWith('capital-')
      ? makeCapitalHearActivity(letter, vocabulary.length ? vocabulary : words)
      : makeHearActivity(letter, vocabulary.length ? vocabulary : words)],
    match: byType(['ODD_OUT']),
    blend: byType(['BLEND']),
    segment: byType(['SEGMENT']),
    balloons: byType(['REVISION', 'TAP_SOUND', 'LOOK_SAY_TAP']).filter(
      (activity: any) => (activity?.questions || []).length || (activity?.sounds || []).length,
    ),
    tap: source.filter((activity: any) =>
      !['HEAR_CHECK', 'ODD_OUT', 'BLEND', 'SEGMENT', 'REVISION', 'TAP_SOUND', 'LOOK_SAY_TAP'].includes(activity?.type)
      && activity?.subtype !== 'LISTENING',
    ),
  };

  const fallbacks: Record<ActivitySectionKey, any> = {
    hear: String(letter?.id || '').startsWith('capital-') ? makeCapitalHearActivity(letter, words) : makeHearActivity(letter, words),
    match: makeMatchActivity(letter, words),
    blend: makeBlendActivity(words),
    segment: makeSegmentActivity(words),
    balloons: makeBalloonsActivity(letter, vocabulary),
    tap: makeTapActivity(letter, words),
  };

  return (Object.keys(SECTION_LABELS) as ActivitySectionKey[]).map((key) => {
    const existing = capActivities(candidates[key]);
    const activities = existing.length ? existing : capActivities([fallbacks[key]]);
    return {
      key,
      label: SECTION_LABELS[key],
      activities,
      questionCount: activities.reduce((total, activity) => total + stepCount(activity), 0),
    };
  });
}
