import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const dataPaths = ['src/data/curriculum.json', 'public/data/curriculum.json'];
const data = JSON.parse(fs.readFileSync(dataPaths[0], 'utf8'));
const outputDir = path.resolve('public/images/letters');

fs.mkdirSync(outputDir, { recursive: true });

function sanitizeKey(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const jobs = [];

for (const group of data.groups || []) {
  for (const letter of group.letters || []) {
    const id = sanitizeKey(letter.id);
    const text = escapeXml(letter.letter || letter.id);
    const fontSize = text.length > 1 ? 112 : 150;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
        <rect width="320" height="320" rx="56" fill="#dbeafe"/>
        <circle cx="258" cy="62" r="34" fill="#fde68a" opacity="0.9"/>
        <circle cx="64" cy="258" r="30" fill="#bbf7d0" opacity="0.85"/>
        <text x="160" y="198" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="900" fill="#2563eb">${text}</text>
      </svg>
    `;

    jobs.push(sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(path.join(outputDir, `${id}.webp`)));
    letter.image = `/images/letters/${id}.webp`;
  }
}

await Promise.all(jobs);

const json = JSON.stringify(data, null, 2);
for (const dataPath of dataPaths) {
  fs.writeFileSync(dataPath, json);
}

console.log(`Generated ${jobs.length} letter image(s).`);
