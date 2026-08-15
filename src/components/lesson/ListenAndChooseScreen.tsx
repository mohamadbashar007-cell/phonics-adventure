import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Check, X } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { soundEffects } from '../../services/soundEffects';
import { getImageSourceCandidates, getVocabularyImagePath } from '../../utils/imagePaths';
import { preloadImages } from '../../utils/preloadImages';
import { assetUrl } from '../../utils/assetUrl';
import { celebrateCorrectAnswer } from '../../utils/correctAnswerCelebration';
import FeedbackToast from './FeedbackToast';

const serializeOptions = (options: any[] = []) =>
  options.map((opt) => `${opt?.word ?? ''}|${opt?.image ?? ''}|${opt?.isCorrect ? '1' : '0'}`).join('__');

const shuffleOptions = (options: any[] = []) => {
  const arr = options?.map((opt) => ({ ...opt })) ?? [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const rotateOptions = (options: any[] = []) => {
  if (!options.length) return options;
  return [...options.slice(1), options[0]];
};

function ListenChoiceImage({ option }: { option: any }) {
  const sources = useMemo(
    () => getImageSourceCandidates(getVocabularyImagePath(option.word), option.image),
    [option.image, option.word]
  );
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [option.image, option.word]);

  return (
    <img
      src={assetUrl(sources[sourceIndex])}
      alt=""
      aria-hidden="true"
      onError={() => setSourceIndex((index) => Math.min(index + 1, sources.length - 1))}
      loading="eager"
      fetchPriority="high"
      decoding="async"
      className="h-[clamp(6rem,24vw,12rem)] w-full rounded-2xl object-contain p-1 sm:p-2"
    />
  );
}

interface ListenAndChooseScreenProps {
  letter: any;
  onComplete: (stars: number) => void;
}

export default function ListenAndChooseScreen({ letter, onComplete }: ListenAndChooseScreenProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const autoplayTimeoutRef = useRef<number | null>(null);

  const listeningSet = (letter.listening || []).slice(0, 3);

  const processedQuestions = useMemo(() => {
    const prepared =
      listeningSet?.map((question: any) => {
        const baseOptions = question?.options ?? [];
        return {
          ...question,
          baseSignature: serializeOptions(baseOptions),
          displayOptions: shuffleOptions(baseOptions),
        };
      }) ?? [];

    let start = 0;
    while (start < prepared.length) {
      const signature = prepared[start]?.baseSignature;
      if (!signature) {
        start += 1;
        continue;
      }

      let end = start + 1;
      while (end < prepared.length && prepared[end]?.baseSignature === signature) {
        end += 1;
      }

      if (end - start >= 3) {
        for (let offset = 1; offset < end - start; offset++) {
          const idx = start + offset;
          let nextOptions = prepared[idx].displayOptions.slice();
          const prevSignature = serializeOptions(prepared[idx - 1].displayOptions);
          let guard = 0;
          while (serializeOptions(nextOptions) === prevSignature && guard < nextOptions.length) {
            nextOptions = rotateOptions(nextOptions);
            guard += 1;
          }
          prepared[idx] = {
            ...prepared[idx],
            displayOptions: nextOptions,
          };
        }
      }

      start = end;
    }

    return prepared;
  }, [listeningSet]);

  const currentQuestion = processedQuestions[questionIndex];
  const options = currentQuestion?.displayOptions ?? [];
  const hasData = processedQuestions.length > 0 && options.length > 0;

  const handlePlaySound = async () => {
    if (isLoading || feedback !== null || !currentQuestion) return;

    setIsLoading(true);
    try {
      await audioService.playPrompt(currentQuestion.audioText || currentQuestion.word);
    } catch (error) {
      console.error('Audio service error in ListenAndChooseScreen:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = async (index: number, correct: boolean) => {
    if (selected !== null || feedback !== null) return;
    setSelected(index);

    if (correct) {
      setFeedback({ type: 'success', text: 'Excellent! \u{1F389}' });
      soundEffects.playCelebration();
      celebrateCorrectAnswer();
      void audioService.playPrompt('Excellent!');

      setTimeout(() => {
        if (questionIndex < processedQuestions.length - 1) {
          setQuestionIndex((prev) => prev + 1);
          setSelected(null);
          setFeedback(null);
        } else {
          onComplete(1);
        }
      }, 1200);
    } else {
      setFeedback({ type: 'error', text: 'Try Again! \u{1F4AA}' });
      soundEffects.playError();
      void audioService.playPrompt('Try Again');

      setTimeout(() => {
        setSelected(null);
        setFeedback(null);
      }, 1500);
    }
  };

  useEffect(() => {
    if (!currentQuestion) return;
    preloadImages(
      options.flatMap((option) => [getVocabularyImagePath(option.word), option.image]),
      { priority: true }
    );
    preloadImages(
      processedQuestions[questionIndex + 1]?.displayOptions?.flatMap((option: any) => [
        getVocabularyImagePath(option.word),
        option.image,
      ]) ?? []
    );
    audioService.preloadPromptAudio(currentQuestion.audioText || currentQuestion.word);
    const nextQuestion = processedQuestions[questionIndex + 1];
    audioService.preloadPromptAudio(nextQuestion?.audioText || nextQuestion?.word);
    if (autoplayTimeoutRef.current) {
      window.clearTimeout(autoplayTimeoutRef.current);
    }
    autoplayTimeoutRef.current = window.setTimeout(() => {
      handlePlaySound();
    }, 300);
    return () => {
      if (autoplayTimeoutRef.current) {
        window.clearTimeout(autoplayTimeoutRef.current);
      }
    };
  }, [questionIndex, currentQuestion, options, processedQuestions]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-2xl text-gray-500">No listening activity available for this letter.</p>
        <button onClick={() => onComplete(0)} className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-full">
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 md:p-8 text-center relative">
      <FeedbackToast feedback={feedback} />

      <h2 className="mb-4 text-2xl font-black text-gray-800 md:mb-8 md:text-4xl">Listen and choose the right one!</h2>

      <AnimatePresence mode="wait">
        <motion.div
          key={questionIndex}
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.95 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="flex flex-col items-center w-full"
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handlePlaySound}
            disabled={isLoading || feedback !== null}
            className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full shadow-2xl transition-colors md:mb-12 md:h-32 md:w-32 ${
              isLoading ? 'bg-blue-400 text-white animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Volume2 className={`h-10 w-10 md:h-16 md:w-16 ${isLoading ? 'animate-pulse' : ''}`} />
          </motion.button>

          <div className="grid w-full max-w-4xl grid-cols-3 gap-2 sm:gap-4 md:gap-6">
            {options.map((option, index) => (
              <motion.button
                key={index}
                aria-label={`Choose ${option.word}`}
                whileHover={selected === null ? { scale: 1.05 } : {}}
                whileTap={selected === null ? { scale: 0.95 } : {}}
                onClick={() => handleSelect(index, option.isCorrect)}
                disabled={feedback !== null}
                className={`relative p-4 rounded-3xl shadow-lg transition-all border-4 ${
                  selected === index
                    ? option.isCorrect
                      ? 'bg-green-100 border-green-500'
                      : 'bg-red-100 border-red-500'
                    : 'bg-white border-transparent hover:border-blue-200'
                }`}
              >
                <ListenChoiceImage option={option} />

                {selected === index && (
                  <div className="absolute top-2 right-2 p-1 rounded-full bg-white shadow-md">
                    {option.isCorrect ? <Check className="text-green-500" size={20} /> : <X className="text-red-500" size={20} />}
                  </div>
                )}
              </motion.button>
            ))}
          </div>

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
