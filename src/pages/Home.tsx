import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Lock, Star, User } from 'lucide-react';
import { useProgressStore } from '@/lib/store';
import { preloadImages } from '@/utils/preloadImages';
import { audioService } from '@/services/audioService';
import { getGroupMapSource } from '@/utils/groupAssets';
import { useLocation } from 'wouter';
import curriculum from '../data/curriculum.json';

export default function Home() {
  const progressStore = useProgressStore();
  const initialized = useRef(false);
  const [hasInteracted, setHasInteracted] = React.useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!initialized.current) {
      progressStore.initializeProgress();
      initialized.current = true;
    }
  }, []);

  const handleStart = () => {
    audioService.warmup();
    setHasInteracted(true);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 100, damping: 15 },
    },
  };

  const handleGroupClick = (groupId: number) => {
    if (progressStore.isGroupUnlocked(groupId)) {
      setLocation(`/group/${groupId}`);
    }
  };

  const handleGroupWarmup = (group: any) => {
    audioService.warmup();
    preloadImages([getGroupMapSource(group.id)], { priority: true });
  };

  const totalStars = progressStore.getTotalStars();
  const floatingDecor = ['a', 'b', 'c', 'd', '⭐', '✨', 'm', 's'];

  return (
    <div className="desktop-page-zoom-75 min-h-screen bg-gradient-to-br from-peach-50 via-peach-100 to-pink-50 p-4 md:p-8">
      {/* Start Overlay */}
      {!hasInteracted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleStart}
            className="px-8 md:px-12 py-4 md:py-6 bg-blue-600 text-white text-2xl md:text-4xl font-black rounded-full shadow-2xl hover:bg-blue-700 transition-colors flex items-center gap-4"
          >
            Start Adventure! 🚀
          </motion.button>
        </div>
      )}

      {/* Decorative background elements */}
      <div className="fixed top-10 left-10 w-16 md:w-24 h-16 md:h-24 rounded-full bg-mint-200 opacity-20 pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-24 md:w-32 h-24 md:h-32 bg-lilac-200 opacity-20 transform rotate-45 pointer-events-none" />
      <div className="fixed top-1/2 right-1/4 w-12 md:w-16 h-12 md:h-16 rounded-full bg-yellow-200 opacity-20 pointer-events-none" />
      {floatingDecor.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="fixed pointer-events-none text-4xl md:text-6xl font-black text-white/30 animate-float"
          style={{
            left: `${8 + (index % 4) * 22}%`,
            top: `${12 + Math.floor(index / 4) * 34}%`,
            animationDelay: `${index * 0.4}s`,
          }}
        >
          {item}
        </span>
      ))}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mb-8 md:mb-12"
      >
        {/* Top Bar with Profile Button */}
        <div className="flex items-center justify-between mb-6">
          <div></div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setLocation('/profile');
            }}
            className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            <User size={20} />
            <span className="hidden sm:inline">{progressStore.userName || 'Profile'}</span>
          </motion.button>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-black text-gray-800 drop-shadow-lg mb-2 md:mb-4">
            🌟 Phonics Adventure
          </h1>
          {progressStore.userName && (
            <p className="text-xl md:text-3xl text-gray-700 font-black mb-4">
              Hi {progressStore.userName}! 👋 Ready to learn today?
            </p>
          )}
          <p className="text-lg md:text-2xl text-gray-700 font-bold">Level 1 - CVC Blending</p>
        </div>

        {/* Total Stars Display */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-2 mt-4 md:mt-6 flex-wrap"
        >
          <div className="flex gap-1">
            {[...Array(Math.min(totalStars, 10))].map((_, i) => (
              <Star
                key={i}
                size={20}
                className="fill-yellow-400 text-yellow-400 md:w-7 md:h-7"
              />
            ))}
          </div>
          <span className="text-lg md:text-2xl font-bold text-gray-800">
            {totalStars} Stars Earned
          </span>
        </motion.div>
      </motion.div>

      {/* Groups Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 max-w-6xl mx-auto relative z-10"
      >
        {curriculum.groups.map((group) => {
          const groupProgress = progressStore.getGroupProgress(group.id);
          const isUnlocked = progressStore.isGroupUnlocked(group.id);
          const completionPercentage = progressStore.getGroupCompletionPercentage(
            group.id
          );

          return (
            <motion.button
              key={group.id}
              variants={itemVariants}
              whileHover={isUnlocked ? { scale: 1.05 } : {}}
              whileTap={isUnlocked ? { scale: 0.95 } : {}}
              onClick={() => handleGroupClick(group.id)}
              onMouseEnter={() => handleGroupWarmup(group)}
              onFocus={() => handleGroupWarmup(group)}
              onTouchStart={() => handleGroupWarmup(group)}
              disabled={!isUnlocked}
              className={`relative p-8 rounded-3xl shadow-xl transition-all ${
                isUnlocked
                  ? 'bg-gradient-to-br from-blue-100 to-blue-50 hover:shadow-2xl cursor-pointer'
                  : 'bg-gradient-to-br from-gray-200 to-gray-100 cursor-not-allowed opacity-60'
              }`}
            >
              {/* Lock Icon */}
              {!isUnlocked && (
                <div className="absolute top-4 right-4 bg-red-400 p-3 rounded-full">
                  <Lock size={24} className="text-white" />
                </div>
              )}

              {/* Group Number */}
              <div className="text-5xl font-black text-blue-600 mb-2">
                Group {group.id}
              </div>

              {/* Group Description */}
              <h3 className="text-2xl font-bold text-gray-800 mb-4 text-left">
                {group.description}
              </h3>

              {/* Letters */}
              <div className="text-left mb-4">
                <p className="text-sm font-semibold text-gray-600 mb-2">Letters:</p>
                <div className="flex flex-wrap gap-2">
                  {group.letters.map((letter) => (
                    <span
                      key={letter.id}
                      className={`px-3 py-1 rounded-full font-bold text-sm ${
                        progressStore.isLetterCompleted(group.id, letter.id)
                          ? 'bg-green-300 text-green-800'
                          : 'bg-blue-300 text-blue-800'
                      }`}
                    >
                      {String(letter.letter).toLowerCase() === 'ck' ? 'c k' : letter.letter}
                    </span>
                  ))}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Progress
                  </span>
                  <span className="text-sm font-bold text-gray-700">
                    {groupProgress.completedLetters}/{groupProgress.totalLetters}
                  </span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPercentage}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="h-full bg-gradient-to-r from-green-400 to-green-500"
                  />
                </div>
              </div>

              {/* Status Badge */}
              <div className="text-center">
                {isUnlocked ? (
                  <span className="inline-block px-4 py-2 bg-green-300 text-green-800 font-bold rounded-full text-sm">
                    {completionPercentage === 100 ? '🎉 Completed' : 'Ready to Learn'}
                  </span>
                ) : (
                  <span className="inline-block px-4 py-2 bg-gray-400 text-gray-700 font-bold rounded-full text-sm">
                    Locked
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-16 max-w-2xl mx-auto bg-white rounded-2xl p-8 shadow-lg relative z-10"
      >
        <h3 className="text-2xl font-bold text-gray-800 mb-4">📖 How to Use</h3>
        <ul className="space-y-3 text-gray-700">
          <li className="flex items-start gap-3">
            <span className="text-2xl">1️⃣</span>
            <span>
              Click on a group to start learning. Group 1 is unlocked by default.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-2xl">2️⃣</span>
            <span>
              Complete all letters in a group to unlock the next group.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-2xl">3️⃣</span>
            <span>
              Each letter has interactive screens: Story, Vocabulary, Tracing, and Exercises.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-2xl">4️⃣</span>
            <span>
              Earn stars for completing lessons and unlock achievements!
            </span>
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
