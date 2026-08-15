import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Volume2, Loader2 } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { soundEffects } from '../../services/soundEffects';
import { handleImageError } from '../../utils/imagePaths';
import { preloadImages } from '../../utils/preloadImages';
import { assetUrl } from '../../utils/assetUrl';
import { celebrateCorrectAnswer } from '../../utils/correctAnswerCelebration';
import FeedbackToast from './FeedbackToast';
import { formatInitialSoundCharacters, startsWithInitialSoundCharacter } from '../../utils/initialSound';

interface ChooseExerciseScreenProps {
  letter: any;
  exercise: any;
  exerciseNumber: number;
  preserveLetterCase?: boolean;
  onComplete: (stars: number) => void;
}

export default function ChooseExerciseScreen({
  letter,
  exercise,
  exerciseNumber,
  preserveLetterCase = false,
  onComplete,
}: ChooseExerciseScreenProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const announcedPromptRef = useRef('');

  const chooseData = letter.choose || exercise;
  const quizQuestions = useMemo<any[]>(() => {
    if (!String(letter.id || '').startsWith('capital-')) {
      const target = letter.letter || letter.id;
      const sourceOptions = chooseData?.options ?? [];
      const validCorrectOption = sourceOptions.find(
        (option: any) => option?.isCorrect && startsWithInitialSoundCharacter(option.word, target),
      );

      if (validCorrectOption) {
        return [{ target, options: sourceOptions }];
      }

      const reviewSounds = (letter.activities || [])
        .filter((activity: any) => activity?.type === 'REVISION')
        .flatMap((activity: any) => activity?.sounds || [])
        .map((sound: string) => String(sound).trim())
        .filter((sound: string) => sound && sound.toLowerCase() !== String(target).toLowerCase());
      const distractors = Array.from(new Set(reviewSounds)).slice(-2);

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
      const correct = vocabulary.find((item: any) => startsWithInitialSoundCharacter(item.word, target))
        || vocabulary.find((item: any) => String(item.word).toUpperCase().includes(target));
      const distractorPool = vocabulary.filter(
        (item: any) => !startsWithInitialSoundCharacter(item.word, target) && item.word !== correct?.word,
      );
      const rotatedDistractors = distractorPool.length
        ? [...distractorPool.slice(targetIndex % distractorPool.length), ...distractorPool.slice(0, targetIndex % distractorPool.length)]
        : [];

      return {
        target,
        options: correct
          ? [
              { ...correct, isCorrect: true },
              ...rotatedDistractors.slice(0, 2).map((item: any) => ({ ...item, isCorrect: false })),
            ]
          : [],
      };
    }).filter((question: any) => question.options.length > 0).slice(0, 3);
  }, [chooseData?.options, letter.id, letter.letter, letter.vocabulary]);
  const currentQuestion = quizQuestions[Math.min(questionIndex, quizQuestions.length - 1)];
  const options = currentQuestion?.options ?? [];
  const shuffledOptions = useMemo(() => {
    const arr = options?.map((opt: any) => ({ ...opt })) ?? [];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [options, letter?.id, exerciseNumber, questionIndex]);
  const formatQuestionText = (value: string) => (preserveLetterCase ? value : value.toLowerCase());
  const displayLetter = formatInitialSoundCharacters(currentQuestion?.target || letter.letter || letter.id, preserveLetterCase);
  const prompt = currentQuestion?.letterOnly ? `Choose the letter ${displayLetter}` : `${displayLetter} for:`;
  const announcementKey = `${letter.id}-${exerciseNumber}-${questionIndex}-${prompt}`;
  const hasData = options.length > 0;

  useEffect(() => {
    preloadImages(
      [
        ...options.map((option: any) => option.image),
        ...(quizQuestions[questionIndex + 1]?.options || []).map((option: any) => option.image),
      ],
      { priority: true },
    );
  }, [options, questionIndex, quizQuestions]);

  useEffect(() => {
    setSelected(null);
    setFeedback(null);
    setQuestionIndex(0);
  }, [letter.id, exerciseNumber]);

  const handlePlaySound = async () => {
    if (isLoading || feedback !== null) return;

    setIsLoading(true);
    try {
      await audioService.playPrompt(prompt);
    } catch (error) {
      console.error('Audio service error in ChooseExerciseScreen:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!prompt || announcedPromptRef.current === announcementKey) return;

    const timeoutId = window.setTimeout(() => {
      announcedPromptRef.current = announcementKey;
      void handlePlaySound();
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [announcementKey]);

  const handleSelect = async (index: number, option: any) => {
    if (feedback?.type === 'success') return;
    setFeedback(null);
    setSelected(index);

    try {
      await audioService.playPrompt(option.word);
    } catch (error) {
      console.error('Audio service error while reading an answer:', error);
    }
  };

  const selectedOption = selected === null ? null : shuffledOptions[selected];

  const handleContinue = () => {
    if (!selectedOption) return;

    if (!feedback) {
      if (selectedOption.isCorrect) {
        setFeedback({ type: 'success', text: formatQuestionText('Correct!') });
        soundEffects.playCelebration();
        celebrateCorrectAnswer();
      } else {
        setFeedback({ type: 'error', text: formatQuestionText('Incorrect!') });
        soundEffects.playError();
      }
      return;
    }

    if (feedback.type === 'error') return;

    if (questionIndex < quizQuestions.length - 1) {
      setQuestionIndex((index) => index + 1);
      setSelected(null);
      setFeedback(null);
      return;
    }

    onComplete(1);
  };

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-4 text-center">
        <p className="text-2xl text-gray-500">No choose activity available for this letter.</p>
        <button onClick={() => onComplete(0)} className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-full">
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 md:p-8 text-center relative">
      <FeedbackToast feedback={feedback} />
      <div className="mb-4 md:mb-8">
        <div className="flex items-center justify-center gap-4">
          <h2 className="text-2xl md:text-4xl font-black text-gray-800">{prompt}</h2>
          <button
            onClick={handlePlaySound}
            disabled={isLoading || feedback !== null}
            className={`p-2 md:p-3 rounded-full transition-colors ${
              isLoading ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
            }`}
          >
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Volume2 size={24} />}
          </button>
        </div>
        {quizQuestions.length > 1 && (
          <p className="mt-3 text-sm font-black text-indigo-500">
            Question {questionIndex + 1} of {quizQuestions.length}
          </p>
        )}
      </div>

      <div className="grid w-full max-w-4xl grid-cols-3 gap-2 sm:gap-4 md:gap-6">
        {shuffledOptions.map((option: any, index: number) => (
          <motion.button
            key={index}
            whileHover={feedback?.type !== 'success' ? { scale: 1.05 } : {}}
            whileTap={feedback?.type !== 'success' ? { scale: 0.95 } : {}}
            onClick={() => handleSelect(index, option)}
            disabled={feedback?.type === 'success'}
            aria-label={`Choose ${option.word}`}
            className={`relative rounded-2xl border-4 p-2 shadow-xl transition-all sm:rounded-3xl sm:p-4 ${
              selected === index
                ? feedback === null
                  ? 'bg-blue-100 border-blue-500'
                  : option.isCorrect
                  ? 'bg-green-100 border-green-500'
                  : 'bg-red-100 border-red-500'
                : 'bg-white border-transparent hover:border-blue-200'
            }`}
          >
            {currentQuestion?.letterOnly ? (
              <span className="grid h-[clamp(6rem,24vw,11rem)] place-items-center text-5xl font-black text-indigo-700 sm:text-7xl md:text-8xl">
                {option.word}
              </span>
            ) : (
              <img
                src={assetUrl(option.image)}
                alt={option.word}
                onError={handleImageError}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="h-[clamp(6rem,24vw,11rem)] w-full rounded-2xl object-contain p-1 sm:p-2"
              />
            )}

            {selected === index && feedback && (
              <div className="absolute top-4 right-4 p-2 rounded-full bg-white shadow-md">
                {option.isCorrect ? (
                  <Check className="text-green-500" size={32} />
                ) : (
                  <X className="text-red-500" size={32} />
                )}
              </div>
            )}
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selectedOption && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="mt-8 flex flex-col items-center gap-4"
          >
            {feedback?.type !== 'error' && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleContinue}
                className="rounded-full bg-blue-600 px-12 py-4 text-2xl font-black text-white shadow-xl transition-colors hover:bg-blue-700"
              >
                Continue
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
