import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
const imageDir = path.join(publicDir, 'images');
const curriculumPaths = [
  path.resolve('src/data/curriculum.json'),
  path.resolve('public/data/curriculum.json'),
];

const converted = new Map();

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function getOptions(filePath, size) {
  const normalized = filePath.replaceAll(path.sep, '/');

  if (!normalized.endsWith('.png')) return null;
  if (normalized.includes('/images/stories/')) {
    return { quality: 76, maxWidth: 1200 };
  }
  if (normalized.includes('/images/maps/')) {
    return { quality: 80, maxWidth: 1060 };
  }
  if (size >= 80 * 1024) {
    return { quality: 78, maxWidth: 800 };
  }
  return null;
}

function publicPath(filePath) {
  return `/${path.relative(publicDir, filePath).replaceAll(path.sep, '/')}`;
}

async function optimizeImage(filePath) {
  const stat = await fs.stat(filePath);
  const options = getOptions(filePath, stat.size);
  if (!options) return null;

  const outPath = filePath.replace(/\.png$/i, '.webp');
  const image = sharp(filePath).rotate();
  const metadata = await image.metadata();
  const shouldResize = options.maxWidth && metadata.width && metadata.width > options.maxWidth;
  const pipeline = shouldResize ? image.resize({ width: options.maxWidth, withoutEnlargement: true }) : image;

  await pipeline.webp({ quality: options.quality, effort: 6 }).toFile(outPath);

  const outStat = await fs.stat(outPath);
  if (outStat.size >= stat.size) {
    await fs.rm(outPath, { force: true });
    return null;
  }

  converted.set(publicPath(filePath), publicPath(outPath));
  return {
    source: publicPath(filePath),
    output: publicPath(outPath),
    before: stat.size,
    after: outStat.size,
  };
}

async function updateCurriculumReferences() {
  for (const dataPath of curriculumPaths) {
    let content = await fs.readFile(dataPath, 'utf8');
    for (const [oldPath, newPath] of converted.entries()) {
      content = content.replaceAll(oldPath, newPath);
    }
    await fs.writeFile(dataPath, content);
  }
}

const files = await walk(imageDir);
const results = [];

for (const file of files) {
  const result = await optimizeImage(file);
  if (result) results.push(result);
}

await updateCurriculumReferences();

const before = results.reduce((sum, item) => sum + item.before, 0);
const after = results.reduce((sum, item) => sum + item.after, 0);
const saved = before - after;

console.log(`Converted ${results.length} image(s) to WebP.`);
console.log(`Optimized referenced bytes: ${(before / 1024 / 1024).toFixed(2)}MB -> ${(after / 1024 / 1024).toFixed(2)}MB`);
console.log(`Saved: ${(saved / 1024 / 1024).toFixed(2)}MB`);
