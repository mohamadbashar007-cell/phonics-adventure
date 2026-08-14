import React from 'react';
import { motion } from 'framer-motion';
import { useProgressStore } from '@/lib/store';
import { soundEffects } from '@/services/soundEffects';
import { Trophy, Lock } from 'lucide-react';

interface GroupExamResultScreenProps {
  groupId: number;
  score: number;
  onComplete: () => void;
}

const PASSING_SCORE = 75;

export default function GroupExamResultScreen({
  groupId,
  score,
  onComplete,
}: GroupExamResultScreenProps) {
  const addExamScore = useProgressStore((state) => state.addExamScore);
  const firstExamScore = useProgressStore((state) => state.getExamScore(groupId));
  const isRetake = React.useRef(Boolean(firstExamScore)).current;
  const passed = score >= PASSING_SCORE;

  React.useEffect(() => {
    // Save exam score
    addExamScore({
      groupId,
      score,
      passed,
      date: new Date().toISOString(),
    });

    // Play sound
    if (passed) {
      soundEffects.playSuccess();
    } else {
      soundEffects.playError();
    }
  }, []);

  const handleContinue = () => {
    soundEffects.playClick();
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8 flex items-center justify-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className={`rounded-3xl p-8 md:p-12 shadow-2xl border-8 max-w-lg w-full text-center ${
          passed
            ? 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-400'
            : 'bg-gradient-to-br from-red-100 to-orange-100 border-red-400'
        }`}
      >
        {/* Decorative icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
          className="mb-6"
        >
          {passed ? (
            <Trophy className="w-24 h-24 md:w-32 md:h-32 mx-auto text-yellow-500 drop-shadow-lg" />
          ) : (
            <Lock className="w-24 h-24 md:w-32 md:h-32 mx-auto text-orange-500 drop-shadow-lg" />
          )}
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className={`text-4xl md:text-5xl font-black mb-4 ${
            passed ? 'text-green-700' : 'text-orange-700'
          }`}
        >
          {passed ? 'Excellent! 🎉' : 'Keep Practicing! 💪'}
        </motion.h1>

        {/* Score Display */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-6"
        >
          <p className="text-lg text-gray-700 font-bold mb-2">
            {isRetake ? 'Practice Score:' : 'Your Score:'}
          </p>
          <p className={`text-6xl md:text-7xl font-black ${passed ? 'text-green-600' : 'text-red-600'}`}>
            {score}%
          </p>
          {isRetake && firstExamScore && (
            <p className="mt-3 font-bold text-indigo-700">
              Your recorded first score remains {firstExamScore.score}%.
            </p>
          )}
          <p className="text-gray-700 font-bold mt-2">
            Passing Score: {PASSING_SCORE}%
          </p>
        </motion.div>

        {/* Message */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xl text-gray-800 font-bold mb-8"
        >
          {isRetake ? (
            <>
              This was a practice retake. Your first result stays unchanged.
            </>
          ) : passed ? (
            <>
              Congratulations! You've unlocked Group {groupId + 1}! 🔓
            </>
          ) : (
            <>
              Don't worry! Review the letters and try again.
            </>
          )}
        </motion.p>

        {/* Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleContinue}
          className={`px-8 py-4 rounded-full text-white text-xl font-black shadow-lg hover:shadow-xl transition-all ${
            passed
              ? 'bg-gradient-to-r from-green-500 to-emerald-500'
              : 'bg-gradient-to-r from-orange-500 to-orange-600'
          }`}
        >
          {passed ? 'Next Group ➜' : 'Try Again ↻'}
        </motion.button>
      </motion.div>
    </div>
  );
}
