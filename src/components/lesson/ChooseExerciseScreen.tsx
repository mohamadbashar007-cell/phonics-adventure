import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Volume2, Loader2 } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { soundEffects } from '../../services/soundEffects';
import { handleImageError } from '../../utils/imagePaths';
import { preloadImages } from '../../utils/preloadImages';
import { assetUrl } from '../../utils/assetUrl';
import { celebrateCorrectAnswer } from '../../utils/correctAnswerCelebration';

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
  const announcedPromptRef = useRef('');

  const chooseData = letter.choose || exercise;
  const options = chooseData?.options ?? [];
  const shuffledOptions = useMemo(() => {
    const arr = options?.map((opt: any) => ({ ...opt })) ?? [];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [options, letter?.id, exerciseNumber]);
  const formatQuestionText = (value: string) => (preserveLetterCase ? value : value.toLowerCase());
  const displayLetter = preserveLetterCase ? letter.letter : String(letter.letter || '').toLowerCase();
  const prompt = `"${displayLetter}" for:`;
  const announcementKey = `${letter.id}-${exerciseNumber}-${prompt}`;
  const hasData = options.length > 0;

  useEffect(() => {
    preloadImages(options.map((option: any) => option.image), { priority: true });
  }, [options]);

  useEffect(() => {
    setSelected(null);
    setFeedback(null);
  }, [letter.id, exerciseNumber]);

  const handlePlaySound = async () => {
    if (isLoading || feedback !== null) return;

    setIsLoading(true);
    try {
      await audioService.speak(prompt);
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
      <div className="mb-8">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full max-w-4xl">
        {shuffledOptions.map((option: any, index: number) => (
          <motion.button
            key={index}
            whileHover={feedback?.type !== 'success' ? { scale: 1.05 } : {}}
            whileTap={feedback?.type !== 'success' ? { scale: 0.95 } : {}}
            onClick={() => handleSelect(index, option)}
            disabled={feedback?.type === 'success'}
            aria-label={`Choose ${option.word}`}
            className={`relative p-4 rounded-3xl shadow-xl transition-all border-4 ${
              selected === index
                ? feedback === null
                  ? 'bg-blue-100 border-blue-500'
                  : option.isCorrect
                  ? 'bg-green-100 border-green-500'
                  : 'bg-red-100 border-red-500'
                : 'bg-white border-transparent hover:border-blue-200'
            }`}
          >
            <img
              src={assetUrl(option.image)}
              alt={option.word}
              onError={handleImageError}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full h-36 md:h-44 object-contain rounded-2xl p-2"
            />

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
            {feedback && (
              <div
                role="status"
                className={`flex items-center gap-2 rounded-full px-8 py-3 text-2xl font-black text-white shadow-lg ${
                  feedback.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                }`}
              >
                {feedback.type === 'success' ? <Check size={30} /> : <X size={30} />}
                {feedback.text}
              </div>
            )}

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
