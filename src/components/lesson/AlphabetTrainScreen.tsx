import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, type PanInfo, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Sparkles, Star, Volume2 } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { soundEffects } from '../../services/soundEffects';
import { getAlphabetTrainLetterAudioPath } from '../../utils/audioPaths';

interface AlphabetTrainScreenProps {
  letter: any;
  onComplete: () => void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const WAGON_THEMES = [
  { shell: 'from-rose-500 via-pink-500 to-fuchsia-600', rim: 'border-rose-800', glow: 'shadow-rose-500/30' },
  { shell: 'from-amber-400 via-orange-500 to-red-500', rim: 'border-orange-800', glow: 'shadow-orange-500/30' },
  { shell: 'from-emerald-400 via-teal-500 to-cyan-600', rim: 'border-teal-800', glow: 'shadow-teal-500/30' },
  { shell: 'from-sky-400 via-blue-500 to-indigo-600', rim: 'border-blue-800', glow: 'shadow-blue-500/30' },
  { shell: 'from-violet-500 via-purple-500 to-fuchsia-600', rim: 'border-purple-900', glow: 'shadow-purple-500/30' },
];

function shuffleLetters(letters: string[]) {
  const shuffled = [...letters];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (shuffled.length > 1 && shuffled.every((item, index) => item === letters[index])) {
    return [...shuffled.slice(1), shuffled[0]];
  }
  return shuffled;
}

function Wheel({ className = '' }: { className?: string }) {
  return (
    <motion.span
      aria-hidden="true"
      animate={{ rotate: 360 }}
      transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
      className={`absolute z-20 grid h-10 w-10 place-items-center rounded-full border-[5px] border-slate-800 bg-slate-300 shadow-lg ${className}`}
    >
      <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
      <span className="absolute h-1 w-7 rounded-full bg-slate-600" />
      <span className="absolute h-7 w-1 rounded-full bg-slate-600" />
    </motion.span>
  );
}

function Locomotive({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="relative mr-5 h-44 w-60 shrink-0" aria-label="Phonics Express locomotive">
      {!reducedMotion && [0, 1, 2].map((puff) => (
        <motion.span
          key={puff}
          aria-hidden="true"
          initial={{ x: 0, y: 0, scale: 0.45, opacity: 0 }}
          animate={{ x: 18 + puff * 12, y: -70 - puff * 12, scale: 1.2 + puff * 0.25, opacity: [0, 0.7, 0] }}
          transition={{ duration: 2.7, delay: puff * 0.65, repeat: Infinity, ease: 'easeOut' }}
          className="absolute left-10 top-4 z-0 h-10 w-10 rounded-full bg-white/80 blur-[1px]"
        />
      ))}

      <div className="absolute bottom-7 left-2 z-10 h-20 w-43 rounded-l-[2.25rem] rounded-r-xl border-[6px] border-indigo-950 bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-800 shadow-2xl shadow-indigo-900/35">
        <div className="absolute -top-14 right-2 h-20 w-24 rounded-t-3xl border-[6px] border-indigo-950 bg-gradient-to-br from-violet-500 to-indigo-700">
          <div className="absolute left-3 top-3 h-10 w-14 rounded-xl border-4 border-indigo-950 bg-gradient-to-br from-cyan-100 to-sky-300 shadow-inner">
            <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-white/80" />
          </div>
        </div>
        <div className="absolute -top-12 left-7 h-12 w-10 rounded-t-lg border-x-[6px] border-indigo-950 bg-indigo-800">
          <div className="absolute -left-3 -top-4 h-5 w-16 rounded-full border-4 border-indigo-950 bg-amber-400" />
        </div>
        <div className="absolute left-7 top-7 rounded-lg border border-white/30 bg-indigo-950/40 px-3 py-1 text-xs font-black tracking-[0.18em] text-white">
          PHONICS
        </div>
        <div className="absolute -left-1 top-4 h-10 w-7 rounded-l-full border-4 border-amber-800 bg-gradient-to-br from-yellow-200 to-amber-500 shadow-[0_0_24px_rgba(251,191,36,0.75)]" />
      </div>

      <div className="absolute bottom-5 left-0 z-0 h-3 w-48 rounded-full bg-indigo-950" />
      <div className="absolute bottom-7 right-0 h-14 w-16 [clip-path:polygon(100%_100%,0_100%,34%_0)] bg-gradient-to-r from-rose-600 to-red-500" />
      <Wheel className="bottom-0 left-7" />
      <Wheel className="bottom-0 left-25" />
      <Wheel className="bottom-0 right-7" />
    </div>
  );
}

export default function AlphabetTrainScreen({ letter, onComplete }: AlphabetTrainScreenProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const viewportRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const draggedLetterRef = useRef('');
  const lessonLetters = useMemo(() => String(letter?.letter || '').match(/[A-Z]/g) || [], [letter?.letter]);
  const lessonKey = lessonLetters.join('');
  const [shuffledLessonLetters, setShuffledLessonLetters] = useState(() => shuffleLetters(lessonLetters));
  const [placedLetters, setPlacedLetters] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const accumulatedLetters = useMemo(() => {
    const lastLetter = lessonLetters.at(-1);
    const lastIndex = lastLetter ? ALPHABET.indexOf(lastLetter) : -1;
    return lastIndex >= 0 ? ALPHABET.slice(0, lastIndex + 1).split('') : lessonLetters;
  }, [lessonLetters]);
  const newLetters = useMemo(() => new Set(lessonLetters), [lessonLetters]);
  const previouslyLearnedLetters = useMemo(
    () => accumulatedLetters.filter((capital) => !newLetters.has(capital)),
    [accumulatedLetters, newLetters],
  );
  const aboardLetters = useMemo(
    () => [...previouslyLearnedLetters, ...placedLetters],
    [placedLetters, previouslyLearnedLetters],
  );
  const remainingLetters = shuffledLessonLetters.filter((capital) => !placedLetters.includes(capital));
  const nextLetter = lessonLetters[placedLetters.length];
  const canContinue = lessonLetters.length > 0 && placedLetters.length === lessonLetters.length;
  const isCompleteAlphabet = canContinue && aboardLetters.length === ALPHABET.length;
  const progress = Math.round((aboardLetters.length / ALPHABET.length) * 100);

  useEffect(() => {
    setShuffledLessonLetters(shuffleLetters(lessonLetters));
    setPlacedLetters([]);
    setFeedback('');
    lessonLetters.forEach((capital) => {
      audioService.preloadAudioFile(getAlphabetTrainLetterAudioPath(capital), { priority: true });
    });

    return () => audioService.stop();
    // lessonKey represents the complete stable letter set for this train task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonKey]);

  useEffect(() => {
    const scrollTimeout = window.setTimeout(() => {
      const viewport = viewportRef.current;
      if (viewport) viewport.scrollTo({ left: viewport.scrollWidth, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }, prefersReducedMotion ? 40 : 180);

    return () => window.clearTimeout(scrollTimeout);
  }, [aboardLetters.length, prefersReducedMotion]);

  const playLetterName = (capital: string) => {
    soundEffects.playClick();
    void audioService.playAudioFile(getAlphabetTrainLetterAudioPath(capital));
  };

  const placeLetter = (capital: string) => {
    if (!nextLetter || placedLetters.includes(capital)) return;
    if (capital !== nextLetter) {
      void soundEffects.playError();
      setFeedback(`Find ${nextLetter}${nextLetter.toLowerCase()} first`);
      window.setTimeout(() => setFeedback(''), 900);
      return;
    }

    void soundEffects.playSuccess();
    setPlacedLetters((current) => [...current, capital]);
    setFeedback(`${capital}${capital.toLowerCase()} is aboard!`);
    window.setTimeout(() => setFeedback(''), 900);
  };

  const handleLetterDrop = (capital: string, info: PanInfo) => {
    const dropRect = dropZoneRef.current?.getBoundingClientRect();
    const landedOnTrain = Boolean(dropRect)
      && info.point.x >= dropRect!.left
      && info.point.x <= dropRect!.right
      && info.point.y >= dropRect!.top
      && info.point.y <= dropRect!.bottom;

    if (landedOnTrain) placeLetter(capital);
    window.setTimeout(() => {
      if (draggedLetterRef.current === capital) draggedLetterRef.current = '';
    }, 0);
  };

  const finish = () => {
    soundEffects.playCelebration();
    onComplete();
  };

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-[#07152f] text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(56,189,248,0.24),transparent_30%),radial-gradient(circle_at_82%_14%,rgba(168,85,247,0.22),transparent_28%),linear-gradient(180deg,#07152f_0%,#12346a_48%,#70c8d0_72%,#123327_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[43%] h-[35%] opacity-70 [clip-path:polygon(0_70%,8%_43%,16%_66%,27%_23%,38%_64%,49%_31%,61%_65%,73%_17%,85%_60%,94%_35%,100%_58%,100%_100%,0_100%)] bg-gradient-to-b from-indigo-700 to-emerald-950" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:42px_42px]" />

      {!prefersReducedMotion && [0, 1, 2].map((cloud) => (
        <motion.div
          key={cloud}
          aria-hidden="true"
          initial={{ x: `${-35 - cloud * 18}vw` }}
          animate={{ x: '125vw' }}
          transition={{ duration: 34 + cloud * 9, delay: cloud * 4, repeat: Infinity, ease: 'linear' }}
          className="pointer-events-none absolute top-[18%] h-8 w-36 rounded-full bg-white/15 blur-[1px] before:absolute before:-top-4 before:left-7 before:h-10 before:w-12 before:rounded-full before:bg-white/15 after:absolute after:-top-6 after:right-7 after:h-12 after:w-16 after:rounded-full after:bg-white/15"
        />
      ))}

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 pb-3 pt-2 md:px-8 md:pb-7 md:pt-5">
        <motion.header
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-white/15 bg-white/10 px-3 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl md:flex-row md:items-center md:justify-between md:rounded-[2rem] md:px-7 md:py-4"
        >
          <div className="flex items-center justify-center gap-4 text-left">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-200/40 bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg shadow-orange-500/30 md:h-14 md:w-14 md:rounded-2xl">
              <Star className="fill-white text-white" size={24} />
              <span className="absolute -right-2 -top-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black text-emerald-950">EXPRESS</span>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200 md:text-xs md:tracking-[0.3em]">Phonics Adventure Railway</p>
              <h2 className="text-xl font-black leading-tight text-white md:text-4xl">
                {isCompleteAlphabet ? 'Alphabet Express Complete!' : 'The Alphabet Express'}
              </h2>
              <p className="mt-1 text-xs font-bold text-sky-100/80 md:text-sm">
                New passengers: {lessonLetters.map((item) => `${item}${item.toLowerCase()}`).join(' · ')}
              </p>
            </div>
          </div>

          <div className="w-full min-w-0 rounded-2xl border border-white/15 bg-slate-950/35 p-3 text-left shadow-inner md:min-w-[230px]">
            <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-sky-100">
              <span>{aboardLetters.length} of 26 aboard</span>
              <span className="text-amber-300">{progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-slate-950/70 p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-500 shadow-[0_0_16px_rgba(56,189,248,.8)]"
              />
            </div>
          </div>
        </motion.header>

        <section className="relative mt-3 flex h-[21rem] flex-none flex-col justify-end overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-sky-300/10 via-transparent to-emerald-950/50 shadow-[0_28px_80px_rgba(0,0,0,.38)] backdrop-blur-[2px] md:mt-5 md:min-h-[330px] md:flex-1 md:rounded-[2.25rem]">
          <div className="pointer-events-none absolute left-5 top-5 hidden rounded-xl border border-white/20 bg-slate-950/45 px-4 py-2 text-left shadow-xl backdrop-blur-md sm:block">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-200">Next stop</p>
            <p className="text-lg font-black text-white">{nextLetter ? `Letter ${nextLetter}` : 'All aboard!'}</p>
          </div>

          <div className="absolute inset-x-2 top-3 z-30 flex flex-col items-center gap-2 sm:inset-x-36 md:top-4">
            <p className="rounded-full bg-slate-950/45 px-4 py-1 text-xs font-black text-cyan-100 shadow-md backdrop-blur-sm md:text-sm">
              Drag the letters to the train in order
            </p>
            <div className="flex min-h-16 items-center justify-center gap-2 md:min-h-20 md:gap-4">
              {remainingLetters.map((capital, index) => (
                <motion.button
                  key={capital}
                  type="button"
                  drag
                  dragSnapToOrigin
                  dragMomentum={false}
                  dragElastic={0.12}
                  onPointerDown={() => playLetterName(capital)}
                  onDragStart={() => {
                    draggedLetterRef.current = capital;
                  }}
                  onDragEnd={(_, info) => handleLetterDrop(capital, info)}
                  onClick={() => {
                    if (draggedLetterRef.current === capital) return;
                    placeLetter(capital);
                  }}
                  whileHover={{ y: -4, scale: 1.06 }}
                  whileTap={{ scale: 0.96 }}
                  aria-label={`Letter ${capital}. Drag it to the train`}
                  className={`relative z-40 grid h-14 w-16 cursor-grab place-items-center rounded-2xl border-4 border-white bg-gradient-to-br text-2xl font-black text-white shadow-xl active:cursor-grabbing md:h-18 md:w-20 md:text-3xl ${
                    WAGON_THEMES[index % WAGON_THEMES.length].shell
                  }`}
                >
                  <span>{capital}<span className="text-[0.72em]">{capital.toLowerCase()}</span></span>
                  <Volume2 className="absolute bottom-0.5 right-0.5 rounded-full bg-slate-950/35 p-0.5" size={16} />
                </motion.button>
              ))}
            </div>
          </div>

          <div ref={viewportRef} className="relative z-10 w-full touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 pb-8 pt-28 md:px-9 md:pb-12 md:pt-32 [scrollbar-color:#38bdf8_rgba(15,23,42,.35)] [scrollbar-width:thin]">
            <motion.div
              initial={false}
              animate={{ opacity: 1 }}
              className="flex w-max items-end [zoom:0.46] md:min-w-full md:[zoom:1]"
            >
              <Locomotive reducedMotion={prefersReducedMotion} />

              {aboardLetters.map((capital, index) => {
                const theme = WAGON_THEMES[index % WAGON_THEMES.length];
                const isNew = newLetters.has(capital);
                return (
                  <motion.div
                    key={capital}
                    initial={prefersReducedMotion ? false : { opacity: 0, x: 120, y: -24, scale: 0.72 }}
                    animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    transition={{
                      delay: 0,
                      duration: prefersReducedMotion ? 0 : 0.36,
                      ease: 'easeOut',
                    }}
                    className="relative flex items-end"
                  >
                    <span className="mb-12 h-3 w-6 border-y-2 border-slate-950 bg-amber-300" aria-hidden="true" />
                    <motion.button
                      type="button"
                      onClick={() => playLetterName(capital)}
                      whileHover={{ y: -8, scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      aria-label={`Play ${capital} and ${capital.toLowerCase()}`}
                      className={`relative h-32 w-29 shrink-0 rounded-[1.65rem] border-[6px] bg-gradient-to-br ${theme.shell} ${theme.rim} shadow-2xl ${theme.glow} focus:outline-none focus:ring-4 focus:ring-cyan-300`}
                    >
                      <span className="absolute inset-x-2 top-2 h-4 rounded-full bg-white/30" />
                      <span className="absolute left-1/2 top-8 flex -translate-x-1/2 items-baseline gap-0.5 text-white drop-shadow-lg">
                        <span className="text-5xl font-black">{capital}</span>
                        <span className="text-4xl font-black text-white/90">{capital.toLowerCase()}</span>
                      </span>
                      <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-slate-950/30 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/90">
                        <Volume2 size={11} /> tap
                      </span>
                      {isNew && (
                        <motion.span
                          animate={prefersReducedMotion ? undefined : { scale: [1, 1.12, 1], rotate: [0, 3, -3, 0] }}
                          transition={{ duration: 1.8, repeat: Infinity }}
                          className="absolute -right-3 -top-4 flex items-center gap-1 rounded-full border-2 border-white bg-amber-300 px-2 py-1 text-[9px] font-black uppercase text-amber-950 shadow-lg"
                        >
                          <Sparkles size={11} /> New
                        </motion.span>
                      )}
                      <Wheel className="-bottom-6 left-2" />
                      <Wheel className="-bottom-6 right-2" />
                    </motion.button>
                  </motion.div>
                );
              })}

              {!canContinue && (
                <div className="relative flex items-end">
                  <span className="mb-12 h-3 w-6 border-y-2 border-slate-950 bg-amber-300" aria-hidden="true" />
                  <div
                    ref={dropZoneRef}
                    className="relative grid h-32 w-29 shrink-0 place-items-center rounded-[1.65rem] border-[6px] border-dashed border-cyan-200 bg-cyan-300/15 text-white shadow-[0_0_30px_rgba(34,211,238,.38)] backdrop-blur-sm"
                    aria-label={`Drop letter ${nextLetter || ''} here`}
                  >
                    <motion.span
                      animate={prefersReducedMotion ? undefined : { scale: [1, 1.12, 1], opacity: [0.65, 1, 0.65] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="text-5xl font-black text-cyan-100"
                    >
                      ?
                    </motion.span>
                    <span className="absolute bottom-3 text-[9px] font-black uppercase tracking-widest text-cyan-100">drop here</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-5 h-6 bg-slate-800 shadow-[0_-5px_0_#d1a73d,0_6px_0_#0f172a]">
            <motion.div
              animate={prefersReducedMotion ? undefined : { backgroundPositionX: ['0px', '-96px'] }}
              transition={{ duration: 1.2, ease: 'linear', repeat: Infinity }}
              className="h-full bg-[repeating-linear-gradient(90deg,transparent_0px,transparent_25px,#8b5a2b_26px,#8b5a2b_42px,transparent_43px,transparent_68px)]"
            />
          </div>
        </section>

        <div className="relative z-20 mt-4 flex min-h-16 items-center justify-center">
          {canContinue ? (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ y: -3, scale: 1.025 }}
              whileTap={{ scale: 0.97 }}
              onClick={finish}
              className="group flex items-center gap-3 rounded-2xl border border-white/25 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-600 px-8 py-4 text-lg font-black text-white shadow-[0_15px_40px_rgba(59,130,246,.4)]"
            >
              <CheckCircle2 size={25} strokeWidth={2.7} />
              Finish this journey
              <ArrowRight className="transition-transform group-hover:translate-x-1" size={24} strokeWidth={3} />
            </motion.button>
          ) : (
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-bold text-sky-100/75">
              <motion.span animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.2, repeat: Infinity }} className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
              {feedback || (nextLetter ? `Drag ${nextLetter}${nextLetter.toLowerCase()} onto the empty wagon` : 'Arrange the letters')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
