import fs from 'fs';
import path from 'path';

const curriculumPath = './src/data/curriculum.json';
const vocabDir = './public/images/vocabulary';
const phonicsDir = './public/images/phonics';

const data = JSON.parse(fs.readFileSync(curriculumPath, 'utf-8'));
const letters = data.groups.flatMap((group) => group.letters);
const ids = letters.map((letter) => letter.id);

const chooseWordById = new Map();
const optionWordsById = new Map();

for (const letter of letters) {
  const correctOption = letter.choose?.options?.find((opt) => opt.isCorrect);
  if (correctOption?.word) {
    chooseWordById.set(letter.id, correctOption.word);
    continue;
  }

  const vocabWords = (letter.vocabulary ?? []).map((vocab) => vocab.word).filter(Boolean);
  if (!vocabWords.length) {
    throw new Error(`Missing vocabulary for letter "${letter.id}".`);
  }

  chooseWordById.set(letter.id, vocabWords[0]);
  optionWordsById.set(letter.id, vocabWords.slice(0, 3));
}

const ensurePhonicsImage = (letterId, word, index) => {
  const suffix = String.fromCharCode(65 + index);
  const source = path.join(vocabDir, `${word.toLowerCase()}.png`);
  const destination = path.join(phonicsDir, `lesson_${letterId}_choose_option_${suffix}.png`);

  if (!fs.existsSync(source)) {
    throw new Error(`Missing vocabulary image: ${source}`);
  }

  if (!fs.existsSync(destination)) {
    fs.copyFileSync(source, destination);
  }
};

const ensureMissingExercises = (letter) => {
  const needsChoose = !letter.choose;
  const needsListening = !letter.listening;
  if (!needsChoose && !needsListening) return;

  const optionWords =
    optionWordsById.get(letter.id) ||
    (letter.vocabulary ?? []).map((vocab) => vocab.word).filter(Boolean).slice(0, 3);

  if (optionWords.length < 3) {
    throw new Error(`Not enough vocabulary words for "${letter.id}" to build exercises.`);
  }

  optionWords.forEach((word, index) => ensurePhonicsImage(letter.id, word, index));

  if (needsChoose) {
    const index = ids.indexOf(letter.id);
    const nextId = ids[(index + 1) % ids.length];
    const nextNextId = ids[(index + 2) % ids.length];

    letter.choose = {
      prompt: 'Choose:',
      options: [
        {
          label: 'A',
          word: chooseWordById.get(letter.id),
          image: `/images/phonics/lesson_${letter.id}_choose_option_A.png`,
          isCorrect: true,
        },
        {
          label: 'B',
          word: chooseWordById.get(nextId),
          image: `/images/phonics/lesson_${nextId}_choose_option_A.png`,
          isCorrect: false,
        },
        {
          label: 'C',
          word: chooseWordById.get(nextNextId),
          image: `/images/phonics/lesson_${nextNextId}_choose_option_A.png`,
          isCorrect: false,
        },
      ],
    };
  }

  if (needsListening) {
    const optionSet = optionWords.map((word, index) => ({
      word,
      image: `/images/phonics/lesson_${letter.id}_choose_option_${String.fromCharCode(65 + index)}.png`,
    }));

    letter.listening = optionWords.map((word, index) => ({
      word,
      audioText: word,
      options: optionSet.map((opt, optIndex) => ({
        ...opt,
        isCorrect: optIndex === index,
      })),
    }));
  }
};

letters.forEach(ensureMissingExercises);

fs.writeFileSync(curriculumPath, JSON.stringify(data, null, 2));
