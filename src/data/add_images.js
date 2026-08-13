import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./src/data/curriculum.json', 'utf-8'));

data.groups.forEach(group => {
  group.letters.forEach(letter => {
    if (letter.story) {
      // use a more descriptive prompt to guarantee relevance to the story text
      const prompt = encodeURIComponent(
        `A children’s book illustration of: ${letter.story.text} - clear, colorful, friendly style`);
      letter.story.image = `https://image.pollinations.ai/prompt/${prompt}?width=600&height=400&nologo=true`;
    }
    if (letter.vocabulary) {
      letter.vocabulary.forEach(vocab => {
        // ask for a simple, accurate cartoon of the single word on white background
        const prompt = encodeURIComponent(
          `A clean cartoon-style picture of a ${vocab.word} on a white background, suitable for kids`);
        vocab.image = `https://image.pollinations.ai/prompt/${prompt}?width=400&height=400&nologo=true`;
      });
    }
  });
});

fs.writeFileSync('./src/data/curriculum.json', JSON.stringify(data, null, 2));
