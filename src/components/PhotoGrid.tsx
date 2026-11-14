import { TIER_COLORS, formatScore } from '../utils/scoring';
import type { RoundResult } from '../types';

interface PhotoGridProps {
  rounds: Array<{
    round: RoundResult;
    index: number;
    distDisplay: string;
    place: string;
    stateAbbr: string;
    seasonDate: string | null;
  }>;
}

export function PhotoGrid({ rounds }: PhotoGridProps) {
  return (
    <div className="photo-section">
      <h3 className="photo-section-heading">Your five photos</h3>

      <div className="photo-grid">
        {rounds.map(({ round: r, index: i, distDisplay, place, stateAbbr, seasonDate }) => (
          <div className="photo-grid-card" key={r.image.id}>
            <div className="photo-grid-image-wrapper">
              <img
                src={r.image.r2_url}
                alt={r.image.locationName}
                className="photo-grid-image"
              />
              <span className="photo-grid-badge">{i + 1}</span>
            </div>

            <div className="photo-grid-content">
              <span className="photo-grid-state">{stateAbbr}</span>
              <span className="photo-grid-place">{place}</span>
              {seasonDate && <span className="photo-grid-season">{seasonDate}</span>}
              <div className="photo-grid-meta">
                <span className="photo-grid-distance">{distDisplay} off</span>
                <span className="photo-grid-tier" style={{ color: TIER_COLORS[r.tier] }}>
                  {r.tier}
                </span>
              </div>
              <span className="photo-grid-score">{formatScore(r.score)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
