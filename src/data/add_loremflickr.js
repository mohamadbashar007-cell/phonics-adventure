import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./src/data/curriculum.json', 'utf-8'));

data.groups.forEach(group => {
  group.letters.forEach(letter => {
    if (letter.story) {
      const word = letter.vocabulary && letter.vocabulary.length > 0 ? letter.vocabulary[0].word : letter.letter;
      letter.story.image = `https://loremflickr.com/600/400/${encodeURIComponent(word.toLowerCase())},kids/all`;
    }
    if (letter.vocabulary) {
      letter.vocabulary.forEach(vocab => {
        vocab.image = `https://loremflickr.com/400/400/${encodeURIComponent(vocab.word.toLowerCase())},kids/all`;
      });
    }
  });
});

fs.writeFileSync('./src/data/curriculum.json', JSON.stringify(data, null, 2));
