import curriculum from '../src/data/curriculum.json';
import { getLessonActivitySections } from '../src/utils/lessonActivitySections';

const failures: unknown[] = [];
const falsePositions = new Set<number>();

for (const group of curriculum.groups) {
  for (const letter of group.letters) {
    const hear = getLessonActivitySections(letter).find((section) => section.key === 'hear');
    const items = hear?.activities.flatMap((activity) => activity.items || []) || [];
    const wrong = items.filter((item) => !item.isCorrect);
    const falsePosition = items.findIndex((item) => !item.isCorrect);
    if (falsePosition >= 0) falsePositions.add(falsePosition);

    if (items.length !== 3 || wrong.length !== 1) {
      failures.push({ group: group.id, id: letter.id, count: items.length, wrong: wrong.length, items });
    }
  }
}

const total = curriculum.groups.reduce((sum, group) => sum + group.letters.length, 0);
console.log(`Hear audit: ${total - failures.length}/${total} lessons have exactly three questions and one false answer.`);
console.log(`Observed false-answer positions: ${[...falsePositions].map((position) => position + 1).join(', ')}`);

if (failures.length || falsePositions.size < 2) {
  if (failures.length) console.log(JSON.stringify(failures, null, 2));
  process.exit(1);
}
