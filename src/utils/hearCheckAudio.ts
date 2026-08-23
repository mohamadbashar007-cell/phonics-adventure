import { audioService } from '../services/audioService';
import { getRecordedVocabularyAudioPath } from './audioPaths';
import { getInitialSoundCharacters } from './initialSound';

const GENERIC_PROMPT_AUDIO = getRecordedVocabularyAudioPath('Can you hear');
const IN_AUDIO = getRecordedVocabularyAudioPath('in');

const RECORDED_PROMPTS: Record<string, { text: string; includesIn: boolean }> = {
  a: { text: 'Can you hear a in', includesIn: true },
  e: { text: 'Can you hear e', includesIn: false },
  i: { text: 'Can you hear i in', includesIn: true },
  n: { text: 'Can you hear n in', includesIn: true },
  p: { text: 'Can you hear p in', includesIn: true },
  s: { text: 'Can you hear s in', includesIn: true },
  t: { text: 'Can you hear t in', includesIn: true },
};

function recordedPromptPath(prompt: { text: string }) {
  return getRecordedVocabularyAudioPath(prompt.text);
}

export function formatHearCheckSound(sound: unknown) {
  return getInitialSoundCharacters(sound).map((unit) => `/${unit}/`).join(' or ');
}

export function preloadHearCheckAudio(sound: string, word: string) {
  const soundUnits = getInitialSoundCharacters(sound);
  const recordedPrompt = soundUnits.length === 1 ? RECORDED_PROMPTS[soundUnits[0]] : undefined;

  if (recordedPrompt) {
    audioService.preloadAudioFile(recordedPromptPath(recordedPrompt), { priority: true });
    if (!recordedPrompt.includesIn) audioService.preloadAudioFile(IN_AUDIO, { priority: true });
  } else {
    audioService.preloadAudioFile(GENERIC_PROMPT_AUDIO, { priority: true });
    audioService.preloadPromptAudio(sound);
    audioService.preloadAudioFile(IN_AUDIO, { priority: true });
  }

  audioService.preloadPromptAudio(word);
}

async function playComposedPrompt(sound: string, isCurrent: () => boolean) {
  const playedGenericPrompt = await audioService.playAudioFile(GENERIC_PROMPT_AUDIO);
  if (!isCurrent()) return;
  if (!playedGenericPrompt) return;

  await audioService.playPrompt(sound);

  if (!isCurrent()) return;
  const playedIn = await audioService.playAudioFile(IN_AUDIO);
  if (!isCurrent() || !playedIn) return;
}

export async function playHearCheckAudio(sound: string, word: string, isCurrent: () => boolean) {
  const soundUnits = getInitialSoundCharacters(sound);
  const recordedPrompt = soundUnits.length === 1 ? RECORDED_PROMPTS[soundUnits[0]] : undefined;

  if (recordedPrompt) {
    const playedPrompt = await audioService.playAudioFile(recordedPromptPath(recordedPrompt));
    if (!isCurrent()) return;
    if (!playedPrompt) {
      await playComposedPrompt(sound, isCurrent);
    } else if (!recordedPrompt.includesIn) {
      const playedIn = await audioService.playAudioFile(IN_AUDIO);
      if (!isCurrent() || !playedIn) return;
    }
  } else {
    await playComposedPrompt(sound, isCurrent);
  }

  if (isCurrent()) await audioService.playPrompt(word);
}
