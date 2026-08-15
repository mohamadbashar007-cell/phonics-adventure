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
import CapitalLowercaseMatchScreen from './lesson/CapitalLowercaseMatchScreen';
import StorySentenceBlendScreen from './lesson/StorySentenceBlendScreen';
import AlphabetTrainScreen from './lesson/AlphabetTrainScreen';
import { preloadLetterTrace } from '@/data/letterTraces';
import { audioService } from '@/services/audioService';
import { getLessonActivitySections, type ActivitySectionKey } from '@/utils/lessonActivitySections';

export type LessonScreen =
  | 'story'
  | 'vocabulary'
  | 'tracing'
  | 'choose'
  | 'listen'
  | 'hear'
  | 'match'
  | 'blend'
  | 'segment'
  | 'balloons'
  | 'tap'
  | 'train'
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
  const [viewportScale, setViewportScale] = useState(() => getLessonViewportScale());
  const progressStore = useProgressStore();
  const isCapitalGroup = groupId === 7;
  const activitySections = useMemo(() => getLessonActivitySections(letter), [letter]);
  const visibleActivitySections = useMemo(
    () => activitySections.filter((section) => (
      isCapitalGroup ? section.key !== 'tap' : section.key !== 'match'
    )),
    [activitySections, isCapitalGroup],
  );
  const hasChooseActivity = true;
  const traceLetters = useMemo(() => getTraceLettersForLesson(groupId, letter), [groupId, letter]);
  const lessonFlow: Array<{ key: LessonScreen; label: string }> = [
    { key: 'story', label: 'Story' },
    { key: 'vocabulary', label: 'Words' },
    { key: 'tracing', label: 'Trace' },
    ...(hasChooseActivity ? [{ key: 'choose' as const, label: 'Quiz' }] : []),
    { key: 'listen', label: 'Listen' },
    ...visibleActivitySections.map((section) => ({ key: section.key, label: section.label })),
    ...(isCapitalGroup ? [{ key: 'train' as const, label: 'Train' }] : []),
  ];

  const [completedScreens, setCompletedScreens] = useState<Set<LessonScreen>>(new Set());

  useEffect(() => {
    audioService.warmup();
    preloadLessonCriticalImages(letter, { priority: true });
    preloadLessonImages(letter, { defer: false });
    audioService.preloadLessonAudio(letter);
    traceLetters.forEach((traceLetter) => preloadLetterTrace(traceLetter));
  }, [letter, traceLetters]);

  useEffect(() => {
    const updateScale = () => setViewportScale(getLessonViewportScale());
    window.addEventListener('resize', updateScale);
    window.visualViewport?.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      window.visualViewport?.removeEventListener('resize', updateScale);
    };
  }, []);

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
    setCurrentScreen(hasChooseActivity ? 'choose' : 'listen');
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
    setCurrentScreen('hear');
  };

  const handleActivitySectionComplete = (sectionKey: ActivitySectionKey, earnedStars: number) => {
    setCompletedScreens((prev) => new Set(prev).add(sectionKey));
    setStars((prev) => prev + earnedStars);
    const sectionIndex = visibleActivitySections.findIndex((section) => section.key === sectionKey);
    const nextSection = visibleActivitySections[sectionIndex + 1];
    setCurrentScreen(nextSection?.key || (isCapitalGroup ? 'train' : 'celebration'));
  };

  const handleTrainComplete = () => {
    setCompletedScreens((prev) => new Set(prev).add('train'));
    setCurrentScreen('celebration');
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
    <div className="h-dvh w-full overflow-hidden">
      <div
        data-lesson-viewport
        className="relative flex w-full flex-col overflow-hidden bg-gradient-to-br from-peach-50 to-peach-100"
        style={{
          height: `${100 / viewportScale}dvh`,
          zoom: viewportScale,
        }}
      >
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

        <div className="mx-auto w-full max-w-6xl pl-20 pr-0 sm:pr-4">
          <div
            className="grid w-full gap-1 sm:gap-2"
            style={{ gridTemplateColumns: `repeat(${lessonFlow.length}, minmax(0, 1fr))` }}
          >
            {lessonFlow.map((step) => (
              <div key={step.key} className="min-w-0">
                <div className="mb-1 truncate text-center text-[7px] font-bold text-gray-500 min-[430px]:text-[9px] sm:text-xs">{step.label}</div>
                <div
                  className={`h-3 sm:h-4 rounded-full transition-colors ${
                    completedScreens.has(step.key)
                      ? 'bg-green-500'
                      : currentScreen === step.key
                      ? 'bg-blue-500'
                      : 'bg-gray-200'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

        <div className="relative z-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
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

            {currentScreen === 'choose' && hasChooseActivity && (
              <ChooseExerciseScreen
                letter={letter}
                exercise={letter.exercises?.[exerciseIndex]}
                exerciseNumber={exerciseIndex + 1}
                preserveLetterCase={groupId === 7}
                onComplete={handleChooseComplete}
              />
            )}

            {currentScreen === 'listen' && <ListenAndChooseScreen letter={letter} onComplete={handleListenComplete} />}

            {currentScreen === 'match' && isCapitalGroup && (
              <CapitalLowercaseMatchScreen
                letter={letter}
                onComplete={(earnedStars) => handleActivitySectionComplete('match', earnedStars)}
              />
            )}

            {currentScreen === 'blend' && isCapitalGroup && (
              <StorySentenceBlendScreen
                letter={letter}
                onComplete={(earnedStars) => handleActivitySectionComplete('blend', earnedStars)}
              />
            )}

            {visibleActivitySections.map((section) => (
              currentScreen === section.key && section.key !== 'match' && !(isCapitalGroup && section.key === 'blend') ? (
                <ActivityLessonScreen
                  key={section.key}
                  letter={letter}
                  activities={section.activities}
                  preserveLetterCase={groupId === 7}
                  onComplete={(earnedStars) => handleActivitySectionComplete(section.key, earnedStars)}
                />
              ) : null
            ))}

            {currentScreen === 'train' && isCapitalGroup && (
              <AlphabetTrainScreen letter={letter} onComplete={handleTrainComplete} />
            )}

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
    </div>
  );
}

function getTraceLettersForLesson(groupId: number, letter: { id: string; letter: string }) {
  if (groupId !== 7) {
    return [(letter.letter || letter.id || 'a').toLowerCase()];
  }

  const capitalLetters = (letter.letter || '').match(/[A-Z]/g) || [];

  return capitalLetters.length
    ? capitalLetters.map((capital) => `${capital}${capital.toLowerCase()}`)
    : [letter.letter || letter.id || 'A'];
}

function getLessonViewportScale() {
  if (typeof window === 'undefined') return 1;

  const width = window.innerWidth;
  const height = window.visualViewport?.height || window.innerHeight;
  const clamp = (value: number, minimum: number) => Math.min(1, Math.max(minimum, value));

  if (width >= 1180) {
    return clamp(Math.min(width / 1820, height / 1024), 0.72);
  }

  if (width >= 700) {
    return clamp(Math.min(width / 1180, height / 900), 0.76);
  }

  return clamp(Math.min(width / 430, height / 820), 0.8);
}
