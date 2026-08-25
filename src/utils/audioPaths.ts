import curriculum from '../data/curriculum.json';
import recordedAudioConfig from '../data/recordedAudioConfig.json';
import recordedAudioPrompts from '../data/recordedAudioPrompts.json';

// Make phones retry recordings that may have been cached as a failed request.
const AUDIO_CACHE_VERSION = '20260825-group7-audio-refresh';

function withAudioVersion(value: string) {
  if (!value) return '';
  return `${value.split('?')[0]}?v=${AUDIO_CACHE_VERSION}`;
}

function sanitizeAudioKey(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const recordedVocabularyAudio = new Map<string, string>();

// The c and k activities are presented separately, but their bundled audio is
// still stored under the legacy "ck" filenames. Point both the sound-only and
// quiz-question prompts at those recordings instead of requesting missing
// c/k-specific files.
const recordedSoundAudioAliases = new Map<string, string>([
  ['c', '/audio/vocabulary/ck.mp3'],
  ['k', '/audio/vocabulary/ck.mp3'],
  ['c-is-for', '/audio/vocabulary/ck-is-for.mp3'],
  ['k-is-for', '/audio/vocabulary/ck-is-for.mp3'],
]);

export function getStoryBlendSentences(text: unknown): string[] {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => (sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []).length >= 3)
    .slice(0, 3);
}

function registerRecordedText(text: string, audio?: string) {
  const key = sanitizeAudioKey(text);
  if (!key || recordedVocabularyAudio.has(key)) return;
  recordedVocabularyAudio.set(key, audio || `/audio/vocabulary/${key}.mp3`);
}

(curriculum.groups || []).forEach((group: any) => {
  (group.letters || []).forEach((letter: any) => {
    if (recordedAudioConfig.extendedPromptsReady) {
      registerRecordedText(letter.letter);
      if (group.id !== 7) registerRecordedText(`"${letter.letter}" is for:`);
      registerRecordedText(`Trace the letter ${letter.letter}`);
    }

    (letter.vocabulary || []).forEach((item: any) => {
      registerRecordedText(item.word, item.audio);
    });
  });
});

if (recordedAudioConfig.extendedPromptsReady) {
  recordedAudioPrompts.forEach((prompt) => registerRecordedText(prompt));
}

const recordedTextKeys = new Set([
  'word',
  'audioText',
  'audioWord',
  'audioSound',
  'audioSyllable',
  ...(recordedAudioConfig.extendedPromptsReady ? ['result'] : []),
]);

function registerCurriculumRecordedText(value: any) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach(registerCurriculumRecordedText);
    return;
  }
  if (typeof value !== 'object') return;

  Object.entries(value).forEach(([key, child]) => {
    if (recordedTextKeys.has(key) && typeof child === 'string') registerRecordedText(child);
    registerCurriculumRecordedText(child);
  });
}

registerCurriculumRecordedText(curriculum);

export function getVocabularyAudioPath(word: string) {
  const key = sanitizeAudioKey(word);
  return key ? withAudioVersion(`/audio/vocabulary/${key}.mp3`) : '';
}

export function getAlphabetTrainLetterAudioPath(letter: string) {
  const key = sanitizeAudioKey(letter);
  return /^[a-z]$/.test(key) ? withAudioVersion(`/audio/train/${key}.mp3`) : '';
}

export function getCapitalIntroLetterAudioPath(letter: string) {
  const key = sanitizeAudioKey(letter);
  return /^[a-z]$/.test(key) ? withAudioVersion(`/audio/group-7-letters/${key}.mp3`) : '';
}

export function getCapitalTraceLetterAudioPath(letter: string) {
  return getCapitalIntroLetterAudioPath(letter);
}

const introSoundAudioSequences = new Map<string, string[]>([
  ['th', [
    '/audio/vocabulary/th-1.mp3',
    '/audio/vocabulary/th-2.mp3',
  ]],
]);

export function getIntroSoundAudioPaths(sound: string) {
  const key = sanitizeAudioKey(sound);
  return (introSoundAudioSequences.get(key) || []).map(withAudioVersion);
}

export function getRecordedVocabularyAudioPath(text: string) {
  const key = sanitizeAudioKey(text);
  if (!key) return '';
  return withAudioVersion(recordedSoundAudioAliases.get(key) || recordedVocabularyAudio.get(key) || '');
}

export function getLessonAudioSources(letter: any) {
  const sources = new Set<string>();

  const storyAudio = getStoryAudioPath(letter);
  if (storyAudio) sources.add(storyAudio);

  (letter?.vocabulary || []).forEach((item: any) => {
    const audio = item.audio || getVocabularyAudioPath(item.word);
    if (audio) sources.add(audio);
  });
  if (String(letter?.id || '').startsWith('capital-')) {
    getStoryBlendSentences(letter?.story?.text).forEach((_sentence, index) => {
      const storyBlendAudio = getStoryBlendSentenceAudioPath(letter, index);
      if (storyBlendAudio) sources.add(storyBlendAudio);
    });
  }

  const visit = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object') return;

    Object.entries(value).forEach(([key, child]) => {
      if (
        typeof child === 'string' &&
        (key === 'audioText' || key === 'audioWord' || key === 'audioSound' || key === 'audioSyllable')
      ) {
        const recordedAudio = getRecordedVocabularyAudioPath(child);
        if (recordedAudio) sources.add(recordedAudio);
      }
      visit(child);
    });
  };

  visit(letter);
  return [...sources];
}

export function getStoryAudioPath(letter: { id?: string; story?: { audio?: string | null } }) {
  if (letter.story?.audio) return withAudioVersion(letter.story.audio);

  const key = sanitizeAudioKey(letter.id || '');
  return key ? withAudioVersion(`/audio/stories/${key}-story.mp3`) : '';
}

export function getStoryBlendSentenceAudioPath(letter: { id?: string }, sentenceIndex: number) {
  const key = sanitizeAudioKey(letter?.id || '');
  if (!key || !Number.isFinite(sentenceIndex) || sentenceIndex < 0) return '';
  return withAudioVersion(`/audio/stories/blend/${key}-sentence-${sentenceIndex + 1}.mp3`);
}
