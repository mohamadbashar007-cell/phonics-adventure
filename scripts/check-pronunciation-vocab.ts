import fs from 'node:fs';
import path from 'node:path';
import { evaluatePronunciation, getSpeechAliases } from '../src/services/pronunciationService';

type Curriculum = {
  groups?: Group[];
} | Group[];

type Group = {
  id?: number | string;
  groupId?: number | string;
  letters?: Letter[];
};

type Letter = {
  id?: string;
  letter?: string;
  vocabulary?: VocabItem[];
};

type VocabItem = {
  word?: string;
  image?: string;
};

type VocabRow = {
  group: number | string;
  letter: string;
  word: string;
  image: string;
};

const curriculumPath = path.join(process.cwd(), 'src', 'data', 'curriculum.json');
const curriculum = JSON.parse(fs.readFileSync(curriculumPath, 'utf8')) as Curriculum;
const groups = Array.isArray(curriculum) ? curriculum : curriculum.groups || [];
const rows: VocabRow[] = [];

for (const group of groups) {
  for (const letter of group.letters || []) {
    for (const item of letter.vocabulary || []) {
      rows.push({
        group: group.id ?? group.groupId ?? 'unknown',
        letter: letter.letter ?? letter.id ?? 'unknown',
        word: String(item.word || '').trim().toLowerCase(),
        image: String(item.image || '').trim(),
      });
    }
  }
}

const failures: string[] = [];
const uniqueWords = [...new Set(rows.map((row) => row.word).filter(Boolean))].sort();
const wordSet = new Set(uniqueWords);

for (const row of rows) {
  if (!row.word) {
    failures.push(`Missing vocab word in group ${row.group}, letter ${row.letter}.`);
    continue;
  }

  const exactResult = evaluatePronunciation(row.word, row.word);
  if (exactResult.status !== 'correct') {
    failures.push(`Exact word failed: "${row.word}" in group ${row.group}, letter ${row.letter}.`);
  }

  if (!row.image) {
    failures.push(`Missing image path for "${row.word}" in group ${row.group}, letter ${row.letter}.`);
  } else {
    const imagePath = path.join(process.cwd(), 'public', row.image.replace(/^\/+/, ''));
    if (!fs.existsSync(imagePath)) {
      failures.push(`Missing image file for "${row.word}": ${row.image}`);
    }
  }
}

for (const target of uniqueWords) {
  for (const alias of getSpeechAliases(target)) {
    if (wordSet.has(alias) && alias !== target) {
      failures.push(`Alias collision: "${alias}" is a real vocab word but is accepted for "${target}".`);
    }

    const aliasResult = evaluatePronunciation(alias, target);
    if (aliasResult.status !== 'correct') {
      failures.push(`Alias failed: "${alias}" should be accepted for "${target}".`);
    }
  }
}

for (const target of uniqueWords) {
  for (const spoken of uniqueWords) {
    if (spoken === target) continue;
    const result = evaluatePronunciation(spoken, target);
    if (result.status === 'correct') {
      failures.push(`False positive: vocab word "${spoken}" is accepted for "${target}" with score ${result.score}.`);
    }
  }
}

const antAliases = ['ant', 'and', 'aunt', 'an', 'at', 'end', 'ent'];
for (const spoken of antAliases) {
  const result = evaluatePronunciation(spoken, 'ant');
  if (result.status !== 'correct') {
    failures.push(`Ant smoke test failed: "${spoken}" => ant returned ${result.status}.`);
  }
}

if (failures.length > 0) {
  console.error(`Pronunciation vocab check failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Pronunciation vocab check passed for ${rows.length} vocab entries and ${uniqueWords.length} unique words.`);
