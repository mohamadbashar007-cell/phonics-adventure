import curriculum from '../src/data/curriculum.json';
import { getInitialSoundCharacters, wordHasSound } from '../src/utils/initialSound';
import { getLessonActivitySections } from '../src/utils/lessonActivitySections';

const failures: string[] = [];
let lessonCount = 0;
let questionCount = 0;

for (const group of curriculum.groups as any[]) {
  for (const lesson of group.letters || []) {
    lessonCount += 1;
    const lessonKey = `group ${group.id}/${lesson.id}`;
    const lessonSounds = getInitialSoundCharacters(lesson.letter || lesson.id);
    const tapSection = getLessonActivitySections(lesson).find((section) => section.key === 'tap');
    const activities = tapSection?.activities || [];
    const questions = activities.flatMap((activity: any) => (
      (activity.questions || []).map((question: any) => ({ activity, question }))
    ));

    if (questions.length !== 3) {
      failures.push(`${lessonKey}: expected 3 Tap questions, found ${questions.length}`);
    }

    questions.forEach(({ activity, question }: any, index: number) => {
      questionCount += 1;
      const questionKey = `${lessonKey}/question ${index + 1}`;
      if (activity.type !== 'SAY_TAP' || activity.subtype === 'LISTENING') {
        failures.push(`${questionKey}: Tap still contains a non-balloon activity`);
      }

      const requestedSound = String(question.prompt || '').match(/^Sound is\s+(.+)$/i)?.[1]?.toLowerCase();
      if (!requestedSound || !lessonSounds.includes(requestedSound)) {
        failures.push(`${questionKey}: prompt does not use a lesson sound`);
      }

      const correctWord = String(question.correctAnswer || '').toLowerCase();
      const correctOption = (question.options || []).find((option: any) => (
        String(option?.word || option?.label || option || '').toLowerCase() === correctWord
      ));
      if (!correctOption?.image) failures.push(`${questionKey}: missing curriculum picture`);
      if (!requestedSound || !wordHasSound(correctWord, requestedSound)) {
        failures.push(`${questionKey}: picture word ${correctWord} does not contain ${requestedSound}`);
      }
    });
  }
}

const oLesson = (curriculum.groups as any[])
  .find((group) => group.id === 3)
  ?.letters.find((lesson: any) => lesson.id === 'o');
const oQuestions = getLessonActivitySections(oLesson)
  .find((section) => section.key === 'tap')
  ?.activities.flatMap((activity: any) => activity.questions || []) || [];
const oWords = oQuestions.map((question: any) => question.correctAnswer).join(',');
if (oWords !== 'on,dog,hop') failures.push(`group 3/o: expected pictures on,dog,hop; found ${oWords}`);
if (oQuestions.some((question: any) => question.prompt.toLowerCase() !== 'sound is o')) {
  failures.push('group 3/o: every correct balloon must contain o');
}

if (failures.length) {
  console.error(`Tap audit failed with ${failures.length} problem(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Tap audit: ${questionCount} questions across ${lessonCount} lessons; all use picture + lesson-sound balloons.`);
}
