import { useEffect, useState } from 'react';
import type { RoundResult } from '../types';
import { TIER_COLORS, formatScore } from '../utils/scoring';
import { getTrailSection, parseLocationName } from '../utils/trail-sections';

interface Props {
  rounds: RoundResult[];
  totalScore: number;
  onPlayAgain: () => void;
  mode: 'daily' | 'free-play';
  challengeDate?: string;
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

// "July 24" from a YYYY-MM-DD challenge date — parsed as UTC midnight so the
// calendar day can't shift based on the viewer's local timezone.
function formatChallengeDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

// Ms remaining until the next America/New_York midnight, derived from the
// current ET wall-clock time-of-day. DST-safe since it never reconstructs a
// Date from a formatted string — only reads hour/minute/second parts.
function msUntilNextEasternMidnight(): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  const msSinceMidnight = ((get('hour') % 24 * 60 + get('minute')) * 60 + get('second')) * 1000;
  return 24 * 60 * 60 * 1000 - msSinceMidnight;
}

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
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

export function GameSummary({ rounds, totalScore, onPlayAgain, mode, challengeDate }: Props) {
  const [openRounds, setOpenRounds] = useState<Set<number>>(new Set());
  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const tier = overallTier(totalScore);
  const pct = Math.round((totalScore / MAX_SCORE) * 100);

  useEffect(() => {
    if (mode !== 'daily') return;
    const update = () => setCountdownMs(msUntilNextEasternMidnight());
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [mode]);

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
      <div className="summary-header">
        <div className="summary-header-top">
          <div className="summary-header-left">
            {mode === 'daily' && challengeDate && (
              <div className="summary-eyebrow">Daily Challenge · {formatChallengeDate(challengeDate)}</div>
            )}
            <h2 className="summary-title">You hiked like a {tier}.</h2>
            <p className="summary-subline">
              Five photos, {totalDistance.toLocaleString()} miles off in total · {pct}% accuracy.
              {bestRoundDist && bestRoundState && ` Best round: ${bestRoundDist} in ${bestRoundState}.`}
            </p>
          </div>
          <div className="summary-header-right">
            <div className="summary-score-cta-row">
              <span className="summary-score-hero-label">Total Score</span>
              <span className="summary-score-hero-value">{formatScore(totalScore)}</span>
              {mode === 'daily' ? (
                <a href="/play" className="btn-primary btn-lock summary-header-action">Free Play →</a>
              ) : (
                <button
                  type="button"
                  className="btn-primary btn-lock summary-header-action"
                  onClick={onPlayAgain}
                >
                  Hike Again
                </button>
              )}
            </div>
            {mode === 'daily' && countdownMs !== null && (
              <div className="summary-countdown">Next Daily Challenge in {formatCountdown(countdownMs)}</div>
            )}
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
    </div>
  );
}
