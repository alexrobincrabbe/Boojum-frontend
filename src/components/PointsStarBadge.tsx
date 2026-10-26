import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { POINTS_STAR_LINK } from './badgeLinks';
import './PointsStarBadge.css';

export const POINTS_STAR_COLORS: Record<string, string> = {
  white: '#f4f4f4',
  green: '#33c15b',
  yellow: '#f5ce45',
  pink: '#ff5596',
  purple: '#5e4cb0',
};

/** Crescent used by every moon tier. Horns face up-right. */
const MOON_PATH = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';

const MOON_TIERS = new Set(['silver', 'gold', 'red', 'violet']);

type MoonStop = { offset: string; color: string };

const MOON_FILLS: Record<string, { stops: MoonStop[] }> = {
  silver: {
    stops: [
      { offset: '0%', color: '#f7f7fb' },
      { offset: '38%', color: '#d7d7e4' },
      { offset: '72%', color: '#a3a3b5' },
      { offset: '100%', color: '#6f6f82' },
    ],
  },
  gold: {
    stops: [
      { offset: '0%', color: '#fff6cc' },
      { offset: '34%', color: '#f0c94a' },
      { offset: '68%', color: '#d4a82e' },
      { offset: '100%', color: '#a67c1a' },
    ],
  },
  red: {
    stops: [
      { offset: '0%', color: '#ffd0da' },
      { offset: '24%', color: '#ff4d6a' },
      { offset: '58%', color: '#e11d48' },
      { offset: '100%', color: '#9f1239' },
    ],
  },
  violet: {
    stops: [
      { offset: '0%', color: '#faf5ff' },
      { offset: '30%', color: '#d8b4fe' },
      { offset: '64%', color: '#8b5cf6' },
      { offset: '100%', color: '#5e4cb0' },
    ],
  },
};

const GLITTER_SPARKLES = [
  { x: 8.1, y: 9.2, scale: 1.15, delay: '0s' },
  { x: 6.2, y: 13.6, scale: 0.85, delay: '0.45s' },
  { x: 10.4, y: 16.4, scale: 1.25, delay: '0.9s' },
  { x: 11.7, y: 11.6, scale: 0.7, delay: '1.35s' },
  { x: 7.6, y: 17.2, scale: 0.62, delay: '0.2s' },
];

export type PointsTier = keyof typeof POINTS_STAR_COLORS | string;

interface PointsStarBadgeProps {
  tier?: PointsTier | null;
  size?: number;
  linkable?: boolean;
  children: ReactNode;
}

function badgeKind(tier: string): 'star' | 'moon' | 'sun' {
  if (tier === 'sun') return 'sun';
  if (MOON_TIERS.has(tier)) return 'moon';
  return 'star';
}

function Sparkle({ x, y, scale, delay }: { x: number; y: number; scale: number; delay: string }) {
  return (
    <path
      className="points-moon-sparkle"
      style={{ animationDelay: delay }}
      transform={`translate(${x} ${y}) scale(${scale})`}
      d="M0 -1.15 L0.32 -0.32 L1.15 0 L0.32 0.32 L0 1.15 L-0.32 0.32 L-1.15 0 L-0.32 -0.32 Z"
      fill="#fff8e8"
    />
  );
}

function MoonBadge({
  tier,
  iconSize,
  gradientId,
  className,
  style,
}: {
  tier: string;
  iconSize: number;
  gradientId: string;
  className: string;
  style: CSSProperties;
}) {
  const spec = MOON_FILLS[tier] ?? MOON_FILLS.silver;
  const fillId = `moon-fill-${gradientId}`;
  const maskId = `moon-mask-${gradientId}`;
  const sheenId = `moon-sheen-${gradientId}`;
  const glitter = tier === 'red';

  return (
    <svg
      className={className}
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      overflow="visible"
      aria-hidden="true"
      style={style}
    >
      <defs>
        <linearGradient id={fillId} x1="15%" y1="0%" x2="95%" y2="100%">
          {spec.stops.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
        {glitter && (
          <>
            <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="45%" stopColor="#fff" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#ffe7ea" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <mask id={maskId}>
              <rect width="24" height="24" fill="#000" />
              <path d={MOON_PATH} fill="#fff" />
            </mask>
          </>
        )}
      </defs>
      {tier === 'violet' && (
        <path className="points-badge-aura points-badge-aura--violet" d={MOON_PATH} />
      )}
      <path d={MOON_PATH} fill={`url(#${fillId})`} />
      {glitter && (
        <>
          <g mask={`url(#${maskId})`}>
            <g className="points-glitter-sheen">
              <rect x="-8" y="-2" width="6" height="28" fill={`url(#${sheenId})`} />
            </g>
          </g>
          {GLITTER_SPARKLES.map((sparkle) => (
            <Sparkle key={`${sparkle.x}-${sparkle.y}`} {...sparkle} />
          ))}
          <circle cx="9.4" cy="12.4" r="0.55" fill="#fff" opacity="0.95" />
          <circle cx="6.8" cy="15.8" r="0.38" fill="#ffe08a" opacity="0.9" />
        </>
      )}
    </svg>
  );
}

function SunBadge({
  iconSize,
  gradientId,
  className,
  style,
}: {
  iconSize: number;
  gradientId: string;
  className: string;
  style: CSSProperties;
}) {
  const diskId = `sun-disk-${gradientId}`;
  const rayId = `sun-ray-${gradientId}`;

  return (
    <svg
      className={className}
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      overflow="visible"
      aria-hidden="true"
      style={style}
    >
      <defs>
        <radialGradient id={diskId} cx="38%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#fffef8" />
          <stop offset="28%" stopColor="#ffe27a" />
          <stop offset="64%" stopColor="#f6c445" />
          <stop offset="100%" stopColor="#e09412" />
        </radialGradient>
        <linearGradient id={rayId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6d0" />
          <stop offset="100%" stopColor="#f0b429" />
        </linearGradient>
      </defs>
      <circle className="points-badge-aura points-badge-aura--sun" cx="12" cy="12" r="7.4" />
      <g className="points-sun-rays" fill={`url(#${rayId})`}>
        {Array.from({ length: 8 }, (_, index) => (
          <rect
            key={index}
            x="11.05"
            y="1.05"
            width="1.9"
            height="4.45"
            rx="0.95"
            transform={`rotate(${index * 45} 12 12)`}
          />
        ))}
      </g>
      <circle cx="12" cy="12" r="4.9" fill={`url(#${diskId})`} />
      <circle cx="10.45" cy="10.5" r="1.55" fill="#fff" opacity="0.82" />
    </svg>
  );
}

export function PointsStarBadge({ tier, size = 30, linkable = false, children }: PointsStarBadgeProps) {
  const gradientId = useId().replace(/:/g, '');

  if (!tier) {
    return <>{children}</>;
  }

  const kind = badgeKind(tier);
  const color = POINTS_STAR_COLORS[tier] || POINTS_STAR_COLORS.white;
  const scale = kind === 'sun' ? 0.62 : kind === 'moon' ? 0.5 : 0.42;
  const iconSize = Math.max(10, Math.round(size * scale));
  const style = {
    '--points-star-color': color,
    '--points-star-size': `${iconSize}px`,
    '--points-aura-blur': `${Math.max(1.5, iconSize * 0.16)}px`,
    width: iconSize,
    height: iconSize,
  } as CSSProperties;
  const className = [
    'points-star-badge',
    kind !== 'star' ? `points-star-badge--${kind}` : '',
    kind !== 'star' ? `points-star-badge--${tier}` : '',
  ].filter(Boolean).join(' ');

  const icon = kind === 'sun' ? (
    <SunBadge iconSize={iconSize} gradientId={gradientId} className={className} style={style} />
  ) : kind === 'moon' ? (
    <MoonBadge tier={tier} iconSize={iconSize} gradientId={gradientId} className={className} style={style} />
  ) : (
    <Star
      className={className}
      size={iconSize}
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
          {icon}
        </Link>
      ) : (
        icon
      )}
    </span>
  );
}
