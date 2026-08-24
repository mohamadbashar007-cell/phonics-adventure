import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play, Sparkles, Volume2 } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { getCapitalIntroLetterAudioPath, getIntroSoundAudioPaths } from '../../utils/audioPaths';
import { getInitialSoundCharacters } from '../../utils/initialSound';
import { getStoryVideoPath } from '../../utils/storyVideos';

interface StoryScreenProps {
  letter: {
    id?: string;
    letter?: string;
  };
  onComplete: () => void;
}

const wait = (duration: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, duration);
});

const LETTER_PALETTES = [
  {
    frame: 'border-sky-200 from-cyan-50 via-white to-violet-100',
    glow: 'from-cyan-300 via-blue-400 to-violet-400',
    text: 'from-sky-500 via-blue-600 to-violet-600',
    badge: 'from-blue-500 to-violet-600',
  },
  {
    frame: 'border-pink-200 from-rose-50 via-white to-amber-100',
    glow: 'from-pink-300 via-rose-400 to-amber-300',
    text: 'from-pink-500 via-rose-500 to-orange-500',
    badge: 'from-pink-500 to-orange-500',
  },
  {
    frame: 'border-emerald-200 from-emerald-50 via-white to-cyan-100',
    glow: 'from-emerald-300 via-teal-400 to-cyan-300',
    text: 'from-emerald-500 via-teal-600 to-cyan-600',
    badge: 'from-emerald-500 to-cyan-600',
  },
  {
    frame: 'border-amber-200 from-yellow-50 via-white to-orange-100',
    glow: 'from-yellow-300 via-amber-400 to-orange-400',
    text: 'from-amber-500 via-orange-500 to-rose-500',
    badge: 'from-amber-500 to-rose-500',
  },
];

export default function StoryScreen({ letter, onComplete }: StoryScreenProps) {
  const isCapitalLesson = String(letter.id || '').startsWith('capital-');
  const videoSrc = getStoryVideoPath(letter);
  const playbackIdRef = useRef(0);
  const [playingSound, setPlayingSound] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(Boolean(videoSrc));
  const [videoFailed, setVideoFailed] = useState(false);

  const soundUnits = useMemo(() => {
    const units = getInitialSoundCharacters(letter.letter || letter.id);
    return units.length > 0 ? units : [String(letter.id || letter.letter || '').toLowerCase()];
  }, [letter.id, letter.letter]);
  const soundKey = soundUnits.join('|');
  const displayUnits = isCapitalLesson
    ? soundUnits.map((sound) => `${sound.toUpperCase()} ${sound.toLowerCase()}`)
    : soundUnits.length > 1
      ? soundUnits
      : [String(letter.letter || letter.id || '').toLowerCase()];

  const playLessonSound = async (sound: string, isCurrent: () => boolean = () => true) => {
    if (isCapitalLesson) {
      await audioService.playAudioFile(getCapitalIntroLetterAudioPath(sound));
      return;
    }

    const introAudioPaths = getIntroSoundAudioPaths(sound);
    if (!introAudioPaths.length) {
      await audioService.playPrompt(sound);
      return;
    }

    for (let index = 0; index < introAudioPaths.length; index += 1) {
      if (!isCurrent()) return;
      await audioService.playAudioFile(introAudioPaths[index]);
      if (!isCurrent()) return;
      if (index < introAudioPaths.length - 1) await wait(120);
    }
  };

  useEffect(() => {
    const playbackId = playbackIdRef.current + 1;
    playbackIdRef.current = playbackId;
    soundUnits.forEach((sound) => {
      if (isCapitalLesson) {
        audioService.preloadAudioFile(getCapitalIntroLetterAudioPath(sound), { priority: true });
      } else {
        const introAudioPaths = getIntroSoundAudioPaths(sound);
        if (introAudioPaths.length) {
          introAudioPaths.forEach((src) => audioService.preloadAudioFile(src, { priority: true }));
        } else {
          audioService.preloadPromptAudio(sound);
        }
      }
    });

    const timeoutId = window.setTimeout(async () => {
      for (const sound of soundUnits) {
        if (playbackIdRef.current !== playbackId) return;
        setPlayingSound(sound);
        await playLessonSound(sound, () => playbackIdRef.current === playbackId);
        if (playbackIdRef.current !== playbackId) return;
        await wait(120);
      }
      if (playbackIdRef.current === playbackId) setPlayingSound('');
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      playbackIdRef.current += 1;
      audioService.stop();
    };
    // soundKey represents the complete, stable sound sequence for this lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundKey, videoSrc]);

  const replaySound = async (sound: string) => {
    const playbackId = playbackIdRef.current + 1;
    playbackIdRef.current = playbackId;
    audioService.stop();
    setPlayingSound(sound);
    try {
      await playLessonSound(sound, () => playbackIdRef.current === playbackId);
    } finally {
      if (playbackIdRef.current === playbackId) setPlayingSound('');
    }
  };

  const handleVideoPlay = () => {
    playbackIdRef.current += 1;
    audioService.stop();
    setPlayingSound('');
    setIsVideoLoading(false);
  };

  const openVideoDirectly = () => {
    if (videoSrc) window.open(videoSrc, '_blank', 'noopener,noreferrer');
  };

  const startLearning = () => {
    playbackIdRef.current += 1;
    audioService.stop();
    onComplete();
  };

  return (
    <div className="relative mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col items-center justify-start overflow-hidden px-3 py-2 text-center sm:min-h-full sm:justify-center sm:px-4 sm:py-5 md:px-8 md:py-8">
      <div className="pointer-events-none absolute left-[6%] top-[12%] h-36 w-36 rounded-full bg-blue-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[8%] right-[5%] h-44 w-44 rounded-full bg-fuchsia-200/25 blur-3xl" />

      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 mb-2 sm:mb-4 md:mb-7"
      >
        <p className="mb-0.5 text-xs font-black uppercase tracking-[0.24em] text-blue-500 sm:mb-1 sm:text-sm sm:tracking-[0.28em] md:text-base">
          Ready to learn?
        </p>
        <h1 className="text-2xl font-black text-slate-800 sm:text-3xl md:text-5xl">
          {isCapitalLesson ? 'Meet the letters' : 'Meet the sound'}
        </h1>
      </motion.div>

      <div className="relative z-10 grid min-h-0 w-full items-stretch gap-2 sm:gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-8">
        <motion.section
          initial={{ x: -35, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex min-h-[175px] flex-col items-center justify-center rounded-[1.5rem] border-[3px] border-white/90 bg-white/80 p-3 shadow-xl backdrop-blur-sm sm:min-h-[270px] sm:rounded-[2.25rem] sm:border-4 sm:p-5 md:min-h-[390px] md:p-8"
          aria-label="Lesson sound"
        >
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
            {displayUnits.map((display, index) => {
              const sound = soundUnits[Math.min(index, soundUnits.length - 1)];
              const isPlaying = playingSound === sound;
              const hasMultipleLetters = displayUnits.length > 1;
              const isMultiCharacterSound = Array.from(display).length > 1;
              const hasLowercaseDescender = !isCapitalLesson && /[gjpqy]/.test(display);
              const palette = LETTER_PALETTES[index % LETTER_PALETTES.length];
              return (
                <motion.button
                  key={`${display}-${index}`}
                  type="button"
                  onClick={() => void replaySound(sound)}
                  animate={isPlaying ? { scale: [1, 1.08, 1] } : { y: [0, -5, 0] }}
                  transition={isPlaying
                    ? { duration: 0.55, repeat: Infinity }
                    : { duration: 3, repeat: Infinity, delay: index * 0.15 }}
                  whileHover={{ scale: 1.05, rotate: index % 2 === 0 ? -2 : 2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`group relative isolate flex items-center justify-center rounded-[2rem] border-[6px] bg-gradient-to-br font-black leading-none shadow-[0_18px_44px_rgba(79,70,229,0.2)] outline-none transition-shadow hover:shadow-[0_24px_54px_rgba(79,70,229,0.3)] focus-visible:ring-4 focus-visible:ring-blue-300 ${palette.frame} ${
                    hasMultipleLetters
                      ? 'h-20 w-24 text-3xl sm:h-28 sm:w-32 sm:text-4xl md:h-36 md:w-40 md:text-5xl'
                      : isMultiCharacterSound
                        ? 'h-28 w-28 text-[4.5rem] sm:h-44 sm:w-44 sm:text-[5.75rem] md:h-60 md:w-60 md:text-[7.5rem]'
                        : 'h-28 w-28 text-[5.5rem] sm:h-44 sm:w-44 sm:text-[7.5rem] md:h-60 md:w-60 md:text-[10rem]'
                  }`}
                  aria-label={isCapitalLesson ? `Play ${display} again` : `Play ${sound} sound again`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute -inset-3 -z-10 rounded-[2.5rem] bg-gradient-to-br opacity-30 blur-lg transition-opacity group-hover:opacity-50 ${palette.glow}`}
                  />
                  <span aria-hidden="true" className="absolute inset-2 rounded-[1.45rem] border-2 border-white/90 shadow-inner" />
                  <Sparkles
                    aria-hidden="true"
                    className={`absolute text-amber-400 drop-shadow-sm ${hasMultipleLetters ? 'left-2 top-2' : 'left-4 top-4 md:left-6 md:top-6'}`}
                    size={hasMultipleLetters ? 19 : 27}
                  />
                  <span
                    aria-hidden="true"
                    className={`absolute rounded-full bg-white/90 shadow-sm ${hasMultipleLetters ? 'bottom-4 left-3 h-2 w-2' : 'bottom-7 left-6 h-3 w-3 md:bottom-10 md:left-9'}`}
                  />
                  <span className={`relative z-10 inline-block overflow-visible bg-gradient-to-b bg-clip-text px-[0.04em] text-transparent drop-shadow-[0_5px_8px_rgba(59,130,246,0.18)] ${palette.text} ${
                    hasLowercaseDescender ? 'pb-[0.18em] leading-[1.15]' : 'leading-none'
                  }`}>
                    {display}
                  </span>
                  <span className={`absolute -bottom-2 -right-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_8px_18px_rgba(37,99,235,0.35)] ring-4 ring-white sm:-bottom-3 sm:-right-3 sm:h-12 sm:w-12 md:h-14 md:w-14 ${
                    isPlaying ? 'from-emerald-400 to-teal-600' : palette.badge
                  }`}>
                    {isPlaying ? <Loader2 className="animate-spin" size={25} /> : <Volume2 size={27} />}
                  </span>
                </motion.button>
              );
            })}
          </div>
          <p className="mt-3 text-sm font-bold text-slate-500 sm:mt-6 sm:text-base md:mt-8 md:text-xl">
            {isCapitalLesson
              ? 'Tap a letter pair to hear it again'
              : `Tap ${displayUnits.length > 1 ? 'a letter' : 'the letter'} to hear the sound again`}
          </p>
        </motion.section>

        <motion.section
          initial={{ x: 35, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="rounded-[1.5rem] border-[3px] border-white/90 bg-white/80 p-2 text-left shadow-xl backdrop-blur-sm sm:rounded-[2.25rem] sm:border-4 sm:p-4 md:p-6"
        >
          <div className="mb-1 flex items-center gap-2 px-1 sm:mb-3 sm:gap-3 md:mb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md sm:h-11 sm:w-11 sm:rounded-2xl">
              <Play fill="currentColor" size={22} />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-800 sm:text-xl md:text-2xl">Watch and learn</h2>
              <p className="text-[11px] font-semibold leading-tight text-slate-500 sm:text-sm md:text-base">Play the lesson video when you are ready.</p>
            </div>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900 shadow-inner sm:rounded-3xl">
            {videoSrc && !videoFailed ? (
              <video
                key={videoSrc}
                src={videoSrc}
                controls
                playsInline
                preload="metadata"
                onLoadStart={() => setIsVideoLoading(true)}
                onLoadedMetadata={() => setIsVideoLoading(false)}
                onCanPlay={() => setIsVideoLoading(false)}
                onPlaying={handleVideoPlay}
                onWaiting={() => setIsVideoLoading(true)}
                onError={() => {
                  setIsVideoLoading(false);
                  setVideoFailed(true);
                }}
                className="h-full w-full bg-black object-contain"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-800 to-slate-950 p-6 text-center text-white">
                <Play size={42} />
                <p className="font-bold">The video could not open here.</p>
                {videoSrc && (
                  <button
                    type="button"
                    onClick={openVideoDirectly}
                    className="rounded-full bg-white px-5 py-2 font-black text-blue-700 transition-transform active:scale-95"
                  >
                    Open Video
                  </button>
                )}
              </div>
            )}
            {isVideoLoading && videoSrc && !videoFailed && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                <Loader2 className="animate-spin" size={40} />
              </div>
            )}
          </div>
        </motion.section>
      </div>

      <motion.button
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        type="button"
        onClick={startLearning}
        className="relative z-10 mt-2 w-full max-w-xl rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-base font-black text-white shadow-[0_14px_32px_rgba(37,99,235,0.3)] transition-shadow hover:shadow-[0_18px_38px_rgba(37,99,235,0.42)] sm:mt-5 sm:py-3.5 sm:text-xl md:mt-7 md:py-4 md:text-2xl"
      >
        Start Learning <span aria-hidden="true">→</span>
      </motion.button>
    </div>
  );
}
