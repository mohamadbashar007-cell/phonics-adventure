import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const publicDir = path.resolve('public');
const videoDir = path.join(publicDir, 'videos');
const backupDir = path.resolve('backups', 'videos-original');

const maxWidth = Number(process.env.VIDEO_MAX_WIDTH ?? 960);
const crf = Number(process.env.VIDEO_CRF ?? 30);
const audioBitrate = process.env.VIDEO_AUDIO_BITRATE ?? '96k';
const preset = process.env.VIDEO_PRESET ?? 'veryfast';
const keepBackups = process.env.VIDEO_KEEP_BACKUPS !== '0';

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp4')) {
      files.push(fullPath);
    }
  }

  return files;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `${command} exited with code ${code}`));
      }
    });
  });
}

function publicPath(filePath) {
  return `/${path.relative(publicDir, filePath).replaceAll(path.sep, '/')}`;
}

async function optimizeVideo(filePath) {
  const sourceStat = await fs.stat(filePath);
  const tempPath = `${filePath}.optimized.tmp.mp4`;
  const backupPath = path.join(backupDir, path.relative(videoDir, filePath));

  await fs.rm(tempPath, { force: true });
  await fs.mkdir(path.dirname(backupPath), { recursive: true });

  const scaleFilter = `scale='min(${maxWidth},iw)':-2`;
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    filePath,
    '-vf',
    scaleFilter,
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'main',
    '-c:a',
    'aac',
    '-b:a',
    audioBitrate,
    '-movflags',
    '+faststart',
    tempPath,
  ];

  await run(ffmpegInstaller.path, args);

  const outputStat = await fs.stat(tempPath);
  if (outputStat.size >= sourceStat.size * 0.96) {
    await fs.rm(tempPath, { force: true });
    return {
      file: publicPath(filePath),
      before: sourceStat.size,
      after: sourceStat.size,
      skipped: true,
    };
  }

  if (keepBackups) {
    try {
      await fs.access(backupPath);
    } catch {
      await fs.copyFile(filePath, backupPath);
    }
  }

  await fs.rename(tempPath, filePath);

  return {
    file: publicPath(filePath),
    before: sourceStat.size,
    after: outputStat.size,
    skipped: false,
  };
}

const files = await walk(videoDir);
const results = [];

for (const file of files) {
  if (file.includes(`${path.sep}__`)) continue;
  console.log(`Optimizing ${publicPath(file)}...`);
  try {
    const result = await optimizeVideo(file);
    results.push(result);
    const saved = result.before - result.after;
    const status = result.skipped ? 'kept original' : `saved ${(saved / 1024 / 1024).toFixed(2)}MB`;
    console.log(`  ${status}`);
  } catch (error) {
    console.error(`  failed: ${error.message}`);
  }
}

const before = results.reduce((sum, item) => sum + item.before, 0);
const after = results.reduce((sum, item) => sum + item.after, 0);
const optimized = results.filter((item) => !item.skipped).length;

console.log(`Optimized ${optimized}/${results.length} video(s).`);
console.log(`Total video bytes: ${(before / 1024 / 1024).toFixed(2)}MB -> ${(after / 1024 / 1024).toFixed(2)}MB`);
