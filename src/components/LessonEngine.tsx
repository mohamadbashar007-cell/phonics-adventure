import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressStore } from '@/lib/store';
import { preloadLessonCriticalImages, preloadLessonImages } from '@/utils/preloadImages';
import StoryScreen from './lesson/StoryScreen';
import VocabularyScreen from './lesson/VocabularyScreen';
import TracingScreen from './lesson/TracingScreen';
import ChooseExerciseScreen from './lesson/ChooseExerciseScreen';
import ListenAndChooseScreen from './lesson/ListenAndChooseScreen';
import ActivityLessonScreen from './lesson/ActivityLessonScreen';
import CelebrationScreen from './lesson/CelebrationScreen';
import { preloadLetterTrace } from '@/data/letterTraces';
import { audioService } from '@/services/audioService';

export type LessonScreen =
  | 'story'
  | 'vocabulary'
  | 'tracing'
  | 'activities'
  | 'choose'
  | 'listen'
  | 'celebration';

interface LessonEngineProps {
  groupId: number;
  letter: {
    id: string;
    letter: string;
    sound: string;
    soundDescription: string;
    action: string;
    story?: {
      text: string;
      image: string;
    };
    vocabulary?: Array<{
      word: string;
      image: string;
      audio: string;
    }>;
    exercises?: Array<{
      type: 'choose' | 'listen';
      question: string;
      word?: string;
      options: Array<{
        image: string;
        word: string;
        correct: boolean;
      }>;
    }>;
  };
  onComplete?: (stars: number) => void;
  onExit?: () => void;
}

export default function LessonEngine({ groupId, letter, onComplete, onExit }: LessonEngineProps) {
  const [currentScreen, setCurrentScreen] = useState<LessonScreen>('story');
  const [stars, setStars] = useState(0);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const progressStore = useProgressStore();
  const hasActivities = (letter as any)?.activities?.length > 0;
  const traceLetters = useMemo(() => getTraceLettersForLesson(groupId, letter), [groupId, letter]);
  const lessonFlow = hasActivities
    ? ([
        { key: 'story', label: 'Story' },
        { key: 'vocabulary', label: 'Words' },
        { key: 'tracing', label: 'Trace' },
        { key: 'choose', label: 'Quiz' },
        { key: 'listen', label: 'Listen' },
        { key: 'activities', label: 'Practice' },
      ] as const)
    : ([
        { key: 'story', label: 'Story' },
        { key: 'vocabulary', label: 'Words' },
        { key: 'tracing', label: 'Trace' },
        { key: 'choose', label: 'Quiz' },
        { key: 'listen', label: 'Listen' },
      ] as const);

  const [completedScreens, setCompletedScreens] = useState<Set<LessonScreen>>(new Set());

  useEffect(() => {
    audioService.warmup();
    preloadLessonCriticalImages(letter, { priority: true });
    preloadLessonImages(letter, { defer: false });
    audioService.preloadLessonAudio(letter);
    traceLetters.forEach((traceLetter) => preloadLetterTrace(traceLetter));
  }, [letter, traceLetters]);

  const handleStoryComplete = () => {
    setCompletedScreens((prev) => {
      const updated = new Set(prev);
      updated.add('story');
      return updated;
    });
    setCurrentScreen('vocabulary');
  };

  const handleVocabularyComplete = (earnedStars: number) => {
    setCompletedScreens((prev) => {
      const updated = new Set(prev);
      updated.add('vocabulary');
      return updated;
    });
    setStars((prev) => prev + earnedStars);
    setCurrentScreen('tracing');
  };

  const handleTracingComplete = (earnedStars: number) => {
    setCompletedScreens((prev) => {
      const updated = new Set(prev);
      updated.add('tracing');
      return updated;
    });
    setStars((prev) => prev + earnedStars);
    setCurrentScreen('choose');
  };

  const handleActivitiesComplete = (earnedStars: number) => {
    setCompletedScreens((prev) => {
      const updated = new Set(prev);
      updated.add('activities');
      return updated;
    });
    setStars((prev) => prev + earnedStars);
    setCurrentScreen('celebration');
  };

  const handleChooseComplete = (earnedStars: number) => {
    setCompletedScreens((prev) => {
      const updated = new Set(prev);
      updated.add('choose');
      return updated;
    });
    setStars((prev) => prev + earnedStars);

    const exercises = letter.exercises || [];
    if (exerciseIndex < exercises.length - 1) {
      setExerciseIndex((prev) => prev + 1);
      setCurrentScreen('choose');
    } else {
      setCurrentScreen('listen');
    }
  };

  const handleListenComplete = (earnedStars: number) => {
    setCompletedScreens((prev) => {
      const updated = new Set(prev);
      updated.add('listen');
      return updated;
    });
    const totalStars = stars + earnedStars;
    setStars(totalStars);
    setCurrentScreen(hasActivities ? 'activities' : 'celebration');
  };

  const handleCelebrationComplete = () => {
    const finalStars = Math.min(stars, 3);
    progressStore.addProgress({
      groupId,
      letterId: letter.id,
      stars: finalStars,
    });
    onComplete?.(finalStars);
  };

  const screenVariants = {
    enter: { opacity: 0, y: 20 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <div className="w-full min-h-dvh bg-gradient-to-br from-peach-50 to-peach-100 relative overflow-hidden flex flex-col">
      <div className="absolute top-10 left-10 w-16 h-16 rounded-full bg-mint-200 opacity-30 pointer-events-none" />
      <div className="absolute top-32 right-20 w-20 h-20 bg-lilac-200 opacity-30 transform rotate-45 pointer-events-none" />
      <div className="absolute bottom-20 left-1/4 w-12 h-12 rounded-full bg-yellow-200 opacity-30 pointer-events-none" />

      <div className="w-full h-24 flex-shrink-0 relative z-10 px-4 pt-4">
        {currentScreen !== 'celebration' && (
          <button
            onClick={onExit}
            className="absolute top-4 left-4 px-4 py-2 bg-red-200 hover:bg-red-300 rounded-lg font-bold text-sm transition-colors"
          >
            ? Exit
          </button>
        )}

        <div className="mx-auto w-full max-w-4xl pl-0 sm:pl-20 pr-0 sm:pr-4">
          <div
            className="mb-1 hidden sm:grid text-xs font-bold text-gray-500"
            style={{ gridTemplateColumns: `repeat(${lessonFlow.length}, minmax(0, 1fr))` }}
          >
            {lessonFlow.map((step) => (
              <span key={`${step.key}-label`} className="text-center">
                {step.label}
              </span>
            ))}
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${lessonFlow.length}, minmax(0, 1fr))` }}>
            {lessonFlow.map((step) => (
              <div
                key={step.key}
                className={`h-4 rounded-full transition-colors ${
                  completedScreens.has(step.key as LessonScreen)
                    ? 'bg-green-500'
                    : currentScreen === step.key
                    ? 'bg-blue-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            variants={screenVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="w-full min-h-full flex flex-col"
          >
            {currentScreen === 'story' && <StoryScreen letter={letter} onComplete={handleStoryComplete} />}

            {currentScreen === 'vocabulary' && (
              <VocabularyScreen letter={letter} preserveLetterCase={groupId === 7} onComplete={handleVocabularyComplete} />
            )}

            {currentScreen === 'tracing' && <TracingScreen letter={letter} traceLetters={traceLetters} onComplete={handleTracingComplete} />}

            {currentScreen === 'choose' && (
              <ChooseExerciseScreen
                letter={letter}
                exercise={letter.exercises?.[exerciseIndex]}
                exerciseNumber={exerciseIndex + 1}
                preserveLetterCase={groupId === 7}
                onComplete={handleChooseComplete}
              />
            )}

            {currentScreen === 'activities' && (
              <ActivityLessonScreen letter={letter} preserveLetterCase={groupId === 7} onComplete={handleActivitiesComplete} />
            )}

            {currentScreen === 'listen' && <ListenAndChooseScreen letter={letter} onComplete={handleListenComplete} />}

            {currentScreen === 'celebration' && (
              <CelebrationScreen
                letter={letter}
                stars={Math.min(stars, 3)}
                onComplete={handleCelebrationComplete}
                onExit={onExit}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function getTraceLettersForLesson(groupId: number, letter: { id: string; letter: string }) {
  if (groupId !== 7) {
    return [(letter.letter || letter.id || 'a').toLowerCase()];
  }

  const capitalLetters = (letter.letter || '').match(/[A-Z]/g) || [];

  return capitalLetters.length ? capitalLetters : [letter.letter || letter.id || 'A'];
}
