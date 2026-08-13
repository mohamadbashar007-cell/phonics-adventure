export const GROUP_MAP_SOURCES = [
  '/images/maps/group-1-map.webp',
  '/images/maps/group-2-map.webp',
  '/images/maps/group-3-map.webp',
  '/images/maps/group-4-map.webp',
  '/images/maps/group-5-map.webp',
  '/images/maps/group-6-map.webp',
  '/images/maps/group-7-map.webp',
];

export function getGroupMapSource(groupId: number) {
  return GROUP_MAP_SOURCES[groupId - 1] ?? null;
}
