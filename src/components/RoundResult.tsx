import type { RoundResult as RoundResultType } from '../types';
import { TIER_COLORS } from '../utils/scoring';

interface Props {
  result: RoundResultType;
  roundNumber: number;
  totalRounds: number;
  totalScore: number;
  onNext: () => void;
  isLastRound: boolean;
}

export function RoundResult({ result, roundNumber, totalRounds, totalScore, onNext, isLastRound }: Props) {
  const tierColor = TIER_COLORS[result.tier];
  const distDisplay =
    result.distanceMiles < 1
      ? `${Math.round(result.distanceMiles * 5280)} ft`
      : `${result.distanceMiles.toFixed(0)} mi`;

  return (
    <div className="round-result">
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

      <div className="result-photo-thumb-desktop" style={{ backgroundImage: `url(${result.image.r2_url})` }} />

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
          <span className="stat-value stat-score">{result.score.toLocaleString()}</span>
        </div>
      </div>

      <div className="result-footer">
        <div className="running-total">
          <span className="running-label">Total</span>
          <span className="running-score">{totalScore.toLocaleString()}</span>
        </div>
        <button className="btn-primary btn-lock" onClick={onNext}>
          {isLastRound ? 'See Final Score' : `Round ${roundNumber + 1} →`}
        </button>
      </div>
    </div>
  );
}
