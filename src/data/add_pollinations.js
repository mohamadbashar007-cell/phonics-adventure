import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./src/data/curriculum.json', 'utf-8'));

function hashCode(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

data.groups.forEach(group => {
  group.letters.forEach(letter => {
    if (letter.story) {
      const word = letter.vocabulary && letter.vocabulary.length > 0 ? letter.vocabulary[0].word : letter.letter;
      const seed = hashCode(word + 'story');
      letter.story.image = `https://image.pollinations.ai/prompt/${encodeURIComponent(word.toLowerCase() + ' cartoon style kids illustration')}?width=600&height=400&nologo=true&seed=${seed}`;
    }
    if (letter.vocabulary) {
      letter.vocabulary.forEach(vocab => {
        const seed = hashCode(vocab.word + 'vocab');
        vocab.image = `https://image.pollinations.ai/prompt/${encodeURIComponent(vocab.word.toLowerCase() + ' isolated on white background cartoon style kids illustration')}?width=400&height=400&nologo=true&seed=${seed}`;
      });
    }
  });
});

fs.writeFileSync('./src/data/curriculum.json', JSON.stringify(data, null, 2));
