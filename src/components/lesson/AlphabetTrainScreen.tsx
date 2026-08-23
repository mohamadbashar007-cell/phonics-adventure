import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
  const [canContinue, setCanContinue] = useState(false);
  const [visibleWagonCount, setVisibleWagonCount] = useState(0);
  const lessonLetters = useMemo(() => String(letter?.letter || '').match(/[A-Z]/g) || [], [letter?.letter]);
  const accumulatedLetters = useMemo(() => {
    const lastLetter = lessonLetters.at(-1);
    const lastIndex = lastLetter ? ALPHABET.indexOf(lastLetter) : -1;
    return lastIndex >= 0 ? ALPHABET.slice(0, lastIndex + 1).split('') : lessonLetters;
  }, [lessonLetters]);
  const newLetters = useMemo(() => new Set(lessonLetters), [lessonLetters]);
  const isCompleteAlphabet = accumulatedLetters.length === ALPHABET.length;
  const progress = Math.round((accumulatedLetters.length / ALPHABET.length) * 100);

  useEffect(() => {
    setCanContinue(false);
    setVisibleWagonCount(prefersReducedMotion ? accumulatedLetters.length : 0);
    let cancelled = false;
    const wait = (delay: number) => new Promise<void>((resolve) => window.setTimeout(resolve, delay));
    const announceWagons = async () => {
      for (const capital of accumulatedLetters) {
        if (cancelled) return;
        await audioService.playAudioFile(getAlphabetTrainLetterAudioPath(capital));
        if (cancelled) return;
        await wait(60);
      }
    };
    const buildTrain = async () => {
      if (prefersReducedMotion) {
        void announceWagons();
        setCanContinue(true);
        return;
      }

      await wait(220);
      // The train keeps moving while the letters are spoken in sequence, so a
      // longer recording never makes the wagon animation feel stuck.
      void announceWagons();
      for (let index = 0; index < accumulatedLetters.length; index += 1) {
        if (cancelled) return;
        setVisibleWagonCount(index + 1);
        await wait(380);
      }
      if (!cancelled) setCanContinue(true);
    };
    void buildTrain();

    const scrollTimeout = window.setTimeout(() => {
      const viewport = viewportRef.current;
      if (viewport) viewport.scrollTo({ left: viewport.scrollWidth, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }, prefersReducedMotion ? 100 : Math.min(8_000, 500 + accumulatedLetters.length * 410));

    return () => {
      cancelled = true;
      audioService.stop();
      window.clearTimeout(scrollTimeout);
    };
  }, [accumulatedLetters, prefersReducedMotion]);

  const playLetterPair = (capital: string) => {
    soundEffects.playClick();
    void audioService.playAudioFile(getAlphabetTrainLetterAudioPath(capital));
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
              <span>{accumulatedLetters.length} of 26 aboard</span>
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
          <div className="pointer-events-none absolute left-5 top-5 rounded-xl border border-white/20 bg-slate-950/45 px-4 py-2 text-left shadow-xl backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-200">Next stop</p>
            <p className="text-lg font-black text-white">Letter {accumulatedLetters.at(-1)}</p>
          </div>

          <div ref={viewportRef} className="relative z-10 w-full overflow-hidden px-2 pb-8 pt-16 md:overflow-x-auto md:px-9 md:pb-12 md:pt-24 [scrollbar-color:#38bdf8_rgba(15,23,42,.35)] [scrollbar-width:thin]">
            <motion.div
              initial={false}
              animate={{ opacity: 1 }}
              className="flex w-max min-w-full origin-bottom-left scale-[0.46] items-end md:scale-100"
            >
              <Locomotive reducedMotion={prefersReducedMotion} />

              {accumulatedLetters.slice(0, visibleWagonCount).map((capital, index) => {
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
                      onClick={() => playLetterPair(capital)}
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
              All aboard… building your alphabet train
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
