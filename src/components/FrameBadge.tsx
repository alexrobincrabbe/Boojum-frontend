import { Link } from 'react-router-dom';
import { useId, type CSSProperties, type ReactNode } from 'react';
import {
  BADGE_JEWEL_COLORS,
  normalizeBadgeJewels,
  type BadgeJewel,
} from './badgeJewels';
import { BADGE_JEWEL_LABELS, SCEPTRE_JEWEL_LINKS } from './badgeLinks';
import './FrameBadge.css';

interface FrameBadgeProps {
  jewels?: BadgeJewel[] | null;
  size?: number;
  linkable?: boolean;
  children: ReactNode;
}

/** Evenly spaced gem centers along the ribbon (viewBox x, y). */
function ribbonJewelPositions(count: number): Array<{ x: number; y: number }> {
  const y = 84;
  if (count <= 0) return [];
  if (count === 1) return [{ x: 50, y }];
  if (count === 2) return [{ x: 38, y }, { x: 62, y }];
  if (count === 3) return [{ x: 30, y }, { x: 50, y }, { x: 70, y }];
  return [{ x: 26, y }, { x: 42, y }, { x: 58, y }, { x: 74, y }];
}

export function FrameBadge({ jewels, size = 30, linkable = false, children }: FrameBadgeProps) {
  const gradientId = useId().replace(/:/g, '');
  const active = normalizeBadgeJewels(jewels);
  if (active.length === 0) {
    return <>{children}</>;
  }

  const style = {
    '--frame-inset': `${Math.max(2, Math.round(size * 0.06))}px`,
    '--ribbon-overhang': `${Math.max(6, Math.round(size * 0.22))}px`,
  } as CSSProperties;

  const ringRadius = 44;
  const strokeWidth = 7;
  const jewelRadius = active.length >= 4 ? 7.2 : 8;
  const positions = ribbonJewelPositions(active.length);

  return (
    <span
      className={`frame-badge-wrap${linkable ? ' frame-badge-wrap--linkable' : ''}`}
      style={style}
      data-jewels={active.join(',')}
    >
      {children}
      <span className="frame-badge-layer" aria-hidden={!linkable}>
        <svg
          className="frame-badge"
          viewBox="0 0 100 108"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`frame-gold-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffe9a8" />
              <stop offset="35%" stopColor="#f0c94a" />
              <stop offset="70%" stopColor="#d4a82e" />
              <stop offset="100%" stopColor="#a67c1a" />
            </linearGradient>
            <linearGradient id={`ribbon-gold-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffe08a" />
              <stop offset="45%" stopColor="#f0c94a" />
              <stop offset="100%" stopColor="#b8891c" />
            </linearGradient>
            <linearGradient id={`ribbon-fold-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#c9a227" />
              <stop offset="100%" stopColor="#8a6814" />
            </linearGradient>
          </defs>

          {/* Gold frame ring */}
          <circle
            className="frame-badge-ring-outer"
            cx="50"
            cy="46"
            r={ringRadius + strokeWidth / 2}
            fill="none"
            stroke="#1a1428"
            strokeWidth={1.2}
          />
          <circle
            className="frame-badge-ring"
            cx="50"
            cy="46"
            r={ringRadius}
            fill="none"
            stroke={`url(#frame-gold-${gradientId})`}
            strokeWidth={strokeWidth}
          />
          <circle
            className="frame-badge-ring-inner"
            cx="50"
            cy="46"
            r={ringRadius - strokeWidth / 2}
            fill="none"
            stroke="#1a1428"
            strokeWidth={0.9}
          />

          {/* Ribbon at bottom */}
          <g className="frame-badge-ribbon">
            {/* Left fold / tail */}
            <path
              d="M14 76 L6 92 L18 86 Z"
              fill={`url(#ribbon-fold-${gradientId})`}
              stroke="#1a1428"
              strokeWidth={0.7}
              strokeLinejoin="round"
            />
            {/* Right fold / tail */}
            <path
              d="M86 76 L94 92 L82 86 Z"
              fill={`url(#ribbon-fold-${gradientId})`}
              stroke="#1a1428"
              strokeWidth={0.7}
              strokeLinejoin="round"
            />
            {/* Main ribbon band */}
            <path
              d="M16 74 H84 Q88 74 88 78 V90 Q88 94 84 94 H16 Q12 94 12 90 V78 Q12 74 16 74 Z"
              fill={`url(#ribbon-gold-${gradientId})`}
              stroke="#1a1428"
              strokeWidth={0.9}
              strokeLinejoin="round"
            />
            {/* Soft highlight on band */}
            <path
              d="M18 76 H82 Q84 76 84 78 V80 H16 V78 Q16 76 18 76 Z"
              fill="rgba(255,255,255,0.22)"
            />
          </g>

          {active.map((jewel, index) => {
            const pos = positions[index] || { x: 50, y: 84 };
            return (
              <g key={jewel} className="frame-badge-jewel-group">
                <circle
                  className="frame-badge-jewel-bezel"
                  cx={pos.x}
                  cy={pos.y}
                  r={jewelRadius + 1.4}
                  fill="#c9a227"
                  stroke="#1a1428"
                  strokeWidth={0.8}
                />
                <circle
                  className="frame-badge-jewel"
                  cx={pos.x}
                  cy={pos.y}
                  r={jewelRadius}
                  fill={BADGE_JEWEL_COLORS[jewel] || '#f4f4f4'}
                  stroke="#1a1428"
                  strokeWidth={0.65}
                />
                <circle
                  className="frame-badge-jewel-shine"
                  cx={pos.x - jewelRadius * 0.28}
                  cy={pos.y - jewelRadius * 0.28}
                  r={jewelRadius * 0.3}
                  fill="rgba(255,255,255,0.55)"
                />
              </g>
            );
          })}
        </svg>
        {linkable && (
          <span className="frame-badge-jewel-links">
            {active.map((jewel, index) => {
              const href = SCEPTRE_JEWEL_LINKS[jewel];
              if (!href) return null;
              const pos = positions[index] || { x: 50, y: 84 };
              const hitSize = Math.max(16, Math.round(size * 0.32));
              return (
                <Link
                  key={jewel}
                  to={href}
                  className="frame-badge-jewel-link"
                  aria-label={`All-time ${BADGE_JEWEL_LABELS[jewel] || 'Leaderboard'}`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${(pos.y / 108) * 100}%`,
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
