import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const PROFILE_DIR = process.env.LAHAJATI_PROFILE_DIR || path.join(os.tmpdir(), 'codex-lahajati-profile');
const STAGING_DIR = path.join(os.tmpdir(), 'phonics-lahajati-audio-staging');
const BACKUP_DIR = path.join(ROOT, 'backups', 'audio-before-lahajati-20260806');
const CURRICULUM_PATH = path.join(ROOT, 'src', 'data', 'curriculum.json');
const TTS_URL = 'https://lahajati.ai/en/tools/text-to-speech-superior-v2';
const GENERATE_URL = 'https://lahajati.ai/en/tools/text-to-speech';
const VOICE_ID = '1382'; // Rahma: the most child-friendly free female voice on this account.
const DIALECT_ID = '77'; // General American English.
const MIN_AUDIO_BYTES = 1_000;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function sanitizeAudioKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildJobs() {
  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, 'utf8'));
  const jobs = new Map();

  for (const group of curriculum.groups || []) {
    for (const letter of group.letters || []) {
      for (const item of letter.vocabulary || []) {
        const key = sanitizeAudioKey(item.word);
        if (!key) continue;
        const relativePath = path.join('public', 'audio', 'vocabulary', `${key}.mp3`);
        if (!jobs.has(relativePath)) jobs.set(relativePath, item.word.trim());
      }

      if (!letter.story?.text) continue;
      const storyUrl = (letter.story.audio || `/audio/stories/${sanitizeAudioKey(letter.id)}-story.mp3`).split('?')[0];
      const relativePath = path.join('public', ...storyUrl.split('/').filter(Boolean));
      jobs.set(relativePath, letter.story.text.trim());
    }
  }

  const recordedTextKeys = new Set(['word', 'audioText', 'audioWord', 'audioSound', 'audioSyllable']);
  const visitRecordedText = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visitRecordedText);
      return;
    }
    if (typeof value !== 'object') return;

    for (const [key, child] of Object.entries(value)) {
      if (recordedTextKeys.has(key) && typeof child === 'string' && child.trim()) {
        const audioKey = sanitizeAudioKey(child);
        if (audioKey) {
          const relativePath = path.join('public', 'audio', 'vocabulary', `${audioKey}.mp3`);
          if (!jobs.has(relativePath)) jobs.set(relativePath, child.trim());
        }
      }
      visitRecordedText(child);
    }
  };

  visitRecordedText(curriculum);

  return [...jobs].map(([relativePath, text]) => ({ relativePath, text }));
}

function isValidAudio(buffer) {
  if (buffer.length < MIN_AUDIO_BYTES) return false;
  const startsWithId3 = buffer.subarray(0, 3).toString('ascii') === 'ID3';
  const startsWithMp3Frame = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  return startsWithId3 || startsWithMp3Frame;
}

function stagingPathFor(job) {
  return path.join(STAGING_DIR, job.relativePath);
}

async function preparePage(page) {
  await page.goto(TTS_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector(`.voice-card[data-voice-id="${VOICE_ID}"]`, { timeout: 30_000 });
  await page.locator(`.voice-card[data-voice-id="${VOICE_ID}"]`).click();
  await page.locator('#dialect-selector').click();

  const dialectItems = page.locator('#dialect-options-grid .selection-item');
  for (let index = 0; index < await dialectItems.count(); index += 1) {
    if ((await dialectItems.nth(index).innerText()).includes('General American')) {
      await dialectItems.nth(index).click();
      break;
    }
  }

  const settings = await page.evaluate(() => ({
    authenticated: !document.body.innerText.includes('Login'),
    voiceId: eval('selectedVoiceId'),
    dialectId: eval('selectedVoiceCategories').dialect?.id,
    csrfToken: eval('csrfToken'),
  }));

  if (!settings.authenticated || !settings.csrfToken) throw new Error('The Lahajati session is not authenticated.');
  if (String(settings.voiceId) !== VOICE_ID) throw new Error(`Voice selection failed: ${settings.voiceId}`);
  if (String(settings.dialectId) !== DIALECT_ID) throw new Error(`Dialect selection failed: ${settings.dialectId}`);
  return settings.csrfToken;
}

async function generateOne(request, csrfToken, job, index, total) {
  const finalPath = stagingPathFor(job);
  if (fs.existsSync(finalPath)) {
    const existing = fs.readFileSync(finalPath);
    if (isValidAudio(existing)) {
      console.log(`[${index}/${total}] cached ${job.relativePath}`);
      return;
    }
  }

  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const generationId = `phonics-${index}-${crypto.randomUUID()}`;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const startedAt = Date.now();
    const response = await request.post(GENERATE_URL, {
      headers: {
        Accept: 'text/plain',
        'X-CSRF-TOKEN': csrfToken,
      },
      multipart: {
        text: job.text.replace(/[\r\n]+/g, ' ').trim(),
        id_voice: VOICE_ID,
        version: 'lahajati_tts_pro_v1',
        feature_mode: '3',
        input_mode: 'guided_selection',
        speed: '1',
        temperature: '1.2',
        top_p: '0.95',
        top_k: '64',
        is_preview: '0',
        generation_id: generationId,
        professional_quality: '0',
        improve_human: '0',
        dialect_id: DIALECT_ID,
        project_name: `Phonics Adventure - ${path.basename(job.relativePath, '.mp3')}`,
      },
      timeout: 300_000,
    });

    if (response.ok()) {
      const buffer = await response.body();
      if (!isValidAudio(buffer)) {
        throw new Error(`Invalid audio response for ${job.relativePath} (${buffer.length} bytes)`);
      }
      const partialPath = `${finalPath}.part`;
      fs.writeFileSync(partialPath, buffer);
      fs.renameSync(partialPath, finalPath);
      console.log(`[${index}/${total}] generated ${job.relativePath} (${buffer.length} bytes, ${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
      await sleep(1_500);
      return;
    }

    const status = response.status();
    const errorText = (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
    if (status === 429) throw new Error(`Lahajati daily generation limit reached: ${errorText}`);
    if (![400, 408, 425, 500, 502, 503, 504].includes(status) || attempt === 5) {
      throw new Error(`Generation failed for ${job.relativePath}: HTTP ${status} ${errorText}`);
    }

    const waitMilliseconds = Math.min(60_000, 5_000 * 2 ** (attempt - 1));
    console.log(`[${index}/${total}] retry ${attempt}/5 after HTTP ${status}; waiting ${waitMilliseconds / 1000}s`);
    await sleep(waitMilliseconds);
  }
}

function installGeneratedAudio(jobs) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    for (const directory of ['lessons', 'stories', 'vocabulary']) {
      fs.cpSync(path.join(ROOT, 'public', 'audio', directory), path.join(BACKUP_DIR, directory), { recursive: true });
    }
  }

  for (const job of jobs) {
    const source = stagingPathFor(job);
    const destination = path.join(ROOT, job.relativePath);
    fs.copyFileSync(source, destination);
  }

  const sLesson = jobs.find((job) => job.relativePath.endsWith(path.join('lessons', 's-story.mp3')));
  if (sLesson) {
    fs.copyFileSync(stagingPathFor(sLesson), path.join(ROOT, 'public', 'audio', 'stories', 's-story.mp3'));
  }
}

async function main() {
  const jobs = buildJobs();
  const totalCharacters = jobs.reduce((sum, job) => sum + job.text.length, 0);
  console.log(`Preparing ${jobs.length} files (${totalCharacters} text characters).`);
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: true,
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    const csrfToken = await preparePage(page);
    let nextJobIndex = 0;
    const worker = async () => {
      while (nextJobIndex < jobs.length) {
        const index = nextJobIndex;
        nextJobIndex += 1;
        await generateOne(context.request, csrfToken, jobs[index], index + 1, jobs.length);
      }
    };
    await worker();
  } finally {
    await context.close();
  }

  const missing = jobs.filter((job) => !fs.existsSync(stagingPathFor(job)) || !isValidAudio(fs.readFileSync(stagingPathFor(job))));
  if (missing.length) throw new Error(`${missing.length} staged audio files are missing or invalid.`);

  installGeneratedAudio(jobs);
  console.log(`Installed ${jobs.length + 1} audio files. Original files: ${BACKUP_DIR}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
