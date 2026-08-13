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

export function RoundResult({ result, roundNumber, totalScore }: Props) {
  const [isMinimized, setIsMinimized] = useState(false);
  const tierColor = TIER_COLORS[result.tier];
  const distDisplay =
    result.distanceMiles < 1
      ? `${Math.round(result.distanceMiles * 5280)} ft`
      : `${result.distanceMiles.toFixed(0)} mi`;

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
      <div className="result-card-header">
        <div className="result-card-title">
          <svg className="result-pin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <h3 className="result-location-name">{result.image.locationName}</h3>
        </div>
        <button
          className="result-toggle-btn"
          onClick={() => setIsMinimized(true)}
          aria-label="Minimize result"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {result.image.description && (
        <p className="result-description">{result.image.description}</p>
      )}

      <div className="result-stats">
        <div className="result-stat">
          <span className="stat-label">Off by</span>
          <span className="stat-value">{distDisplay}</span>
        </div>
        <div className="result-stat">
          <span className="stat-label">Tier</span>
          <span className="stat-value tier-badge" style={{ color: tierColor }}>
            {result.tier}
          </span>
        </div>
        <div className="result-stat">
          <span className="stat-label">Round</span>
          <span className="stat-value stat-score">{formatScore(result.score)}</span>
        </div>
      </div>

      <div className="result-total">
        <span className="result-total-label">Total</span>
        <span className="result-total-value">{formatScore(totalScore)}</span>
      </div>
    </div>
  );
}
