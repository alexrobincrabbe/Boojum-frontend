/** Shared jewel keys/colors for crown (last week) and frame (all-time) badges. */
export const BADGE_JEWEL_COLORS: Record<string, string> = {
  lookingglass: '#f5ce45',
  boojum: '#ff5596',
  forevermore: '#5e4cb0',
  points: '#33c15b',
};

export const BADGE_JEWEL_ORDER = ['lookingglass', 'boojum', 'forevermore', 'points'] as const;

export type BadgeJewel = (typeof BADGE_JEWEL_ORDER)[number] | string;

export function normalizeBadgeJewels(jewels?: BadgeJewel[] | null): string[] {
  if (!jewels?.length) return [];
  const set = new Set(jewels.filter(Boolean));
  return BADGE_JEWEL_ORDER.filter((key) => set.has(key));
}

/** Horizontal positions for crown band (viewBox width 24). */
export function jewelBandPositions(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [12];
  if (count === 2) return [8, 16];
  if (count === 3) return [6.5, 12, 17.5];
  return [5.5, 9.5, 14.5, 18.5];
}
