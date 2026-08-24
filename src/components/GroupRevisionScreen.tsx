import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Volume2 } from 'lucide-react';
import { audioService } from '@/services/audioService';
import { soundEffects } from '@/services/soundEffects';
import { preloadImages } from '@/utils/preloadImages';
import { handleImageError } from '@/utils/imagePaths';
import { assetUrl } from '@/utils/assetUrl';

interface GroupRevisionScreenProps {
  groupId: number;
  group: any;
  onComplete: () => void;
  onExit: () => void;
}

const CARD_STYLES = [
  'from-pink-400 via-rose-400 to-orange-400 shadow-rose-300/50',
  'from-sky-400 via-cyan-400 to-teal-400 shadow-cyan-300/50',
  'from-violet-500 via-purple-500 to-fuchsia-500 shadow-purple-300/50',
];

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export default function GroupRevisionScreen({ groupId, group, onComplete, onExit }: GroupRevisionScreenProps) {
  const letters = group?.letters || [];
  const [letterIndex, setLetterIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [speakingWord, setSpeakingWord] = useState('');
  const playbackIdRef = useRef(0);
  const announcedLetterRef = useRef('');
  const currentLetter = letters[letterIndex];
  const words = useMemo(() => (currentLetter?.vocabulary || []).slice(0, 3), [currentLetter]);
  const isLastLetter = letterIndex === letters.length - 1;

  useEffect(() => {
    if (!currentLetter) return;
    const nextLetter = letters[letterIndex + 1];
    preloadImages(
      [...(currentLetter.vocabulary || []), ...(nextLetter?.vocabulary || [])]
        .slice(0, 6)
        .map((item: any) => item.image),
      { priority: true },
    );
    audioService.preloadPromptAudio(currentLetter.letter || currentLetter.id);
    words.forEach((item: any) => audioService.preloadPromptAudio(item.word));
  }, [currentLetter, letterIndex, letters, words]);

  useEffect(() => () => {
    playbackIdRef.current += 1;
    audioService.stop();
  }, []);

  const playWord = async (word: string) => {
    playbackIdRef.current += 1;
    setSpeakingWord(word);
    try {
      await audioService.playPrompt(word);
    } finally {
      setSpeakingWord('');
    }
  };

  const revealWords = async (playClick = true) => {
    if (playClick) soundEffects.playClick();
    if (revealed) {
      await playWord(currentLetter.letter || currentLetter.id);
      return;
    }

    setRevealed(true);
    const playbackId = playbackIdRef.current + 1;
    playbackIdRef.current = playbackId;
    await audioService.playPrompt(currentLetter.letter || currentLetter.id);

    for (const item of words) {
      if (playbackIdRef.current !== playbackId) return;
      await wait(120);
      if (playbackIdRef.current !== playbackId) return;
      setSpeakingWord(item.word);
      await audioService.playPrompt(item.word);
    }
    if (playbackIdRef.current === playbackId) setSpeakingWord('');
  };

  useEffect(() => {
    if (!currentLetter) return;
    const announcementKey = `${groupId}-${currentLetter.id}`;
    if (announcedLetterRef.current === announcementKey) return;

    const timeoutId = window.setTimeout(() => {
      announcedLetterRef.current = announcementKey;
      void revealWords(false);
    }, 300);

    return () => window.clearTimeout(timeoutId);
    // The revision narration runs once whenever a new letter card appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, currentLetter?.id]);

  const advance = () => {
    soundEffects.playClick();
    playbackIdRef.current += 1;
    audioService.stop();
    setSpeakingWord('');

    if (isLastLetter) {
      onComplete();
      return;
    }

    setRevealed(false);
    setLetterIndex((index) => index + 1);
  };

  if (!currentLetter) return null;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-cyan-100 via-indigo-100 to-pink-100 px-4 py-5 text-slate-800 md:px-8">
      <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-cyan-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-16 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <button
          type="button"
          onClick={onExit}
          aria-label="Back to group"
          className="grid h-12 w-12 place-items-center rounded-full bg-white text-indigo-700 shadow-lg transition hover:-translate-x-1"
        >
          <ArrowLeft size={27} strokeWidth={3} />
        </button>
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-indigo-500">Group {groupId}</p>
          <h1 className="text-2xl font-black text-indigo-900 md:text-4xl">Magic Revision</h1>
        </div>
        <div className="h-12 w-12" aria-hidden="true" />
      </header>

      <div className="relative z-10 mx-auto mt-4 flex max-w-xl justify-center gap-2" aria-label="Revision progress">
        {letters.map((letter: any, index: number) => (
          <span
            key={letter.id}
            className={`h-3 rounded-full transition-all duration-500 ${
              index === letterIndex ? 'w-10 bg-indigo-600' : index < letterIndex ? 'w-3 bg-emerald-400' : 'w-3 bg-white/80'
            }`}
          />
        ))}
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 items-center justify-center py-5">
        <AnimatePresence mode="wait">
          <motion.section
            key={currentLetter.id}
            initial={{ opacity: 0, x: 90, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -90, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className="flex w-full flex-col items-center"
          >
              <motion.button
              type="button"
              onClick={() => void revealWords()}
                aria-label={revealed
                  ? `Play ${String(currentLetter.letter).toLowerCase() === 'ck' ? 'c and k' : currentLetter.letter}`
                  : `Reveal words for ${String(currentLetter.letter).toLowerCase() === 'ck' ? 'c and k' : currentLetter.letter}`}
              whileHover={{ scale: 1.07, rotate: -2 }}
              whileTap={{ scale: 0.93 }}
              className="relative grid min-h-40 min-w-40 place-items-center rounded-[3rem] border-[7px] border-white bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 px-8 text-white shadow-[0_24px_60px_rgba(244,114,182,0.35)] md:min-h-52 md:min-w-52"
            >
              <Sparkles className="absolute left-5 top-5 text-yellow-100" size={28} />
              <Volume2 className="absolute right-5 top-5 rounded-full bg-white/20 p-1" size={30} />
              <motion.span
                animate={revealed ? { y: [0, -7, 0] } : { scale: [1, 1.06, 1] }}
                transition={{ duration: revealed ? 2.4 : 1.7, repeat: Infinity, ease: 'easeInOut' }}
                className="text-7xl font-black drop-shadow-lg md:text-9xl"
              >
                {String(currentLetter.letter).toLowerCase() === 'ck' ? 'c k' : currentLetter.letter}
              </motion.span>
            </motion.button>

            <p className="mt-4 text-base font-black text-indigo-700 md:text-lg">
              {revealed ? 'Tap any picture to hear it again' : 'Tap the letter to reveal its words'}
            </p>

            <div className="mt-5 min-h-52 w-full">
              <AnimatePresence>
                {revealed && (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-3 gap-3 md:gap-6"
                  >
                    {words.map((item: any, index: number) => (
                      <motion.button
                        key={item.word}
                        type="button"
                        variants={{
                          hidden: { opacity: 0, y: 55, scale: 0.65, rotate: index === 1 ? 0 : index === 0 ? -8 : 8 },
                          visible: { opacity: 1, y: 0, scale: 1, rotate: 0 },
                        }}
                        transition={{ delay: index * 0.16, type: 'spring', stiffness: 270, damping: 20 }}
                        whileHover={{ y: -8, scale: 1.04 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => void playWord(item.word)}
                        aria-label={`Play ${item.word}`}
                        className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br p-2 shadow-2xl ${CARD_STYLES[index % CARD_STYLES.length]} md:p-3`}
                      >
                        <span className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-indigo-600 shadow">
                          <Volume2 size={17} strokeWidth={3} />
                        </span>
                        <div className="rounded-[1.45rem] bg-white p-2 md:p-3">
                          <img
                            src={assetUrl(item.image)}
                            alt={item.word}
                            onError={handleImageError}
                            className="h-24 w-full object-contain md:h-32"
                            loading="eager"
                            decoding="async"
                          />
                        </div>
                        <span className="mt-2 block truncate px-1 pb-1 text-lg font-black text-white drop-shadow md:text-2xl">
                          {item.word}
                        </span>
                        {speakingWord === item.word && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: [0.8, 1.15, 1] }}
                            className="absolute inset-0 grid place-items-center bg-indigo-700/25"
                            aria-hidden="true"
                          >
                            <Volume2 className="text-white drop-shadow-lg" size={52} />
                          </motion.span>
                        )}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {revealed && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={advance}
                  className="mt-5 flex items-center gap-3 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-4 text-xl font-black text-white shadow-xl"
                >
                  {isLastLetter ? 'Start Exam' : 'Next Letter'}
                  <ArrowRight size={26} strokeWidth={3} />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
}
