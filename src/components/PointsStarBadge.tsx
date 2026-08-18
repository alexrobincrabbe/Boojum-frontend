import { Star } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import './PointsStarBadge.css';

export const POINTS_STAR_COLORS: Record<string, string> = {
  white: '#f4f4f4',
  green: '#33c15b',
  yellow: '#f5ce45',
  pink: '#ff5596',
  purple: '#5e4cb0',
};

export type PointsTier = keyof typeof POINTS_STAR_COLORS | string;

interface PointsStarBadgeProps {
  tier?: PointsTier | null;
  size?: number;
  children: ReactNode;
}

export function PointsStarBadge({ tier, size = 30, children }: PointsStarBadgeProps) {
  if (!tier) {
    return <>{children}</>;
  }
  const color = POINTS_STAR_COLORS[tier] || POINTS_STAR_COLORS.white;
  const starSize = Math.max(10, Math.round(size * 0.4));
  const style: CSSProperties = {
    width: starSize,
    height: starSize,
    color,
    fill: color,
  };
  return (
    <span className="points-star-badge-wrap">
      {children}
      <Star
        className="points-star-badge"
        size={starSize}
        color={color}
        fill={color}
        aria-hidden="true"
        style={style}
      />
    </span>
  );
}
