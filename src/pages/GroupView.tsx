import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, Lock, Map, Settings, Star, Trophy } from 'lucide-react';
import { useLocation, useRoute } from 'wouter';
import { toast } from 'sonner';
import LessonIsland from '@/components/LessonIsland';
import GroupCompleteScreen from '@/components/GroupCompleteScreen';
import GroupExamResultScreen from '@/components/GroupExamResultScreen';
import GroupExamScreen from '@/components/GroupExamScreen';
import LessonEngine from '@/components/LessonEngine';
import { useProgressSync } from '@/lib/useProgressSync';
import { useProgressStore } from '@/lib/store';
import { soundEffects } from '@/services/soundEffects';
import { audioService } from '@/services/audioService';
import { preloadImages, preloadLessonCriticalImages } from '@/utils/preloadImages';
import { assetUrl } from '@/utils/assetUrl';
import { getGroupMapSource } from '@/utils/groupAssets';
import curriculum from '../data/curriculum.json';

type ViewMode = 'map' | 'lesson' | 'exam' | 'exam-result' | 'group-complete';
type IslandTheme = 'snake' | 'apple' | 'tree' | 'hut' | 'palm' | 'rocks';

const MAP_WIDTH = 1024;
const TOP_OFFSET = 210;
const BOTTOM_OFFSET = 210;

const themeByLetter: Record<string, IslandTheme> = {
  s: 'snake',
  a: 'apple',
  t: 'tree',
  i: 'hut',
  p: 'palm',
  n: 'rocks',
};

const navItems = [
  { label: 'Map', icon: Map, active: true },
  { label: 'Rewards', icon: Trophy, active: false },
  { label: 'Lessons', icon: BookOpen, active: false },
  { label: 'Settings', icon: Settings, active: false },
];

type LessonZone = { left: number; top: number; width: number; height: number };

const imageMapConfigs: Record<number, { src: string; width: number; height: number; zones: LessonZone[] }> = {
  1: {
    src: '/images/maps/group-1-map.webp',
    width: 1060,
    height: 1108,
    zones: [
      { left: 17.9, top: 2.2, width: 28.2, height: 20.7 },
      { left: 57.3, top: 12.1, width: 28.3, height: 19.5 },
      { left: 27.5, top: 32.3, width: 28.4, height: 19.2 },
      { left: 55.3, top: 51.2, width: 29.5, height: 18.1 },
      { left: 18.1, top: 67.5, width: 27.4, height: 17.2 },
      { left: 57.0, top: 80.2, width: 28.2, height: 17.5 },
    ],
  },
  2: {
    src: '/images/maps/group-2-map.webp',
    width: 1060,
    height: 1105,
    zones: [
      { left: 22.6, top: 3.4, width: 27.4, height: 19.1 },
      { left: 54.8, top: 15.2, width: 28.8, height: 18.5 },
      { left: 24.0, top: 34.2, width: 27.1, height: 18.5 },
      { left: 55.5, top: 52.0, width: 28.4, height: 18.0 },
      { left: 23.0, top: 67.0, width: 27.8, height: 17.9 },
      { left: 55.8, top: 80.0, width: 28.8, height: 17.8 },
    ],
  },
  3: {
    src: '/images/maps/group-3-map.webp',
    width: 1060,
    height: 1099,
    zones: [
      { left: 23.4, top: 4.6, width: 27.5, height: 18.6 },
      { left: 54.4, top: 17.2, width: 28.8, height: 18.4 },
      { left: 25.0, top: 35.5, width: 27.8, height: 18.0 },
      { left: 55.0, top: 53.0, width: 28.5, height: 17.7 },
      { left: 22.4, top: 69.1, width: 27.0, height: 17.3 },
      { left: 55.8, top: 81.4, width: 28.4, height: 17.0 },
    ],
  },
  4: {
    src: '/images/maps/group-4-map.webp',
    width: 1060,
    height: 1094,
    zones: [
      { left: 23.4, top: 2.8, width: 27.4, height: 18.6 },
      { left: 54.6, top: 16.0, width: 28.7, height: 18.5 },
      { left: 24.4, top: 33.4, width: 28.0, height: 17.8 },
      { left: 55.2, top: 50.5, width: 28.4, height: 17.8 },
      { left: 22.4, top: 65.3, width: 27.3, height: 17.2 },
      { left: 55.0, top: 77.8, width: 28.5, height: 17.0 },
      { left: 40.2, top: 88.8, width: 28.4, height: 11.0 },
    ],
  },
  5: {
    src: '/images/maps/group-5-map.webp',
    width: 1060,
    height: 1098,
    zones: [
      { left: 23.4, top: 2.9, width: 27.4, height: 18.6 },
      { left: 54.6, top: 16.7, width: 28.6, height: 18.6 },
      { left: 24.7, top: 34.8, width: 27.8, height: 17.9 },
      { left: 55.0, top: 52.0, width: 28.5, height: 17.8 },
      { left: 21.5, top: 66.8, width: 27.4, height: 17.2 },
      { left: 55.2, top: 80.2, width: 28.5, height: 17.0 },
    ],
  },
  6: {
    src: '/images/maps/group-6-map.webp',
    width: 1060,
    height: 1108,
    zones: [
      { left: 23.4, top: 4.2, width: 27.4, height: 18.8 },
      { left: 54.8, top: 17.8, width: 28.7, height: 18.5 },
      { left: 24.2, top: 36.4, width: 28.0, height: 18.2 },
      { left: 55.2, top: 55.0, width: 28.5, height: 18.0 },
      { left: 25.0, top: 72.8, width: 28.2, height: 16.8 },
    ],
  },
  7: {
    src: '/images/maps/group-7-map.webp',
    width: 1060,
    height: 1101,
    zones: [
      { left: 23.4, top: 3.4, width: 27.4, height: 18.4 },
      { left: 53.8, top: 15.0, width: 28.2, height: 18.2 },
      { left: 24.0, top: 31.5, width: 27.8, height: 17.3 },
      { left: 54.7, top: 47.5, width: 28.0, height: 17.4 },
      { left: 22.0, top: 60.0, width: 27.8, height: 17.1 },
      { left: 53.5, top: 71.0, width: 28.2, height: 16.5 },
      { left: 21.0, top: 81.6, width: 28.4, height: 16.0 },
      { left: 53.2, top: 88.5, width: 28.4, height: 11.5 },
    ],
  },
};

function getLessonPosition(index: number) {
  const mapPattern = [
    { x: 330, y: 205 },
    { x: 250, y: 465 },
    { x: 585, y: 645 },
    { x: 275, y: 840 },
    { x: 565, y: 1030 },
    { x: 720, y: 1190 },
  ];

  if (mapPattern[index]) return mapPattern[index];

  const xPattern = [295, 610, 275, 680];
  return {
    x: xPattern[index % xPattern.length],
    y: TOP_OFFSET + index * 190,
  };
}

function getPath(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return '';

  return points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;

      const previous = points[index - 1];
      const midY = previous.y + (point.y - previous.y) * 0.5;
      const bend = point.x > previous.x ? 106 : -106;
      return `C ${previous.x + bend} ${midY - 48}, ${point.x - bend} ${midY + 48}, ${point.x} ${point.y}`;
    })
    .join(' ');
}

function OceanScenery() {
  return (
    <>
      <div className="map-cloud map-cloud-left" />
      <div className="map-cloud map-cloud-right" />
      <div className="map-cloud map-cloud-low" />
      <div className="map-cloud map-cloud-bottom" />

      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1024 1360" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 120 C180 42 270 112 420 72 C610 20 760 108 1024 48 V0 H0Z" fill="#A7E5FF" opacity="0.42" />
        <path d="M0 160 C138 94 286 152 460 102 C640 50 810 154 1024 90" fill="none" stroke="#E7FAFF" strokeWidth="5" opacity="0.24" />
        <path d="M70 345 C92 329 118 329 143 345 C168 361 193 361 218 345" fill="none" stroke="#BDEFFF" strokeWidth="4" strokeLinecap="round" opacity="0.36" />
        <path d="M760 410 C784 394 808 394 832 410 C856 426 881 426 906 410" fill="none" stroke="#BDEFFF" strokeWidth="4" strokeLinecap="round" opacity="0.3" />
        <path d="M78 815 C108 796 137 796 167 815 C197 834 227 834 257 815" fill="none" stroke="#BDEFFF" strokeWidth="4" strokeLinecap="round" opacity="0.32" />
        <path d="M324 1078 C350 1061 377 1061 403 1078 C430 1095 456 1095 482 1078" fill="none" stroke="#BDEFFF" strokeWidth="4" strokeLinecap="round" opacity="0.28" />
        <path d="M760 690 C785 674 811 674 836 690 C862 706 888 706 914 690" fill="none" stroke="#BDEFFF" strokeWidth="4" strokeLinecap="round" opacity="0.24" />
        <g className="map-sparkle">
          <path d="M796 705 L804 723 L823 730 L804 737 L796 755 L788 737 L769 730 L788 723Z" fill="#FFFFFF" opacity="0.72" />
          <circle cx="170" cy="238" r="4" fill="#FFFFFF" opacity="0.58" />
          <circle cx="850" cy="906" r="4" fill="#FFFFFF" opacity="0.58" />
        </g>
        <g transform="translate(772 680) scale(1.1)" className="whale-scene">
          <g className="whale-bob">
            <ellipse cx="36" cy="58" rx="55" ry="16" fill="#55CBFF" opacity="0.26" />
            <path d="M6 42 C12 14 40 3 69 15 C94 25 102 49 85 64 C62 85 14 75 6 42Z" fill="#39AFFF" stroke="#0D78BF" strokeWidth="4" />
            <path d="M78 25 C92 10 110 9 124 22 C107 28 96 37 84 48Z" fill="#39AFFF" stroke="#0D78BF" strokeWidth="4" />
            <path d="M84 19 C98 3 116 1 130 11 C111 17 101 27 89 40Z" fill="#60C4FF" stroke="#0D78BF" strokeWidth="4" />
            <path d="M8 44 C20 51 32 52 44 46" fill="none" stroke="#A7E8FF" strokeWidth="5" strokeLinecap="round" opacity="0.72" />
            <circle cx="48" cy="34" r="4" fill="#0D2B4A" />
            <circle cx="51" cy="32" r="1.5" fill="#FFFFFF" />
            <path d="M27 55 C39 64 58 65 73 55" fill="none" stroke="#E8F8FF" strokeWidth="4" strokeLinecap="round" />
            <path d="M34 -1 C31 -17 43 -23 42 -35 M45 -2 C48 -18 60 -22 65 -35 M55 0 C68 -14 80 -10 88 -22" fill="none" stroke="#DDF8FF" strokeWidth="5" strokeLinecap="round" />
            <circle cx="32" cy="-5" r="4" fill="#DDF8FF" />
            <circle cx="66" cy="-7" r="4" fill="#DDF8FF" />
          </g>
        </g>
        <g opacity="0.8">
          <path d="M875 160 C888 149 902 149 915 160" fill="none" stroke="#236D8D" strokeWidth="3" strokeLinecap="round" />
          <path d="M920 142 C933 131 947 131 960 142" fill="none" stroke="#236D8D" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>

      <div className="mini-island left-[7%] top-[10%]">
        <span className="mini-island-grass" />
      </div>
      <div className="mini-island mini-island-large right-[10%] top-[20%]">
        <span className="mini-island-grass" />
      </div>
      <div className="mini-island bottom-[4%] left-[18%]">
        <span className="mini-island-grass" />
      </div>
      <span className="sea-rock left-[12%] top-[15%]" />
      <span className="sea-rock sea-rock-small right-[7%] top-[29%]" />
      <span className="sea-rock left-[8%] top-[47%]" />
      <span className="sea-rock sea-rock-small left-[13%] bottom-[22%]" />
    </>
  );
}

export default function GroupView() {
  const [, params] = useRoute('/group/:groupId');
  const [, setLocation] = useLocation();
  const progressStore = useProgressStore();
  useProgressSync();

  const [activeLetter, setActiveLetter] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [examScore, setExamScore] = useState(0);
  const [groupWasCompleteBeforeLesson, setGroupWasCompleteBeforeLesson] = useState(false);
  const [sessionStartStars] = useState(() => progressStore.getTotalStars());
  const [groupCompleteSessionStars, setGroupCompleteSessionStars] = useState(0);
  const [mapScale, setMapScale] = useState(1);
  const autostartHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncMapScale = () => {
      const availableWidth = Math.max(0, window.innerWidth - 24);
      const widthScale = availableWidth / MAP_WIDTH;
      const heightScale = window.innerHeight >= 1000 ? (window.innerHeight - 520) / 1400 : 1;
      setMapScale(Math.min(1, widthScale, heightScale));
    };

    syncMapScale();
    window.addEventListener('resize', syncMapScale);
    return () => window.removeEventListener('resize', syncMapScale);
  }, []);

  const groupId = parseInt((params as any)?.groupId || '1', 10);
  const group = curriculum.groups.find((item) => item.id === groupId);

  const groupProgress = progressStore.getGroupProgress(groupId);
  const completionPercentage = progressStore.getGroupCompletionPercentage(groupId);
  const allLettersCompleted = groupProgress.completedLetters === groupProgress.totalLetters;
  const nextGroupId = curriculum.groups.find((item) => item.id === groupId + 1)?.id ?? null;
  const devMode = Boolean((progressStore as any).devMode || progressStore.allUnlocked);
  const imageMapConfig = imageMapConfigs[groupId];

  const lessonNodes = useMemo(
    () => {
      if (!group) return [];
      return (
      group.letters.map((letter: any, index: number) => {
        const isCompleted = progressStore.isLetterCompleted(groupId, letter.id);
        const previousCompleted = index === 0 || progressStore.isLetterCompleted(groupId, group.letters[index - 1].id);
        const isLocked = !devMode && !isCompleted && !previousCompleted;
        const letterProgress = progressStore.progress.find((item) => item.groupId === groupId && item.letterId === letter.id);
        const position = getLessonPosition(index);

        return {
          letter,
          index,
          isCompleted,
          isLocked,
          stars: letterProgress?.stars ?? 0,
          current: !isCompleted && !isLocked && group.letters.findIndex((item: any) => !progressStore.isLetterCompleted(groupId, item.id)) === index,
          theme: themeByLetter[letter.id] ?? (index % 2 === 0 ? 'palm' : 'rocks'),
          position,
        };
      })
      );
    },
    [group, groupId, progressStore.progress, devMode]
  );

  const lastNodeY = lessonNodes.at(-1)?.position.y ?? TOP_OFFSET;
  const mapHeight = lastNodeY + BOTTOM_OFFSET;
  const path = getPath(lessonNodes.map((node) => node.position));
  const scaledMapWidth = MAP_WIDTH * mapScale;
  const scaledMapHeight = mapHeight * mapScale;

  useEffect(() => {
    if (!group) return;
    if (typeof window === 'undefined') return;
    const key = `${groupId}-${window.location.search}`;
    if (autostartHandledRef.current === key) return;

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('autostart') !== '1') return;

    autostartHandledRef.current = key;
    if (group.letters.length > 0) {
      setGroupWasCompleteBeforeLesson(allLettersCompleted);
      setActiveLetter(group.letters[0]);
      setViewMode('lesson');
    }
    window.history.replaceState(null, '', `/group/${groupId}`);
  }, [groupId, group, allLettersCompleted]);

  useEffect(() => {
    if (!group) return;
    preloadImages([imageMapConfig?.src ?? getGroupMapSource(groupId)], { priority: true });
  }, [group, groupId, imageMapConfig?.src]);

  const handleLetterClick = (letter: any) => {
    soundEffects.playClick();
    audioService.warmup();
    preloadLessonCriticalImages(letter, { priority: true });
    setGroupWasCompleteBeforeLesson(allLettersCompleted);
    setActiveLetter(letter);
    setViewMode('lesson');
  };

  const handleLetterWarmup = (letter: any) => {
    audioService.warmup();
  };

  const handleLockedLessonClick = (lessonNumber: number) => {
    soundEffects.playError();
    toast.info(`Lesson ${lessonNumber} is locked. Finish the current lesson first.`);
  };

  const handleLessonComplete = () => {
    const updatedProgress = progressStore.getGroupProgress(groupId);
    const isNowComplete = updatedProgress.totalLetters > 0 && updatedProgress.completedLetters === updatedProgress.totalLetters;
    const shouldShowGroupCompletion = !groupWasCompleteBeforeLesson && isNowComplete;

    if (shouldShowGroupCompletion) {
      setGroupCompleteSessionStars(Math.max(0, progressStore.getTotalStars() - sessionStartStars));
      setActiveLetter(null);
      setViewMode('group-complete');
      return;
    }

    setActiveLetter(null);
    setViewMode('map');
  };

  const handleStartExam = () => {
    if (!devMode && !allLettersCompleted) {
      soundEffects.playError();
      toast.info('Finish all lessons in this group before taking the exam.');
      return;
    }

    soundEffects.playClick();
    setViewMode('exam');
  };

  if (!params) return <div>Invalid Route</div>;

  if (!group) return <div>Group not found</div>;

  if (viewMode === 'lesson' && activeLetter) {
    return (
      <LessonEngine
        groupId={groupId}
        letter={activeLetter}
        onComplete={handleLessonComplete}
        onExit={() => {
          setActiveLetter(null);
          setViewMode('map');
        }}
      />
    );
  }

  if (viewMode === 'exam') {
    return <GroupExamScreen groupId={groupId} group={group} onComplete={(score) => { setExamScore(score); setViewMode('exam-result'); }} onExit={() => setViewMode('map')} />;
  }

  if (viewMode === 'exam-result') {
    return <GroupExamResultScreen groupId={groupId} score={examScore} onComplete={() => setLocation('/')} />;
  }

  if (viewMode === 'group-complete') {
    return <GroupCompleteScreen groupId={groupId} starsEarned={groupCompleteSessionStars} nextGroupId={nextGroupId} />;
  }

  if (imageMapConfig) {
    const examPassed = progressStore.isGroupExamPassed(groupId);
    const examUnlocked = devMode || allLettersCompleted;

    return (
      <div className="group-one-screen min-h-screen overflow-x-hidden bg-[#26BDEB] px-3 py-4 text-slate-700 sm:px-5">
        <main className="mx-auto flex w-full max-w-[1060px] flex-col gap-4">
          <header className="group-one-header">
            <div className="mb-4 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setLocation('/')}
                aria-label="Back"
                className="group-one-back flex items-center gap-2 rounded-full text-blue-700 transition hover:text-blue-900 focus-visible:outline focus-visible:outline-4 focus-visible:outline-blue-500/70"
              >
                <ArrowLeft className="group-one-back-icon" strokeWidth={3} />
                <span>Back</span>
              </button>

              <div className="group-one-stars flex items-center justify-center gap-2 rounded-full bg-white shadow-xl ring-1 ring-white/80">
                <Star className="group-one-star-icon fill-amber-400 text-amber-500" strokeWidth={2.5} />
                <span className="font-black text-orange-500">{progressStore.getTotalStars()}</span>
              </div>
            </div>

            <section className="group-one-progress-card bg-white/95 shadow-2xl ring-1 ring-white/80">
              <h1 className="font-black leading-tight text-blue-700">Group {groupId}</h1>
              <p className="mt-1 font-bold text-slate-500">{group.description}</p>
              <div className="mt-2 flex items-center justify-between font-bold text-slate-500">
                <span>Progress</span>
                <span>{groupProgress.completedLetters}/{groupProgress.totalLetters}</span>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-200">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPercentage}%` }}
                  transition={{ duration: 0.85, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500"
                />
              </div>
            </section>
          </header>

          <div
            className="group-one-map relative w-full overflow-hidden"
            style={{ aspectRatio: `${imageMapConfig.width} / ${imageMapConfig.height}` }}
          >
            <img
              src={assetUrl(imageMapConfig.src)}
              alt=""
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full select-none object-cover"
              draggable={false}
            />

            {lessonNodes.map((node) => {
              const zone = imageMapConfig.zones[node.index] ?? imageMapConfig.zones[0];

              return (
                <div
                  key={node.letter.id}
                  className={`group-one-lesson-zone absolute z-20 ${node.isLocked ? 'is-locked' : node.current ? 'is-current' : node.isCompleted ? 'is-completed' : 'is-open'}`}
                  style={{
                    left: `${zone.left}%`,
                    top: `${zone.top}%`,
                    width: `${zone.width}%`,
                    height: `${zone.height}%`,
                  }}
                >
                  <button
                    type="button"
                    aria-label={`${node.isLocked ? 'Locked' : 'Start'} lesson ${node.index + 1}: ${node.letter.letter}`}
                    onClick={() => (node.isLocked ? handleLockedLessonClick(node.index + 1) : handleLetterClick(node.letter))}
                    onMouseEnter={() => !node.isLocked && handleLetterWarmup(node.letter)}
                    onFocus={() => !node.isLocked && handleLetterWarmup(node.letter)}
                    onTouchStart={() => !node.isLocked && handleLetterWarmup(node.letter)}
                    className="absolute inset-0 z-20 rounded-[45%] focus-visible:outline focus-visible:outline-4 focus-visible:outline-blue-600/80"
                  />

                  {node.isLocked && (
                    <div className="pointer-events-none absolute inset-[8%] z-10 grid place-items-center rounded-[45%] bg-slate-900/10 shadow-inner ring-2 ring-white/60 backdrop-blur-[1px] backdrop-grayscale">
                      <span className="grid place-items-center rounded-full bg-white/92 p-2.5 text-slate-600 shadow-xl">
                        <Lock className="group-one-lock-icon" strokeWidth={3} />
                      </span>
                    </div>
                  )}

                  {!node.isLocked && (
                    <div className="pointer-events-none absolute left-1/2 top-[78%] z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white/92 px-2 py-1 shadow-lg ring-1 ring-white/80">
                      {[0, 1, 2].map((starIndex) => (
                        <Star
                          key={starIndex}
                          className={`group-one-lesson-star ${starIndex < node.stars ? 'fill-amber-400 text-amber-500' : 'fill-slate-200 text-slate-300'}`}
                          strokeWidth={2.2}
                        />
                      ))}
                    </div>
                  )}

                  {node.current && (
                    <span className="pointer-events-none absolute inset-[4%] rounded-[45%] ring-4 ring-yellow-300/80 shadow-[0_0_28px_rgba(250,204,21,0.75)]" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="group-one-bottom-actions grid grid-cols-2 gap-6 rounded-3xl bg-white/96 shadow-2xl ring-1 ring-white/80">
            <button
              type="button"
              onClick={() => setLocation('/')}
              className="flex min-w-0 items-center justify-center gap-3 rounded-2xl border-2 border-blue-600 bg-white font-black text-blue-700 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-blue-500/70"
            >
              <ArrowLeft className="group-one-action-icon" strokeWidth={3} />
              <span>Back to Menu</span>
            </button>

            <button
              type="button"
              onClick={handleStartExam}
              disabled={examPassed}
              className={`relative flex min-w-0 items-center justify-center gap-3 rounded-2xl font-black text-white shadow-lg transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-blue-500/70 ${
                examPassed
                  ? 'cursor-default bg-gradient-to-r from-green-500 to-emerald-500'
                  : examUnlocked
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                  : 'bg-slate-400'
              }`}
            >
              {!examUnlocked && !examPassed && <Lock className="group-one-action-icon" strokeWidth={3} />}
              <span>{examPassed ? 'Completed!' : 'Take Exam'}</span>
              {examUnlocked && !examPassed && <ArrowRight className="group-one-action-icon" strokeWidth={3} />}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="lesson-map-screen min-h-screen overflow-x-hidden bg-[#1CB8E9] text-slate-700">
      <div className="relative z-40 bg-gradient-to-b from-[#C7F3FF] via-[#BCEEFF]/96 to-[#BCEEFF]/0 px-5 pb-4 pt-5 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setLocation('/')}
              className="flex items-center gap-2 rounded-full px-1 text-xl font-black text-blue-700 transition hover:text-blue-900 md:text-2xl"
            >
              <ArrowLeft size={27} strokeWidth={3} />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-3 rounded-full bg-white px-5 py-2.5 shadow-xl ring-1 ring-white/80">
              <Star size={29} className="fill-amber-400 text-amber-500" strokeWidth={2.5} />
              <span className="text-2xl font-black text-orange-500">{progressStore.getTotalStars()}</span>
            </div>
          </div>

          <section className="rounded-[1.6rem] bg-white/94 p-5 shadow-2xl ring-1 ring-white/80 md:p-6">
            <h1 className="text-2xl font-black leading-tight text-blue-700 md:text-3xl">Group {groupId}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500 md:text-base">{group.description}</p>
            <div className="mt-2 flex items-center justify-between text-sm font-bold text-slate-500 md:text-base">
              <span>Progress</span>
              <span>{groupProgress.completedLetters}/{groupProgress.totalLetters}</span>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500"
              />
            </div>
          </section>
        </div>
      </div>

      <main className="relative -mt-4 overflow-hidden pb-32">
        <div className="ocean-water absolute inset-0" />
        <div className="relative mx-auto flex w-full justify-center px-3">
          <div className="map-stage-shell" style={{ width: scaledMapWidth, height: scaledMapHeight }}>
            <div className="map-stage" style={{ width: MAP_WIDTH, height: mapHeight, transform: `scale(${mapScale})` }}>
              <OceanScenery />

              <svg className="absolute inset-0 z-0 h-full w-full overflow-visible" viewBox={`0 0 ${MAP_WIDTH} ${mapHeight}`} preserveAspectRatio="none" aria-hidden="true">
                <path d={path} fill="none" stroke="#057FB5" strokeWidth="44" strokeLinecap="round" opacity="0.13" />
                <path d={path} fill="none" stroke="#B7F4FF" strokeWidth="32" strokeLinecap="round" opacity="0.22" />
                <path d={path} fill="none" stroke="#F7FFFF" strokeWidth="16" strokeLinecap="round" strokeDasharray="22 28" opacity="0.98" className="map-path-dashes" />
              </svg>

              {lessonNodes.map((node) => (
                <div
                  key={node.letter.id}
                  className="lesson-node absolute z-10"
                  style={{ left: `${(node.position.x / MAP_WIDTH) * 100}%`, top: node.position.y }}
                >
                  <LessonIsland
                    letter={node.letter.letter}
                    phonics={node.letter.sound}
                    stars={node.stars}
                    completed={node.isCompleted}
                    locked={node.isLocked}
                    current={node.current}
                    preserveLetterCase={groupId === 7}
                    theme={node.theme}
                    lessonNumber={node.index + 1}
                    onClick={() => handleLetterClick(node.letter)}
                    onMouseEnter={() => handleLetterWarmup(node.letter)}
                    onFocus={() => handleLetterWarmup(node.letter)}
                    onTouchStart={() => handleLetterWarmup(node.letter)}
                  />
                </div>
              ))}

              {(devMode || allLettersCompleted) && !progressStore.isGroupExamPassed(groupId) && (
                <motion.button
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleStartExam}
                  className="absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border-4 border-amber-500 bg-gradient-to-r from-yellow-300 to-orange-400 px-7 py-3 text-xl font-black text-slate-800 shadow-2xl"
                  style={{ top: mapHeight - 150 }}
                >
                  <Trophy size={30} />
                  Take Exam
                </motion.button>
              )}

              {progressStore.isGroupExamPassed(groupId) && (
                <div
                  className="absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border-4 border-green-600 bg-gradient-to-r from-green-400 to-emerald-500 px-7 py-3 text-xl font-black text-white shadow-2xl"
                  style={{ top: mapHeight - 150 }}
                >
                  <Trophy size={30} />
                  Completed!
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
        <div className="mx-auto grid max-w-[680px] grid-cols-4 rounded-[1.6rem] bg-white/95 px-4 py-3 shadow-2xl ring-1 ring-white/80 backdrop-blur">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => item.label === 'Lessons' && setLocation('/')}
                className={`grid justify-items-center gap-1 rounded-2xl px-1 py-1.5 text-sm font-bold transition ${item.active ? 'text-blue-700' : 'text-slate-500 hover:text-blue-600'}`}
              >
                <Icon size={30} strokeWidth={item.active ? 2.8 : 2.2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
