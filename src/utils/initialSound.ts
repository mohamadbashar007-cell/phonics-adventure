export function getInitialSoundCharacters(sound: unknown): string[] {
  return Array.from(new Set(
    String(sound || '')
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .split('')
      .filter(Boolean),
  ));
}

export function startsWithInitialSoundCharacter(word: unknown, sound: unknown): boolean {
  const firstLetter = String(word || '').trim().toLowerCase().match(/[a-z]/)?.[0];
  return Boolean(firstLetter) && getInitialSoundCharacters(sound).includes(firstLetter!);
}

export function formatInitialSoundCharacters(sound: unknown, uppercase = false): string {
  return getInitialSoundCharacters(sound)
    .map((character) => `"${uppercase ? character.toUpperCase() : character}"`)
    .join(' or ');
}
