import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Loader2, Mic } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { soundEffects } from '../../services/soundEffects';
import { pronunciationService } from '../../services/pronunciationService';
import { handleImageError } from '../../utils/imagePaths';
import { assetUrl } from '../../utils/assetUrl';
import { getVocabularyAudioPath } from '../../utils/audioPaths';
import { preloadImages } from '../../utils/preloadImages';
import { celebrateCorrectAnswer } from '../../utils/correctAnswerCelebration';
import FeedbackToast from './FeedbackToast';

interface VocabularyScreenProps {
  letter: any;
  preserveLetterCase?: boolean;
  onComplete: (stars: number) => void;
}

type FeedbackState =
  | { type: 'success'; text: string }
  | { type: 'warning'; text: string }
  | { type: 'error'; text: string }
  | null;

export default function VocabularyScreen({ letter, preserveLetterCase = false, onComplete }: VocabularyScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const [isSkipped, setIsSkipped] = useState(false);
  const [completedWords, setCompletedWords] = useState<Set<number>>(new Set());
  const [skippedWords, setSkippedWords] = useState<Set<number>>(new Set());

  const vocab = useMemo(() => letter.vocabulary || [], [letter.vocabulary]);
  const currentItem = useMemo(() => vocab[currentIndex], [vocab, currentIndex]);
  const targetWord = currentItem?.word ?? '';
  const displayWord = preserveLetterCase
    ? `${targetWord.charAt(0).toUpperCase()}${targetWord.slice(1)}`
    : targetWord.toLowerCase();
  const displayLetter = preserveLetterCase ? letter.letter : String(letter.letter || '').toLowerCase();
  const targetAudioSrc = useMemo(() => getVocabularyAudioPath(targetWord), [targetWord]);
  const canAdvance = feedback?.type === 'success' || isSkipped;

  useEffect(() => {
    setFeedback(null);
    setLastScore(null);
    setLastTranscript('');
    setIsSkipped(false);
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      pronunciationService.stopListening();
    };
  }, []);

  useEffect(() => {
    if (targetAudioSrc) {
      audioService.preloadAudioFile(targetAudioSrc);
    }
    preloadImages([currentItem?.image], { priority: true });

    const nextItem = vocab[currentIndex + 1];
    if (nextItem) {
      preloadImages([nextItem.image], { limit: 1 });
      audioService.preloadAudioFile(getVocabularyAudioPath(nextItem.word));
    }
  }, [targetAudioSrc, currentItem?.image, currentIndex, vocab]);

  const handlePlaySound = async (word: string) => {
    if (!word || isListening || isLoading) return;
    setIsLoading(true);
    try {
      const audioSrc = getVocabularyAudioPath(word);
      const playedAudioFile = audioSrc ? await audioService.playAudioFile(audioSrc) : false;
      if (!playedAudioFile) {
        await audioService.speak(word);
      }
    } catch (error) {
      console.error('Audio service error in VocabularyScreen:', error);
      setFeedback({ type: 'error', text: 'Try again' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePronunciationCheck = async () => {
    if (isListening || isLoading || feedback?.type === 'success' || !targetWord) return;

    try {
      setIsListening(true);
      setFeedback(null);
      setLastScore(null);
      setLastTranscript('');

      const result = await pronunciationService.startListening(targetWord);
      setLastScore(result.score);
      setLastTranscript(result.spokenText);

      if (result.status === 'correct') {
        setFeedback({ type: 'success', text: result.message });
        soundEffects.playCelebration();
        celebrateCorrectAnswer();
      } else if (result.status === 'almost') {
        setFeedback({ type: 'warning', text: result.message });
        soundEffects.playError();
      } else {
        setFeedback({ type: 'error', text: result.message });
        soundEffects.playError();
      }
    } catch (error) {
      console.error('Speech recognition error:', error);
      const message = (error as Error).message || '';
      const isCaptureFailure =
        message.includes('did not hear') ||
        message.includes('Speech is not available') ||
        message.includes('Check the microphone');

      if (isCaptureFailure) {
        setFeedback({ type: 'warning', text: 'Try again or skip' });
      } else {
        setFeedback({ type: 'warning', text: 'Try once more' });
      }
    } finally {
      setIsListening(false);
    }
  };

  const handleNext = () => {
    if (!canAdvance) {
      setFeedback({ type: 'warning', text: 'Say it or skip' });
      return;
    }

    if (feedback?.type === 'success') {
      setCompletedWords((prev) => {
        const updated = new Set(prev);
        updated.add(currentIndex);
        return updated;
      });
    }

    if (currentIndex < vocab.length - 1) {
      setCurrentIndex((idx) => idx + 1);
    } else {
      const correctWords = completedWords.size + (feedback?.type === 'success' && !completedWords.has(currentIndex) ? 1 : 0);
      const skippedCount = skippedWords.size + (isSkipped && !skippedWords.has(currentIndex) ? 1 : 0);
      onComplete(correctWords === vocab.length && skippedCount === 0 ? 1 : 0);
    }
  };

  const handleSkip = () => {
    setIsSkipped(true);
    setSkippedWords((prev) => {
      const updated = new Set(prev);
      updated.add(currentIndex);
      return updated;
    });
    pronunciationService.stopListening();
    setFeedback({ type: 'warning', text: 'Skipped' });
  };

  if (!currentItem) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-2xl text-gray-500">No vocabulary found for this letter.</p>
        <button onClick={() => onComplete(0)} className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-full">
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 md:p-8 text-center relative">
      <FeedbackToast feedback={feedback} />

      <h2 className="text-3xl md:text-4xl font-black text-gray-800 mb-8">
        Words starting with '{displayLetter}'
      </h2>

      <div className="relative w-full max-w-md h-[400px] md:h-[450px] mb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            className="absolute inset-0 bg-white rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col items-center justify-center border-4 border-blue-100"
          >
            <img
              src={assetUrl(currentItem.image)}
              alt={targetWord}
              onError={handleImageError}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-40 h-40 md:w-48 md:h-48 object-contain rounded-2xl mb-6 shadow-md p-2 bg-white"
            />
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-4">
                <span className="text-4xl md:text-5xl font-black text-gray-800">{displayWord}</span>
                <button
                  onClick={() => handlePlaySound(targetWord)}
                  disabled={isLoading || isListening}
                  aria-label={`Play ${targetWord}`}
                  className={`p-3 rounded-full transition-colors ${
                    isLoading ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Volume2 size={24} />}
                </button>
              </div>

              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-gray-500 font-medium">Repeat the word:</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePronunciationCheck}
                    disabled={isListening || isLoading}
                    className={`p-4 rounded-full transition-all shadow-lg ${
                      isListening
                        ? 'bg-green-500 text-white animate-pulse'
                        : feedback?.type === 'success'
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-500 text-white hover:bg-green-600 active:scale-95'
                    }`}
                  >
                    {isListening ? <Loader2 className="animate-spin" size={32} /> : <Mic size={32} />}
                  </button>

                </div>
                {isListening && <p className="text-xs text-green-600 font-bold animate-bounce">Listening...</p>}
                {lastScore !== null && (
                  <div className="text-xs text-gray-500 mt-2">
                    Heard "<span className="font-semibold text-gray-700">{lastTranscript || '...'}</span>" - Score {lastScore}%
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex gap-4">
        {vocab.map((_: any, i: number) => (
          <div key={i} className={`w-4 h-4 rounded-full ${i === currentIndex ? 'bg-blue-600' : 'bg-gray-300'}`} />
        ))}
      </div>

      <div className="mt-10 flex flex-col md:flex-row items-center gap-4">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isSkipped || isListening || isLoading}
          className={`px-6 py-3 text-base font-semibold rounded-full border transition-all ${
            isSkipped || isListening || isLoading
              ? 'border-gray-300 text-gray-400 cursor-not-allowed'
              : 'border-gray-400 text-gray-700 hover:border-gray-600'
          }`}
        >
          Can't speak? Skip this word
        </button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleNext}
          disabled={!canAdvance || isListening || isLoading}
          className={`px-12 py-4 text-white text-2xl font-black rounded-full shadow-xl transition-all ${
            !canAdvance || isListening || isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {currentIndex === vocab.length - 1 ? 'Finish >' : 'Next >'}
        </motion.button>
      </div>
    </div>
  );
}
