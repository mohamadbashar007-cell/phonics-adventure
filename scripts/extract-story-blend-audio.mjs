import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const ROOT = process.cwd();
const CURRICULUM_PATH = path.join(ROOT, 'src', 'data', 'curriculum.json');
const STORIES_DIR = path.join(ROOT, 'public', 'audio', 'stories');
const OUTPUT_DIR = path.join(STORIES_DIR, 'blend');
const SILENCE_FILTER = 'silencedetect=noise=-35dB:d=0.3';
const MIN_SEGMENT_SECONDS = 0.25;
const CLIP_PADDING_SECONDS = 0.04;

function sanitizeAudioKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getStoryBlendSentences(text) {
  return getStorySentenceEntries(text)
    .filter((entry) => entry.words.length >= 3)
    .slice(0, 3)
    .map((entry) => entry.sentence);
}

function getStorySentenceEntries(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence, originalIndex) => ({
      sentence,
      originalIndex,
      words: sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [],
    }));
}

function runFfmpeg(args) {
  const result = spawnSync(ffmpegInstaller.path, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `ffmpeg failed with status ${result.status}`);
  }
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function detectSilences(sourcePath) {
  const output = runFfmpeg(['-hide_banner', '-i', sourcePath, '-af', SILENCE_FILTER, '-f', 'null', '-']);
  const durationMatch = output.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!durationMatch) throw new Error(`Could not read duration for ${sourcePath}`);
  const duration =
    Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);

  const silences = [];
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([0-9.]+)/);
    if (startMatch) {
      silences.push({ start: Number(startMatch[1]), end: null });
      continue;
    }
    const endMatch = line.match(/silence_end:\s*([0-9.]+)/);
    if (endMatch && silences.length) {
      silences[silences.length - 1].end = Number(endMatch[1]);
    }
  }

  return { duration, silences: silences.filter((silence) => Number.isFinite(silence.start) && Number.isFinite(silence.end)) };
}

function sentenceSpans(sourcePath) {
  const { duration, silences } = detectSilences(sourcePath);
  const spans = [];
  let cursor = 0;

  for (const silence of silences) {
    if (silence.start <= 0.05) {
      cursor = Math.max(cursor, silence.end);
      continue;
    }
    if (silence.start - cursor >= MIN_SEGMENT_SECONDS) {
      spans.push({
        start: Math.max(0, cursor - CLIP_PADDING_SECONDS),
        end: Math.min(duration, silence.start + CLIP_PADDING_SECONDS),
      });
    }
    cursor = Math.max(cursor, silence.end);
  }

  if (duration - cursor >= MIN_SEGMENT_SECONDS) {
    spans.push({
      start: Math.max(0, cursor - CLIP_PADDING_SECONDS),
      end: duration,
    });
  }

  return spans;
}

function extractClip(sourcePath, destinationPath, span) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  runFfmpeg([
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    span.start.toFixed(3),
    '-to',
    span.end.toFixed(3),
    '-i',
    sourcePath,
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '160k',
    destinationPath,
  ]);
}

function main() {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  const group7 = (curriculum.groups || []).find((group) => group.id === 7);
  if (!group7) throw new Error('Group 7 was not found in curriculum.json');

  let written = 0;
  for (const letter of group7.letters || []) {
    const key = sanitizeAudioKey(letter.id);
    const sourcePath = path.join(STORIES_DIR, `${key}-story.mp3`);
    const entries = getStorySentenceEntries(letter.story?.text)
      .filter((entry) => entry.words.length >= 3)
      .slice(0, 3);
    if (!entries.length) continue;
    if (!fs.existsSync(sourcePath)) throw new Error(`Missing story audio: ${sourcePath}`);

    const spans = sentenceSpans(sourcePath);
    const requiredSpanCount = Math.max(...entries.map((entry) => entry.originalIndex)) + 1;
    if (spans.length < requiredSpanCount) {
      throw new Error(`Only detected ${spans.length} sentence clips for ${key}, expected at least ${requiredSpanCount}`);
    }

    entries.forEach(({ sentence, originalIndex }, index) => {
      const destinationPath = path.join(OUTPUT_DIR, `${key}-sentence-${index + 1}.mp3`);
      extractClip(sourcePath, destinationPath, spans[originalIndex]);
      written += 1;
      console.log(`${path.relative(ROOT, destinationPath)}\t${sentence}`);
    });
  }

  console.log(`Extracted ${written} story Blend clips.`);
}

main();
