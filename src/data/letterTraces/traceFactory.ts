import type { TracePoint } from '../../utils/sequentialTraceValidator';

export interface LetterTrace {
  guidePath: string;
  path: string;
  points: TracePoint[];
  guideStrokeWidth: number;
}

type DrawCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number };

const CANVAS_SIZE = 400;
const PADDING = 44;
const MIN_POINTS = 28;
const MAX_POINTS = 42;
const SAMPLE_DENSITY = 11;

const traceCache = new Map<string, Promise<LetterTrace>>();

export function getLetterTrace(letter: string): Promise<LetterTrace> {
  const key = normalizeTraceKey(letter);
  if (!traceCache.has(key)) {
    traceCache.set(key, Promise.resolve(buildLetterTrace(key)));
  }
  return traceCache.get(key)!;
}

export function preloadLetterTrace(letter: string) {
  void getLetterTrace(letter);
}

function buildLetterTrace(key: string): LetterTrace {
  if (typeof document === 'undefined') {
    return fallbackTrace();
  }

  const letters = splitTraceLetters(key);
  const commands = composeLetters(letters);
  const path = commandsToPathData(commands);
  const points = generateDotsOnPath(path);
  const guideStrokeWidth = letters.length === 1 ? 44 : letters.length === 2 ? 32 : 26;

  return points.length ? { guidePath: path, path, points, guideStrokeWidth } : fallbackTrace();
}

function normalizeTraceKey(value: string) {
  const raw = String(value || 's').trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith('capital-')) return lower.replace('capital-', '').toUpperCase();
  if (/^[A-Z]+$/.test(raw)) return raw;
  if (/^[A-Z][a-z]$/.test(raw)) return raw;
  if (/[A-Z]/.test(raw) && raw.includes(' ')) return raw.replace(/[^A-Z]/g, '') || 'S';
  return lower.replace(/[^a-z]/g, '') || 's';
}

function splitTraceLetters(key: string) {
  const maxLetters = key === key.toUpperCase() ? 4 : 2;
  return key.slice(0, maxLetters).split('');
}

function composeLetters(letters: string[]): DrawCommand[] {
  const baseWidth = 100;
  const isUpperLowerPair =
    letters.length === 2 && /^[A-Z]$/.test(letters[0]) && /^[a-z]$/.test(letters[1]);
  const baseHeight = isUpperLowerPair ? 160 : 140;
  const gap = letters.length === 1 ? 0 : letters.length > 2 ? 18 : 30;
  const sizeFactors = letters.map((_, index) => (isUpperLowerPair && index === 1 ? 0.68 : 1));
  const totalWidth =
    sizeFactors.reduce((width, factor) => width + baseWidth * factor, 0) +
    (letters.length - 1) * gap;
  const availableWidth = CANVAS_SIZE - PADDING * 2;
  const availableHeight = CANVAS_SIZE - PADDING * 2;
  const scale = Math.min(availableWidth / totalWidth, availableHeight / baseHeight);
  const startX = (CANVAS_SIZE - totalWidth * scale) / 2;
  const startY = (CANVAS_SIZE - baseHeight * scale) / 2;
  const baselineY = startY + baseHeight * scale;
  let currentX = startX;

  return letters.flatMap((letter, index) => {
    const shape = LETTER_PATHS[letter] ?? LETTER_PATHS[letter.toLowerCase()] ?? LETTER_PATHS.s;
    const letterScale = scale * sizeFactors[index];
    const offsetX = currentX;
    const offsetY = isUpperLowerPair
      ? baselineY - baseHeight * letterScale
      : startY;
    currentX += (baseWidth * sizeFactors[index] + gap) * scale;
    return transformCommands(shape, letterScale, offsetX, offsetY);
  });
}

function transformCommands(commands: DrawCommand[], scale: number, offsetX: number, offsetY: number): DrawCommand[] {
  return commands.map((command) => {
    if (command.type === 'M' || command.type === 'L') {
      return { type: command.type, x: command.x * scale + offsetX, y: command.y * scale + offsetY };
    }
    if (command.type === 'Q') {
      return {
        type: 'Q',
        x1: command.x1 * scale + offsetX,
        y1: command.y1 * scale + offsetY,
        x: command.x * scale + offsetX,
        y: command.y * scale + offsetY,
      };
    }
    return {
      type: 'C',
      x1: command.x1 * scale + offsetX,
      y1: command.y1 * scale + offsetY,
      x2: command.x2 * scale + offsetX,
      y2: command.y2 * scale + offsetY,
      x: command.x * scale + offsetX,
      y: command.y * scale + offsetY,
    };
  });
}

function commandsToPathData(commands: DrawCommand[]) {
  return commands
    .map((command) => {
      if (command.type === 'M') return `M${format(command.x)} ${format(command.y)}`;
      if (command.type === 'L') return `L${format(command.x)} ${format(command.y)}`;
      if (command.type === 'Q') return `Q${format(command.x1)} ${format(command.y1)} ${format(command.x)} ${format(command.y)}`;
      return `C${format(command.x1)} ${format(command.y1)} ${format(command.x2)} ${format(command.y2)} ${format(
        command.x
      )} ${format(command.y)}`;
    })
    .join(' ');
}

function generateDotsOnPath(pathData: string): TracePoint[] {
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svgEl.setAttribute('width', '0');
  svgEl.setAttribute('height', '0');
  svgEl.setAttribute('aria-hidden', 'true');
  svgEl.style.position = 'absolute';
  svgEl.style.overflow = 'hidden';
  pathEl.setAttribute('d', pathData);
  svgEl.appendChild(pathEl);
  document.body?.appendChild(svgEl);

  const totalLength = pathEl.getTotalLength();
  if (!isFinite(totalLength) || totalLength <= 0) {
    svgEl.remove();
    return [];
  }

  const sampleCount = Math.min(Math.max(Math.round(totalLength / SAMPLE_DENSITY), MIN_POINTS), MAX_POINTS);
  const points: TracePoint[] = [];
  let strokeId = 0;
  let previousPoint: DOMPoint | null = null;

  for (let index = 0; index < sampleCount; index++) {
    const lengthAt = (totalLength * index) / (sampleCount - 1 || 1);
    const point = pathEl.getPointAtLength(lengthAt);
    if (previousPoint && Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) > SAMPLE_DENSITY * 3) {
      strokeId += 1;
    }
    points.push({
      x: point.x,
      y: point.y,
      distance: sampleCount <= 1 ? 0 : index / (sampleCount - 1),
      strokeId,
    });
    previousPoint = point;
  }

  svgEl.remove();
  return points;
}

function fallbackTrace(): LetterTrace {
  const path = `M${PADDING} ${PADDING} L${CANVAS_SIZE - PADDING} ${CANVAS_SIZE - PADDING}`;
  return {
    guidePath: path,
    path,
    guideStrokeWidth: 44,
    points: [
      { x: PADDING, y: PADDING, distance: 0 },
      { x: CANVAS_SIZE - PADDING, y: CANVAS_SIZE - PADDING, distance: 1 },
    ],
  };
}

function format(value: number) {
  return Number(value.toFixed(2));
}

const LETTER_PATHS: Record<string, DrawCommand[]> = {
  a: [
    { type: 'M', x: 72, y: 48 },
    { type: 'C', x1: 44, y1: 24, x2: 18, y2: 44, x: 18, y: 78 },
    { type: 'C', x1: 18, y1: 118, x2: 66, y2: 124, x: 78, y: 86 },
    { type: 'M', x: 78, y: 52 },
    { type: 'L', x: 78, y: 118 },
  ],
  b: [
    { type: 'M', x: 24, y: 14 },
    { type: 'L', x: 24, y: 118 },
    { type: 'M', x: 24, y: 70 },
    { type: 'C', x1: 56, y1: 40, x2: 92, y2: 62, x: 84, y: 96 },
    { type: 'C', x1: 76, y1: 128, x2: 44, y2: 128, x: 24, y: 110 },
  ],
  c: [{ type: 'M', x: 82, y: 44 }, { type: 'C', x1: 30, y1: 16, x2: 8, y2: 114, x: 82, y: 112 }],
  d: [
    { type: 'M', x: 78, y: 14 },
    { type: 'L', x: 78, y: 118 },
    { type: 'M', x: 78, y: 70 },
    { type: 'C', x1: 46, y1: 40, x2: 10, y2: 62, x: 18, y: 96 },
    { type: 'C', x1: 26, y1: 128, x2: 58, y2: 128, x: 78, y: 110 },
  ],
  e: [
    // A single, open handwriting stroke: crossbar first, then loop around.
    // Keeping the two right endpoints apart prevents a thick guide from
    // turning the lowercase e into a closed circle.
    { type: 'M', x: 16, y: 80 },
    { type: 'L', x: 80, y: 80 },
    { type: 'C', x1: 78, y1: 56, x2: 60, y2: 42, x: 42, y: 44 },
    { type: 'C', x1: 18, y1: 46, x2: 12, y2: 72, x: 18, y: 94 },
    { type: 'C', x1: 26, y1: 122, x2: 60, y2: 128, x: 84, y: 108 },
  ],
  f: [{ type: 'M', x: 72, y: 16 }, { type: 'C', x1: 34, y1: 12, x2: 42, y2: 60, x: 42, y: 128 }, { type: 'M', x: 20, y: 56 }, { type: 'L', x: 76, y: 56 }],
  g: [
    { type: 'M', x: 74, y: 48 },
    { type: 'C', x1: 44, y1: 22, x2: 16, y2: 44, x: 18, y: 78 },
    { type: 'C', x1: 20, y1: 116, x2: 66, y2: 122, x: 78, y: 86 },
    { type: 'M', x: 78, y: 52 },
    { type: 'L', x: 78, y: 126 },
    { type: 'C', x1: 76, y1: 154, x2: 30, y2: 152, x: 28, y: 126 },
  ],
  h: [{ type: 'M', x: 22, y: 14 }, { type: 'L', x: 22, y: 118 }, { type: 'M', x: 22, y: 74 }, { type: 'C', x1: 36, y1: 42, x2: 82, y2: 48, x: 82, y: 118 }],
  i: [{ type: 'M', x: 50, y: 46 }, { type: 'L', x: 50, y: 118 }, { type: 'M', x: 50, y: 22 }, { type: 'L', x: 50, y: 22 }],
  j: [{ type: 'M', x: 62, y: 46 }, { type: 'L', x: 62, y: 118 }, { type: 'C', x1: 62, y1: 150, x2: 20, y2: 148, x: 24, y: 118 }, { type: 'M', x: 62, y: 22 }, { type: 'L', x: 62, y: 22 }],
  k: [{ type: 'M', x: 24, y: 14 }, { type: 'L', x: 24, y: 118 }, { type: 'M', x: 82, y: 50 }, { type: 'L', x: 24, y: 86 }, { type: 'L', x: 86, y: 118 }],
  l: [{ type: 'M', x: 50, y: 14 }, { type: 'L', x: 50, y: 118 }],
  m: [{ type: 'M', x: 12, y: 118 }, { type: 'L', x: 12, y: 52 }, { type: 'C', x1: 24, y1: 34, x2: 42, y2: 34, x: 50, y: 70 }, { type: 'C', x1: 58, y1: 34, x2: 88, y2: 34, x: 88, y: 118 }],
  n: [{ type: 'M', x: 20, y: 118 }, { type: 'L', x: 20, y: 52 }, { type: 'C', x1: 34, y1: 34, x2: 80, y2: 42, x: 80, y: 118 }],
  o: [{ type: 'M', x: 50, y: 36 }, { type: 'C', x1: 8, y1: 36, x2: 8, y2: 118, x: 50, y: 118 }, { type: 'C', x1: 92, y1: 118, x2: 92, y2: 36, x: 50, y: 36 }],
  p: [{ type: 'M', x: 22, y: 136 }, { type: 'L', x: 22, y: 52 }, { type: 'M', x: 22, y: 70 }, { type: 'C', x1: 56, y1: 36, x2: 92, y2: 62, x: 80, y: 96 }, { type: 'C', x1: 68, y1: 126, x2: 36, y2: 126, x: 22, y: 108 }],
  q: [{ type: 'M', x: 78, y: 136 }, { type: 'L', x: 78, y: 52 }, { type: 'M', x: 78, y: 70 }, { type: 'C', x1: 44, y1: 36, x2: 8, y2: 62, x: 20, y: 96 }, { type: 'C', x1: 32, y1: 126, x2: 64, y2: 126, x: 78, y: 108 }],
  r: [{ type: 'M', x: 24, y: 118 }, { type: 'L', x: 24, y: 52 }, { type: 'C', x1: 38, y1: 36, x2: 62, y2: 36, x: 78, y: 56 }],
  s: [{ type: 'M', x: 80, y: 30 }, { type: 'C', x1: 18, y1: 4, x2: 8, y2: 62, x: 60, y: 72 }, { type: 'C', x1: 112, y1: 82, x2: 78, y2: 145, x: 18, y: 116 }],
  t: [{ type: 'M', x: 50, y: 16 }, { type: 'L', x: 50, y: 108 }, { type: 'C', x1: 50, y1: 130, x2: 76, y2: 128, x: 82, y: 112 }, { type: 'M', x: 24, y: 46 }, { type: 'L', x: 78, y: 46 }],
  u: [{ type: 'M', x: 20, y: 48 }, { type: 'L', x: 20, y: 94 }, { type: 'C', x1: 20, y1: 128, x2: 80, y2: 128, x: 80, y: 94 }, { type: 'L', x: 80, y: 48 }],
  v: [{ type: 'M', x: 16, y: 48 }, { type: 'L', x: 50, y: 118 }, { type: 'L', x: 84, y: 48 }],
  w: [{ type: 'M', x: 8, y: 48 }, { type: 'L', x: 30, y: 118 }, { type: 'L', x: 50, y: 70 }, { type: 'L', x: 70, y: 118 }, { type: 'L', x: 92, y: 48 }],
  x: [{ type: 'M', x: 20, y: 48 }, { type: 'L', x: 80, y: 118 }, { type: 'M', x: 80, y: 48 }, { type: 'L', x: 20, y: 118 }],
  y: [{ type: 'M', x: 16, y: 48 }, { type: 'L', x: 50, y: 104 }, { type: 'L', x: 84, y: 48 }, { type: 'M', x: 50, y: 104 }, { type: 'C', x1: 42, y1: 140, x2: 20, y2: 150, x: 16, y: 126 }],
  z: [{ type: 'M', x: 20, y: 48 }, { type: 'L', x: 82, y: 48 }, { type: 'L', x: 18, y: 118 }, { type: 'L', x: 84, y: 118 }],
};

Object.assign(LETTER_PATHS, {
  A: [{ type: 'M', x: 16, y: 120 }, { type: 'L', x: 50, y: 16 }, { type: 'L', x: 84, y: 120 }, { type: 'M', x: 30, y: 78 }, { type: 'L', x: 70, y: 78 }],
  B: [{ type: 'M', x: 22, y: 18 }, { type: 'L', x: 22, y: 122 }, { type: 'M', x: 22, y: 18 }, { type: 'C', x1: 82, y1: 18, x2: 82, y2: 68, x: 22, y: 68 }, { type: 'M', x: 22, y: 68 }, { type: 'C', x1: 88, y1: 68, x2: 88, y2: 122, x: 22, y: 122 }],
  C: LETTER_PATHS.c,
  D: [{ type: 'M', x: 22, y: 18 }, { type: 'L', x: 22, y: 122 }, { type: 'M', x: 22, y: 18 }, { type: 'C', x1: 96, y1: 26, x2: 96, y2: 114, x: 22, y: 122 }],
  E: [{ type: 'M', x: 78, y: 18 }, { type: 'L', x: 24, y: 18 }, { type: 'L', x: 24, y: 122 }, { type: 'L', x: 82, y: 122 }, { type: 'M', x: 24, y: 70 }, { type: 'L', x: 70, y: 70 }],
  F: [{ type: 'M', x: 78, y: 18 }, { type: 'L', x: 24, y: 18 }, { type: 'L', x: 24, y: 122 }, { type: 'M', x: 24, y: 70 }, { type: 'L', x: 70, y: 70 }],
  G: [{ type: 'M', x: 82, y: 35 }, { type: 'C', x1: 22, y1: 4, x2: 9, y2: 136, x: 84, y: 108 }, { type: 'L', x: 84, y: 78 }, { type: 'L', x: 58, y: 78 }],
  H: [{ type: 'M', x: 22, y: 18 }, { type: 'L', x: 22, y: 122 }, { type: 'M', x: 78, y: 18 }, { type: 'L', x: 78, y: 122 }, { type: 'M', x: 22, y: 70 }, { type: 'L', x: 78, y: 70 }],
  I: [{ type: 'M', x: 30, y: 18 }, { type: 'L', x: 70, y: 18 }, { type: 'M', x: 50, y: 18 }, { type: 'L', x: 50, y: 122 }, { type: 'M', x: 30, y: 122 }, { type: 'L', x: 70, y: 122 }],
  J: LETTER_PATHS.j,
  K: LETTER_PATHS.k,
  L: [{ type: 'M', x: 24, y: 18 }, { type: 'L', x: 24, y: 122 }, { type: 'L', x: 82, y: 122 }],
  M: [{ type: 'M', x: 16, y: 122 }, { type: 'L', x: 16, y: 18 }, { type: 'L', x: 50, y: 84 }, { type: 'L', x: 84, y: 18 }, { type: 'L', x: 84, y: 122 }],
  N: [{ type: 'M', x: 20, y: 122 }, { type: 'L', x: 20, y: 18 }, { type: 'L', x: 80, y: 122 }, { type: 'L', x: 80, y: 18 }],
  O: LETTER_PATHS.o,
  P: LETTER_PATHS.p,
  Q: [{ type: 'M', x: 50, y: 18 }, { type: 'C', x1: 8, y1: 18, x2: 8, y2: 122, x: 50, y: 122 }, { type: 'C', x1: 92, y1: 122, x2: 92, y2: 18, x: 50, y: 18 }, { type: 'M', x: 62, y: 100 }, { type: 'L', x: 86, y: 126 }],
  R: [{ type: 'M', x: 22, y: 122 }, { type: 'L', x: 22, y: 18 }, { type: 'M', x: 22, y: 18 }, { type: 'C', x1: 88, y1: 18, x2: 88, y2: 76, x: 22, y: 76 }, { type: 'L', x: 84, y: 122 }],
  S: LETTER_PATHS.s,
  T: [{ type: 'M', x: 18, y: 18 }, { type: 'L', x: 82, y: 18 }, { type: 'M', x: 50, y: 18 }, { type: 'L', x: 50, y: 122 }],
  U: LETTER_PATHS.u,
  V: LETTER_PATHS.v,
  W: LETTER_PATHS.w,
  X: LETTER_PATHS.x,
  Y: [{ type: 'M', x: 16, y: 18 }, { type: 'L', x: 50, y: 72 }, { type: 'L', x: 84, y: 18 }, { type: 'M', x: 50, y: 72 }, { type: 'L', x: 50, y: 122 }],
  Z: LETTER_PATHS.z,
} satisfies Record<string, DrawCommand[]>);
