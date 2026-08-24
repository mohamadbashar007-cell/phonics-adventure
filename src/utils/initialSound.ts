function normalizeSound(sound: unknown): string {
  return String(sound || '').toLowerCase().replace(/[^a-z]/g, '');
}

function normalizeWord(word: unknown): string {
  return String(word || '').toLowerCase().replace(/[^a-z]/g, '');
}

export function getInitialSoundCharacters(sound: unknown): string[] {
  const units = String(sound || '')
    .trim()
    .split(/[\s,/]+/)
    .map(normalizeSound)
    .filter(Boolean)
    .flatMap((unit) => unit === 'ck' ? ['c', 'k'] : [unit]);
  return Array.from(new Set(units));
}

export function getSoundCharacterForWord(word: unknown, sound: unknown): string {
  const normalizedWord = normalizeWord(word);
  const units = getInitialSoundCharacters(sound);
  const isSeparatedCkLesson = units.includes('c') && units.includes('k');

  if (isSeparatedCkLesson) {
    if (normalizedWord.startsWith('k')) return 'k';
    if (normalizedWord.startsWith('c')) return 'c';
    if (normalizedWord.includes('k')) return 'k';
    if (normalizedWord.includes('c')) return 'c';
    return '';
  }

  return units.find((unit) => normalizedWord.includes(unit)) || units[0] || '';
}

export function startsWithInitialSoundCharacter(word: unknown, sound: unknown): boolean {
  const normalizedWord = normalizeWord(word);
  return getInitialSoundCharacters(sound).some((unit) => normalizedWord.startsWith(unit));
}

export function wordHasSound(word: unknown, sound: unknown): boolean {
  const normalizedWord = normalizeWord(word);
  return getInitialSoundCharacters(sound).some((unit) => {
    if (unit === 'ck') {
      // The /k/ sound taught in the ck lesson can be written as "ck", "k",
      // or a hard "c" before sounds other than e, i, y, and h (for example cap).
      return normalizedWord.includes('ck')
        || normalizedWord.startsWith('k')
        || /^c(?![eiyh])/.test(normalizedWord);
    }
    return normalizedWord.includes(unit);
  });
}

export function formatInitialSoundCharacters(sound: unknown, uppercase = false): string {
  return getInitialSoundCharacters(sound)
    .map((unit) => `"${uppercase ? unit.toUpperCase() : unit}"`)
    .join(' or ');
}
