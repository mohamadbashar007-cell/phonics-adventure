export const GROUP_META = [
  { id: 1, letterCount: 6 },
  { id: 2, letterCount: 6 },
  { id: 3, letterCount: 6 },
  { id: 4, letterCount: 7 },
  { id: 5, letterCount: 6 },
  { id: 6, letterCount: 5 },
  { id: 7, letterCount: 8 },
] as const;

export const GROUP_COUNT = GROUP_META.length;

export function getGroupLetterCount(groupId: number) {
  return GROUP_META.find((group) => group.id === groupId)?.letterCount ?? 0;
}
