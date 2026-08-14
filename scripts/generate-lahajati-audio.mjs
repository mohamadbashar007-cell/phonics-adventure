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
const RECORDED_AUDIO_CONFIG_PATH = path.join(ROOT, 'src', 'data', 'recordedAudioConfig.json');
const RECORDED_PROMPTS_PATH = path.join(ROOT, 'src', 'data', 'recordedAudioPrompts.json');
const TTS_URL = 'https://lahajati.ai/en/tools/text-to-speech-superior-v2';
const GENERATE_URL = 'https://lahajati.ai/en/tools/text-to-speech';
const LOGIN_URL = 'https://lahajati.ai/login';
const VOICE_ID = '1382'; // Rahma: the most child-friendly free female voice on this account.
const DIALECT_ID = '77'; // General American English.
const MIN_AUDIO_BYTES = 1_000;
const GENERATION_WORKERS = Math.max(1, Number.parseInt(process.env.LAHAJATI_WORKERS || '4', 10) || 1);
const ACCOUNT_WORKERS = Math.max(1, Number.parseInt(process.env.LAHAJATI_ACCOUNT_WORKERS || '4', 10) || 1);
const ACCOUNT_LOGIN_WORKERS = Math.max(1, Number.parseInt(process.env.LAHAJATI_LOGIN_WORKERS || '3', 10) || 1);
const ACCOUNT_DAILY_JOB_LIMIT = 25;

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
  const recordedPrompts = JSON.parse(fs.readFileSync(RECORDED_PROMPTS_PATH, 'utf8'));
  const jobs = new Map();

  const registerVocabularyAudio = (text) => {
    const normalizedText = String(text || '').trim();
    const key = sanitizeAudioKey(normalizedText);
    if (!key) return;
    const relativePath = path.join('public', 'audio', 'vocabulary', `${key}.mp3`);
    if (!jobs.has(relativePath)) jobs.set(relativePath, normalizedText);
  };

  // Generate the short interface feedback first so a partial quota never
  // leaves the most frequently heard phrases on the browser's old voice.
  recordedPrompts.forEach(registerVocabularyAudio);

  for (const group of curriculum.groups || []) {
    for (const letter of group.letters || []) {
      registerVocabularyAudio(letter.letter);
      registerVocabularyAudio(`"${letter.letter}" for:`);
      registerVocabularyAudio(`Trace the letter ${letter.letter}`);

      for (const item of letter.vocabulary || []) {
        registerVocabularyAudio(item.word);
      }

      if (!letter.story?.text) continue;
      const storyUrl = (letter.story.audio || `/audio/stories/${sanitizeAudioKey(letter.id)}-story.mp3`).split('?')[0];
      const relativePath = path.join('public', ...storyUrl.split('/').filter(Boolean));
      jobs.set(relativePath, letter.story.text.trim());
    }
  }

  const recordedTextKeys = new Set(['word', 'audioText', 'audioWord', 'audioSound', 'audioSyllable', 'result']);
  const visitRecordedText = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visitRecordedText);
      return;
    }
    if (typeof value !== 'object') return;

    for (const [key, child] of Object.entries(value)) {
      if (recordedTextKeys.has(key) && typeof child === 'string' && child.trim()) {
        registerVocabularyAudio(child);
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

function generationTextFor(job) {
  if (job.relativePath.endsWith(path.join('vocabulary', 'oi-for.mp3'))) {
    return 'The oi sound is for';
  }
  return job.text;
}

async function preparePage(page) {
  await page.goto(TTS_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  if (new URL(page.url()).pathname.includes('/login')) {
    if (process.env.LAHAJATI_HEADLESS !== 'false') {
      throw new Error('The Lahajati session expired. Run with LAHAJATI_HEADLESS=false and sign in in the opened window.');
    }

    console.log('Lahajati login is required. Complete sign-in in the opened Chrome window.');
    const loginDeadline = Date.now() + 10 * 60_000;
    const authenticationPaths = /\/(login|register|forgot-password|reset-password|verify)/i;

    while (Date.now() < loginDeadline) {
      if (await page.locator(`.voice-card[data-voice-id="${VOICE_ID}"]`).count()) break;

      const currentPath = new URL(page.url()).pathname;
      if (!authenticationPaths.test(currentPath)) {
        await page.goto(TTS_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        if (await page.locator(`.voice-card[data-voice-id="${VOICE_ID}"]`).count()) break;
      }

      await page.waitForTimeout(2_000);
    }
  }

  await page.waitForSelector(`.voice-card[data-voice-id="${VOICE_ID}"]`, { timeout: 30_000 });
  await page.locator(`.voice-card[data-voice-id="${VOICE_ID}"]`).click();
  await page.locator('#dialect-selector').click();

  const generalAmericanDialect = page
    .locator('#dialect-options-grid .selection-item')
    .filter({ hasText: 'General American' })
    .first();
  await generalAmericanDialect.click();
  await page.waitForFunction(
    (dialectId) => String(eval('selectedVoiceCategories').dialect?.id) === dialectId,
    DIALECT_ID,
    { timeout: 10_000 },
  );

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

async function loginAccount(page, email, password) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click({ noWaitAfter: true });

    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 120_000 });
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(4_000 * attempt);
    }
  }

  if (new URL(page.url()).pathname.includes('/login')) {
    const errors = await page.locator('[role="alert"], .alert, .invalid-feedback, .text-danger').allTextContents();
    throw new Error(`Lahajati login failed: ${errors.map((value) => value.trim()).filter(Boolean).join(' ') || 'unknown error'}`);
  }
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
        text: generationTextFor(job).replace(/[\r\n]+/g, ' ').trim(),
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
    if (status === 429) {
      if (attempt === 5) throw new Error(`Lahajati generation limit is still active: ${errorText}`);
      const retryAfterSeconds = Number.parseInt(response.headers()['retry-after'] || '', 10);
      if (process.env.LAHAJATI_ACCOUNTS && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 3_600) {
        throw new Error(`This Lahajati account reached its daily generation limit while processing ${job.relativePath}.`);
      }
      const waitMilliseconds = Number.isFinite(retryAfterSeconds)
        ? Math.max(15_000, retryAfterSeconds * 1_000)
        : 60_000 + index * 250;
      console.log(`[${index}/${total}] rate limited; waiting ${Math.round(waitMilliseconds / 1000)}s before retry ${attempt + 1}/5`);
      await sleep(waitMilliseconds);
      continue;
    }
    if (![400, 408, 425, 500, 502, 503, 504].includes(status) || attempt === 5) {
      throw new Error(`Generation failed for ${job.relativePath}: HTTP ${status} ${errorText}`);
    }

    const waitMilliseconds = Math.min(60_000, 5_000 * 2 ** (attempt - 1));
    console.log(`[${index}/${total}] retry ${attempt}/5 after HTTP ${status}; waiting ${waitMilliseconds / 1000}s`);
    await sleep(waitMilliseconds);
  }
}

async function generateWithAccounts(jobs, accountEmails, password) {
  const pendingJobs = jobs
    .map((job, index) => ({ job, index }))
    .filter(({ job }) => !fs.existsSync(stagingPathFor(job)) || !isValidAudio(fs.readFileSync(stagingPathFor(job))));

  if (!pendingJobs.length) {
    console.log('All staged audio files are already complete.');
    return;
  }
  if (pendingJobs.length > accountEmails.length * ACCOUNT_DAILY_JOB_LIMIT) {
    throw new Error(`${pendingJobs.length} files need generation, but the configured accounts safely cover only ${accountEmails.length * ACCOUNT_DAILY_JOB_LIMIT} daily jobs.`);
  }

  const assignments = accountEmails.map((email, accountIndex) => ({ email, accountIndex, jobs: [] }));
  pendingJobs.forEach((entry, index) => assignments[index % assignments.length].jobs.push(entry));
  const activeAssignments = assignments.filter((assignment) => assignment.jobs.length > 0);
  console.log(`Generating ${pendingJobs.length} missing files across ${activeAssignments.length} accounts.`);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let nextAccountIndex = 0;
  let activeLogins = 0;
  const loginWaiters = [];

  const acquireLoginSlot = async () => {
    if (activeLogins < ACCOUNT_LOGIN_WORKERS) {
      activeLogins += 1;
      return;
    }
    await new Promise((resolve) => loginWaiters.push(resolve));
    activeLogins += 1;
  };

  const releaseLoginSlot = () => {
    activeLogins = Math.max(0, activeLogins - 1);
    loginWaiters.shift()?.();
  };

  const accountWorker = async () => {
    while (nextAccountIndex < activeAssignments.length) {
      const assignment = activeAssignments[nextAccountIndex];
      nextAccountIndex += 1;
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await acquireLoginSlot();
        let csrfToken;
        try {
          await loginAccount(page, assignment.email, password);
          csrfToken = await preparePage(page);
        } finally {
          releaseLoginSlot();
        }
        console.log(`Account ${assignment.accountIndex + 1}: generating ${assignment.jobs.length} files.`);
        for (const { job, index } of assignment.jobs) {
          try {
            await generateOne(context.request, csrfToken, job, index + 1, jobs.length);
          } catch (error) {
            console.error(`Deferred ${job.relativePath}: ${error.message || error}`);
          }
        }
      } finally {
        await context.close();
      }
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(ACCOUNT_WORKERS, activeAssignments.length) }, () => accountWorker()),
    );
  } finally {
    await browser.close();
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

  fs.writeFileSync(
    RECORDED_AUDIO_CONFIG_PATH,
    `${JSON.stringify({ extendedPromptsReady: true }, null, 2)}\n`,
    'utf8',
  );

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

  const accountEmails = String(process.env.LAHAJATI_ACCOUNTS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
  const accountPassword = process.env.LAHAJATI_ACCOUNT_PASSWORD || '';

  if (accountEmails.length) {
    if (!accountPassword) throw new Error('LAHAJATI_ACCOUNT_PASSWORD is required when LAHAJATI_ACCOUNTS is set.');
    for (let round = 1; round <= 3; round += 1) {
      await generateWithAccounts(jobs, accountEmails, accountPassword);
      const remaining = jobs.filter(
        (job) => !fs.existsSync(stagingPathFor(job)) || !isValidAudio(fs.readFileSync(stagingPathFor(job))),
      );
      if (!remaining.length) break;
      console.log(`Generation round ${round} left ${remaining.length} files; redistributing them.`);
    }
  } else {
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: 'chrome',
      headless: process.env.LAHAJATI_HEADLESS !== 'false',
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
      await Promise.all(Array.from({ length: Math.min(GENERATION_WORKERS, jobs.length) }, () => worker()));
    } finally {
      await context.close();
    }
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
