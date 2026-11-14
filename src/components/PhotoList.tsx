import { useState } from 'react';
import { TIER_COLORS, formatScore } from '../utils/scoring';
import type { RoundResult } from '../types';

interface PhotoListProps {
  rounds: Array<{
    round: RoundResult;
    index: number;
    distDisplay: string;
    place: string;
    stateAbbr: string;
    seasonDate: string | null;
  }>;
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
      className="photo-list-chevron"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function PhotoList({ rounds }: PhotoListProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleRound = (i: number) => {
    setOpenIndex(prev => prev === i ? null : i);
  };

  return (
    <div className="photo-section">
      <h3 className="photo-section-heading">Your five photos</h3>
      <p className="photo-list-hint">Tap a photo to see it whole</p>

      <div className="photo-list">
        {rounds.map(({ round: r, index: i, distDisplay, place, stateAbbr, seasonDate }) => {
          const isOpen = openIndex === i;

          return (
            <div className={`photo-list-item ${isOpen ? 'is-open' : ''}`} key={r.image.id}>
              <button
                type="button"
                className="photo-list-row"
                onClick={() => toggleRound(i)}
                aria-expanded={isOpen}
              >
                <div className="photo-list-thumb-wrapper">
                  <img
                    src={r.image.r2_url}
                    alt={r.image.locationName}
                    className="photo-list-thumb"
                  />
                  <span className="photo-list-badge">{i + 1}</span>
                </div>

                <div className="photo-list-info">
                  <span className="photo-list-location">{place}, {stateAbbr}</span>
                  {seasonDate && <span className="photo-list-season">{seasonDate}</span>}
                  <span className="photo-list-meta">
                    {distDisplay} off · <span style={{ color: TIER_COLORS[r.tier] }}>{r.tier}</span>
                  </span>
                </div>

                <span className="photo-list-score">{formatScore(r.score)}</span>
                <ChevronIcon />
              </button>

              {isOpen && (
                <div className="photo-list-expanded">
                  <img
                    src={r.image.r2_url}
                    alt={r.image.locationName}
                    className="photo-list-expanded-image"
                  />
                  {r.image.description && (
                    <p className="photo-list-caption">{r.image.description}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
