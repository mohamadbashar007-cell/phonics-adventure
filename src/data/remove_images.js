import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./src/data/curriculum.json', 'utf-8'));

data.groups.forEach(group => {
  group.letters.forEach(letter => {
    if (letter.story && letter.story.image) {
      letter.story.image = '';
    }
    if (letter.vocabulary) {
      letter.vocabulary.forEach(vocab => {
        if (vocab.image) {
          vocab.image = '';
        }
      });
    }
  });
});

fs.writeFileSync('./src/data/curriculum.json', JSON.stringify(data, null, 2));
