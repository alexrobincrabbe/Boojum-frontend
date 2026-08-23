import { Link } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';
import {
  BADGE_JEWEL_COLORS,
  jewelBandPositions,
  normalizeBadgeJewels,
  type BadgeJewel,
} from './badgeJewels';
import { BADGE_JEWEL_LABELS, CROWN_JEWEL_LINKS } from './badgeLinks';
import './CrownBadge.css';

export const CROWN_JEWEL_COLORS = BADGE_JEWEL_COLORS;
export const CROWN_JEWEL_ORDER = ['lookingglass', 'boojum', 'forevermore', 'points'] as const;
export type CrownJewel = BadgeJewel;

interface CrownBadgeProps {
  jewels?: CrownJewel[] | null;
  size?: number;
  linkable?: boolean;
  children: ReactNode;
}

export function CrownBadge({ jewels, size = 30, linkable = false, children }: CrownBadgeProps) {
  const active = normalizeBadgeJewels(jewels);
  if (active.length === 0) {
    return <>{children}</>;
  }

  const crownSize = Math.max(20, Math.round(size * 0.78));
  const crownHeight = Math.round(crownSize * 0.78);
  const style = {
    '--crown-size': `${crownSize}px`,
    '--crown-display-width': `${crownSize}px`,
    '--crown-display-height': `${crownHeight}px`,
  } as CSSProperties;
  const positions = jewelBandPositions(active.length);
  const jewelRadius = active.length >= 4 ? 2.35 : 2.55;

  return (
    <span
      className={`crown-badge-wrap${linkable ? ' crown-badge-wrap--linkable' : ''}`}
      style={style}
      data-jewels={active.join(',')}
    >
      {children}
      <span className="crown-badge-layer">
        <svg
          className="crown-badge"
          width={crownSize}
          height={crownHeight}
          viewBox="0 0 24 18"
          aria-hidden="true"
        >
          <path
            className="crown-badge-base"
            d="M2.5 15.5h19l-1.2-8.2-4.3 4.1L12 2.8 8 11.4 3.7 7.3 2.5 15.5z"
          />
          <path
            className="crown-badge-band"
            d="M3.2 15.5h17.6v1.6H3.2z"
          />
          {active.map((jewel, index) => (
            <circle
              key={jewel}
              className="crown-badge-jewel"
              cx={positions[index]}
              cy={11}
              r={jewelRadius}
              fill={BADGE_JEWEL_COLORS[jewel] || '#f4f4f4'}
              stroke="#1a1428"
              strokeWidth={0.5}
            />
          ))}
        </svg>
        {linkable && (
          <span className="crown-badge-jewel-links">
            {active.map((jewel, index) => {
              const href = CROWN_JEWEL_LINKS[jewel];
              if (!href) return null;
              const hitSize = Math.max(16, Math.round((jewelRadius * 2 / 24) * crownSize * 1.8));
              return (
                <Link
                  key={jewel}
                  to={href}
                  className="crown-badge-jewel-link"
                  aria-label={BADGE_JEWEL_LABELS[jewel] || 'Leaderboard'}
                  style={{
                    left: `${(positions[index] / 24) * 100}%`,
                    top: `${(11 / 18) * 100}%`,
                    width: hitSize,
                    height: hitSize,
                  }}
                />
              );
            })}
          </span>
        )}
      </span>
    </span>
  );
}
