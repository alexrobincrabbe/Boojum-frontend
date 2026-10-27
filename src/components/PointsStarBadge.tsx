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
  crimson: '#e11d48',
};

/** Crescent used by every moon tier. Horns face up-right. */
const MOON_PATH = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';

/** Same path as lucide's filled Star. */
const STAR_PATH =
  'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z';

const MOON_TIERS = new Set(['silver', 'gold', 'red', 'violet']);
const SHINY_MOON_TIERS = new Set(['silver', 'gold']);

type MoonStop = { offset: string; color: string };

const MOON_FILLS: Record<string, { stops: MoonStop[] }> = {
  silver: {
    stops: [
      { offset: '0%', color: '#ffffff' },
      { offset: '18%', color: '#f4f4fa' },
      { offset: '42%', color: '#c8c8d8' },
      { offset: '68%', color: '#ececf4' },
      { offset: '100%', color: '#8a8a9c' },
    ],
  },
  gold: {
    stops: [
      { offset: '0%', color: '#fffceb' },
      { offset: '18%', color: '#ffe27a' },
      { offset: '42%', color: '#d4a82e' },
      { offset: '68%', color: '#fff0a8' },
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

const MOON_SPARKLES = [
  { x: 8.1, y: 9.2, scale: 1.15, delay: '0s' },
  { x: 6.2, y: 13.6, scale: 0.85, delay: '0.45s' },
  { x: 10.4, y: 16.4, scale: 1.25, delay: '0.9s' },
  { x: 11.7, y: 11.6, scale: 0.7, delay: '1.35s' },
  { x: 7.6, y: 17.2, scale: 0.62, delay: '0.2s' },
];

const STAR_SPARKLES = [
  { x: 12, y: 5.2, scale: 0.95, delay: '0s' },
  { x: 7.2, y: 9.4, scale: 0.72, delay: '0.35s' },
  { x: 16.4, y: 9.8, scale: 0.8, delay: '0.7s' },
  { x: 9.6, y: 14.8, scale: 0.68, delay: '1.05s' },
  { x: 14.2, y: 15.1, scale: 0.9, delay: '1.4s' },
  { x: 12, y: 11.2, scale: 0.55, delay: '0.2s' },
];

export type PointsTier = keyof typeof POINTS_STAR_COLORS | string;

interface PointsStarBadgeProps {
  tier?: PointsTier | null;
  size?: number;
  linkable?: boolean;
  children: ReactNode;
}

function badgeKind(tier: string): 'star' | 'moon' | 'sun' | 'glitter-star' {
  if (tier === 'sun') return 'sun';
  if (MOON_TIERS.has(tier)) return 'moon';
  if (tier === 'crimson') return 'glitter-star';
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

function GlitterLayer({
  maskId,
  sheenId,
  path,
  sparkles,
}: {
  maskId: string;
  sheenId: string;
  path: string;
  sparkles: Array<{ x: number; y: number; scale: number; delay: string }>;
}) {
  return (
    <>
      <defs>
        <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#ffe7ea" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id={maskId}>
          <rect width="24" height="24" fill="#000" />
          <path d={path} fill="#fff" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <g className="points-glitter-sheen">
          <rect x="-8" y="-2" width="6" height="28" fill={`url(#${sheenId})`} />
        </g>
      </g>
      {sparkles.map((sparkle) => (
        <Sparkle key={`${sparkle.x}-${sparkle.y}`} {...sparkle} />
      ))}
    </>
  );
}

function ShinySheen({
  maskId,
  sheenId,
  path,
  accent,
}: {
  maskId: string;
  sheenId: string;
  path: string;
  accent: string;
}) {
  return (
    <>
      <defs>
        <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="38%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="46%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="54%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="62%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id={maskId}>
          <rect width="24" height="24" fill="#000" />
          <path d={path} fill="#fff" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <g className="points-shiny-sheen">
          <rect x="-14" y="-4" width="10" height="32" fill={`url(#${sheenId})`} />
        </g>
      </g>
      <path
        d="M7.4 7.9c1.35-1.7 3.2-2.55 4.7-2.35"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.72"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <circle cx="9.1" cy="11.2" r="0.55" fill="#fff" opacity="0.85" />
      <circle cx="11.8" cy="15.4" r="0.35" fill="#fff" opacity="0.7" />
    </>
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
  const shiny = SHINY_MOON_TIERS.has(tier);

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
        <linearGradient id={fillId} x1="12%" y1="0%" x2="92%" y2="100%">
          {spec.stops.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>
      {tier === 'violet' && (
        <path className="points-badge-aura points-badge-aura--violet" d={MOON_PATH} />
      )}
      <path d={MOON_PATH} fill={`url(#${fillId})`} />
      {shiny && (
        <ShinySheen
          maskId={maskId}
          sheenId={sheenId}
          path={MOON_PATH}
          accent={tier === 'gold' ? '#ffe08a' : '#e8e8f8'}
        />
      )}
      {glitter && (
        <>
          <GlitterLayer maskId={maskId} sheenId={sheenId} path={MOON_PATH} sparkles={MOON_SPARKLES} />
          <circle cx="9.4" cy="12.4" r="0.55" fill="#fff" opacity="0.95" />
          <circle cx="6.8" cy="15.8" r="0.38" fill="#ffe08a" opacity="0.9" />
        </>
      )}
    </svg>
  );
}

function CrimsonStarBadge({
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
  const fillId = `crimson-fill-${gradientId}`;
  const maskId = `crimson-mask-${gradientId}`;
  const sheenId = `crimson-sheen-${gradientId}`;

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
        <linearGradient id={fillId} x1="15%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#ffd0da" />
          <stop offset="28%" stopColor="#ff4d6a" />
          <stop offset="62%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
      </defs>
      <path d={STAR_PATH} fill={`url(#${fillId})`} />
      <GlitterLayer maskId={maskId} sheenId={sheenId} path={STAR_PATH} sparkles={STAR_SPARKLES} />
      <circle cx="12" cy="9.2" r="0.45" fill="#fff" opacity="0.95" />
      <circle cx="9.4" cy="13.2" r="0.32" fill="#ffe08a" opacity="0.9" />
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
  const scale = kind === 'sun' ? 0.62 : kind === 'moon' ? 0.6 : 0.42;
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
    kind === 'moon' || kind === 'sun' || kind === 'glitter-star' ? `points-star-badge--${kind === 'glitter-star' ? 'crimson' : kind}` : '',
    kind !== 'star' ? `points-star-badge--${tier}` : '',
  ].filter(Boolean).join(' ');

  let icon: ReactNode;
  if (kind === 'sun') {
    icon = <SunBadge iconSize={iconSize} gradientId={gradientId} className={className} style={style} />;
  } else if (kind === 'moon') {
    icon = <MoonBadge tier={tier} iconSize={iconSize} gradientId={gradientId} className={className} style={style} />;
  } else if (kind === 'glitter-star') {
    icon = <CrimsonStarBadge iconSize={iconSize} gradientId={gradientId} className={className} style={style} />;
  } else {
    icon = (
      <Star
        className={className}
        size={iconSize}
        fill={color}
        stroke={color}
        aria-hidden={linkable ? undefined : true}
        style={style}
      />
    );
  }

  const wrapClass = [
    'points-star-badge-wrap',
    linkable ? 'points-star-badge-wrap--linkable' : '',
    kind === 'moon' || kind === 'sun' ? 'points-star-badge-wrap--outset' : '',
  ].filter(Boolean).join(' ');

  return (
    <span className={wrapClass} data-tier={tier}>
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
