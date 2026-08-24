import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Link2 } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { soundEffects } from '../../services/soundEffects';
import { celebrateCorrectAnswer } from '../../utils/correctAnswerCelebration';
import { getAlphabetTrainLetterAudioPath } from '../../utils/audioPaths';
import FeedbackToast from './FeedbackToast';

interface CapitalLowercaseMatchScreenProps {
  letter: any;
  onComplete: (stars: number) => void;
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  if (result.length > 1 && result.every((item, index) => item === items[index])) {
    return [...result.slice(1), result[0]];
  }
  return result;
}

function createMatchOrders(capitals: string[]) {
  const capitalOrder = shuffle(capitals);
  let lowercaseOrder = shuffle(capitals.map((item) => item.toLowerCase()));

  // Never present every matching pair directly opposite each other. A rotation
  // guarantees at least one crossed connection even when both shuffles happen
  // to produce the same relative order.
  if (
    lowercaseOrder.length > 1
    && capitalOrder.every((capital, index) => capital.toLowerCase() === lowercaseOrder[index])
  ) {
    lowercaseOrder = [...lowercaseOrder.slice(1), lowercaseOrder[0]];
  }

  return { capitalOrder, lowercaseOrder };
}

export default function CapitalLowercaseMatchScreen({ letter, onComplete }: CapitalLowercaseMatchScreenProps) {
  const capitals = useMemo(
    () => Array.from(new Set(
      (String(letter?.letter || letter?.id || '').match(/[A-Za-z]/g) || []).map((item) => item.toUpperCase()),
    )),
    [letter?.id, letter?.letter],
  );
  const [{ lowercaseOrder, capitalOrder }, setLetterOrders] = useState(() => createMatchOrders(capitals));
  const [selectedCapital, setSelectedCapital] = useState('');
  const [selectedLowercase, setSelectedLowercase] = useState('');
  const [matchedCapitals, setMatchedCapitals] = useState<string[]>([]);
  const [wrongCapital, setWrongCapital] = useState('');
  const [wrongLowercase, setWrongLowercase] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const wrongTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setLetterOrders(createMatchOrders(capitals));
    setSelectedCapital('');
    setSelectedLowercase('');
    setMatchedCapitals([]);
    setWrongCapital('');
    setWrongLowercase('');
    setFeedback(null);
    void audioService.playPrompt('Match each capital letter with its small letter');
  }, [capitals, letter?.id]);

  useEffect(() => () => {
    if (wrongTimeoutRef.current) window.clearTimeout(wrongTimeoutRef.current);
  }, []);

  const isComplete = capitals.length > 0 && matchedCapitals.length === capitals.length;
  const rowPosition = (index: number, total: number) => ((index + 0.5) / Math.max(total, 1)) * 100;

  const playLetterName = (value: string) => {
    void audioService.playAudioFile(getAlphabetTrainLetterAudioPath(value));
  };

  const matchPair = (capital: string, lowercase: string) => {
    if (capital.toLowerCase() === lowercase) {
      const nextMatches = [...matchedCapitals, capital];
      setMatchedCapitals(nextMatches);
      setSelectedCapital('');
      setSelectedLowercase('');
      setFeedback({ type: 'success', text: `${capital} matches ${capital.toLowerCase()}!` });
      soundEffects.playSuccess();
      if (nextMatches.length === capitals.length) {
        soundEffects.playCelebration();
        celebrateCorrectAnswer();
      }
      return;
    }

    setWrongCapital(capital);
    setWrongLowercase(lowercase);
    setFeedback({ type: 'error', text: 'Try the matching letter!' });
    soundEffects.playError();
    if (wrongTimeoutRef.current) window.clearTimeout(wrongTimeoutRef.current);
    wrongTimeoutRef.current = window.setTimeout(() => {
      setWrongCapital('');
      setWrongLowercase('');
      setFeedback(null);
    }, 900);
  };

  const chooseCapital = (capital: string) => {
    if (matchedCapitals.includes(capital) || isComplete) return;
    soundEffects.playClick();
    playLetterName(capital);
    setSelectedCapital(capital);
    setFeedback(null);
    if (selectedLowercase) matchPair(capital, selectedLowercase);
  };

  const chooseLowercase = (lowercase: string) => {
    if (matchedCapitals.includes(lowercase.toUpperCase()) || isComplete) return;
    soundEffects.playClick();
    playLetterName(lowercase);
    setSelectedLowercase(lowercase);
    setFeedback(null);
    if (selectedCapital) matchPair(selectedCapital, lowercase);
  };

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden p-4 text-center md:p-8">
      <FeedbackToast feedback={feedback} />
      <div className="pointer-events-none absolute left-8 top-12 h-28 w-28 rounded-full bg-cyan-200/35 blur-2xl" />
      <div className="pointer-events-none absolute bottom-10 right-8 h-32 w-32 rounded-full bg-fuchsia-200/30 blur-2xl" />

      <div className="relative z-10 mb-5 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg">
          <Link2 size={28} strokeWidth={3} />
        </span>
        <div className="text-left">
          <h2 className="text-2xl font-black text-slate-800 md:text-4xl">Match capital and small letters</h2>
          <p className="font-bold text-slate-500">Choose a letter from either side, then choose its match.</p>
        </div>
      </div>

      <div
        className="relative z-10 w-full max-w-2xl rounded-[2rem] border-4 border-white bg-white/75 p-4 shadow-2xl backdrop-blur md:p-6"
        style={{ height: Math.max(310, capitals.length * 92) }}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {matchedCapitals.map((capital) => {
            const lowercaseIndex = lowercaseOrder.indexOf(capital.toLowerCase());
            const capitalIndex = capitalOrder.indexOf(capital);
            return (
              <motion.line
                key={capital}
                x1="25"
                y1={rowPosition(capitalIndex, capitalOrder.length)}
                x2="75"
                y2={rowPosition(lowercaseIndex, lowercaseOrder.length)}
                stroke="#10b981"
                strokeWidth="1.8"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            );
          })}
        </svg>

        <div className="absolute inset-y-4 left-4 flex w-[24%] flex-col justify-around md:left-7">
          {capitalOrder.map((capital) => {
            const matched = matchedCapitals.includes(capital);
            return (
              <motion.button
                key={capital}
                type="button"
                whileHover={!matched ? { scale: 1.08 } : undefined}
                whileTap={!matched ? { scale: 0.92 } : undefined}
                onClick={() => chooseCapital(capital)}
                disabled={matched}
                aria-pressed={selectedCapital === capital}
                className={`grid h-16 w-16 place-items-center self-center rounded-2xl border-4 text-4xl font-black shadow-lg transition md:h-20 md:w-20 md:text-5xl ${
                  matched
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                    : wrongCapital === capital
                      ? 'border-red-500 bg-red-100 text-red-600'
                      : selectedCapital === capital
                        ? 'border-indigo-500 bg-indigo-100 text-indigo-700 ring-4 ring-indigo-200'
                        : 'border-white bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white'
                }`}
              >
                {capital}
              </motion.button>
            );
          })}
        </div>

        <div className="absolute inset-y-4 right-4 flex w-[24%] flex-col justify-around md:right-7">
          {lowercaseOrder.map((lowercase) => {
            const matched = matchedCapitals.includes(lowercase.toUpperCase());
            return (
              <motion.button
                key={lowercase}
                type="button"
                whileHover={!matched ? { scale: 1.08 } : undefined}
                whileTap={!matched ? { scale: 0.92 } : undefined}
                onClick={() => chooseLowercase(lowercase)}
                disabled={matched}
                aria-pressed={selectedLowercase === lowercase}
                className={`grid h-16 w-16 place-items-center self-center rounded-2xl border-4 text-4xl font-black shadow-lg transition md:h-20 md:w-20 md:text-5xl ${
                  matched
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                    : wrongLowercase === lowercase
                      ? 'border-red-500 bg-red-100 text-red-600'
                      : selectedLowercase === lowercase
                        ? 'border-indigo-500 bg-indigo-100 text-indigo-700 ring-4 ring-indigo-200'
                        : 'border-white bg-gradient-to-br from-cyan-400 to-blue-500 text-white'
                }`}
              >
                {lowercase}
              </motion.button>
            );
          })}
        </div>
      </div>

      {isComplete && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onComplete(1)}
          className="relative z-10 mt-6 flex items-center gap-2 rounded-full bg-emerald-500 px-10 py-4 text-xl font-black text-white shadow-xl"
        >
          Continue <ArrowRight size={24} strokeWidth={3} />
        </motion.button>
      )}
    </div>
  );
}
