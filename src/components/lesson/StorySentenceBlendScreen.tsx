import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Volume2 } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { soundEffects } from '../../services/soundEffects';
import { celebrateCorrectAnswer } from '../../utils/correctAnswerCelebration';
import { getStoryBlendSentenceAudioPath, getStoryBlendSentences } from '../../utils/audioPaths';
import FeedbackToast from './FeedbackToast';

interface StorySentenceBlendScreenProps {
  letter: any;
  onComplete: (stars: number) => void;
}

type WordTile = {
  id: string;
  word: string;
};

function tokenize(sentence: string) {
  return sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
}

function shuffledTiles(words: string[]) {
  const tiles = words.map((word, index) => ({ id: `${index}-${word}`, word }));
  for (let index = tiles.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [tiles[index], tiles[swapIndex]] = [tiles[swapIndex], tiles[index]];
  }
  if (tiles.length > 1 && tiles.every((tile, index) => tile.word === words[index])) {
    return [...tiles.slice(1), tiles[0]];
  }
  return tiles;
}

export default function StorySentenceBlendScreen({ letter, onComplete }: StorySentenceBlendScreenProps) {
  const storySentences = useMemo(() => {
    const text = String(letter?.story?.text || '').trim();
    const sentences = getStoryBlendSentences(text);
    return (sentences.length ? sentences : [text]).filter(Boolean).slice(0, 3);
  }, [letter?.story?.text]);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const sentence = storySentences[Math.min(sentenceIndex, storySentences.length - 1)] || '';
  const sentenceAudio = useMemo(
    () => getStoryBlendSentenceAudioPath(letter, Math.min(sentenceIndex, storySentences.length - 1)),
    [letter, sentenceIndex, storySentences.length],
  );
  const targetWords = useMemo(() => tokenize(sentence), [sentence]);
  const [availableTiles, setAvailableTiles] = useState<WordTile[]>([]);
  const [placedTiles, setPlacedTiles] = useState<WordTile[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const isLastSentence = sentenceIndex >= storySentences.length - 1;
  const playSentence = useCallback(async () => {
    if (sentenceAudio && (await audioService.playAudioFile(sentenceAudio))) return;
    await audioService.playPrompt(sentence);
  }, [sentence, sentenceAudio]);

  useEffect(() => {
    setSentenceIndex(0);
  }, [letter?.id]);

  useEffect(() => {
    setAvailableTiles(shuffledTiles(targetWords));
    setPlacedTiles([]);
    setFeedback(null);
    audioService.preloadAudioFile(sentenceAudio, { priority: true });
    const timeoutId = window.setTimeout(() => void playSentence(), 300);
    return () => window.clearTimeout(timeoutId);
  }, [playSentence, sentenceAudio, targetWords]);

  const placeTile = (tile: WordTile) => {
    if (feedback?.type === 'success') return;
    soundEffects.playClick();
    setAvailableTiles((items) => items.filter((item) => item.id !== tile.id));
    setPlacedTiles((items) => [...items, tile]);
  };

  const returnTile = (tile: WordTile) => {
    if (feedback?.type === 'success') return;
    soundEffects.playClick();
    setPlacedTiles((items) => items.filter((item) => item.id !== tile.id));
    setAvailableTiles((items) => [...items, tile]);
    setFeedback(null);
  };

  const resetSentence = () => {
    setAvailableTiles(shuffledTiles(targetWords));
    setPlacedTiles([]);
    setFeedback(null);
  };

  const checkSentence = () => {
    if (placedTiles.length !== targetWords.length) return;
    const answer = placedTiles.map((tile) => tile.word.toLowerCase()).join(' ');
    const target = targetWords.map((word) => word.toLowerCase()).join(' ');
    if (answer === target) {
      setFeedback({ type: 'success', text: 'Great story sentence!' });
      soundEffects.playCelebration();
      celebrateCorrectAnswer();
      void playSentence();
      return;
    }

    setFeedback({ type: 'error', text: 'Listen again and change the word order.' });
    soundEffects.playError();
  };

  const advance = () => {
    if (!isLastSentence) {
      setSentenceIndex((index) => index + 1);
      return;
    }
    onComplete(1);
  };

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden p-4 text-center md:p-8">
      <FeedbackToast feedback={feedback} />
      <div className="pointer-events-none absolute left-1/4 top-8 h-32 w-32 rounded-full bg-amber-200/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-12 right-1/4 h-36 w-36 rounded-full bg-sky-200/40 blur-3xl" />

      <h2 className="relative z-10 text-2xl font-black text-slate-800 md:text-4xl">Build a sentence from the story</h2>
      <p className="relative z-10 mt-2 font-bold text-slate-500">
        Sentence {sentenceIndex + 1} of {storySentences.length} · Listen, then arrange the words.
      </p>

      <motion.button
        type="button"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => void playSentence()}
        className="relative z-10 mt-5 grid h-20 w-20 place-items-center rounded-full bg-blue-600 text-white shadow-xl"
        aria-label="Play story sentence"
      >
        <Volume2 size={38} />
      </motion.button>

      <div className="relative z-10 mt-6 flex min-h-28 w-full max-w-4xl flex-wrap items-center justify-center gap-3 rounded-[2rem] border-4 border-dashed border-indigo-200 bg-white/80 p-4 shadow-lg">
        {targetWords.map((_, index) => {
          const tile = placedTiles[index];
          return (
            <button
              key={`slot-${index}`}
              type="button"
              onClick={() => tile && returnTile(tile)}
              className={`min-h-14 min-w-24 rounded-2xl border-3 px-4 py-2 text-xl font-black transition ${
                tile
                  ? 'border-indigo-400 bg-indigo-100 text-indigo-800 shadow-md'
                  : 'border-dashed border-slate-300 bg-slate-50 text-slate-300'
              }`}
            >
              {tile?.word || `${index + 1}`}
            </button>
          );
        })}
      </div>

      <div className="relative z-10 mt-5 flex min-h-24 w-full max-w-4xl flex-wrap items-center justify-center gap-3">
        {availableTiles.map((tile, index) => (
          <motion.button
            key={tile.id}
            type="button"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -5, scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => placeTile(tile)}
            className="rounded-2xl border-4 border-white bg-gradient-to-br from-amber-400 to-orange-500 px-5 py-3 text-xl font-black text-white shadow-lg"
          >
            {tile.word}
          </motion.button>
        ))}
      </div>

      <div className="relative z-10 mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={resetSentence}
          disabled={feedback?.type === 'success'}
          className="flex items-center gap-2 rounded-full bg-white px-6 py-3 font-black text-slate-600 shadow-lg disabled:opacity-50"
        >
          <RotateCcw size={20} /> Reset
        </button>
        {feedback?.type === 'success' ? (
          <button
            type="button"
            onClick={advance}
            className="rounded-full bg-emerald-500 px-9 py-3 text-lg font-black text-white shadow-xl"
          >
            {isLastSentence ? 'Continue' : 'Next sentence'}
          </button>
        ) : (
          <button
            type="button"
            onClick={checkSentence}
            disabled={placedTiles.length !== targetWords.length}
            className="rounded-full bg-indigo-600 px-9 py-3 text-lg font-black text-white shadow-xl disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Check
          </button>
        )}
      </div>
    </div>
  );
}
