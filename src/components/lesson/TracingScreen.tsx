import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { soundEffects } from '../../services/soundEffects';
import { getLetterTrace, type LetterTrace } from '../../data/letterTraces';
import { SequentialTraceValidator, TraceProgressState, type TracePoint } from '../../utils/sequentialTraceValidator';
import { celebrateCorrectAnswer } from '../../utils/correctAnswerCelebration';
import FeedbackToast from './FeedbackToast';

interface TracingScreenProps {
  letter: any;
  traceLetters?: string[];
  onComplete: (stars: number) => void;
}

const CANVAS_SIZE = 400;
const PERFECT_TRACE_DURATION = 2.4;
const PERFECT_TRACE_COLOR = '#14b8a6';

type PerfectTraceSegment = {
  path: string;
  length: number;
};

function buildPerfectTraceSegments(trace: LetterTrace): PerfectTraceSegment[] {
  const paths = trace.path.match(/M[^M]*/g)?.map((path) => path.trim()).filter(Boolean) || [trace.path];
  if (typeof document === 'undefined') {
    return paths.map((path) => ({ path, length: CANVAS_SIZE }));
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.style.overflow = 'hidden';
  document.body.appendChild(svg);

  const segments = paths.map((path) => {
    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElement.setAttribute('d', path);
    svg.appendChild(pathElement);
    const length = Math.max(1, pathElement.getTotalLength());
    pathElement.remove();
    return { path, length };
  });

  svg.remove();
  return segments;
}

export default function TracingScreen({ letter, traceLetters: traceLettersProp, onComplete }: TracingScreenProps) {
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const validatorRef = useRef<SequentialTraceValidator | null>(null);
  const perfectTraceAdvanceTimeoutRef = useRef<number | null>(null);
  const perfectTraceFinishedRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const traceLetters = useMemo(() => {
    const providedLetters = traceLettersProp?.map((item) => item.trim()).filter(Boolean);
    return providedLetters?.length ? providedLetters : [letter.letter || letter.id || 'a'];
  }, [letter.id, letter.letter, traceLettersProp]);

  const [traceIndex, setTraceIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isShowingPerfectTrace, setIsShowingPerfectTrace] = useState(false);
  const [isPerfectTraceComplete, setIsPerfectTraceComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [traceData, setTraceData] = useState<LetterTrace | null>(null);
  const [isTraceLoading, setIsTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const activeTraceLetter = traceLetters[Math.min(traceIndex, traceLetters.length - 1)] || 'a';
  const hasMultipleTraceLetters = traceLetters.length > 1;
  const isLastTraceLetter = traceIndex >= traceLetters.length - 1;
  const canDraw = Boolean(traceData) && !isTraceLoading && !traceError;
  const canAdvance = Boolean(validatorRef.current?.isPassing()) && !isCompleting && canDraw;
  const perfectTraceSegments = useMemo(
    () => (traceData ? buildPerfectTraceSegments(traceData) : []),
    [traceData],
  );

  useEffect(() => {
    setTraceIndex(0);
  }, [letter.id]);

  useEffect(() => {
    audioService.playPrompt(`Trace the letter ${activeTraceLetter}`);
  }, [activeTraceLetter]);

  useEffect(() => {
    let cancelled = false;
    setIsTraceLoading(true);
    setTraceError(null);
    setTraceData(null);
    setProgress(0);
    setCurrentIndex(0);
    setHasDrawn(false);
    setIsCompleting(false);
    setIsShowingPerfectTrace(false);
    setIsPerfectTraceComplete(false);
    perfectTraceFinishedRef.current = false;

    getLetterTrace(activeTraceLetter)
      .then((trace) => {
        if (cancelled) return;
        if (trace.points.length === 0) {
          setTraceError('Unable to load the tracing guide. Please try again.');
        } else {
          setTraceData(trace);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTraceError('Unable to load the tracing guide. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsTraceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTraceLetter]);

  useEffect(() => {
    return () => {
      if (perfectTraceAdvanceTimeoutRef.current) {
        window.clearTimeout(perfectTraceAdvanceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!traceData) return;
    validatorRef.current = new SequentialTraceValidator(traceData.points, {
      tolerance: 34,
      skipTolerance: 82,
      offPathTolerance: 96,
      minProgress: 0.78,
      minPoints: 32,
    });
    setProgress(0);
    setCurrentIndex(0);
    setHasDrawn(false);
    setFeedback(null);
    setIsCompleting(false);
    setIsShowingPerfectTrace(false);
    setIsPerfectTraceComplete(false);
    perfectTraceFinishedRef.current = false;
    clearCanvas();
  }, [traceData]);

  const clearCanvas = () => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#3b82f6';
    validatorRef.current?.reset();
    setProgress(0);
    setCurrentIndex(0);
    setHasDrawn(false);
    setFeedback(null);
    setIsCompleting(false);
    setIsShowingPerfectTrace(false);
    setIsPerfectTraceComplete(false);
    perfectTraceFinishedRef.current = false;
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (feedback || isCompleting || !validatorRef.current || !canDraw) return;
    setIsDrawing(true);
    setHasDrawn(true);
    const point = getCoordinates(e);
    const ctx = drawCanvasRef.current?.getContext('2d');
    ctx?.beginPath();
    ctx?.moveTo(point.x, point.y);
    updateProgressState(validatorRef.current.startDrawing(point));
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || feedback || isCompleting) return;
    if ('touches' in e) e.preventDefault();
    const point = getCoordinates(e);
    const ctx = drawCanvasRef.current?.getContext('2d');
    ctx?.lineTo(point.x, point.y);
    ctx?.stroke();
    if (!validatorRef.current || !canDraw) return;
    updateProgressState(validatorRef.current.recordPoint(point));
  };

  const stopDrawing = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const point = e ? getCoordinates(e) : undefined;
    if (!validatorRef.current) return;
    updateProgressState(validatorRef.current.stopDrawing(point));
  };

  const updateProgressState = (state: TraceProgressState) => {
    setProgress(state.progress);
    setCurrentIndex(state.currentIndex);
  };

  const handleDone = async () => {
    if (!validatorRef.current || !canAdvance) return;

    if (!validatorRef.current.isPassing()) {
      setFeedback({ type: 'error', text: 'Follow the dots inside the letter! \u{1F501}' });
      soundEffects.playError();
      setIsCompleting(true);
      setTimeout(() => {
        setFeedback(null);
        setIsCompleting(false);
      }, 1500);
      return;
    }

    setFeedback({ type: 'success', text: 'Excellent tracing! \u{2728}' });
    soundEffects.playSuccess();
    setIsCompleting(true);
    perfectTraceFinishedRef.current = false;
    setIsPerfectTraceComplete(false);
    setIsShowingPerfectTrace(true);
    void audioService.playPrompt('Excellent tracing!');
  };

  const handlePerfectTraceComplete = () => {
    if (!isShowingPerfectTrace || perfectTraceFinishedRef.current) return;

    perfectTraceFinishedRef.current = true;
    setIsPerfectTraceComplete(true);
    setFeedback({ type: 'success', text: 'Perfect! \u{1F389}' });
    soundEffects.playCelebration();
    celebrateCorrectAnswer();

    perfectTraceAdvanceTimeoutRef.current = window.setTimeout(() => {
      setFeedback(null);
      setIsCompleting(false);
      setIsShowingPerfectTrace(false);
      if (isLastTraceLetter) {
        onComplete(1);
      } else {
        setTraceIndex((current) => Math.min(current + 1, traceLetters.length - 1));
      }
    }, 900);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): TracePoint => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 md:p-8 text-center relative">
      <h2 className="text-2xl md:text-4xl font-black text-gray-800 mb-2">Trace the letter '{activeTraceLetter}'</h2>
      <p className="text-lg md:text-xl text-gray-600 mb-2 font-bold">Trace inside the blue letter!</p>
      <p className="text-sm text-gray-500 mb-6 font-semibold">
        {hasMultipleTraceLetters ? `Letter ${traceIndex + 1} of ${traceLetters.length} · ` : ''}
        Progress: {isTraceLoading ? '--' : `${(progress * 100).toFixed(0)}%`}
      </p>

      <div className="relative group">
        <div className="relative w-[min(92vw,380px)] h-[min(92vw,380px)] md:w-[360px] md:h-[360px] lg:w-[400px] lg:h-[400px] bg-white rounded-3xl shadow-2xl border-8 border-dashed border-blue-200 flex items-center justify-center overflow-hidden">
          {traceData && (
            <svg viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`} className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <path
                d={traceData.guidePath}
                fill="none"
                stroke="#dbeafe"
                strokeWidth={traceData.guideStrokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {traceData.points.map((point, index) => {
                const previousPoint = traceData.points[index - 1];
                const isStart = index === 0 || point.strokeId !== previousPoint?.strokeId;
                const isCompleted = index < currentIndex;
                const fill = isStart ? '#22c55e' : isCompleted ? '#2563eb' : '#c9cdd2';
                const radius = isStart ? 7 : 5;

                return (
                  <circle
                    key={`${point.x}-${point.y}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={isStart ? 2 : 1.5}
                    opacity={isShowingPerfectTrace ? 0.2 : 1}
                  />
                );
              })}
            </svg>
          )}

          {traceData && isShowingPerfectTrace && (
            <svg
              viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
              className="pointer-events-none absolute inset-0 z-20 h-full w-full"
              aria-label={`Perfect tracing animation for ${activeTraceLetter}`}
              role="img"
            >
              <defs>
                <filter
                  id="perfect-trace-glow"
                  filterUnits="userSpaceOnUse"
                  x="-100"
                  y="-100"
                  width="600"
                  height="600"
                >
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {!isPerfectTraceComplete && perfectTraceSegments.map((segment, index) => {
                const totalDuration = prefersReducedMotion ? 0.6 : PERFECT_TRACE_DURATION;
                const duration = totalDuration / Math.max(perfectTraceSegments.length, 1);
                const delay = 0.2 + index * duration;
                const isLastSegment = index === perfectTraceSegments.length - 1;

                return (
                  <React.Fragment key={`perfect-stroke-${index}`}>
                    <motion.path
                      d={segment.path}
                      fill="none"
                      stroke={PERFECT_TRACE_COLOR}
                      strokeWidth={26}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={`${segment.length} ${segment.length}`}
                      opacity={0.28}
                      initial={{ strokeDashoffset: segment.length }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ delay, duration, ease: 'easeInOut' }}
                    />
                    <motion.path
                      d={segment.path}
                      fill="none"
                      stroke={PERFECT_TRACE_COLOR}
                      strokeWidth={17}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={`${segment.length} ${segment.length}`}
                      filter="url(#perfect-trace-glow)"
                      initial={{ strokeDashoffset: segment.length }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ delay, duration, ease: 'easeInOut' }}
                      onAnimationComplete={isLastSegment ? handlePerfectTraceComplete : undefined}
                    />
                  </React.Fragment>
                );
              })}

              {isPerfectTraceComplete && (
                <>
                  <path
                    d={traceData.path}
                    fill="none"
                    stroke={PERFECT_TRACE_COLOR}
                    strokeWidth={26}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.28}
                  />
                  <path
                    d={traceData.path}
                    fill="none"
                    stroke={PERFECT_TRACE_COLOR}
                    strokeWidth={17}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#perfect-trace-glow)"
                  />
                </>
              )}

              {traceData.points.at(-1) && (
                <motion.g
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.2 + (prefersReducedMotion ? 0.6 : PERFECT_TRACE_DURATION),
                    type: 'spring',
                    stiffness: 320,
                    damping: 18,
                  }}
                  style={{ transformOrigin: `${traceData.points.at(-1)!.x}px ${traceData.points.at(-1)!.y}px` }}
                >
                  <circle
                    cx={traceData.points.at(-1)!.x}
                    cy={traceData.points.at(-1)!.y}
                    r="18"
                    fill="#22c55e"
                    stroke="#ffffff"
                    strokeWidth="5"
                  />
                  <path
                    d={`M${traceData.points.at(-1)!.x - 8} ${traceData.points.at(-1)!.y} l6 6 l12 -14`}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </motion.g>
              )}
            </svg>
          )}

          {isTraceLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 text-lg font-bold text-blue-600">Loading letter...</div>
          )}

          {traceError && !isTraceLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center px-4 text-center text-sm font-semibold text-red-600 bg-white/80">
              {traceError}
            </div>
          )}

          <canvas
            ref={drawCanvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className={`absolute inset-0 z-10 h-full w-full touch-none transition-opacity duration-300 ${
              isShowingPerfectTrace ? 'cursor-default opacity-0' : 'cursor-crosshair opacity-100'
            }`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={(e) => stopDrawing(e)}
            onMouseLeave={() => stopDrawing()}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={(e) => stopDrawing(e)}
          />

        </div>

        <button
          onClick={() => clearCanvas()}
          disabled={!canDraw || isDrawing || isCompleting}
          className="absolute -top-4 -right-4 p-3 bg-white rounded-full shadow-lg text-gray-500 hover:text-red-500 transition-colors z-20 border-2 border-gray-100 disabled:opacity-50"
          title="Clear"
        >
          <RotateCcw size={24} />
        </button>
      </div>

      <FeedbackToast feedback={feedback} />

      {canAdvance && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleDone}
          className="mt-6 px-12 py-4 text-white text-2xl font-black rounded-full shadow-xl transition-all bg-blue-600 hover:bg-blue-700"
        >
          {hasMultipleTraceLetters && !isLastTraceLetter ? 'Next' : 'Done'}
        </motion.button>
      )}
    </div>
  );
}
