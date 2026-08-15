import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { Check, Loader2, Volume2, X } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { soundEffects } from '../../services/soundEffects';
import { getVocabularyImagePath, handleImageError } from '../../utils/imagePaths';
import { assetUrl } from '../../utils/assetUrl';
import { celebrateCorrectAnswer } from '../../utils/correctAnswerCelebration';
import FeedbackToast from './FeedbackToast';
import { formatInitialSoundCharacters, startsWithInitialSoundCharacter } from '../../utils/initialSound';

interface ActivityLessonScreenProps {
  letter: any;
  activities?: any[];
  preserveLetterCase?: boolean;
  onComplete: (stars: number) => void;
}

type OptionValue = string | { word?: string; label?: string; image?: string };

type BalloonOption = {
  id: string;
  label: string;
  isCorrect: boolean;
};

type Step = {
  mode: 'choice' | 'segment' | 'blend' | 'review' | 'sound-match' | 'balloon-choice';
  prompt: string;
  instruction?: string;
  audioText?: string;
  imageAudioText?: string;
  options?: OptionValue[];
  correctAnswer?: string;
  image?: string;
  sentence?: string;
  availableSounds?: string[];
  correctOrder?: string[];
  blendParts?: { left: string; right: string; result: string };
  soundTarget?: string;
  desiredOptionCount?: number;
  balloons?: BalloonOption[];
};

type NormalizedOption = {
  value: string;
  label: string;
  image?: string;
  emoji?: string;
};

type BlendTile = {
  id: string;
  letter: string;
};

const BALLOON_DISTRACTORS = [
  's', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b', 'j', 'z', 'w', 'v', 'y', 'x', 'q',
];

const BALLOON_STYLES = [
  { body: 'from-pink-400 to-rose-500', knot: 'bg-rose-500', string: 'bg-rose-300' },
  { body: 'from-sky-400 to-blue-500', knot: 'bg-blue-500', string: 'bg-blue-300' },
  { body: 'from-amber-300 to-orange-500', knot: 'bg-orange-500', string: 'bg-orange-300' },
  { body: 'from-emerald-400 to-teal-500', knot: 'bg-teal-500', string: 'bg-teal-300' },
  { body: 'from-violet-400 to-purple-500', knot: 'bg-purple-500', string: 'bg-purple-300' },
  { body: 'from-cyan-300 to-cyan-500', knot: 'bg-cyan-500', string: 'bg-cyan-300' },
  { body: 'from-lime-300 to-green-500', knot: 'bg-green-500', string: 'bg-green-300' },
];

const BALLOON_VERTICAL_LANES = ['9%', '20%', '31%', '41%', '59%', '70%', '81%'];
const BALLOON_ENTRY_DELAYS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9];
const BLEND_DISTRACTOR_COUNT = 2;
const SYLLABLE_CHOICE_STYLES = [
  'from-violet-500 via-purple-500 to-fuchsia-500 shadow-purple-300/60',
  'from-sky-400 via-cyan-500 to-blue-600 shadow-cyan-300/60',
  'from-amber-400 via-orange-500 to-rose-500 shadow-orange-300/60',
  'from-emerald-400 via-teal-500 to-cyan-600 shadow-emerald-300/60',
];

const WORD_EMOJI_MAP: Record<string, string> = {
  sun: '\u{2600}\u{FE0F}',
  snake: '\u{1F40D}',
  panda: '\u{1F43C}',
  slide: '\u{1F6DD}',
  sock: '\u{1F9E6}',
  soup: '\u{1F372}',
  sandal: '\u{1F461}',
  sand: '\u{1F3D6}\u{FE0F}',
  moon: '\u{1F319}',
  map: '\u{1F5FA}\u{FE0F}',
  mat: '\u{1F9D8}',
  milk: '\u{1F95B}',
  mug: '\u{2615}',
  cat: '\u{1F431}',
  cap: '\u{1F9E2}',
  cup: '\u{1F964}',
  dog: '\u{1F436}',
  hat: '\u{1F452}',
  bed: '\u{1F6CF}\u{FE0F}',
  pig: '\u{1F437}',
  pen: '\u{1F58A}\u{FE0F}',
  bag: '\u{1F45C}',
  kite: '\u{1FA81}',
  fish: '\u{1F41F}',
};

function fallbackEmoji(word: string): string {
  return WORD_EMOJI_MAP[word.toLowerCase()] || '\u{1F9E9}';
}

function buildWordImageMap(letter: any): Map<string, string> {
  const map = new Map<string, string>();
  const add = (word?: string, image?: string) => {
    if (!word) return;
    const key = word.trim().toLowerCase();
    if (!key) return;
    if (!map.has(key) || (image && !map.get(key))) {
      map.set(key, image || '');
    }
  };

  (letter?.vocabulary || []).forEach((item: any) => add(item.word, item.image));
  (letter?.choose?.options || []).forEach((option: any) => add(option.word, option.image));
  (letter?.exercises || []).forEach((exercise: any) => {
    (exercise?.options || []).forEach((opt: any) => add(opt.word, opt.image));
  });
  (letter?.listening || []).forEach((question: any) => {
    (question?.options || []).forEach((opt: any) => add(opt.word, opt.image));
  });
  (letter?.activities || []).forEach((activity: any) => {
    (activity?.questions || []).forEach((question: any) => {
      (question?.options || []).forEach((opt: any) => add(opt.word || opt.label, opt.image));
      if (question?.picture?.image) {
        add(question?.correctAnswer || question?.audioWord || question?.audioSound, question.picture.image);
      }
    });
  });

  return map;
}

function normalizeOption(option: OptionValue, wordImageMap: Map<string, string>): NormalizedOption {
  if (typeof option === 'string') {
    const image = wordImageMap.get(option.toLowerCase());
    return { value: option, label: option, image, emoji: image ? undefined : fallbackEmoji(option) };
  }
  const value = option.word || option.label || '';
  const image = option.image || wordImageMap.get(value.toLowerCase());
  return { value, label: value, image, emoji: image ? undefined : fallbackEmoji(value) };
}

function optionSignature(option: OptionValue) {
  if (typeof option === 'string') return option.trim().toLowerCase();
  return String(option.word || option.label || '').trim().toLowerCase();
}

function dedupeOptions(options: OptionValue[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const signature = optionSignature(option);
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function extractSoundTarget(prompt?: string) {
  const match = String(prompt || '').trim().match(/^Sound is\s+(.+)$/i);
  return match?.[1]?.trim();
}

function isRedundantActivity(activity: any) {
  if (activity?.type === 'SEGMENT') return true;
  if (activity?.type !== 'SAY_TAP') return false;
  if (activity?.subtype === 'LISTENING') return true;

  return (activity?.questions || []).some((question: any) => Boolean(extractSoundTarget(question?.prompt)));
}

function isRevisionIntro(activity: any) {
  return activity?.type === 'REVISION' && !activity?.questions?.length && !activity?.sounds?.length;
}

function shuffleStepOptions(options: OptionValue[], previousSignature = '') {
  if (options.length < 2) return [...options];

  const originalSignature = options.map(optionSignature).join('|');
  let shuffled = [...options];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    shuffled = [...options];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    const signature = shuffled.map(optionSignature).join('|');
    if (signature !== originalSignature && signature !== previousSignature) return shuffled;
  }

  for (let rotation = 1; rotation < options.length; rotation += 1) {
    const rotated = [...options.slice(rotation), ...options.slice(0, rotation)];
    if (rotated.map(optionSignature).join('|') !== previousSignature) return rotated;
  }

  return [...options].reverse();
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function buildBalloonOptions(question: any, questionIndex: number): BalloonOption[] {
  const correctAnswer = String(question?.correctAnswer || question?.audioSound || '').trim();
  const correctKey = correctAnswer.toLowerCase();
  const suppliedDistractors = (question?.options || [])
    .map((option: OptionValue) => typeof option === 'string' ? option : option.word || option.label || '')
    .map((option: string) => option.trim())
    .filter((option: string) => option && option.toLowerCase() !== correctKey);
  const distractors = Array.from(new Set(
    [...suppliedDistractors, ...BALLOON_DISTRACTORS]
      .filter((option) => option.toLowerCase() !== correctKey),
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

function createBlendTiles(word: string): BlendTile[] {
  const answerLetters = Array.from(word);
  const answerLetterKeys = new Set(answerLetters.map((letter) => letter.toLowerCase()));
  const distractorLetters = BALLOON_DISTRACTORS
    .filter((letter) => !answerLetterKeys.has(letter.toLowerCase()))
    .slice(0, BLEND_DISTRACTOR_COUNT);
  const tiles = [
    ...answerLetters.map((letter, index) => ({ id: `answer-${index}-${letter}`, letter })),
    ...distractorLetters.map((letter, index) => ({ id: `distractor-${index}-${letter}`, letter })),
  ];
  if (tiles.length < 2) return tiles;

  const shuffled = [...tiles];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (shuffled.every((tile, index) => tile.id === tiles[index].id)) {
    return [...shuffled.slice(1), shuffled[0]];
  }
  return shuffled;
}

function buildSteps(activity: any, lessonSound?: string): Step[] {
  const type = activity?.type;
  const instruction = activity?.instruction as string | undefined;

  if (type === 'HEAR_CHECK') {
    return (activity.items || []).map((item: any) => ({
      mode: 'choice',
      prompt: lessonSound
        ? `Does the word start with ${formatInitialSoundCharacters(lessonSound)}?`
        : 'Does the word start with the target sound?',
      options: ['yes', 'no'],
      correctAnswer: item.answer,
      audioText: item.word,
    }));
  }

  if (type === 'ODD_OUT') {
    return [
      {
        mode: 'sound-match',
        prompt: 'Drag and drop',
        options: dedupeOptions(activity.words || []),
        desiredOptionCount: Math.max(6, activity.words?.length || 0),
        correctAnswer: activity.correctAnswer,
      },
    ];
  }

  if (type === 'BLEND') {
    return (activity.items || []).map((item: any) => ({
      mode: 'blend',
      instruction,
      prompt: 'Blend',
      audioText: item.result,
      blendParts: item,
    }));
  }

  if (type === 'SEGMENT') {
    return (activity.questions || []).map((q: any) => ({
      mode: 'segment',
      instruction,
      prompt: q.audioWord ? `Tap sounds for "${q.audioWord}" in order` : `Tap sounds for "${q.audioSyllable}" in order`,
      audioText: q.audioWord || q.audioSyllable,
      availableSounds: q.availableSounds || q.correctBreakdown || q.correctOrder,
      correctOrder: q.correctOrder || q.correctBreakdown,
    }));
  }

  if ((type === 'REVISION' || type === 'TAP_SOUND') && activity.questions?.length) {
    return activity.questions.map((q: any, questionIndex: number) => ({
      mode: 'balloon-choice',
      instruction,
      prompt: 'Listen and pop the 3 matching balloons',
      correctAnswer: q.correctAnswer,
      audioText: q.audioSound,
      balloons: buildBalloonOptions(q, questionIndex),
    }));
  }

  if (type === 'REVISION' && activity.sounds?.length) {
    return activity.sounds.map((sound: string, questionIndex: number) => ({
      mode: 'balloon-choice',
      instruction,
      prompt: 'Listen and pop the 3 matching balloons',
      correctAnswer: sound,
      audioText: sound,
      balloons: buildBalloonOptions(
        {
          correctAnswer: sound,
          audioSound: sound,
          options: activity.sounds,
        },
        questionIndex,
      ),
    }));
  }

  if (type === 'LOOK_SAY_TAP' && activity.questions?.length) {
    return activity.questions.map((q: any, questionIndex: number) => ({
      mode: 'balloon-choice',
      instruction,
      prompt: q.prompt || instruction || 'Look at the picture and tap on the first sound',
      correctAnswer: q.correctAnswer,
      image: q.picture?.image,
      imageAudioText: q.picture?.word,
      balloons: buildBalloonOptions(q, questionIndex),
    }));
  }

  return (activity.questions || []).map((q: any) => {
    const rawOptions: OptionValue[] = q.options || [];
    const soundTarget = type === 'SAY_TAP' ? extractSoundTarget(q.prompt) : undefined;

    return {
      mode: 'choice',
      instruction: soundTarget
        ? 'Listen to the sound, then choose the word that has it'
        : instruction,
      prompt: soundTarget
        ? `Which word has the "${soundTarget}" sound?`
        : type === 'TAP_SYLLABLE'
          ? 'Listen and tap'
          : q.prompt || activity.prompt || instruction || 'Choose the correct answer',
      options: dedupeOptions(rawOptions),
      desiredOptionCount: rawOptions.length,
      correctAnswer: q.correctAnswer,
      audioText: soundTarget || q.audioWord || q.audioSound || q.audioSyllable,
      soundTarget,
      image: q.picture?.image,
      sentence: q.sentence,
    };
  });
}

export default function ActivityLessonScreen({ letter, activities: activityOverride, preserveLetterCase = false, onComplete }: ActivityLessonScreenProps) {
  const displayText = (value?: string) => {
    const text = String(value || '');
    return preserveLetterCase ? text : text.toLowerCase();
  };
  const activities = useMemo(() => {
    if (activityOverride) return activityOverride.filter((activity: any) => !isRevisionIntro(activity));
    return (letter?.activities || []).filter(
      (activity: any) => !isRevisionIntro(activity) && !isRedundantActivity(activity),
    );
  }, [activityOverride, letter]);
  const [activityIndex, setActivityIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [segmentSequence, setSegmentSequence] = useState<string[]>([]);
  const [blendTiles, setBlendTiles] = useState<BlendTile[]>([]);
  const [blendSlots, setBlendSlots] = useState<Array<BlendTile | null>>([]);
  const [matchedSoundWords, setMatchedSoundWords] = useState<Set<string>>(new Set());
  const [activeSoundWord, setActiveSoundWord] = useState('');
  const [poppedBalloonIds, setPoppedBalloonIds] = useState<Set<string>>(new Set());
  const [balloonViewportHeight, setBalloonViewportHeight] = useState(
    () => (typeof window === 'undefined' ? 800 : window.innerHeight),
  );
  const balloonChoiceLockedRef = useRef(false);
  const wrongBalloonLockedRef = useRef(false);
  const poppedBalloonIdsRef = useRef<Set<string>>(new Set());
  const choiceLockedRef = useRef(false);
  const advanceLockedRef = useRef(false);
  const announcedHearCheckRef = useRef('');
  const announcedImageAudioRef = useRef('');
  const soundMatchTargetRef = useRef<HTMLDivElement>(null);
  const soundMatchOptionRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const matchedSoundWordsRef = useRef<Set<string>>(new Set());
  const soundMatchLockedRef = useRef(false);
  const audioPlaybackRequestRef = useRef(0);

  const currentActivity = activities[activityIndex];
  const activeStepKey = `${activityIndex}-${stepIndex}`;
  const activeStepKeyRef = useRef(activeStepKey);
  activeStepKeyRef.current = activeStepKey;
  const steps = useMemo(
    () => buildSteps(currentActivity, letter?.letter || letter?.id),
    [currentActivity, letter?.id, letter?.letter],
  );
  const wordImageMap = useMemo(() => buildWordImageMap(letter), [letter]);
  const preparedOptionsByStep = useMemo(() => {
    const activityAnswers = new Set(
      steps
        .map((step) => step.correctAnswer?.trim().toLowerCase())
        .filter((answer): answer is string => Boolean(answer)),
    );

    return steps.map((step) => {
      const options = dedupeOptions(step.options || []);
      const desiredCount = Math.max(options.length, step.desiredOptionCount || 0);
      if (options.length >= desiredCount) return options;

      const used = new Set(options.map(optionSignature));
      const normalizedSound = String(step.soundTarget || '').toLowerCase().replace(/[^a-z]/g, '');
      const candidates: OptionValue[] = Array.from(wordImageMap.entries()).map(([word, image]) => ({ word, image }));
      const isUnusedDistractor = (option: OptionValue) => {
        const signature = optionSignature(option);
        return Boolean(signature) && !used.has(signature) && !activityAnswers.has(signature);
      };
      const doesNotContainTargetSound = (option: OptionValue) => {
        if (!normalizedSound) return true;
        return !optionSignature(option).replace(/[^a-z]/g, '').includes(normalizedSound);
      };
      const preferred = shuffleStepOptions(candidates.filter(
        (option) => isUnusedDistractor(option) && doesNotContainTargetSound(option),
      ));
      const fallback = shuffleStepOptions(candidates.filter(isUnusedDistractor));

      for (const candidate of [...preferred, ...fallback]) {
        const signature = optionSignature(candidate);
        if (used.has(signature)) continue;
        options.push(candidate);
        used.add(signature);
        if (options.length >= desiredCount) break;
      }

      return options;
    });
  }, [steps, wordImageMap]);
  const shuffledOptionsByStep = useMemo(() => {
    let previousSignature = '';
    return preparedOptionsByStep.map((options) => {
      const shuffled = shuffleStepOptions(options, previousSignature);
      previousSignature = shuffled.map(optionSignature).join('|');
      return shuffled;
    });
  }, [preparedOptionsByStep]);
  const currentStep = steps[stepIndex];
  const displayChoiceOptions = shuffledOptionsByStep[stepIndex] || currentStep?.options || [];
  const normalizedChoiceOptions = useMemo(
    () => displayChoiceOptions.map((option) => normalizeOption(option, wordImageMap)),
    [displayChoiceOptions, wordImageMap],
  );
  const soundMatchOptions = useMemo(
    () => normalizedChoiceOptions.map((option) => (
      option.image
        ? option
        : { ...option, image: getVocabularyImagePath(option.value), emoji: undefined }
    )),
    [normalizedChoiceOptions],
  );
  const soundMatchTarget = useMemo(() => {
    const rawTarget = String(letter?.letter || letter?.id || '').trim();
    return rawTarget.toLowerCase().replace(/[^a-z]/g, '') || rawTarget;
  }, [letter?.id, letter?.letter]);
  const soundMatchAnswers = useMemo(
    () => soundMatchOptions.filter((option) => startsWithInitialSoundCharacter(option.value, soundMatchTarget)),
    [soundMatchOptions, soundMatchTarget],
  );

  useEffect(() => {
    audioPlaybackRequestRef.current += 1;
    audioService.stop();
    setIsLoadingAudio(false);
    setSegmentSequence([]);
    const blendWord = currentStep?.blendParts?.result || '';
    setBlendTiles(currentStep?.mode === 'blend' ? createBlendTiles(blendWord) : []);
    setBlendSlots(currentStep?.mode === 'blend' ? Array.from({ length: Array.from(blendWord).length }, () => null) : []);
    setMatchedSoundWords(new Set());
    setActiveSoundWord('');
    setPoppedBalloonIds(new Set());
    balloonChoiceLockedRef.current = false;
    wrongBalloonLockedRef.current = false;
    poppedBalloonIdsRef.current = new Set();
    choiceLockedRef.current = false;
    advanceLockedRef.current = false;
    matchedSoundWordsRef.current = new Set();
    soundMatchLockedRef.current = false;
    if (currentStep?.audioText) {
      audioService.preloadPromptAudio(currentStep.audioText);
    }
    if (currentStep?.imageAudioText) {
      audioService.preloadPromptAudio(currentStep.imageAudioText);
    }
    if (currentStep?.mode === 'sound-match') {
      soundMatchOptions.forEach((option) => audioService.preloadPromptAudio(option.value));
    }
  }, [activityIndex, stepIndex, currentStep?.mode]);

  useEffect(() => {
    const updateBalloonViewportHeight = () => setBalloonViewportHeight(window.innerHeight);
    window.addEventListener('resize', updateBalloonViewportHeight);
    return () => window.removeEventListener('resize', updateBalloonViewportHeight);
  }, []);

  const hasData = activities.length > 0 && !!currentStep;

  const advance = (expectedStepKey = activeStepKey) => {
    if (expectedStepKey !== activeStepKeyRef.current || advanceLockedRef.current) return;
    advanceLockedRef.current = true;

    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => prev + 1);
      return;
    }

    if (activityIndex < activities.length - 1) {
      setActivityIndex((prev) => prev + 1);
      setStepIndex(0);
      return;
    }

    onComplete(2);
  };

  const playAudio = async () => {
    if (!currentStep?.audioText) return;

    const requestId = audioPlaybackRequestRef.current + 1;
    audioPlaybackRequestRef.current = requestId;
    if (isLoadingAudio) audioService.stop();
    setIsLoadingAudio(true);
    let timeoutId: number | undefined;

    try {
      const finished = await Promise.race([
        audioService.playPrompt(currentStep.audioText).then(() => true),
        new Promise<boolean>((resolve) => {
          timeoutId = window.setTimeout(() => resolve(false), 6_000);
        }),
      ]);

      if (!finished) audioService.stop();
    } catch (error) {
      console.error('Prompt audio playback failed:', error);
      audioService.stop();
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (audioPlaybackRequestRef.current === requestId) setIsLoadingAudio(false);
    }
  };

  const hearCheckAudioKey = `${letter.id}-${activityIndex}-${stepIndex}-${currentStep?.audioText || ''}`;
  const imageAudioKey = `${letter.id}-${activityIndex}-${stepIndex}-${currentStep?.imageAudioText || ''}`;

  useEffect(() => {
    if (currentActivity?.type !== 'HEAR_CHECK' || !currentStep?.audioText) return;
    if (announcedHearCheckRef.current === hearCheckAudioKey) return;

    const timeoutId = window.setTimeout(() => {
      announcedHearCheckRef.current = hearCheckAudioKey;
      void playAudio();
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [hearCheckAudioKey, currentActivity?.type]);

  useEffect(() => {
    if (!currentStep?.imageAudioText || announcedImageAudioRef.current === imageAudioKey) return;

    const timeoutId = window.setTimeout(() => {
      announcedImageAudioRef.current = imageAudioKey;
      void audioService.playPrompt(currentStep.imageAudioText!);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [imageAudioKey, currentStep?.imageAudioText]);

  const playImageAudio = () => {
    if (!currentStep?.imageAudioText) return;
    void audioService.playPrompt(currentStep.imageAudioText);
  };

  const handleChoice = async (choice: string) => {
    if (choiceLockedRef.current) return;

    if (!currentStep?.correctAnswer) {
      choiceLockedRef.current = true;
      advance(activeStepKey);
      return;
    }

    if (choice.toLowerCase() === currentStep.correctAnswer.toLowerCase()) {
      choiceLockedRef.current = true;
      const answeredStepKey = activeStepKey;
      setFeedback({ type: 'success', text: 'Excellent! \u{1F389}' });
      soundEffects.playSuccess();
      celebrateCorrectAnswer();
      setTimeout(() => {
        if (activeStepKeyRef.current !== answeredStepKey) return;
        setFeedback(null);
        advance(answeredStepKey);
      }, 600);
      return;
    }

    choiceLockedRef.current = true;
    const answeredStepKey = activeStepKey;
    setFeedback({ type: 'error', text: 'Try again! \u{1F4AA}' });
    soundEffects.playError();
    setTimeout(() => {
      if (activeStepKeyRef.current !== answeredStepKey) return;
      setFeedback(null);
      choiceLockedRef.current = false;
    }, 700);
  };

  const handleBalloonChoice = (balloon: BalloonOption) => {
    if (balloonChoiceLockedRef.current || poppedBalloonIdsRef.current.has(balloon.id)) return;

    if (!balloon.isCorrect) {
      if (wrongBalloonLockedRef.current) return;
      wrongBalloonLockedRef.current = true;
      const answeredStepKey = activeStepKey;
      setFeedback({ type: 'error', text: 'Try another balloon! \u{1F388}' });
      soundEffects.playError();
      window.setTimeout(() => {
        if (activeStepKeyRef.current !== answeredStepKey) return;
        setFeedback(null);
        wrongBalloonLockedRef.current = false;
      }, 700);
      return;
    }

    const nextPopped = new Set(poppedBalloonIdsRef.current);
    nextPopped.add(balloon.id);
    poppedBalloonIdsRef.current = nextPopped;
    setPoppedBalloonIds(nextPopped);
    soundEffects.playSuccess();

    if (nextPopped.size < 3) return;

    balloonChoiceLockedRef.current = true;
    const answeredStepKey = activeStepKey;
    setFeedback({ type: 'success', text: 'You found all 3! \u{1F389}' });
    celebrateCorrectAnswer();
    window.setTimeout(() => {
      if (activeStepKeyRef.current !== answeredStepKey) return;
      setFeedback(null);
      advance(answeredStepKey);
    }, 900);
  };

  const playSoundMatchWord = (word: string) => {
    if (!word) return;
    void audioService.playPrompt(word);
  };

  const handleSoundMatchDrop = (word: string, info: PanInfo) => {
    setActiveSoundWord('');
    if (soundMatchLockedRef.current || matchedSoundWordsRef.current.has(word)) return;

    const targetRect = soundMatchTargetRef.current?.getBoundingClientRect();
    const pictureRect = soundMatchOptionRefs.current.get(word)?.getBoundingClientRect();
    const dropPadding = 24;
    const pointerIsNearLetter = Boolean(
      targetRect &&
      info.point.x >= targetRect.left - dropPadding &&
      info.point.x <= targetRect.right + dropPadding &&
      info.point.y >= targetRect.top - dropPadding &&
      info.point.y <= targetRect.bottom + dropPadding,
    );
    const overlapWidth = targetRect && pictureRect
      ? Math.max(0, Math.min(targetRect.right, pictureRect.right) - Math.max(targetRect.left, pictureRect.left))
      : 0;
    const overlapHeight = targetRect && pictureRect
      ? Math.max(0, Math.min(targetRect.bottom, pictureRect.bottom) - Math.max(targetRect.top, pictureRect.top))
      : 0;
    const pictureArea = pictureRect ? pictureRect.width * pictureRect.height : 0;
    const pictureOverlapsLetter = pictureArea > 0 && (overlapWidth * overlapHeight) / pictureArea >= 0.08;
    const wasDroppedOnLetter = Boolean(
      targetRect && (pointerIsNearLetter || pictureOverlapsLetter),
    );
    if (!wasDroppedOnLetter) return;

    if (!startsWithInitialSoundCharacter(word, soundMatchTarget)) {
      setFeedback({ type: 'error', text: 'Try another picture! \u{1F4AA}' });
      soundEffects.playError();
      window.setTimeout(() => setFeedback(null), 750);
      return;
    }

    const nextMatched = new Set(matchedSoundWordsRef.current);
    nextMatched.add(word);
    matchedSoundWordsRef.current = nextMatched;
    setMatchedSoundWords(nextMatched);
    soundEffects.playSuccess();

    if (soundMatchAnswers.length > 0 && nextMatched.size >= soundMatchAnswers.length) {
      soundMatchLockedRef.current = true;
      setFeedback({ type: 'success', text: 'Excellent matching! \u{1F389}' });
      celebrateCorrectAnswer();
      window.setTimeout(() => {
        setFeedback(null);
        advance();
      }, 1200);
    }
  };

  const handleSegmentTap = (sound: string) => {
    if (!currentStep?.correctOrder?.length) return;
    const next = [...segmentSequence, sound];
    setSegmentSequence(next);

    if (next.length < currentStep.correctOrder.length) return;

    const isCorrect = next.every((s, i) => s.toLowerCase() === currentStep.correctOrder![i].toLowerCase());
    if (isCorrect) {
      setFeedback({ type: 'success', text: 'Great job! \u{1F31F}' });
      soundEffects.playSuccess();
      celebrateCorrectAnswer();
      setTimeout(() => {
        setFeedback(null);
        advance();
      }, 650);
      return;
    }

    setFeedback({ type: 'error', text: 'Not quite, try again! \u{1F504}' });
    soundEffects.playError();
    setTimeout(() => {
      setFeedback(null);
      setSegmentSequence([]);
    }, 700);
  };

  const placeBlendTile = (tileId: string, targetIndex: number) => {
    const tile = blendTiles.find((item) => item.id === tileId);
    if (!tile) return;

    setBlendSlots((current) => {
      const next = [...current];
      const sourceIndex = next.findIndex((item) => item?.id === tileId);
      const replacedTile = next[targetIndex];
      if (sourceIndex >= 0) next[sourceIndex] = replacedTile;
      next[targetIndex] = tile;
      return next;
    });
  };

  const handleBlendTileTap = (tileId: string) => {
    const firstEmptySlot = blendSlots.findIndex((slot) => slot === null);
    if (firstEmptySlot >= 0) placeBlendTile(tileId, firstEmptySlot);
  };

  const clearBlendSlot = (slotIndex: number) => {
    setBlendSlots((current) => current.map((slot, index) => (index === slotIndex ? null : slot)));
  };

  const checkBlendAnswer = () => {
    const target = currentStep?.blendParts?.result || '';
    if (!target || blendSlots.some((slot) => slot === null)) return;

    const answer = blendSlots.map((slot) => slot?.letter || '').join('');
    if (answer.toLowerCase() === target.toLowerCase()) {
      setFeedback({ type: 'success', text: 'Excellent! Great blending!' });
      soundEffects.playSuccess();
      celebrateCorrectAnswer();
      void audioService.playPrompt(target);
      setTimeout(() => {
        setFeedback(null);
        advance();
      }, 900);
      return;
    }

    setFeedback({ type: 'error', text: 'Try a different order!' });
    soundEffects.playError();
    setTimeout(() => setFeedback(null), 800);
  };

  if (!hasData) {
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-2xl font-bold text-gray-700">No activity data for this lesson.</p>
          <button onClick={() => onComplete(0)} className="mt-6 rounded-full bg-blue-600 px-8 py-3 font-bold text-white">
            Continue
          </button>
        </div>
      </div>
    );
  }

  const isHearCheck = currentActivity.type === 'HEAR_CHECK';
  const isTapSyllable = currentActivity.type === 'TAP_SYLLABLE';
  const isListeningBalloon = currentStep.mode === 'balloon-choice' && !currentStep.image;

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden p-4 text-center md:p-8">
      <FeedbackToast feedback={feedback} />

      <AnimatePresence mode="wait">
        <motion.div
          key={`${activityIndex}-${stepIndex}`}
          initial={{ opacity: 0, x: 70, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -70, scale: 0.98 }}
          transition={{ duration: 0.32, ease: 'easeInOut' }}
          className="relative z-40 flex w-full flex-col items-center"
          aria-live="polite"
        >
      <h2 className={`relative z-20 font-black text-gray-800 ${currentStep.sentence ? 'mb-2' : 'mb-6'} ${isHearCheck ? 'text-2xl md:text-3xl' : 'text-2xl md:text-4xl'}`}>
        {displayText(currentStep.prompt)}
      </h2>
      {!isListeningBalloon && currentStep.sentence && <p className="relative z-20 mb-6 text-xl font-bold text-gray-700">{displayText(currentStep.sentence)}</p>}

      {currentStep.audioText && (
        <button
          type="button"
          onClick={playAudio}
          aria-label={isLoadingAudio ? 'Restart sound' : 'Play sound'}
          className={`relative z-20 flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 ${isListeningBalloon ? 'mb-3' : 'mb-8'}`}
        >
          {isLoadingAudio ? <Loader2 className="animate-spin" size={36} /> : <Volume2 size={36} />}
        </button>
      )}

      {currentStep.image && currentStep.imageAudioText && (
        <button
          type="button"
          onClick={playImageAudio}
          aria-label={`Play ${currentStep.imageAudioText}`}
          className="relative z-20 mb-6 rounded-2xl bg-white shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-blue-400"
        >
          <img
            src={assetUrl(currentStep.image)}
            alt={displayText(currentStep.imageAudioText)}
            onError={handleImageError}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="h-40 w-40 rounded-2xl p-3 object-contain"
          />
        </button>
      )}

      {currentStep.image && !currentStep.imageAudioText && (
        <img
          src={assetUrl(currentStep.image)}
          alt="prompt"
          onError={handleImageError}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="mb-6 h-40 w-40 rounded-2xl bg-white p-3 object-contain shadow-lg"
        />
      )}

      {currentStep.mode === 'blend' && currentStep.blendParts && (
        <div className="mb-8 flex w-full max-w-3xl flex-col items-center rounded-3xl bg-white p-5 shadow-lg md:p-8">
          <p className="mb-5 text-sm font-bold text-gray-500">Drag or tap the letters into the empty boxes</p>

          <div className="mb-8 flex flex-wrap justify-center gap-3" aria-label="Word slots">
            {blendSlots.map((tile, index) => (
              <button
                key={`blend-slot-${index}`}
                type="button"
                draggable={Boolean(tile)}
                onDragStart={(event) => {
                  if (!tile) return;
                  event.dataTransfer.setData('text/plain', tile.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  placeBlendTile(event.dataTransfer.getData('text/plain'), index);
                }}
                onClick={() => tile && clearBlendSlot(index)}
                aria-label={tile ? `Remove ${tile.letter} from position ${index + 1}` : `Empty position ${index + 1}`}
                className={`grid h-16 w-16 place-items-center rounded-2xl border-4 text-3xl font-black transition md:h-20 md:w-20 md:text-4xl ${
                  preserveLetterCase ? 'uppercase ' : ''
                }${
                  tile
                    ? 'cursor-grab border-blue-400 bg-blue-50 text-blue-800 shadow-md active:cursor-grabbing'
                    : 'border-dashed border-slate-300 bg-slate-50 text-slate-300'
                }`}
              >
                {displayText(tile?.letter)}
              </button>
            ))}
          </div>

          <div className="flex min-h-16 flex-wrap justify-center gap-3" aria-label="Available letters">
            {blendTiles.map((tile, index) => {
              const isPlaced = blendSlots.some((slot) => slot?.id === tile.id);
              return (
                <motion.button
                  key={tile.id}
                  type="button"
                  draggable={!isPlaced}
                  disabled={isPlaced}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: isPlaced ? 0 : 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onDragStartCapture={(event: React.DragEvent<HTMLButtonElement>) => {
                    event.dataTransfer.setData('text/plain', tile.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => handleBlendTileTap(tile.id)}
                  aria-label={`Place letter ${tile.letter}`}
                  className={`grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-2xl font-black text-white shadow-lg md:h-16 md:w-16 md:text-3xl ${
                    preserveLetterCase ? 'uppercase ' : ''
                  }${
                    isPlaced ? 'pointer-events-none invisible' : 'cursor-grab active:cursor-grabbing'
                  }`}
                >
                  {displayText(tile.letter)}
                </motion.button>
              );
            })}
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => setBlendSlots(Array.from({ length: blendSlots.length }, () => null))}
              disabled={blendSlots.every((slot) => slot === null)}
              className="rounded-full bg-slate-200 px-6 py-3 font-bold text-slate-700 disabled:opacity-40"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={checkBlendAnswer}
              disabled={blendSlots.some((slot) => slot === null)}
              className="rounded-full bg-green-600 px-8 py-3 font-bold text-white shadow-md hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Check
            </button>
          </div>
        </div>
      )}

      {currentStep.mode === 'review' && (
        <div className="mb-8 flex flex-wrap justify-center gap-3">
          {(currentStep.options || []).map((option, idx) => {
            const normalized = normalizeOption(option, wordImageMap);
            return (
              <span key={`${normalized.value}-${idx}`} className="rounded-full bg-orange-200 px-5 py-2 text-xl font-black text-orange-900">
                {displayText(normalized.label)}
              </span>
            );
          })}
          <div className="w-full">
            <button onClick={() => advance()} className="mt-6 rounded-full bg-green-600 px-8 py-3 font-bold text-white hover:bg-green-700">
              Continue
            </button>
          </div>
        </div>
      )}

      {currentStep.mode === 'segment' && (
        <div className="w-full max-w-2xl">
          <p className="mb-4 text-sm font-bold text-gray-600">Tapped order: {segmentSequence.join(' - ') || '...'}</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {(currentStep.availableSounds || []).map((sound, idx) => (
              <button
                key={`${sound}-${idx}`}
                onClick={() => handleSegmentTap(sound)}
                className="rounded-2xl bg-white px-6 py-5 text-2xl font-black text-gray-800 shadow-lg hover:bg-blue-50"
              >
                {displayText(sound)}
              </button>
            ))}
          </div>
          <button onClick={() => setSegmentSequence([])} className="mt-5 rounded-full bg-gray-200 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300">
            Reset
          </button>
        </div>
      )}

      {currentStep.mode === 'sound-match' && (
        <div
          className="relative grid min-h-[30rem] w-full max-w-5xl grid-cols-3 gap-2 md:min-h-[36rem] md:gap-6"
          style={{ gridTemplateRows: 'repeat(3, minmax(110px, 1fr))' }}
        >
          <motion.div
            ref={soundMatchTargetRef}
            animate={activeSoundWord ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={activeSoundWord ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
            className={`relative z-10 col-start-2 row-start-2 m-auto grid h-36 w-36 place-items-center rounded-full border-[7px] bg-gradient-to-br from-blue-500 to-indigo-700 text-white shadow-2xl transition-colors md:h-52 md:w-52 ${
              activeSoundWord ? 'border-yellow-300 ring-8 ring-yellow-200/60' : 'border-white'
            }`}
            aria-label={`Drop pictures for the letter ${soundMatchTarget} here`}
          >
            <span className={`text-7xl font-black drop-shadow-lg md:text-9xl ${preserveLetterCase ? '' : 'lowercase'}`}>
              {displayText(letter.letter || soundMatchTarget)}
            </span>

            <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center justify-center -space-x-2">
              {soundMatchAnswers
                .filter((option) => matchedSoundWords.has(option.value))
                .map((option) => (
                  <motion.span
                    key={`matched-${option.value}`}
                    initial={{ opacity: 0, scale: 0.2, y: -30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border-4 border-white bg-green-100 shadow-lg md:h-14 md:w-14"
                  >
                    {option.image ? (
                      <img
                        src={assetUrl(option.image)}
                        alt=""
                        aria-hidden="true"
                        onError={handleImageError}
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-xl">{option.emoji}</span>
                    )}
                  </motion.span>
                ))}
            </div>
          </motion.div>

          {soundMatchOptions.map((option, idx) => {
            const sixSlotOrder = [0, 2, 3, 5, 6, 8, 1, 7];
            const slotIndex = sixSlotOrder[idx % sixSlotOrder.length];
            const row = Math.floor(slotIndex / 3) + 1;
            const column = (slotIndex % 3) + 1;
            const isMatched = matchedSoundWords.has(option.value);

            return (
              <div
                key={`${option.value}-${idx}`}
                className="flex items-center justify-center"
                style={{ gridColumn: column, gridRow: row }}
              >
                <motion.button
                  ref={(node) => {
                    if (node) {
                      soundMatchOptionRefs.current.set(option.value, node);
                    } else {
                      soundMatchOptionRefs.current.delete(option.value);
                    }
                  }}
                  type="button"
                  drag={!isMatched}
                  dragSnapToOrigin
                  dragMomentum={false}
                  disabled={isMatched || soundMatchLockedRef.current}
                  initial={{ opacity: 0, scale: 0.75 }}
                  animate={{ opacity: isMatched ? 0 : 1, scale: isMatched ? 0.35 : 1 }}
                  whileHover={!isMatched ? { scale: 1.08, rotate: idx % 2 === 0 ? -2 : 2 } : undefined}
                  whileTap={!isMatched ? { scale: 0.96, cursor: 'grabbing' } : undefined}
                  onPointerDown={() => playSoundMatchWord(option.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') playSoundMatchWord(option.value);
                  }}
                  onDragStart={() => setActiveSoundWord(option.value)}
                  onDragEnd={(_, info) => handleSoundMatchDrop(option.value, info)}
                  aria-label={`Picture of ${option.label}. Drag it to the letter if it starts with ${soundMatchTarget}`}
                  className={`relative grid h-24 w-24 touch-none cursor-grab place-items-center overflow-hidden rounded-[1.75rem] border-4 bg-white p-2 shadow-xl active:cursor-grabbing sm:h-28 sm:w-28 md:h-36 md:w-36 ${
                    activeSoundWord === option.value ? 'z-30 border-yellow-400' : 'z-20 border-white hover:border-blue-200'
                  }`}
                >
                  {option.image ? (
                    <img
                      src={assetUrl(option.image)}
                      alt=""
                      aria-hidden="true"
                      onError={handleImageError}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      draggable={false}
                      className="h-full w-full select-none object-contain"
                    />
                  ) : (
                    <span className="text-5xl md:text-7xl" aria-hidden="true">{option.emoji}</span>
                  )}
                  <Volume2 className="absolute bottom-1 right-1 rounded-full bg-blue-600 p-1 text-white shadow md:bottom-2 md:right-2" size={24} />
                </motion.button>
              </div>
            );
          })}

          <div className="pointer-events-none absolute bottom-0 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-sm font-black text-indigo-700 shadow">
            {matchedSoundWords.size}/{soundMatchAnswers.length}
          </div>
        </div>
      )}

      {currentStep.mode === 'balloon-choice' && (
        <div className="flex w-full flex-col items-center">
          {typeof document !== 'undefined' && createPortal(
            <div className="pointer-events-none fixed inset-0 z-30 h-[100dvh] w-screen overflow-hidden">
              {(currentStep.balloons || []).map((balloon, idx) => {
                const isPopped = poppedBalloonIds.has(balloon.id);
                const style = BALLOON_STYLES[idx % BALLOON_STYLES.length];
                const movesUp = idx % 2 === 0;
                const offscreenTop = -Math.max(192, balloonViewportHeight * 0.3);
                const offscreenBottom = balloonViewportHeight + Math.max(64, balloonViewportHeight * 0.1);
                const verticalPath = movesUp
                  ? [offscreenBottom, offscreenTop]
                  : [offscreenTop, offscreenBottom];

                return (
                  <motion.div
                    key={balloon.id}
                    style={{ left: BALLOON_VERTICAL_LANES[idx % BALLOON_VERTICAL_LANES.length], top: 0 }}
                    initial={{ y: verticalPath[0] }}
                    animate={{
                      y: verticalPath,
                      rotate: [0, idx % 2 === 0 ? -2 : 2, 0],
                    }}
                    transition={{
                      duration: 12,
                      delay: BALLOON_ENTRY_DELAYS[idx % BALLOON_ENTRY_DELAYS.length],
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    className="pointer-events-auto absolute w-[clamp(3.75rem,7vw,6rem)]"
                  >
                    <motion.button
                      type="button"
                      onClick={() => handleBalloonChoice(balloon)}
                      disabled={isPopped || balloonChoiceLockedRef.current}
                      initial={{ opacity: 0, scale: 0.55 }}
                      animate={{ opacity: isPopped ? 0 : 1, scale: isPopped ? 1.45 : 1 }}
                      transition={{ duration: isPopped ? 0.28 : 0.35, delay: isPopped ? 0 : idx * 0.045 }}
                      whileHover={!isPopped ? { scale: 1.08 } : undefined}
                      whileTap={!isPopped ? { scale: 0.9 } : undefined}
                      aria-label={`Balloon with letter ${displayText(balloon.label)}`}
                      className="flex w-full flex-col items-center rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 disabled:pointer-events-none"
                    >
                      <span
                        className={`relative grid aspect-[0.86] w-full place-items-center rounded-[52%_52%_48%_48%] bg-gradient-to-br ${style.body} text-4xl font-black text-white shadow-xl ring-4 ring-white/80 md:text-5xl`}
                      >
                        <span className="absolute left-[22%] top-[16%] h-5 w-3 -rotate-12 rounded-full bg-white/45" aria-hidden="true" />
                        {displayText(balloon.label)}
                      </span>
                      <span className={`-mt-1 h-4 w-4 rotate-45 rounded-sm ${style.knot}`} aria-hidden="true" />
                      <span className={`h-10 w-0.5 ${style.string}`} aria-hidden="true" />
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>,
            document.body,
          )}

          <div className="relative z-20 mt-1 rounded-full bg-white px-5 py-2 text-base font-black text-purple-700 shadow-md" aria-live="polite">
            {poppedBalloonIds.size}/3 found
          </div>
        </div>
      )}

      {currentStep.mode === 'choice' && (
        <div
          className={`grid w-full ${
            isHearCheck
              ? 'max-w-3xl grid-cols-2 gap-4'
              : isTapSyllable
                ? 'max-w-2xl grid-cols-2 gap-5 md:gap-8'
                : 'max-w-4xl grid-cols-1 gap-4 md:grid-cols-2'
          }`}
        >
          {displayChoiceOptions.map((option, idx) => {
            const normalized = normalizeOption(option, wordImageMap);
            const syllableStyle = SYLLABLE_CHOICE_STYLES[idx % SYLLABLE_CHOICE_STYLES.length];
            return (
              <motion.button
                key={`${normalized.value}-${idx}`}
                onClick={() => handleChoice(normalized.value)}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + idx * 0.055, duration: 0.22 }}
                whileHover={isTapSyllable ? { y: -6, scale: 1.05, rotate: idx % 2 === 0 ? -1 : 1 } : { scale: 1.02 }}
                whileTap={{ scale: 0.94 }}
                aria-label={isHearCheck
                  ? (normalized.value.toLowerCase() === 'yes' ? 'Yes, correct' : 'No, incorrect')
                  : `Choose ${normalized.label}`}
                className={isTapSyllable
                  ? `relative isolate min-h-32 overflow-hidden rounded-[2rem] border-4 border-white/80 bg-gradient-to-br p-4 text-center shadow-2xl ${syllableStyle} md:min-h-40`
                  : `rounded-2xl border-4 border-transparent bg-white shadow-lg transition hover:border-blue-200 ${
                    isHearCheck ? 'flex min-h-32 items-center justify-center p-3 md:min-h-44' : 'p-4 text-left'
                  }`}
              >
                {isTapSyllable && (
                  <>
                    <span className="absolute -right-7 -top-9 -z-10 h-24 w-24 rounded-full bg-white/20" aria-hidden="true" />
                    <span className="absolute -bottom-10 -left-6 -z-10 h-28 w-28 rounded-full bg-white/15" aria-hidden="true" />
                    <span className="absolute left-5 top-5 h-3 w-3 rounded-full bg-white/70 shadow-[1.15rem_0_0_rgba(255,255,255,0.35)]" aria-hidden="true" />
                  </>
                )}
                {isHearCheck ? (
                  <span
                    className={`grid h-28 w-28 place-items-center rounded-full border-[6px] shadow-xl md:h-36 md:w-36 ${
                      normalized.value.toLowerCase() === 'yes'
                        ? 'border-green-600 bg-green-100 text-green-600'
                        : 'border-red-600 bg-red-100 text-red-600'
                    }`}
                    aria-hidden="true"
                  >
                    {normalized.value.toLowerCase() === 'yes' ? (
                      <Check className="h-20 w-20 md:h-28 md:w-28" strokeWidth={4.5} />
                    ) : (
                      <X className="h-20 w-20 md:h-28 md:w-28" strokeWidth={4.5} />
                    )}
                  </span>
                ) : normalized.image ? (
                  <img
                    src={assetUrl(normalized.image)}
                    alt={normalized.label}
                    onError={handleImageError}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className="mb-3 h-28 w-full rounded-xl object-contain bg-gray-50 p-2 md:h-36"
                  />
                ) : null}
                {!isHearCheck && (
                  <p className={`text-center font-black ${isTapSyllable ? 'text-4xl text-white drop-shadow-md md:text-5xl' : 'text-2xl text-gray-800'}`}>
                    {displayText(normalized.label)}
                  </p>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
