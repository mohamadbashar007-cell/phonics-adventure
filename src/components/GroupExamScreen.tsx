import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audioService } from '@/services/audioService';
import { soundEffects } from '@/services/soundEffects';
import { Volume2 } from 'lucide-react';
import { handleImageError } from '@/utils/imagePaths';
import { preloadImages } from '@/utils/preloadImages';
import { assetUrl } from '@/utils/assetUrl';
import { celebrateCorrectAnswer } from '@/utils/correctAnswerCelebration';

interface GroupExamScreenProps {
  groupId: number;
  group: any;
  onComplete: (score: number) => void;
  onExit: () => void;
}

export default function GroupExamScreen({ groupId, group, onComplete, onExit }: GroupExamScreenProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [animateResult, setAnimateResult] = useState(false);

  if (!group) return <div>Group not found</div>;

  // Create exam questions - one from each letter
  const examQuestions = useMemo(
    () =>
      group.letters
        .filter((letter: any) => letter.listening && letter.listening.length > 0)
        .slice(0, 5)
        .map((letter: any) => {
          const listeningItem = letter.listening[0];
          return {
            word: listeningItem.word,
            audioText: listeningItem.audioText,
            options: listeningItem.options,
            correctOptionIndex: listeningItem.options.findIndex((option: any) => option.isCorrect),
          };
        }),
    [group]
  );

  const currentQuestion = examQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / examQuestions.length) * 100;

  useEffect(() => {
    audioService.warmup();
    preloadImages(currentQuestion?.options?.map((option: any) => option.image) ?? [], { priority: true });
    if (currentQuestionIndex === 0) {
      preloadImages(
        examQuestions.flatMap((question: any) => question.options?.map((option: any) => option.image) ?? []),
        { defer: false }
      );
    }
    audioService.preloadPromptAudio(currentQuestion?.audioText || currentQuestion?.word);
    const nextQuestion = examQuestions[currentQuestionIndex + 1];
    audioService.preloadPromptAudio(nextQuestion?.audioText || nextQuestion?.word);
  }, [currentQuestionIndex, currentQuestion, examQuestions]);

  const handleAnswerSelect = (optionIndex: number) => {
    soundEffects.playClick();
    setSelectedAnswer(optionIndex);
    setAnswered(true);
    setAnimateResult(true);

    if (optionIndex === currentQuestion.correctOptionIndex) {
      soundEffects.playSuccess();
      celebrateCorrectAnswer();
      setScore((prev) => prev + 20);
    } else {
      soundEffects.playError();
    }

    setTimeout(() => {
      if (currentQuestionIndex < examQuestions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
        setSelectedAnswer(null);
        setAnswered(false);
        setAnimateResult(false);
      } else {
        onComplete(score + (optionIndex === currentQuestion.correctOptionIndex ? 20 : 0));
      }
    }, 2000);
  };

  const handlePlayAudio = () => {
    void audioService.playPrompt(currentQuestion.audioText || currentQuestion.word);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8 flex flex-col">
      {/* Header */}
      <div className="max-w-2xl mx-auto w-full mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-black text-indigo-800">Group {groupId} Exam</h1>
          <button
            onClick={onExit}
            className="text-gray-600 hover:text-gray-800 text-2xl font-black"
          >
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-full h-4 overflow-hidden shadow-md border-2 border-indigo-200">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
          />
        </div>
        <p className="text-center text-sm font-bold text-gray-600 mt-2">
          Question {currentQuestionIndex + 1} of {examQuestions.length}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-xl w-full border-4 border-indigo-200"
        >
          <div className="text-center mb-8">
            <p className="text-lg text-gray-600 font-bold mb-4">Listen carefully:</p>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handlePlayAudio}
              className="mx-auto px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full shadow-lg font-bold text-lg flex items-center gap-2 hover:shadow-xl transition-all"
            >
              <Volume2 size={24} />
              Play Sound
            </motion.button>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AnimatePresence>
              {currentQuestion.options.map((option, index) => (
                <motion.button
                  key={`${currentQuestionIndex}-${option.word}-${index}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => !answered && handleAnswerSelect(index)}
                  disabled={answered}
                  className={`relative rounded-2xl overflow-hidden border-4 transition-all transform ${
                    selectedAnswer === index
                      ? index === currentQuestion.correctOptionIndex
                        ? 'border-green-400 scale-105'
                        : 'border-red-400 scale-105'
                      : 'border-gray-300 hover:border-indigo-400'
                  } ${answered ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {/* Result Overlay */}
                  {answered && selectedAnswer === index && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: animateResult ? 1 : 0 }}
                      className={`absolute inset-0 flex items-center justify-center text-4xl z-10 ${
                        index === currentQuestion.correctOptionIndex
                          ? 'bg-green-400'
                          : 'bg-red-400'
                      }`}
                    >
                      {index === currentQuestion.correctOptionIndex ? '✓' : '✗'}
                    </motion.div>
                  )}

                  {/* Image */}
                  <img
                    src={assetUrl(option.image)}
                    alt={option.word}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    onError={handleImageError}
                    className="w-full h-32 md:h-40 object-contain p-4"
                  />

                  {/* Label */}
                  <div className="p-3 bg-gray-50 text-center">
                    <p className="font-black text-gray-800">
                      {groupId === 7 ? option.word : String(option.word || '').toLowerCase()}
                    </p>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {answered && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 text-center"
            >
              <p className={`text-2xl font-black ${selectedAnswer === currentQuestion.correctOptionIndex ? 'text-green-600' : 'text-red-600'}`}>
                {selectedAnswer === currentQuestion.correctOptionIndex ? 'Great! 🎉' : 'Try Again ❌'}
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
