import { useState } from 'react';
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

function TapToEnlargeHint() {
  return (
    <span className="photo-tap-hint">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
      Tap to enlarge
    </span>
  );
}

export function RoundResult({ result, roundNumber, totalRounds, totalScore, onNext, isLastRound }: Props) {
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const tierColor = TIER_COLORS[result.tier];
  const distDisplay =
    result.distanceMiles < 1
      ? `${Math.round(result.distanceMiles * 5280)} ft`
      : `${result.distanceMiles.toFixed(0)} mi`;

  return (
    <div className="round-result">
      {/* Everything except the footer scrolls in this region on mobile; the
          footer is a normal flex sibling below it, so it can never overlap
          scrolled content — no sticky-position/padding math to keep in sync. */}
      <div className="round-result-scroll">
        <div className="result-header">
          <div className="result-round-indicator">
            <span className="result-round-label">Round {roundNumber} of {totalRounds}</span>
            <div className="result-pips">
              {Array.from({ length: totalRounds }, (_, i) => (
                <span
                  key={i}
                  className={`result-pip ${i < roundNumber ? 'pip-done' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          className="result-photo-thumb-desktop"
          style={{ backgroundImage: `url(${result.image.r2_url})` }}
          onClick={() => setShowFullPhoto(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setShowFullPhoto(true)}
        >
          <TapToEnlargeHint />
        </div>

        <div
          className="result-photo-large-mobile"
          style={{ backgroundImage: `url(${result.image.r2_url})` }}
          onClick={() => setShowFullPhoto(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setShowFullPhoto(true)}
        >
          <TapToEnlargeHint />
        </div>

        <div className="result-content-row">
          <div className="result-photo-thumb-mobile" style={{ backgroundImage: `url(${result.image.r2_url})` }} />
          <div className="result-location-info">
            <h3 className="result-location-name">{result.image.locationName}</h3>
            {result.image.description && (
              <p className="result-description">{result.image.description}</p>
            )}
          </div>
        </div>

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
      </div>

      <div className="result-footer">
        <div className="running-total">
          <span className="running-label">Total</span>
          <span className="running-score">{formatScore(totalScore)}</span>
        </div>
        <button className="btn-primary btn-lock" onClick={onNext}>
          {isLastRound ? 'See Final Score' : `Round ${roundNumber + 1} →`}
        </button>
      </div>

      {showFullPhoto && (
        <div
          className="photo-fullscreen-overlay"
          onClick={() => setShowFullPhoto(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setShowFullPhoto(false)}
        >
          <img
            src={result.image.r2_url}
            alt={result.image.locationName}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
