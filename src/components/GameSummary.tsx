import type { RoundResult } from '../types';
import { TIER_COLORS } from '../utils/scoring';

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

export function GameSummary({ rounds, totalScore, onPlayAgain }: Props) {
  const tier = overallTier(totalScore);
  const pct = Math.round((totalScore / MAX_SCORE) * 100);
  const tierColor = TIER_COLORS[tier as keyof typeof TIER_COLORS];

  return (
    <div className="summary-screen">
      <div className="summary-header">
        <h2 className="summary-title">Trail Complete!</h2>
        <div className="summary-score-ring" style={{ '--tier-color': tierColor } as React.CSSProperties}>
          <span className="summary-score-num">{totalScore.toLocaleString()}</span>
          <span className="summary-score-max">/ {MAX_SCORE.toLocaleString()}</span>
        </div>
        <div className="summary-tier" style={{ color: tierColor }}>
          {tier}
        </div>
        <div className="summary-pct">{pct}% accuracy</div>
      </div>

      <div className="summary-rounds">
        {rounds.map((r, i) => (
          <div className="summary-round-row" key={r.image.id}>
            <span className="summary-round-num">{i + 1}</span>
            <span className="summary-round-location">{r.image.locationName}</span>
            <span className="summary-round-dist">
              {r.distanceMiles < 1
                ? `${Math.round(r.distanceMiles * 5280)} ft`
                : `${r.distanceMiles.toFixed(0)} mi`}
            </span>
            <span
              className="summary-round-tier"
              style={{ color: TIER_COLORS[r.tier] }}
            >
              {r.tier}
            </span>
            <span className="summary-round-score">{r.score.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <button className="btn-primary btn-large" onClick={onPlayAgain}>
        Hike Again
      </button>
    </div>
  );
}
