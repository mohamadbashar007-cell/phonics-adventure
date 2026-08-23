import curriculum from '../src/data/curriculum.json';
import { balloonLabelAppearsInWord, buildBalloonOptions } from '../src/utils/balloonOptions';
import { wordHasSound } from '../src/utils/initialSound';
import { getLessonActivitySections } from '../src/utils/lessonActivitySections';

const failures: string[] = [];
let lessonCount = 0;
let questionCount = 0;

function optionValue(option: any) {
  return String(typeof option === 'string' ? option : option?.word || option?.label || '').trim();
}

function auditQuestion(questionKey: string, word: string, correctSound: string, sourceQuestion: any) {
  questionCount += 1;

  if (!word) {
    failures.push(`${questionKey}: missing picture word`);
    return;
  }
  if (!correctSound || !wordHasSound(word, correctSound)) {
    failures.push(`${questionKey}: correct sound "${correctSound}" is not represented by "${word}"`);
  }

  const balloons = buildBalloonOptions(
    { ...sourceQuestion, correctAnswer: correctSound },
    questionCount,
    word,
  );
  const correct = balloons.filter((balloon) => balloon.isCorrect);
  const wrong = balloons.filter((balloon) => !balloon.isCorrect);

  if (correct.length !== 3 || correct.some((balloon) => balloon.label.toLowerCase() !== correctSound.toLowerCase())) {
    failures.push(`${questionKey}: expected exactly 3 correct "${correctSound}" balloons`);
  }
  if (wrong.length !== 4) {
    failures.push(`${questionKey}: expected 4 wrong balloons, found ${wrong.length}`);
  }

  wrong.forEach((balloon) => {
    if (balloonLabelAppearsInWord(balloon.label, word)) {
      failures.push(`${questionKey}: wrong balloon "${balloon.label}" appears in "${word}"`);
    }
  });
}

for (const group of curriculum.groups as any[]) {
  for (const lesson of group.letters || []) {
    lessonCount += 1;
    const lessonKey = `group ${group.id}/${lesson.id}`;
    const sections = getLessonActivitySections(lesson)
      .filter((section) => section.key === 'balloons' || section.key === 'tap');

    sections.forEach((section) => {
      section.activities.forEach((activity: any, activityIndex: number) => {
        if (activity.type === 'LOOK_SAY_TAP') {
          (activity.questions || []).forEach((question: any, questionIndex: number) => {
            auditQuestion(
              `${lessonKey}/${section.key}/${activityIndex + 1}/${questionIndex + 1}`,
              String(question.picture?.word || question.audioWord || '').trim(),
              String(question.correctAnswer || question.audioSound || '').trim(),
              question,
            );
          });
        }

        if (activity.type === 'SAY_TAP' && activity.subtype !== 'LISTENING') {
          (activity.questions || []).forEach((question: any, questionIndex: number) => {
            const word = String(question.correctAnswer || '').trim();
            const correctOption = (question.options || []).find((option: any) => (
              optionValue(option).toLowerCase() === word.toLowerCase()
            ));
            const correctSound = String(question.prompt || '').match(/^Sound is\s+(.+)$/i)?.[1]?.trim() || '';
            auditQuestion(
              `${lessonKey}/${section.key}/${activityIndex + 1}/${questionIndex + 1}`,
              optionValue(correctOption) || word,
              correctSound,
              { ...question, options: [] },
            );
          });
        }
      });
    });
  }
}

if (failures.length) {
  console.error(`Picture-balloon audit failed with ${failures.length} problem(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `Picture-balloon audit: ${questionCount} questions across ${lessonCount} lessons; every wrong balloon is absent from its picture word.`,
  );
}
