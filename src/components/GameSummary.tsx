import { useState } from 'react';
import type { RoundResult } from '../types';
import { TIER_COLORS } from '../utils/scoring';
import { getTrailSection } from '../utils/trail-sections';

interface Props {
  rounds: RoundResult[];
  totalScore: number;
  onPlayAgain: () => void;
}

function overallTier(score: number): string {
  if (score >= 1760) return 'Thru-Hiker';
  if (score >= 1100) return 'LASHer';
  if (score >= 440) return 'Section Hiker';
  return 'Day Hiker';
}

const MAX_SCORE = 2200;

// Season boundaries by month (0-indexed): each spans exactly 3 months,
// Winter wrapping across the year boundary (Dec of one year, Jan/Feb of the next).
const SEASONS = [
  { name: 'Winter', firstMonth: 11 },
  { name: 'Spring', firstMonth: 2 },
  { name: 'Summer', firstMonth: 5 },
  { name: 'Fall', firstMonth: 8 },
];

// "Late Spring", "Early Fall", etc. — split by actual day-of-season (not just
// month), so a boundary date like the last day of a season resolves correctly
// instead of being approximated to whichever month it falls in.
function seasonLabel(date: Date): string {
  const month = date.getUTCMonth();
  const season = SEASONS.find(s => s.firstMonth === month
    || s.firstMonth === (month - 1 + 12) % 12
    || s.firstMonth === (month - 2 + 12) % 12)!;

  // Winter starting in December spans into next year's Jan/Feb.
  const seasonStartYear = season.name === 'Winter' && month !== 11
    ? date.getUTCFullYear() - 1
    : date.getUTCFullYear();

  const seasonStart = Date.UTC(seasonStartYear, season.firstMonth, 1);
  const seasonEndExclusive = Date.UTC(seasonStartYear, season.firstMonth + 3, 1);
  const dateOnly = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  const totalDays = (seasonEndExclusive - seasonStart) / 86_400_000;
  const dayOffset = (dateOnly - seasonStart) / 86_400_000;
  const half = dayOffset < totalDays / 2 ? 'Early' : 'Late';

  return `${half} ${season.name}`;
}

// "Late Spring · May 2023" — or null if the photo has no EXIF timestamp.
function seasonDateLabel(takenAt: string | undefined): string | null {
  if (!takenAt) return null;
  const date = new Date(takenAt);
  if (isNaN(date.getTime())) return null;

  const monthYear = date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return `${seasonLabel(date)} · ${monthYear}`;
}

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="summary-round-chevron"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function GameSummary({ rounds, totalScore, onPlayAgain }: Props) {
  const [openRounds, setOpenRounds] = useState<Set<number>>(new Set());
  const tier = overallTier(totalScore);
  const pct = Math.round((totalScore / MAX_SCORE) * 100);
  const tierColor = TIER_COLORS[tier as keyof typeof TIER_COLORS];

  const toggleRound = (i: number) => {
    setOpenRounds(prev => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  const roundsWithMeta = rounds.map((r, i) => {
    const distDisplay = r.distanceMiles < 1
      ? `${Math.round(r.distanceMiles * 5280)} ft`
      : `${r.distanceMiles.toFixed(0)} mi`;

    return {
      round: r,
      index: i,
      distDisplay,
      state: getTrailSection(r.image.coordinates[0], r.image.coordinates[1]),
      seasonDate: seasonDateLabel(r.image.taken_at),
    };
  });

  return (
    <div className="summary-screen">
      <div className="summary-header">
        <h2 className="summary-title">Trail Complete!</h2>
        <div className="result-stats">
          <div className="result-stat">
            <span className="stat-label">Total</span>
            <span className="stat-value">{totalScore.toLocaleString()}</span>
          </div>
          <div className="result-stat">
            <span className="stat-label">Tier</span>
            <span className="stat-value tier-badge" style={{ color: tierColor }}>
              {tier}
            </span>
          </div>
          <div className="result-stat">
            <span className="stat-label">Accuracy</span>
            <span className="stat-value">{pct}%</span>
          </div>
        </div>
      </div>

      {/* Desktop: card grid. Mobile: expandable drawer rows below. Both
          render — CSS media queries pick which one shows, matching how
          responsive breakpoints work elsewhere in this app. */}
      <div className="summary-rounds-grid">
        {roundsWithMeta.map(({ round: r, index: i, distDisplay, state, seasonDate }) => (
          <div className="summary-round-card" key={r.image.id}>
            <div
              className="summary-card-thumb"
              style={{ backgroundImage: `url(${r.image.r2_url})` }}
            />
            <div className="summary-card-body">
              <span className="summary-card-label">Round {i + 1} · {state}</span>
              <span className="summary-card-location">{r.image.locationName}</span>
              {seasonDate && <span className="summary-card-date">{seasonDate}</span>}
              <div className="summary-card-footer">
                <div className="summary-card-footer-group">
                  <div className="summary-card-stat">
                    <span className="stat-label">Off by</span>
                    <span className="stat-value">{distDisplay}</span>
                  </div>
                  <div className="summary-card-stat">
                    <span className="stat-label">Tier</span>
                    <span className="stat-value tier-badge" style={{ color: TIER_COLORS[r.tier] }}>
                      {r.tier}
                    </span>
                  </div>
                </div>
                <div className="summary-card-stat">
                  <span className="stat-label">Score</span>
                  <span className="stat-value">{r.score.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="summary-rounds-list">
        {roundsWithMeta.map(({ round: r, index: i, distDisplay, seasonDate }) => {
          const isOpen = openRounds.has(i);
          return (
            <div className={`summary-round-item ${isOpen ? 'is-open' : ''}`} key={r.image.id}>
              <button
                type="button"
                className="summary-round-row"
                onClick={() => toggleRound(i)}
                aria-expanded={isOpen}
              >
                <span className="summary-round-num">{i + 1}</span>
                <div
                  className="summary-round-thumb"
                  style={{ backgroundImage: `url(${r.image.r2_url})` }}
                />
                <div className="summary-round-info">
                  <span className="summary-round-location">{r.image.locationName}</span>
                  <span className="summary-round-meta">
                    {distDisplay} · <span style={{ color: TIER_COLORS[r.tier] }}>{r.tier}</span>
                  </span>
                </div>
                <span className="summary-round-score">{r.score.toLocaleString()}</span>
                <ChevronIcon />
              </button>

              <div className="summary-round-drawer-wrap">
                <div className="summary-round-drawer">
                  <div className="summary-round-drawer-inner">
                    <div
                      className="summary-round-drawer-thumb"
                      style={{ backgroundImage: `url(${r.image.r2_url})` }}
                    />
                    {seasonDate && (
                      <span className="summary-round-drawer-date">{seasonDate}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn-primary btn-large" onClick={onPlayAgain}>
        Hike Again
      </button>
    </div>
  );
}
