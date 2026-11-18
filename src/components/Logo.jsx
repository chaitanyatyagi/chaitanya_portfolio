import { theme as t } from '../data.js';

// Brand mark: a "C" drawn as a data pipeline — an open arc with flow dots
// entering its mouth. Used in the nav, admin, guide/blog headers & favicon.
export default function Logo({ size = 34, radius = 9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <rect width="34" height="34" rx={radius} fill={t.ink} />
      {/* C as an open pipeline arc */}
      <path
        d="M 23.8 10.4 A 8.6 8.6 0 1 0 23.8 23.6"
        fill="none"
        stroke={t.accent}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* data flowing into the C */}
      <circle cx="21.5" cy="17" r="2.1" fill={t.bg} />
      <circle cx="27" cy="17" r="1.5" fill={t.accent} opacity="0.85" />
      <circle cx="31" cy="17" r="1" fill={t.accent} opacity="0.5" />
    </svg>
  );
}
