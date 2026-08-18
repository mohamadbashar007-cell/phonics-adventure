import React from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { ArrowLeft, Star, Trophy, Target, Zap } from 'lucide-react';
import { useProgressStore } from '@/lib/store';
import { GROUP_COUNT } from '@/data/curriculumMeta';
import { soundEffects } from '@/services/soundEffects';

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const profile = useProgressStore((state) => state.profile);
  const totalStars = useProgressStore((state) => state.getTotalStars());
  const completedGroups = useProgressStore((state) => state.getCompletedGroups());
  const averageScore = useProgressStore((state) => state.getAverageScore());
  const examScores = useProgressStore((state) => state.examScores);
  const signOut = useProgressStore((state) => state.signOut);

  const handleBack = () => {
    soundEffects.playClick();
    setLocation('/');
  };

  const handleSignOut = () => {
    soundEffects.playClick();
    signOut();
    setLocation('/');
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 100, damping: 15 },
    },
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={handleBack}
          className="flex items-center gap-2 text-indigo-600 font-bold mb-8 hover:underline text-lg"
        >
          <ArrowLeft size={24} /> Back to Home
        </motion.button>

        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-lg border-4 border-indigo-200 mb-8"
        >
          <div className="text-center">
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">
              {profile?.name || 'Explorer'}
            </div>
            <p className="text-xl text-gray-600 font-bold">
              {profile?.age ? `Age: ${profile.age}` : 'Getting started...'} 
            </p>
          </div>
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleSignOut}
              className="px-6 py-3 rounded-full bg-red-500 text-white font-black shadow-lg hover:bg-red-600 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
        >
          {/* Total Stars Card */}
          <motion.div
            variants={itemVariants}
            className="bg-gradient-to-br from-yellow-100 to-orange-100 rounded-2xl p-6 shadow-lg border-4 border-yellow-300"
          >
            <div className="flex items-center gap-3 mb-3">
              <Star className="w-8 h-8 fill-yellow-400 text-yellow-400" />
              <h3 className="text-xl font-black text-gray-800">Total Stars</h3>
            </div>
            <p className="text-5xl font-black text-yellow-600">{totalStars}</p>
          </motion.div>

          {/* Groups Completed Card */}
          <motion.div
            variants={itemVariants}
            className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl p-6 shadow-lg border-4 border-green-300"
          >
            <div className="flex items-center gap-3 mb-3">
              <Trophy className="w-8 h-8 text-green-600" />
              <h3 className="text-xl font-black text-gray-800">Groups Completed</h3>
            </div>
            <p className="text-5xl font-black text-green-600">
              {completedGroups} / {GROUP_COUNT}
            </p>
          </motion.div>

          {/* Average Score Card */}
          <motion.div
            variants={itemVariants}
            className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl p-6 shadow-lg border-4 border-blue-300"
          >
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-8 h-8 text-blue-600" />
              <h3 className="text-xl font-black text-gray-800">Average Score</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-5xl font-black text-blue-600">{averageScore}%</p>
            </div>
          </motion.div>

          {/* Progress Card */}
          <motion.div
            variants={itemVariants}
            className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl p-6 shadow-lg border-4 border-purple-300"
          >
            <div className="flex items-center gap-3 mb-3">
              <Zap className="w-8 h-8 text-purple-600" />
              <h3 className="text-xl font-black text-gray-800">Exams Completed</h3>
            </div>
            <p className="text-5xl font-black text-purple-600">{examScores.length}</p>
          </motion.div>
        </motion.div>

        {/* Recent Exam Scores */}
        {examScores.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-4 border-gray-200"
          >
            <h3 className="text-2xl font-black text-gray-800 mb-6">Exam Results</h3>
            <div className="space-y-4">
              {examScores.map((exam) => (
                <motion.div
                  key={exam.groupId}
                  whileHover={{ scale: 1.02 }}
                  className={`p-4 rounded-xl border-4 transition-all ${
                    exam.passed
                      ? 'bg-green-50 border-green-300'
                      : 'bg-red-50 border-red-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-gray-800">Group {exam.groupId} Exam</p>
                      <p className="text-sm text-gray-600">
                        {new Date(exam.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-black ${exam.passed ? 'text-green-600' : 'text-red-600'}`}>
                        {exam.score}%
                      </p>
                      <p className={`text-sm font-bold ${exam.passed ? 'text-green-600' : 'text-red-600'}`}>
                        {exam.passed ? '✓ Passed' : '✗ Failed'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
