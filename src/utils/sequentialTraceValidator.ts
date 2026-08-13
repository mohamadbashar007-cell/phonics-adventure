export interface TracePoint {
  x: number;
  y: number;
  distance?: number;
  strokeId?: number;
}

export interface TraceProgressState {
  offPath: boolean;
  progress: number;
  currentIndex: number;
}

export interface SequentialTraceOptions {
  tolerance?: number;
  skipTolerance?: number;
  offPathTolerance?: number;
  minProgress?: number;
  minPoints?: number;
}

const DEFAULT_TOLERANCE = 35;
const DEFAULT_SKIP_TOLERANCE = 60;
const DEFAULT_OFFPATH_TOLERANCE = 75;
const DEFAULT_MIN_PROGRESS = 0.9;
const DEFAULT_MIN_POINTS = 40;
const SAMPLE_SPACING_GUESS = 5;

export class SequentialTraceValidator {
  private trace: TracePoint[] = [];
  private currentIndex = 0;
  private userPoints = 0;
  private isDrawing = false;
  private furthestDistance = 0;

  private tolerance: number;
  private skipTolerance: number;
  private offPathTolerance: number;
  private minProgress: number;
  private minPoints: number;

  constructor(trace: TracePoint[], options?: SequentialTraceOptions) {
    this.tolerance = options?.tolerance ?? DEFAULT_TOLERANCE;
    this.skipTolerance = options?.skipTolerance ?? DEFAULT_SKIP_TOLERANCE;
    this.offPathTolerance = options?.offPathTolerance ?? DEFAULT_OFFPATH_TOLERANCE;
    this.minProgress = options?.minProgress ?? DEFAULT_MIN_PROGRESS;
    this.minPoints = options?.minPoints ?? DEFAULT_MIN_POINTS;
    this.initialize(trace);
  }

  initialize(trace: TracePoint[]) {
    this.trace = trace;
    this.currentIndex = 0;
    this.userPoints = 0;
    this.isDrawing = false;
    this.furthestDistance = trace[0]?.distance ?? 0;
  }

  reset() {
    this.currentIndex = 0;
    this.userPoints = 0;
    this.isDrawing = false;
    this.furthestDistance = this.trace[0]?.distance ?? 0;
  }

  startDrawing(point?: TracePoint): TraceProgressState {
    this.isDrawing = true;
    if (point) {
      return this.evaluatePoint(point);
    }
    return this.getState(false);
  }

  recordPoint(point: TracePoint): TraceProgressState {
    if (!this.isDrawing || !this.trace.length) {
      return this.getState(false);
    }

    this.userPoints++;
    return this.evaluatePoint(point);
  }

  stopDrawing(point?: TracePoint): TraceProgressState {
    if (!this.isDrawing) {
      return this.getState(false);
    }

    this.isDrawing = false;
    if (point) {
      return this.evaluatePoint(point);
    }
    return this.getState(false);
  }

  private evaluatePoint(point: TracePoint): TraceProgressState {
    if (!this.trace.length) {
      return this.getState(false);
    }

    const lookahead = Math.max(2, Math.round(this.skipTolerance / SAMPLE_SPACING_GUESS));
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    const maxIndex = Math.min(this.trace.length - 1, this.currentIndex + lookahead);

    for (let i = this.currentIndex; i <= maxIndex; i++) {
      const sample = this.trace[i];
      const d = distance(point, sample);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }

    let offPath = false;

    if (bestIndex !== -1 && bestDistance <= this.tolerance) {
      this.currentIndex = Math.min(bestIndex + 1, this.trace.length - 1);
      const reachedDistance = this.trace[this.currentIndex]?.distance ?? 1;
      this.furthestDistance = Math.max(this.furthestDistance, reachedDistance);
    } else if (bestDistance > this.offPathTolerance) {
      offPath = true;
    }

    return this.getState(offPath);
  }

  private getProgress(): number {
    if (!this.trace.length) return 0;
    const currentDistance = this.trace[this.currentIndex]?.distance ?? 0;
    return Math.max(this.furthestDistance, currentDistance);
  }

  isPassing(): boolean {
    return this.userPoints >= this.minPoints && this.getProgress() >= this.minProgress;
  }

  private getState(offPath: boolean): TraceProgressState {
    return {
      offPath,
      progress: this.getProgress(),
      currentIndex: this.currentIndex,
    };
  }
}

function distance(a: TracePoint, b: TracePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
