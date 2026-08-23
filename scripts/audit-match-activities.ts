import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import curriculum from '../src/data/curriculum.json';
import { wordHasSound } from '../src/utils/initialSound';
import { getLessonActivitySections } from '../src/utils/lessonActivitySections';

const failures: string[] = [];
let lessonCount = 0;
let questionCount = 0;

function normalizeOption(option: any) {
  if (typeof option === 'string') return { word: option, image: '' };
  return {
    word: String(option?.word || option?.label || '').trim(),
    image: String(option?.image || '').trim(),
  };
}

for (const group of (curriculum.groups as any[]).filter((item) => item.id >= 1 && item.id <= 6)) {
  for (const lesson of group.letters || []) {
    lessonCount += 1;
    const lessonKey = `group ${group.id}/${lesson.id}`;
    const section = getLessonActivitySections(lesson).find((item) => item.key === 'match');
    const activities = section?.activities || [];

    if (section?.questionCount !== 1 || activities.length !== 1) {
      failures.push(`${lessonKey}: expected exactly one Match question`);
      continue;
    }

    questionCount += 1;
    const activity = activities[0];
    if (activity.type !== 'ODD_OUT') {
      failures.push(`${lessonKey}: expected the picture-to-letter ODD_OUT activity`);
    }

    const options = (activity.words || []).map(normalizeOption);
    const uniqueWords = new Set(options.map((option: any) => option.word.toLowerCase()));
    const correct = options.filter((option: any) => wordHasSound(option.word, lesson.letter || lesson.id));
    const wrong = options.filter((option: any) => !wordHasSound(option.word, lesson.letter || lesson.id));

    if (options.length !== 6 || uniqueWords.size !== 6) {
      failures.push(`${lessonKey}: expected 6 unique pictures, found ${options.length}/${uniqueWords.size}`);
    }
    if (correct.length !== 3 || wrong.length !== 3) {
      failures.push(`${lessonKey}: expected 3 matching and 3 wrong pictures, found ${correct.length}/${wrong.length}`);
    }

    options.forEach((option: any) => {
      if (!option.word) failures.push(`${lessonKey}: option is missing its word`);
      if (!option.image) {
        failures.push(`${lessonKey}/${option.word}: option is missing its curriculum image`);
        return;
      }
      const localPath = resolve('public', option.image.replace(/^\/+/, ''));
      if (!existsSync(localPath)) failures.push(`${lessonKey}/${option.word}: image file does not exist (${option.image})`);
    });
  }
}

if (failures.length) {
  console.error(`Match audit failed with ${failures.length} problem(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `Match audit: ${questionCount} questions across ${lessonCount} lessons; each has 3 matching and 3 wrong curriculum pictures.`,
  );
}
