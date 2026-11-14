import { useState } from 'react';
import type { RoundResult } from '../types';
import { TIER_COLORS, formatScore } from '../utils/scoring';
import { getTrailSection, parseLocationName } from '../utils/trail-sections';
import { ShelterLog } from './ShelterLog';
import { ScoreHero } from './ScoreHero';
import { SummaryActions } from './SummaryActions';
import { getTodayEastern } from '../utils/daily-challenge-storage';

interface Props {
  rounds: RoundResult[];
  totalScore: number;
  onPlayAgain: () => void;
  mode: 'daily' | 'free-play';
  challengeDate?: string;
  challengeId?: string;
  submitStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onRetrySubmit?: () => void;
}

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

export function GameSummary({ rounds, totalScore, onPlayAgain, mode, challengeDate, challengeId, submitStatus, onRetrySubmit }: Props) {
  const [openRounds, setOpenRounds] = useState<Set<number>>(new Set());

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

  const totalDistance = Math.round(rounds.reduce((sum, r) => sum + r.distanceMiles, 0));
  const bestRound = rounds.reduce((best, r) => (r.distanceMiles < best.distanceMiles ? r : best), rounds[0]);
  const bestRoundDist = bestRound
    ? (bestRound.distanceMiles < 1
        ? `${Math.round(bestRound.distanceMiles * 5280)} ft`
        : `${bestRound.distanceMiles.toFixed(0)} mi`)
    : null;
  // Parsed from the same locationName string that's displayed elsewhere,
  // not getTrailSection's lat/lng heuristic — the two can disagree near a
  // state border, and "Best round: X mi in Virginia" must always agree with
  // whatever that round's card actually shows.
  const bestRoundParsed = bestRound ? parseLocationName(bestRound.image.locationName) : null;
  const bestRoundState = bestRoundParsed?.stateFull
    ?? (bestRound ? getTrailSection(bestRound.image.coordinates[0], bestRound.image.coordinates[1]) : null);

  const roundsWithMeta = rounds.map((r, i) => {
    const distDisplay = r.distanceMiles < 1
      ? `${Math.round(r.distanceMiles * 5280)} ft`
      : `${r.distanceMiles.toFixed(0)} mi`;

    const parsed = parseLocationName(r.image.locationName);
    // Fall back to the lat/lng heuristic only if locationName didn't parse
    // cleanly (unexpected format) — never as a silent override of a value
    // that DID parse, which is what caused the label/location mismatch.
    const stateAbbr = parsed.stateAbbr ?? getTrailSection(r.image.coordinates[0], r.image.coordinates[1]);

    return {
      round: r,
      index: i,
      distDisplay,
      place: parsed.place,
      stateAbbr,
      seasonDate: seasonDateLabel(r.image.taken_at),
    };
  });

  return (
    <div className="summary-screen">
      {/* Desktop: two-column layout. Mobile: single column, different order */}
      <div className="summary-layout">
        {/* Left column on desktop: Score hero + Summary actions */}
        <div className="summary-layout-left">
          <ScoreHero
            totalScore={totalScore}
            mode={mode}
            challengeDate={challengeDate}
            totalDistance={totalDistance}
            bestRoundDist={bestRoundDist}
            bestRoundState={bestRoundState}
          />

          {/* Actions appear here on desktop, below Shelter Log on mobile */}
          <div className="summary-actions-desktop">
            <SummaryActions mode={mode} onPlayAgain={onPlayAgain} />
          </div>
        </div>

        {/* Right column on desktop: Recap map placeholder */}
        <div className="summary-layout-right">
          <div className="recap-map-placeholder">
            {/* Recap map will go here in a later prompt */}
          </div>
        </div>
      </div>

      {/* Desktop: card grid. Mobile: expandable drawer rows below. Both
          render — CSS media queries pick which one shows, matching how
          responsive breakpoints work elsewhere in this app. */}
      <div className="summary-rounds-grid">
        {roundsWithMeta.map(({ round: r, index: i, distDisplay, place, stateAbbr, seasonDate }) => (
          <div className="summary-round-card" key={r.image.id}>
            <div
              className="summary-card-thumb"
              style={{ backgroundImage: `url(${r.image.r2_url})` }}
            />
            <div className="summary-card-body">
              <span className="summary-card-label">
                Round {i + 1} · <span className="summary-card-label-state">{stateAbbr}</span>
              </span>
              <span className="summary-card-location">{place}</span>
              {seasonDate && <span className="summary-card-date">{seasonDate}</span>}
              <div className="summary-card-footer">
                <div className="summary-card-footer-meta">
                  <span className="summary-card-footer-dist">{distDisplay} off</span>
                  <span className="summary-card-footer-tier" style={{ color: TIER_COLORS[r.tier] }}>{r.tier}</span>
                </div>
                <span className="summary-card-footer-score">{formatScore(r.score)}</span>
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
                <span className="summary-round-score">{formatScore(r.score)}</span>
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

      {/* Shelter Log - only for today's daily challenge */}
      {mode === 'daily' && challengeId && challengeDate === getTodayEastern() && (
        <ShelterLog
          challengeId={challengeId}
          submitStatus={submitStatus}
          onRetrySubmit={onRetrySubmit}
        />
      )}

      {/* Actions appear here on mobile, after Shelter Log */}
      <div className="summary-actions-mobile">
        <SummaryActions mode={mode} onPlayAgain={onPlayAgain} />
      </div>
    </div>
  );
}
