import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import curriculum from '../src/data/curriculum.json';
import { buildQuizQuestions } from '../src/utils/quizQuestions';
import { wordHasSound } from '../src/utils/initialSound';

const failures: string[] = [];
let questionCount = 0;

for (const group of (curriculum.groups as any[]).filter((item) => item.id >= 1 && item.id <= 6)) {
  for (const lesson of group.letters || []) {
    const lessonKey = `group ${group.id}/${lesson.id}`;
    const questions = buildQuizQuestions(lesson, lesson.choose, 1);
    if (questions.length !== 1) {
      failures.push(`${lessonKey}: expected exactly one Quiz question, found ${questions.length}`);
      continue;
    }

    questionCount += 1;
    const options = questions[0].options || [];
    const correct = options.filter((option: any) => option.isCorrect);
    const wrong = options.filter((option: any) => !option.isCorrect);
    const uniqueWords = new Set(options.map((option: any) => String(option.word).trim().toLowerCase()));
    const vocabularyWords = new Set(
      (lesson.vocabulary || []).map((item: any) => String(item.word).trim().toLowerCase()),
    );

    if (options.length !== 3 || uniqueWords.size !== 3) {
      failures.push(`${lessonKey}: expected 3 unique options, found ${options.length}/${uniqueWords.size}`);
    }
    if (correct.length !== 1 || wrong.length !== 2) {
      failures.push(`${lessonKey}: expected exactly 1 correct and 2 wrong options`);
    }

    correct.forEach((option: any) => {
      const word = String(option.word || '').trim();
      if (!vocabularyWords.has(word.toLowerCase())) {
        failures.push(`${lessonKey}: correct option "${word}" is not lesson vocabulary`);
      }
      if (!wordHasSound(word, lesson.letter || lesson.id)) {
        failures.push(`${lessonKey}: correct option "${word}" does not contain the lesson sound`);
      }
    });

    wrong.forEach((option: any) => {
      const word = String(option.word || '').trim();
      if (wordHasSound(word, lesson.letter || lesson.id)) {
        failures.push(`${lessonKey}: wrong option "${word}" also contains the lesson sound`);
      }
    });

    options.forEach((option: any) => {
      const image = String(option.image || '').trim();
      if (!image) {
        failures.push(`${lessonKey}/${option.word}: missing image path`);
        return;
      }
      if (!existsSync(resolve('public', image.replace(/^\/+/, '')))) {
        failures.push(`${lessonKey}/${option.word}: image file does not exist (${image})`);
      }
    });
  }
}

if (failures.length) {
  console.error(`Quiz audit failed with ${failures.length} problem(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `Quiz audit: ${questionCount} questions; every question has one lesson-vocabulary answer and two sound-free distractors.`,
  );
}
