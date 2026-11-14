import { useState, useEffect } from 'react';
import type { RoundResult as RoundResultType } from '../types';
import { TIER_COLORS, formatScore } from '../utils/scoring';

interface Props {
  result: RoundResultType;
  roundNumber: number;
  totalRounds: number;
  totalScore: number;
  onNext: () => void;
  isLastRound: boolean;
}

export function RoundResult({ result, roundNumber, totalRounds, totalScore }: Props) {
  const [isMinimized, setIsMinimized] = useState(false);
  const tierColor = TIER_COLORS[result.tier];
  const distDisplay =
    result.distanceMiles < 1
      ? `${Math.round(result.distanceMiles * 5280)} ft`
      : `${result.distanceMiles.toFixed(0)} mi`;

  // Extract month and year from taken_at for mobile display
  const monthYear = result.image.taken_at
    ? new Date(result.image.taken_at).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).toUpperCase()
    : null;

  // Always start full (not minimized) on new round
  useEffect(() => {
    setIsMinimized(false);
  }, [roundNumber]);

  if (isMinimized) {
    return (
      <div className="result-card-minimized">
        <div className="result-minimized-content">
          <span className="result-minimized-location">{result.image.locationName}</span>
          <span className="result-minimized-stats">
            {distDisplay} · {result.tier} · {formatScore(result.score)}
          </span>
        </div>
        <button
          className="result-toggle-btn"
          onClick={() => setIsMinimized(false)}
          aria-label="Expand result"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="result-card">
      {/* Wooden trail sign with location */}
      <div className="result-sign-row">
        <div className="result-trail-sign">
          <div className="result-trail-sign-inner">
            {result.image.locationName}
          </div>
        </div>
        {monthYear && <span className="result-month-year">{monthYear}</span>}
        <button
          className="result-minimize-btn"
          onClick={() => setIsMinimized(true)}
          aria-label="Minimize result"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Caption */}
      {result.image.description && (
        <p className="result-caption">{result.image.description}</p>
      )}

      {/* Stat boxes */}
      <div className="result-stats-grid">
        <div className="result-stat-box">
          <span className="result-stat-label">Off by</span>
          <span className="result-stat-value">{distDisplay}</span>
        </div>
        <div className="result-stat-box">
          <span className="result-stat-label">Tier</span>
          <span className="result-stat-value" style={{ color: tierColor }}>
            {result.tier}
          </span>
        </div>
        <div className="result-stat-box">
          <span className="result-stat-label result-stat-label-mobile">Round</span>
          <span className="result-stat-label result-stat-label-desktop">Round score</span>
          <span className="result-stat-value">{formatScore(result.score)}</span>
        </div>
        <div className="result-stat-box result-stat-box-total">
          <span className="result-stat-label">Total after {roundNumber} of {totalRounds}</span>
          <span className="result-stat-value">{formatScore(totalScore)}</span>
        </div>
      </div>
    </div>
  );
}
