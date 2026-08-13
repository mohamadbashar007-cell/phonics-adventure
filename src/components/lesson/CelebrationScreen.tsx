import React from 'react';
import { motion } from 'framer-motion';
import { Star, Trophy } from 'lucide-react';

interface CelebrationScreenProps {
  letter: any;
  stars: number;
  onComplete: () => void;
  onExit?: () => void;
}

export default function CelebrationScreen({ letter, stars, onComplete, onExit }: CelebrationScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 md:p-8 text-center bg-gradient-to-b from-yellow-50 to-peach-100">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="mb-8"
      >
        <Trophy className="w-24 h-24 md:w-32 md:h-32 text-yellow-500 drop-shadow-lg" />
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl md:text-5xl font-black text-gray-800 mb-4"
      >
        Amazing Job!
      </motion.h2>
      
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xl md:text-2xl text-gray-600 font-bold mb-8"
      >
        You mastered the letter '{letter.letter}'!
      </motion.p>

      <div className="flex gap-4 mb-12">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4 + i * 0.1, type: 'spring' }}
          >
            <Star
              className={`w-12 h-12 md:w-16 md:h-16 ${i < stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
            />
          </motion.div>
        ))}
      </div>

      <div className="flex gap-6">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onComplete}
          className="px-8 py-3 md:px-12 md:py-4 bg-green-500 text-white text-xl md:text-2xl font-black rounded-full shadow-xl hover:bg-green-600 transition-colors"
        >
          Finish Lesson ➜
        </motion.button>
      </div>
    </div>
  );
}
