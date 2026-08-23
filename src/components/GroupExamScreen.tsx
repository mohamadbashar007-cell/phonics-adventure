import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Volume2, X } from 'lucide-react';
import { audioService } from '@/services/audioService';
import { soundEffects } from '@/services/soundEffects';
import { handleImageError } from '@/utils/imagePaths';
import { preloadImages } from '@/utils/preloadImages';
import { assetUrl } from '@/utils/assetUrl';
import { celebrateCorrectAnswer } from '@/utils/correctAnswerCelebration';
import { formatHearCheckSound, playHearCheckAudio, preloadHearCheckAudio } from '@/utils/hearCheckAudio';
import FeedbackToast from './lesson/FeedbackToast';
import { startsWithInitialSoundCharacter, wordHasSound } from '@/utils/initialSound';

interface GroupExamScreenProps {
  groupId: number;
  group: any;
  onComplete: (score: number) => void;
  onExit: () => void;
}

type ExamQuestionType = 'listen-image' | 'picture-letter' | 'hear-check' | 'sound-letter' | 'blend';

type ExamOption = {
  value: string;
  label: string;
  image?: string;
  tone?: 'yes' | 'no';
};

type ExamQuestion = {
  id: string;
  type: ExamQuestionType;
  prompt: string;
  audioText?: string;
  hearCheckSound?: string;
  image?: string;
  options: ExamOption[];
  correctOptionIndex: number;
};

const TEXT_OPTION_STYLES = [
  'from-violet-500 via-purple-500 to-fuchsia-500 shadow-purple-300/50',
  'from-sky-400 via-cyan-500 to-blue-600 shadow-cyan-300/50',
  'from-amber-400 via-orange-500 to-rose-500 shadow-orange-300/50',
  'from-emerald-400 via-teal-500 to-cyan-600 shadow-emerald-300/50',
];

function uniqueByValue(options: ExamOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = option.value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shuffleQuestionOptions(options: ExamOption[], correctValue: string) {
  const shuffled = [...options];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return { options: shuffled, correctOptionIndex: shuffled.findIndex((option) => option.value === correctValue) };
}

function letterOptions(group: any, currentLetter: any, offset: number) {
  const letters = group.letters || [];
  const currentIndex = letters.findIndex((letter: any) => letter.id === currentLetter.id);
  const candidates = [
    currentLetter,
    letters[(currentIndex + 1 + offset) % letters.length],
    letters[(currentIndex + 2 + offset) % letters.length],
  ];
  return uniqueByValue(candidates.map((letter: any) => ({
    value: letter.id,
    label: letter.letter,
  }))).slice(0, 3);
}

function makeListenImageQuestion(letter: any, index: number): ExamQuestion | null {
  const listeningItems = letter.listening || [];
  const item = listeningItems[index % Math.max(1, listeningItems.length)];
  if (!item?.options?.length) return null;

  const correctOption = item.options.find((option: any) => option.isCorrect) || item.options[0];
  const prepared = shuffleQuestionOptions(
    item.options.map((option: any) => ({ value: option.word, label: option.word, image: option.image })),
    correctOption.word,
  );
  return {
    id: `${letter.id}-listen-${index}`,
    type: 'listen-image',
    prompt: 'Listen and choose the picture',
    audioText: item.audioText || item.word,
    ...prepared,
  };
}

function makePictureLetterQuestion(group: any, letter: any, index: number): ExamQuestion | null {
  const lessonSound = letter.letter || letter.id;
  const item = (letter.vocabulary || []).find(
    (option: any) => wordHasSound(option.word, lessonSound),
  );
  if (!item?.image) return null;

  const prepared = shuffleQuestionOptions(letterOptions(group, letter, index), letter.id);
  return {
    id: `${letter.id}-picture-letter-${index}`,
    type: 'picture-letter',
    prompt: 'Which sound matches the picture?',
    audioText: item.word,
    image: item.image,
    ...prepared,
  };
}

function makeHearCheckQuestion(letter: any, index: number): ExamQuestion | null {
  const target = letter.letter || letter.id;
  const isCapitalLesson = String(letter.id || '').startsWith('capital-');
  const matchesLessonSound = (word: string) => isCapitalLesson
    ? startsWithInitialSoundCharacter(word, target)
    : wordHasSound(word, target);
  const vocabulary = letter.vocabulary || [];
  const falseWord = [
    ...(letter.choose?.options || []).map((option: any) => option?.word),
    'cat', 'dog', 'sun', 'fish', 'bed', 'pen',
  ].find((word: string) => word && !matchesLessonSound(word));
  const candidates = [vocabulary[0]?.word, falseWord, vocabulary[1]?.word].filter(Boolean);
  const item = candidates[index % candidates.length];
  if (!item) return null;

  const correctValue = matchesLessonSound(item) ? 'yes' : 'no';
  const prepared = shuffleQuestionOptions([
    { value: 'yes', label: 'Yes', tone: 'yes' },
    { value: 'no', label: 'No', tone: 'no' },
  ], correctValue);
  return {
    id: `${letter.id}-hear-${index}`,
    type: 'hear-check',
    prompt: `Can you hear ${formatHearCheckSound(target)} in ...?`,
    audioText: item,
    hearCheckSound: target,
    ...prepared,
  };
}

function makeSoundLetterQuestion(group: any, letter: any, index: number): ExamQuestion | null {
  const options = letterOptions(group, letter, index + 1);
  if (options.length < 2) return null;
  const prepared = shuffleQuestionOptions(options, letter.id);
  return {
    id: `${letter.id}-sound-letter-${index}`,
    type: 'sound-letter',
    prompt: 'Listen and tap the matching sound',
    audioText: letter.letter || letter.id,
    ...prepared,
  };
}

function getBlendItems(group: any) {
  return (group.letters || []).flatMap((letter: any) =>
    (letter.activities || [])
      .filter((activity: any) => activity.type === 'BLEND')
      .flatMap((activity: any) => activity.items || []),
  );
}

function makeBlendQuestion(group: any, letter: any, index: number): ExamQuestion | null {
  const letterBlendItems = (letter.activities || [])
    .filter((activity: any) => activity.type === 'BLEND')
    .flatMap((activity: any) => activity.items || []);
  const target = letterBlendItems[index % Math.max(1, letterBlendItems.length)];
  if (!target?.result) return null;

  const normalizedTarget = target.result.toLowerCase();
  const pairedDistractor = normalizedTarget === 'sat'
    ? 'pat'
    : normalizedTarget === 'pan'
      ? 'nip'
      : normalizedTarget === 'nip'
        ? 'pan'
        : null;
  const distractors = getBlendItems(group)
    .filter((item: any) => {
      const result = String(item?.result || '').toLowerCase();
      return pairedDistractor ? result === pairedDistractor : result && result !== normalizedTarget;
    })
    .slice(pairedDistractor ? 0 : index, pairedDistractor ? 1 : index + 4)
    .map((item: any) => ({ value: item.result, label: item.result }));
  const options = uniqueByValue([{ value: target.result, label: target.result }, ...distractors])
    .slice(0, pairedDistractor ? 2 : 3);
  if (options.length < 2) return null;

  const prepared = shuffleQuestionOptions(options, target.result);
  return {
    id: `${letter.id}-blend-${index}`,
    type: 'blend',
    prompt: 'Listen and choose the word',
    audioText: target.result,
    ...prepared,
  };
}

type QuestionBuilder = (group: any, letter: any, index: number) => ExamQuestion | null;

const QUESTION_BUILDERS: QuestionBuilder[] = [
  (_group, letter, index) => makeListenImageQuestion(letter, index),
  (group, letter, index) => makePictureLetterQuestion(group, letter, index),
  (_group, letter, index) => makeHearCheckQuestion(letter, index),
  (group, letter, index) => makeSoundLetterQuestion(group, letter, index),
  (group, letter, index) => makeBlendQuestion(group, letter, index),
];

const QUESTION_TYPE_ORDER: ExamQuestionType[] = [
  'listen-image',
  'picture-letter',
  'hear-check',
  'sound-letter',
  'blend',
];

export function buildExamQuestions(group: any): ExamQuestion[] {
  const letters = group?.letters || [];
  if (!letters.length) return [];

  const questions: ExamQuestion[] = [];
  const addQuestion = (question: ExamQuestion | null) => {
    if (!question || question.correctOptionIndex < 0 || questions.some((item) => item.id === question.id)) return false;
    questions.push(question);
    return true;
  };

  letters.forEach((letter: any, index: number) => {
    const preferredBuilder = QUESTION_BUILDERS[index % QUESTION_BUILDERS.length];
    const preferred = preferredBuilder(group, letter, index);
    if (addQuestion(preferred)) return;
    addQuestion(makeListenImageQuestion(letter, index));
  });

  const desiredCount = Math.min(12, Math.max(8, letters.length * 2));
  let attempt = 0;
  while (questions.length < desiredCount && attempt < desiredCount * 4) {
    const letterIndex = attempt % letters.length;
    const letter = letters[letterIndex];
    const builderIndex = (letterIndex + Math.floor(attempt / letters.length) + 2) % QUESTION_BUILDERS.length;
    const builder = QUESTION_BUILDERS[builderIndex];
    const variant = attempt + letters.length;
    const question = builder(group, letter, variant);
    if (!addQuestion(question)) addQuestion(makeListenImageQuestion(letter, variant));
    attempt += 1;
  }

  return [...questions].sort(
    (left, right) => QUESTION_TYPE_ORDER.indexOf(left.type) - QUESTION_TYPE_ORDER.indexOf(right.type),
  );
}

export default function GroupExamScreen({ groupId, group, onComplete, onExit }: GroupExamScreenProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const autoplayRef = useRef<number | null>(null);
  const audioPlaybackRequestRef = useRef(0);
  const examQuestions = useMemo(() => buildExamQuestions(group), [group]);
  const currentQuestion = examQuestions[currentQuestionIndex];

  const playQuestionAudio = (question: ExamQuestion) => {
    if (!question.audioText) return;

    const requestId = audioPlaybackRequestRef.current + 1;
    audioPlaybackRequestRef.current = requestId;
    const isCurrentRequest = () => audioPlaybackRequestRef.current === requestId;
    const playback = question.type === 'hear-check' && question.hearCheckSound
      ? playHearCheckAudio(question.hearCheckSound, question.audioText, isCurrentRequest)
      : audioService.playPrompt(question.audioText);

    void playback.catch((error) => {
      if (!isCurrentRequest()) return;
      console.error('Exam audio playback failed:', error);
      audioService.stop();
    });
  };

  useEffect(() => {
    if (!currentQuestion) return;
    audioPlaybackRequestRef.current += 1;
    audioService.stop();
    audioService.warmup();
    const nextQuestion = examQuestions[currentQuestionIndex + 1];
    preloadImages(
      [
        currentQuestion.image,
        ...currentQuestion.options.map((option) => option.image),
        nextQuestion?.image,
        ...(nextQuestion?.options || []).map((option) => option.image),
      ].filter((image): image is string => Boolean(image)),
      { priority: true },
    );
    if (currentQuestion.type === 'hear-check' && currentQuestion.hearCheckSound && currentQuestion.audioText) {
      preloadHearCheckAudio(currentQuestion.hearCheckSound, currentQuestion.audioText);
    } else if (currentQuestion.audioText) {
      audioService.preloadPromptAudio(currentQuestion.audioText);
    }
    if (nextQuestion?.type === 'hear-check' && nextQuestion.hearCheckSound && nextQuestion.audioText) {
      preloadHearCheckAudio(nextQuestion.hearCheckSound, nextQuestion.audioText);
    } else if (nextQuestion?.audioText) {
      audioService.preloadPromptAudio(nextQuestion.audioText);
    }

    if (autoplayRef.current) window.clearTimeout(autoplayRef.current);
    if (currentQuestion.audioText) {
      autoplayRef.current = window.setTimeout(() => {
        playQuestionAudio(currentQuestion);
      }, 350);
    }
    return () => {
      if (autoplayRef.current) window.clearTimeout(autoplayRef.current);
      audioPlaybackRequestRef.current += 1;
      audioService.stop();
    };
  }, [currentQuestion, currentQuestionIndex, examQuestions]);

  if (!group || !currentQuestion) {
    return (
      <div className="grid min-h-dvh place-items-center bg-indigo-50 p-6 text-center">
        <div>
          <p className="text-2xl font-black text-indigo-900">No exam questions available.</p>
          <button onClick={onExit} className="mt-5 rounded-full bg-indigo-600 px-7 py-3 font-black text-white">Back</button>
        </div>
      </div>
    );
  }

  const isCorrect = selectedAnswer === currentQuestion.correctOptionIndex;
  const displayText = (value: string) => groupId === 7 ? value : value.toLowerCase();

  const handleAnswerSelect = (optionIndex: number) => {
    if (answered) return;
    soundEffects.playClick();
    setSelectedAnswer(optionIndex);
    setAnswered(true);
    const answerIsCorrect = optionIndex === currentQuestion.correctOptionIndex;
    const nextCorrectAnswers = correctAnswers + (answerIsCorrect ? 1 : 0);

    if (answerIsCorrect) {
      soundEffects.playSuccess();
      celebrateCorrectAnswer();
      setCorrectAnswers(nextCorrectAnswers);
    } else {
      soundEffects.playError();
    }

    window.setTimeout(() => {
      if (currentQuestionIndex < examQuestions.length - 1) {
        setCurrentQuestionIndex((index) => index + 1);
        setSelectedAnswer(null);
        setAnswered(false);
      } else {
        onComplete(Math.round((nextCorrectAnswers / examQuestions.length) * 100));
      }
    }, 1400);
  };

  const playAudio = () => {
    playQuestionAudio(currentQuestion);
  };

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 p-4 md:p-7">
      <FeedbackToast
        feedback={answered ? {
          type: isCorrect ? 'success' : 'error',
          text: isCorrect ? 'Excellent! 🎉' : 'Try Again ❌',
        } : null}
      />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Group {groupId}</p>
          <h1 className="text-2xl font-black text-indigo-900 md:text-3xl">Final Challenge</h1>
        </div>
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit exam"
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-xl font-black text-slate-600 shadow-lg hover:text-red-500"
        >
          ×
        </button>
      </header>

      <div className="mx-auto mt-4 flex w-full max-w-5xl gap-1.5" aria-label="Exam progress">
        {examQuestions.map((question, index) => (
          <span
            key={question.id}
            className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
              index < currentQuestionIndex ? 'bg-emerald-400' : index === currentQuestionIndex ? 'bg-indigo-600' : 'bg-white'
            }`}
          />
        ))}
      </div>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center py-5">
        <AnimatePresence mode="wait">
          <motion.section
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 80, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -80, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            data-question-type={currentQuestion.type}
            className="w-full rounded-[2.5rem] border-4 border-white/90 bg-white/80 p-5 text-center shadow-2xl backdrop-blur md:p-8"
          >
            <h2 className="text-2xl font-black text-slate-800 md:text-4xl">{displayText(currentQuestion.prompt)}</h2>

            <div className="mt-5 flex items-center justify-center gap-4">
              {currentQuestion.audioText && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.08, rotate: -3 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={playAudio}
                  aria-label="Play sound"
                  className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 text-white shadow-xl"
                >
                  <Volume2 size={36} />
                </motion.button>
              )}

              {currentQuestion.image && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={playAudio}
                  aria-label={`Play ${currentQuestion.audioText || 'picture'}`}
                  className="relative rounded-3xl border-4 border-white bg-white p-3 shadow-xl"
                >
                  <img
                    src={assetUrl(currentQuestion.image)}
                    alt=""
                    className="h-32 w-36 object-contain md:h-40 md:w-44"
                    onError={handleImageError}
                  />
                  <Volume2 className="absolute bottom-2 right-2 rounded-full bg-indigo-600 p-1 text-white" size={25} />
                </motion.button>
              )}
            </div>

            <div className={`mx-auto mt-7 grid gap-4 md:gap-6 ${
              currentQuestion.options.length === 2 ? 'max-w-2xl grid-cols-2' : 'max-w-4xl grid-cols-3'
            }`}>
              {currentQuestion.options.map((option, index) => {
                const selected = selectedAnswer === index;
                const optionIsCorrect = index === currentQuestion.correctOptionIndex;
                const toneStyle = option.tone === 'yes'
                  ? 'border-emerald-300 bg-emerald-100 text-emerald-600'
                  : 'border-rose-300 bg-rose-100 text-rose-600';
                const textStyle = TEXT_OPTION_STYLES[index % TEXT_OPTION_STYLES.length];
                const baseOptionStyle = option.tone
                  ? toneStyle
                  : option.image
                    ? 'border-white bg-white'
                    : `border-white/80 bg-gradient-to-br ${textStyle}`;

                return (
                  <motion.button
                    key={`${option.value}-${index}`}
                    type="button"
                    initial={{ opacity: 0, y: 24, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: selected ? 1.04 : 1 }}
                    transition={{ delay: index * 0.09, type: 'spring', stiffness: 280, damping: 22 }}
                    whileHover={!answered ? { y: -7, scale: 1.04 } : undefined}
                    whileTap={!answered ? { scale: 0.94 } : undefined}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={answered}
                    aria-label={`Choose ${option.label}`}
                    className={`relative min-h-32 overflow-hidden rounded-[2rem] border-4 shadow-xl transition-colors md:min-h-40 ${baseOptionStyle} ${
                      selected
                        ? optionIsCorrect ? '!border-emerald-400 ring-4 ring-emerald-200' : '!border-red-400 ring-4 ring-red-200'
                        : ''
                    }`}
                  >
                    {option.image ? (
                      <img
                        src={assetUrl(option.image)}
                        alt={option.label}
                        onError={handleImageError}
                        className="h-32 w-full object-contain p-3 md:h-40"
                        loading="eager"
                        decoding="async"
                      />
                    ) : option.tone ? (
                      <span className="grid min-h-32 place-items-center md:min-h-40">
                        {option.tone === 'yes' ? <Check size={78} strokeWidth={4} /> : <X size={78} strokeWidth={4} />}
                      </span>
                    ) : (
                      <span className="grid min-h-32 place-items-center px-2 text-2xl font-black text-white drop-shadow-md sm:text-4xl md:min-h-40 md:px-3 md:text-5xl">
                        {displayText(option.label)}
                      </span>
                    )}

                    {selected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-white shadow-lg ${
                          optionIsCorrect ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      >
                        {optionIsCorrect ? <Check size={25} strokeWidth={4} /> : <X size={25} strokeWidth={4} />}
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
}
