import { useEffect, useState } from 'react';
import { canPlayToday, getDailyChallengeState, getTodayEastern } from '../utils/daily-challenge-storage';
import { TIER_COLORS } from '../utils/scoring';
import type { ImageConfig } from '../types';

interface DailyStartScreenProps {
  onStart: () => void;
  onViewLeaderboard: () => void;
  dailyPhotos: ImageConfig[] | null;
}

export function DailyStartScreen({ onStart, onViewLeaderboard, dailyPhotos }: DailyStartScreenProps) {
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    setHasPlayed(!canPlayToday());
  }, []);

  const today = getTodayEastern();
  const formattedDate = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  const imageUrl = dailyPhotos?.[0]?.r2_url;
  const finalScore = getDailyChallengeState()?.finalScore;

  return (
    <div className="daily-entry-veil-overlay">
      {imageUrl && (
        <div className="daily-entry-veil-backdrop" style={{ backgroundImage: `url(${imageUrl})` }} />
      )}
      <div className="daily-entry-veil-scrim" />
      <div className="daily-entry-content">
        <div className="daily-entry-label">Daily challenge · {formattedDate}</div>
        <h1 className="daily-entry-title">What Mile?</h1>

        {hasPlayed && finalScore ? (
          <>
            <div className="daily-entry-result-stats">
              <div className="daily-entry-result-stat">
                <span className="daily-entry-stat-label">Total</span>
                <span className="daily-entry-stat-value">{finalScore.total.toLocaleString()}</span>
              </div>
              <div className="daily-entry-result-stat">
                <span className="daily-entry-stat-label">Tier</span>
                <span className="daily-entry-stat-value daily-entry-tier-value">
                  <span className="daily-entry-tier-dot" style={{ background: TIER_COLORS[finalScore.tier] }} />
                  {finalScore.tier}
                </span>
              </div>
            </div>

            <div className="daily-entry-actions">
              <button onClick={onViewLeaderboard} className="btn-primary">
                View Leaderboard
              </button>
              <a href="/play" className="daily-entry-link">Free play instead</a>
              <div className="daily-entry-unlock-note">Tomorrow's challenge unlocks at midnight Eastern</div>
            </div>
          </>
        ) : (
          <>
            <p className="daily-entry-description">Today's challenge: 5 photos, same for everyone.</p>
            <p className="daily-entry-description">Complete all 5 rounds to submit your score to the leaderboard!</p>

            <div className="daily-entry-actions">
              <button onClick={onStart} className="btn-primary">
                Start Today's Challenge
              </button>
              <a href="/play" className="daily-entry-link">Free play instead</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
