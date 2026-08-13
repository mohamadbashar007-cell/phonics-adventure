import { useEffect, useRef } from 'react';
import { CORRECT_ANSWER_CELEBRATION_EVENT } from '@/utils/correctAnswerCelebration';

type Color = readonly [number, number, number];

interface Spark {
  kind: 'particle' | 'crown';
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  age: number;
  lifetime: number;
  color: Color;
  angle: number;
  arc: number;
  expansion: number;
}

const COLORS: Color[] = [
  [231, 76, 60],
  [241, 196, 15],
  [46, 204, 113],
  [52, 152, 219],
  [155, 89, 182],
  [236, 72, 153],
  [34, 211, 238],
];

const random = (min: number, max: number) => Math.random() * (max - min) + min;
const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

function makeSpark(x: number, y: number, kind: Spark['kind'], compact: boolean): Spark {
  const angle = random(0, Math.PI * 2);
  const speed = random(compact ? 105 : 150, compact ? 235 : 390);

  return {
    kind,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: kind === 'particle' ? random(5, compact ? 10 : 15) : random(13, compact ? 20 : 28),
    age: 0,
    lifetime: kind === 'particle' ? random(0.95, 1.55) : random(0.65, 1.05),
    color: randomColor(),
    angle: random(0, Math.PI * 2),
    arc: random(0.45, 1.45),
    expansion: random(34, 72),
  };
}

function drawParticle(ctx: CanvasRenderingContext2D, spark: Spark, progress: number) {
  const alpha = Math.max(0, 1 - progress);
  const radius = Math.max(0.2, spark.size * Math.pow(alpha, 0.55));
  const [r, g, b] = spark.color;
  const glow = ctx.createRadialGradient(spark.x, spark.y, radius * 0.1, spark.x, spark.y, radius * 2.2);

  glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.65})`);
  glow.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${alpha * 0.26})`);
  glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, radius * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, radius, 0, Math.PI * 2);
  ctx.fill();

  const offset = radius * 0.5;
  ctx.fillStyle = `rgba(${g}, ${b}, ${r}, ${alpha * 0.25})`;
  ctx.beginPath();
  ctx.arc(spark.x + offset, spark.y + offset, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrown(ctx: CanvasRenderingContext2D, spark: Spark, progress: number) {
  const alpha = Math.max(0, 1 - progress);
  const radius = spark.size + spark.expansion * progress;
  const [r, g, b] = spark.color;
  const start = spark.angle;
  const end = start + spark.arc;
  const middle = start + spark.arc / 2;

  ctx.save();
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.64})`;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, radius, start, end);
  ctx.quadraticCurveTo(
    spark.x + radius * 1.2 * Math.cos(middle),
    spark.y + radius * 1.2 * Math.sin(middle),
    spark.x + radius * Math.cos(start),
    spark.y + radius * Math.sin(start),
  );
  ctx.fill();
  ctx.restore();
}

export default function CorrectAnswerCelebration() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let sparks: Spark[] = [];
    let animationFrame = 0;
    let previousTime = 0;
    const burstTimeouts = new Set<number>();

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const render = (time: number) => {
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.034) : 1 / 60;
      previousTime = time;
      ctx.clearRect(0, 0, width, height);

      sparks = sparks.filter((spark) => {
        spark.age += delta;
        if (spark.age >= spark.lifetime) return false;

        const progress = spark.age / spark.lifetime;
        spark.x += spark.vx * delta;
        spark.y += spark.vy * delta;
        spark.vx *= Math.pow(0.985, delta * 60);
        spark.vy = spark.vy * Math.pow(0.985, delta * 60) + 105 * delta;

        if (spark.kind === 'particle') {
          drawParticle(ctx, spark, progress);
        } else {
          drawCrown(ctx, spark, progress);
        }
        return true;
      });

      if (sparks.length) {
        animationFrame = window.requestAnimationFrame(render);
      } else {
        animationFrame = 0;
        previousTime = 0;
        ctx.clearRect(0, 0, width, height);
      }
    };

    const celebrate = () => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const compact = width < 640;
      const points = reducedMotion
        ? [[0.2, 0.5], [0.5, 0.38], [0.8, 0.5]]
        : compact
          ? [[0.1, 0.62], [0.3, 0.34], [0.5, 0.57], [0.7, 0.3], [0.9, 0.6]]
          : [[0.06, 0.58], [0.2, 0.32], [0.35, 0.64], [0.5, 0.38], [0.65, 0.63], [0.8, 0.31], [0.94, 0.57]];
      const particlesPerBurst = reducedMotion ? 10 : compact ? 25 : 32;
      const crownsPerBurst = reducedMotion ? 3 : compact ? 7 : 10;

      points.forEach(([xRatio, yRatio], index) => {
        const x = width * xRatio + random(-18, 18);
        const y = height * yRatio + random(-24, 24);
        const delay = reducedMotion ? 0 : index * 65;

        const timeoutId = window.setTimeout(() => {
          burstTimeouts.delete(timeoutId);
          for (let i = 0; i < particlesPerBurst; i += 1) sparks.push(makeSpark(x, y, 'particle', compact));
          for (let i = 0; i < crownsPerBurst; i += 1) sparks.push(makeSpark(x, y, 'crown', compact));

          if (!animationFrame) {
            previousTime = 0;
            animationFrame = window.requestAnimationFrame(render);
          }
        }, delay);
        burstTimeouts.add(timeoutId);
      });
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener(CORRECT_ANSWER_CELEBRATION_EVENT, celebrate);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener(CORRECT_ANSWER_CELEBRATION_EVENT, celebrate);
      burstTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] h-dvh w-screen"
    />
  );
}
