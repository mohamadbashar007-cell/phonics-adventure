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
    .filter(Boolean);
  return Array.from(new Set(units));
}

export function startsWithInitialSoundCharacter(word: unknown, sound: unknown): boolean {
  const normalizedWord = normalizeWord(word);
  return getInitialSoundCharacters(sound).some((unit) => normalizedWord.startsWith(unit));
}

export function wordHasSound(word: unknown, sound: unknown): boolean {
  const normalizedWord = normalizeWord(word);
  return getInitialSoundCharacters(sound).some((unit) => normalizedWord.includes(unit));
}

export function formatInitialSoundCharacters(sound: unknown, uppercase = false): string {
  return getInitialSoundCharacters(sound)
    .map((unit) => `"${uppercase ? unit.toUpperCase() : unit}"`)
    .join(' or ');
}
