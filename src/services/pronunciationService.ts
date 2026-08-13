// Pronunciation checking using the Web Speech API.

export type PronunciationStatus = 'correct' | 'almost' | 'incorrect';

export interface PronunciationResult {
  spokenText: string;
  score: number;
  status: PronunciationStatus;
  message: string;
}

type PronunciationEvaluation = Omit<PronunciationResult, 'spokenText'>;

interface CandidateEvaluation {
  candidate: string;
  score: number;
  distance: number;
  isExact: boolean;
  isAlias: boolean;
  isStrictMatch: boolean;
}

class PronunciationService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;

  private getSpeechRecognition(): SpeechRecognition | null {
    if (typeof window === 'undefined') return null;
    const SpeechRecognitionCtor = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return null;

    // A fresh instance avoids stale callbacks after a previous recognition
    // session ended or was aborted.
    this.recognition = new SpeechRecognitionCtor();
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 10;
    this.recognition.continuous = false;
    return this.recognition;
  }

  async startListening(targetWord: string): Promise<PronunciationResult> {
    const recognition = this.getSpeechRecognition();
    if (!recognition) {
      throw new Error('Speech is not available here.');
    }

    if (this.isListening) {
      recognition.abort();
    }

    return new Promise((resolve, reject) => {
      this.isListening = true;
      const alternatives = new Set<string>();
      let settled = false;
      let stopTimer: ReturnType<typeof setTimeout> | null = null;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let hasFinalResult = false;

        for (const result of Array.from(event.results || [])) {
          hasFinalResult ||= result.isFinal;
          for (const alternative of Array.from(result || [])) {
            if (alternative.transcript?.trim()) {
              alternatives.add(alternative.transcript.trim());
            }
          }
        }

        const evaluation = evaluateBestPronunciation([...alternatives], targetWord);
        if (evaluation.status === 'correct' || hasFinalResult) {
          finish();
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (settled) return;
        settled = true;
        if (stopTimer) clearTimeout(stopTimer);
        this.cleanupListeners();
        this.isListening = false;
        reject(new Error(getFriendlySpeechError(event.error)));
      };

      recognition.onend = () => {
        if (settled) return;
        if (alternatives.size > 0) {
          finish();
          return;
        }
        settled = true;
        if (stopTimer) clearTimeout(stopTimer);
        this.cleanupListeners();
        this.isListening = false;
        reject(new Error('I did not hear you. Tap the mic and speak after it turns green.'));
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        if (stopTimer) clearTimeout(stopTimer);
        const spokenAlternatives = [...alternatives];
        const spokenText = spokenAlternatives[0] ?? '';
        const evaluation = evaluateBestPronunciation(spokenAlternatives, targetWord);
        this.cleanupListeners();
        this.isListening = false;
        try {
          recognition.stop();
        } catch {
          // Recognition may already be stopping after a final result.
        }
        resolve({ spokenText, ...evaluation });
      };

      recognition.start();
      stopTimer = setTimeout(() => {
        if (!settled) recognition.stop();
      }, 8_000);
    });
  }

  stopListening() {
    const recognition = this.getSpeechRecognition();
    if (recognition && this.isListening) {
      recognition.stop();
      this.cleanupListeners();
      this.isListening = false;
    }
  }

  private cleanupListeners() {
    if (!this.recognition) return;
    this.recognition.onresult = null;
    this.recognition.onerror = null;
    this.recognition.onend = null;
  }
}

export const pronunciationService = new PronunciationService();

export function calculateSimilarity(a: string, b: string): number {
  const cleanA = normalizeSpeechText(a);
  const cleanB = normalizeSpeechText(b);
  if (!cleanA || !cleanB) return 0;
  if (cleanA === cleanB) return 100;

  const distance = levenshtein(cleanA, cleanB);
  const maxLen = Math.max(cleanA.length, cleanB.length);
  const similarity = ((maxLen - distance) / maxLen) * 100;
  return Math.max(0, Math.min(100, Math.round(similarity)));
}

export function evaluatePronunciation(spokenWord: string, targetWord: string): PronunciationEvaluation {
  const target = normalizeSpeechText(targetWord);
  if (!target) return buildEvaluation({ candidate: '', score: 0, distance: 0, isExact: false, isAlias: false, isStrictMatch: false });

  const candidates = getSpeechCandidates(spokenWord, target);
  const evaluations = candidates.map((candidate) => evaluateCandidate(candidate, target));
  const best = evaluations.reduce(
    (currentBest, current) => {
      if (current.isExact && !currentBest.isExact) return current;
      if (current.isAlias && !currentBest.isAlias && !currentBest.isExact) return current;
      if (current.isStrictMatch && !currentBest.isStrictMatch) return current;
      return current.score > currentBest.score ? current : currentBest;
    },
    { candidate: '', score: 0, distance: target.length, isExact: false, isAlias: false, isStrictMatch: false }
  );

  return buildEvaluation(best);
}

function evaluateBestPronunciation(spokenAlternatives: string[], targetWord: string): PronunciationEvaluation {
  const evaluations = spokenAlternatives.length
    ? spokenAlternatives.map((alternative) => evaluatePronunciation(alternative, targetWord))
    : [evaluatePronunciation('', targetWord)];

  return evaluations.reduce((best, current) => {
    if (current.status === 'correct' && best.status !== 'correct') return current;
    if (current.status !== 'correct' && best.status === 'correct') return best;
    return current.score > best.score ? current : best;
  });
}

function buildEvaluation(best: CandidateEvaluation): PronunciationEvaluation {
  let status: PronunciationStatus = 'incorrect';
  let message = 'Try again';

  if (best.isExact || best.isAlias) {
    status = 'correct';
    message = 'Great job!';
  } else if (best.isStrictMatch) {
    status = 'correct';
    message = 'Good speaking!';
  } else if (best.score >= 68) {
    status = 'almost';
    message = 'Almost! Try again';
  }

  return { score: best.score, status, message };
}

function normalizeSpeechText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSpeechCandidates(spokenText: string, targetWord: string): string[] {
  const normalized = normalizeSpeechText(spokenText);
  if (!normalized) return [''];
  const aliases = getSpeechAliases(targetWord);
  if (aliases.includes(normalized)) {
    return [targetWord];
  }
  if (normalized === targetWord || normalized.split(' ').includes(targetWord)) {
    return [targetWord];
  }

  const words = normalized.split(' ');
  if (words.some((word) => aliases.includes(word))) {
    return [targetWord];
  }
  const targetWordCount = targetWord.split(' ').length;
  const candidates = new Set<string>([normalized, ...words]);

  for (let size = 2; size <= Math.max(2, targetWordCount + 1); size++) {
    for (let index = 0; index <= words.length - size; index++) {
      candidates.add(words.slice(index, index + size).join(' '));
    }
  }

  return [...candidates];
}

function evaluateCandidate(candidate: string, targetWord: string): CandidateEvaluation {
  const normalizedCandidate = normalizeSpeechText(candidate);
  const aliases = getSpeechAliases(targetWord);
  const isAlias = aliases.includes(normalizedCandidate);
  const isExact = normalizedCandidate === targetWord || normalizePlural(normalizedCandidate, targetWord) === targetWord;
  const scoringCandidate = normalizePlural(normalizedCandidate, targetWord);
  const distance = levenshtein(scoringCandidate, targetWord);
  const score = calculateSimilarity(scoringCandidate, targetWord);

  return {
    candidate: normalizedCandidate,
    score,
    distance,
    isExact,
    isAlias,
    isStrictMatch: isAlias || isExact || isAcceptableNearMatch(scoringCandidate, targetWord, score, distance),
  };
}

export function getSpeechAliases(targetWord: string): string[] {
  return (SPEECH_ALIASES[targetWord] || []).map(normalizeSpeechText);
}

function normalizePlural(candidate: string, targetWord: string): string {
  if (candidate === targetWord) return candidate;
  if (candidate.endsWith('es') && candidate.slice(0, -2) === targetWord) return targetWord;
  if (candidate.endsWith('s') && candidate.slice(0, -1) === targetWord) return targetWord;
  return candidate;
}

function isAcceptableNearMatch(candidate: string, targetWord: string, score: number, distance: number): boolean {
  if (!candidate || candidate.includes(' ') || targetWord.includes(' ')) return false;

  const targetLength = targetWord.length;
  const lengthDelta = Math.abs(candidate.length - targetLength);
  const sameStart = candidate[0] === targetWord[0];
  const sameEnd = candidate[candidate.length - 1] === targetWord[targetLength - 1];

  if (!sameStart || lengthDelta > 1) return false;

  // Short phonics words differ by only one sound; near-match scoring makes
  // real contrast words such as "bat/boat" or "cat/coat" look too similar.
  if (targetLength <= 4) {
    return false;
  }

  if (targetLength <= 6) {
    return distance <= 1 && sameEnd && score >= 82 && (lengthDelta === 0 || isSingleRepeatedLetter(candidate, targetWord));
  }

  return distance <= 2 && sameEnd && score >= 84 && lengthDelta <= 1;
}

function isSingleRepeatedLetter(candidate: string, targetWord: string): boolean {
  if (candidate.length !== targetWord.length + 1) return false;

  for (let index = 0; index < candidate.length; index++) {
    const withoutChar = candidate.slice(0, index) + candidate.slice(index + 1);
    if (withoutChar === targetWord && candidate[index] === candidate[Math.max(0, index - 1)]) {
      return true;
    }
  }

  return false;
}

const SPEECH_ALIASES: Record<string, string[]> = {
  ant: ['and', 'aunt', 'an', 'at', 'end', 'ent'],
  arm: ['are', 'um'],
  arrow: ['aero'],
  baby: ['babies'],
  bag: ['back'],
  bat: ['bad'],
  bee: ['be'],
  bench: ['ben'],
  box: ['bucks'],
  bus: ['boss'],
  cap: ['cab'],
  car: ['kar'],
  cat: ['kat'],
  cue: ['queue', 'q'],
  dad: ['dadd'],
  dog: ['doc'],
  doll: ['dahl'],
  duel: ['dual', 'jewel'],
  egg: ['eg'],
  elephant: ['elefant'],
  fan: ['fann'],
  fish: ['fishes'],
  flag: ['flack'],
  fox: ['fax'],
  fries: ['frys'],
  gorilla: ['guerrilla'],
  grass: ['glass'],
  hat: ['had'],
  hen: ['henn'],
  hop: ['hope'],
  ink: ['inc'],
  insects: ['insect'],
  jam: ['gem'],
  jelly: ['jeli'],
  juice: ['jews'],
  kangaroo: ['kangeroo'],
  king: ['kin'],
  knight: ['night'],
  lemon: ['lemmon'],
  lion: ['line'],
  man: ['men'],
  map: ['nap'],
  mint: ['meant'],
  monkey: ['monk key'],
  moth: ['math'],
  mug: ['mag'],
  needle: ['neadle'],
  net: ['met'],
  nest: ['next'],
  no: ['know'],
  nut: ['not'],
  oil: ['oyal'],
  on: ['hon'],
  one: ['won'],
  orange: ['oranges'],
  pain: ['pane'],
  panda: ['panda bear'],
  pie: ['pi'],
  pinwheel: ['pin wheel'],
  point: ['paint'],
  quack: ['kwak'],
  queen: ['quean'],
  quilt: ['kwilt'],
  rabbit: ['rabit'],
  rain: ['reign', 'rein'],
  rainbow: ['rain bow'],
  rat: ['red'],
  ring: ['rang'],
  rug: ['rag'],
  sad: ['said'],
  right: ['write'],
  sea: ['see'],
  see: ['sea'],
  seven: ['7'],
  sheep: ['ship'],
  shell: ['shall'],
  shout: ['shot'],
  six: ['6'],
  slide: ['slied'],
  snake: ['sneak'],
  spider: ['spidar'],
  star: ['starr'],
  sun: ['son'],
  swim: ['swam'],
  tail: ['tale'],
  tent: ['tenth'],
  their: ['there', "they're"],
  three: ['free'],
  tie: ['thai'],
  tiger: ['tigger'],
  to: ['too', 'two'],
  train: ['trane'],
  tree: ['tre'],
  two: ['to', 'too'],
  eight: ['ate'],
  umbrella: ['umbrellah'],
  up: ['app'],
  van: ['vann'],
  vest: ['best'],
  watch: ['watched'],
  web: ['wed'],
  well: ['will'],
  whale: ['wale'],
  yak: ['yack'],
  yam: ['yum'],
  yes: ['yess'],
  yoyo: ['yo yo'],
  you: ['u', 'ewe'],
  zebra: ['zeebra'],
  zigzag: ['zig zag'],
  zoo: ['zu'],
};

function getFriendlySpeechError(error: string): string {
  if (error === 'no-speech') return 'I did not hear you.';
  if (error === 'audio-capture') return 'Check the microphone.';
  if (error === 'not-allowed' || error === 'service-not-allowed') return 'Turn on the microphone.';
  return 'Try again.';
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
      }
    }
  }

  return matrix[a.length][b.length];
}
