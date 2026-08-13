import fs from 'fs';
import path from 'path';

const dataPath = path.resolve('src/data/curriculum.json');
const publicDir = path.resolve('public');

const curriculum = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const recorded = new Map();

const recordImage = (imagePath, context) => {
  if (!imagePath) {
    return;
  }
  const normalized = imagePath.replace(/^\/+/, '');
  const filePath = path.join(publicDir, normalized);
  recorded.set(imagePath, { context, filePath });
};

(curriculum.groups || []).forEach((group) => {
  (group.letters || []).forEach((letter) => {
    recordImage(letter.image, `Letter ${letter.letter || letter.id}`);
    if (letter.story) {
      recordImage(letter.story.image, `Story ${letter.letter || letter.id}`);
    }
    (letter.vocabulary || []).forEach((entry) => {
      recordImage(entry.image, `Vocabulary ${entry.word}`);
    });
  });
});

const missing = [];
for (const [imagePath, info] of recorded.entries()) {
  if (!fs.existsSync(info.filePath)) {
    missing.push({ imagePath, ...info });
  }
}

if (missing.length === 0) {
  console.log('All curriculum images exist in public/.');
  process.exit(0);
} else {
  console.warn(`Found ${missing.length} missing image file(s):`);
  missing.forEach((item) => {
    console.warn(` - ${item.context}: expected ${item.filePath}`);
  });
  process.exit(1);
}
