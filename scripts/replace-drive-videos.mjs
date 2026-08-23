import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const ROOT = process.cwd();
const DEFAULT_SOURCE_DIR = 'C:\\Users\\moham\\Downloads\\drive-download-20260818T061910Z-1-001';
const SOURCE_DIR = process.env.DRIVE_VIDEO_SOURCE_DIR || DEFAULT_SOURCE_DIR;
const OUTPUT_DIR = path.join(ROOT, 'public', 'videos');
const MAX_WIDTH = Number(process.env.VIDEO_MAX_WIDTH || '960');
const CRF = Number(process.env.VIDEO_CRF || '30');
const AUDIO_BITRATE = process.env.VIDEO_AUDIO_BITRATE || '96k';
const PRESET = process.env.VIDEO_PRESET || 'veryfast';
const VIDEO_ENCODER = process.env.VIDEO_ENCODER || 'libx264';
const VIDEO_CQ = process.env.VIDEO_CQ || String(CRF);
const START = Number(process.env.VIDEO_BATCH_START || '0');
const COUNT = Number(process.env.VIDEO_BATCH_COUNT || `${Number.MAX_SAFE_INTEGER}`);

const videoMap = [
  ['Letter _Aa_.mp4', '(a) sound.mp4'],
  ['Letter _Bb_.mp4', '(b) sound.mp4'],
  ['Letters _Cc_ & _Kk_.mp4', '(ck) sound.mp4'],
  ['Letter _Dd_.mp4', '(d) sound.mp4'],
  ['Letter _Ee_.mp4', '(e) sound.mp4'],
  ['Letter _Ff_.mp4', '(f) sound.mp4'],
  ['Letter _Gg_.mp4', '(g) sound.mp4'],
  ['Letter _Hh_.mp4', '(h) sound.mp4'],
  ['Letter _Ii_.mp4', '(i) sound.mp4'],
  ['Letter _Jj_.mp4', '(j) sound.mp4'],
  ['Letter _Ll_.mp4', '(l) sound.mp4'],
  ['Letter _Mm_.mp4', '(m) sound.mp4'],
  ['Letter _Nn_.mp4', '(n) sound.mp4'],
  ['Letter _Oo_.mp4', '(o) sound.mp4'],
  ['Letter _Pp_.mp4', '(p) sound.mp4'],
  ['Letter _Qq_.mp4', '(qu) sound.mp4'],
  ['Letter _Rr_.mp4', '(r) sound.mp4'],
  ['Letter _Ss_.mp4', '(s) sound(1).mp4'],
  ['Letter _Tt_.mp4', '(t) sound.mp4'],
  ['Letter _Uu_.mp4', '(u) sound.mp4'],
  ['Letter _Vv_.mp4', '(v) sound.mp4'],
  ['Letter _Ww_.mp4', '(w) sound.mp4'],
  ['Letter _Xx_.mp4', '(x) sound.mp4'],
  ['Letter _Yy_.mp4', '(y) sound.mp4'],
  ['Letter _Zz_.mp4', '(z) sound.mp4'],
  ['_ai_ sound.mp4', '(ai) sound.mp4'],
  ['_ar_ sound.mp4', '(ar) sound.mp4'],
  ['_ch_ sound.mp4', '(ch) sound.mp4'],
  ['_ee_ sound.mp4', '(ee) sound.mp4'],
  ['_ie_ sound.mp4', '(ie) sound.mp4'],
  ['_oa_ sound.mp4', '(oa) sound.mp4'],
  ['_oi_ sound.mp4', '(oi) sound.mp4'],
  ['_ou_ sound.mp4', '(ou) sound.mp4'],
  ['_sh_ sound.mp4', '(sh) sound.mp4'],
  ['_th_ sound.mp4', '(th) sounds.mp4'],
  ['_ue_ sound.mp4', '(ue) sound.mp4'],
  ['Cpital L1.mp4', 'Capitals (Lesson 1).mp4'],
  ['Cpital L2.mp4', 'Capitals (Lesson 2).mp4'],
  ['Cpital L3.mp4', 'Capitals (Lesson 3).mp4'],
  ['Cpital L4.mp4', 'Capitals (Lesson 4).mp4'],
  ['Cpital L5.mp4', 'Capitals (Lesson 5).mp4'],
  ['Cpital L6.mp4', 'Capitals (Lesson 6).mp4'],
  ['Cpital L7.mp4', 'Capitals (Lesson 7).mp4'],
  ['Capital L8.mp4', 'Capitals (Lesson 8).mp4'],
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${command} exited with ${code}`));
    });
  });
}

async function statSize(filePath) {
  const stat = await fs.stat(filePath);
  return stat.size;
}

async function replaceVideo(sourceName, destinationName, index) {
  const sourcePath = path.join(SOURCE_DIR, sourceName);
  const destinationPath = path.join(OUTPUT_DIR, destinationName);
  const tempPath = `${destinationPath}.tmp.mp4`;
  const before = await statSize(sourcePath);

  await fs.access(sourcePath);
  await fs.access(destinationPath);
  await fs.rm(tempPath, { force: true });

  const scaleFilter = `scale='min(${MAX_WIDTH},iw)':-2`;
  const videoArgs =
    VIDEO_ENCODER === 'libx264'
      ? ['-c:v', 'libx264', '-preset', PRESET, '-crf', String(CRF), '-pix_fmt', 'yuv420p', '-profile:v', 'main']
      : ['-c:v', VIDEO_ENCODER, '-preset', PRESET, '-cq', VIDEO_CQ, '-b:v', '0', '-pix_fmt', 'yuv420p'];

  await run(ffmpegInstaller.path, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    sourcePath,
    '-vf',
    scaleFilter,
    ...videoArgs,
    '-c:a',
    'aac',
    '-b:a',
    AUDIO_BITRATE,
    '-movflags',
    '+faststart',
    tempPath,
  ]);

  const after = await statSize(tempPath);
  await fs.rename(tempPath, destinationPath);
  console.log(`${index + 1}/${videoMap.length} ${destinationName}: ${(before / 1048576).toFixed(2)}MB -> ${(after / 1048576).toFixed(2)}MB`);
}

const batch = videoMap.slice(START, START + COUNT);
for (let index = 0; index < batch.length; index += 1) {
  const absoluteIndex = START + index;
  const [sourceName, destinationName] = batch[index];
  await replaceVideo(sourceName, destinationName, absoluteIndex);
}

console.log(`Processed ${batch.length} video(s).`);
