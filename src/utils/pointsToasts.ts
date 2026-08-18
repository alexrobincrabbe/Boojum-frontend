import { toast } from 'react-toastify';

export const POINTS_AWARDED_EVENT = 'boojum:pointsAwarded';

export interface PointsPayload {
  awarded?: boolean;
  delta?: number;
  all_time?: number;
  weekly?: number;
  new_milestones?: number[];
  tier?: string;
}

/** Totals under 1000 stay exact; 1000+ shows whole thousands with a k (1500 → 1k). */
export function formatCompactPoints(value: number): string {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  if (n < 1000) {
    return String(n);
  }
  return `${Math.floor(n / 1000)}k`;
}

export function showPointsToasts(points?: PointsPayload | null) {
  if (!points) {
    return;
  }
  window.dispatchEvent(new CustomEvent(POINTS_AWARDED_EVENT, { detail: points }));
  for (const milestone of points.new_milestones || []) {
    toast.success(`Milestone: ${milestone.toLocaleString()} points!`);
  }
}
