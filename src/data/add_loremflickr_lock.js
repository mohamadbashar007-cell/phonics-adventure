import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./src/data/curriculum.json', 'utf-8'));

function hashCode(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % 10000;
}

data.groups.forEach(group => {
  group.letters.forEach(letter => {
    if (letter.story) {
      const word = letter.vocabulary && letter.vocabulary.length > 0 ? letter.vocabulary[0].word : letter.letter;
      const seed = hashCode(word + 'story');
      letter.story.image = `https://loremflickr.com/600/400/${encodeURIComponent(word.toLowerCase())},kids/all?lock=${seed}`;
    }
    if (letter.vocabulary) {
      letter.vocabulary.forEach(vocab => {
        const seed = hashCode(vocab.word + 'vocab');
        vocab.image = `https://loremflickr.com/400/400/${encodeURIComponent(vocab.word.toLowerCase())},kids/all?lock=${seed}`;
      });
    }
  });
});

fs.writeFileSync('./src/data/curriculum.json', JSON.stringify(data, null, 2));
