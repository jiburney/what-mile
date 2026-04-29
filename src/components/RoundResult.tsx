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
      : `${result.distanceMiles.toFixed(1)} miles`;

  return (
    <div className="round-result">
      <div className="result-header">
        <div className="result-location">
          <span className="result-pin">📍</span>
          <span className="result-location-name">{result.image.locationName}</span>
        </div>
        {result.image.description && (
          <p className="result-description">{result.image.description}</p>
        )}
      </div>

      <div className="result-stats">
        <div className="result-stat">
          <span className="stat-label">Distance off</span>
          <span className="stat-value">{distDisplay}</span>
        </div>
        <div className="result-stat result-stat-tier" style={{ '--tier-color': tierColor } as React.CSSProperties}>
          <span className="stat-label">Tier</span>
          <span className="stat-value tier-badge" style={{ color: tierColor }}>
            {result.tier}
          </span>
        </div>
        <div className="result-stat">
          <span className="stat-label">Round score</span>
          <span className="stat-value stat-score">{result.score.toLocaleString()}</span>
        </div>
      </div>

      <div className="result-footer">
        <div className="running-total">
          <span className="running-label">Total</span>
          <span className="running-score">{totalScore.toLocaleString()}</span>
          <span className="running-rounds">after {roundNumber}/{totalRounds} rounds</span>
        </div>
        <button className="btn-primary" onClick={onNext}>
          {isLastRound ? 'See Final Score' : `Round ${roundNumber + 1} →`}
        </button>
      </div>
    </div>
  );
}
