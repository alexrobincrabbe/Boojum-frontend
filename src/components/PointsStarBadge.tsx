import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';
import { POINTS_STAR_LINK } from './badgeLinks';
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
  linkable?: boolean;
  children: ReactNode;
}

export function PointsStarBadge({ tier, size = 30, linkable = false, children }: PointsStarBadgeProps) {
  if (!tier) {
    return <>{children}</>;
  }
  const color = POINTS_STAR_COLORS[tier] || POINTS_STAR_COLORS.white;
  const starSize = Math.max(10, Math.round(size * 0.42));
  const style = {
    '--points-star-color': color,
    '--points-star-size': `${starSize}px`,
    width: starSize,
    height: starSize,
  } as CSSProperties;

  const star = (
    <Star
      className="points-star-badge"
      size={starSize}
      fill={color}
      stroke={color}
      aria-hidden={linkable ? undefined : true}
      style={style}
    />
  );

  return (
    <span className={`points-star-badge-wrap${linkable ? ' points-star-badge-wrap--linkable' : ''}`} data-tier={tier}>
      {children}
      {linkable ? (
        <Link to={POINTS_STAR_LINK} className="points-star-badge-link" aria-label="Points leaderboard">
          {star}
        </Link>
      ) : (
        star
      )}
    </span>
  );
}
