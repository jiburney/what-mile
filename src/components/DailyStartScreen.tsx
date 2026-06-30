import { useEffect, useState } from 'react';
import { canPlayToday, getTodayEastern } from '../utils/daily-challenge-storage';

interface DailyStartScreenProps {
  onStart: () => void;
  onViewLeaderboard: () => void;
}

export function DailyStartScreen({ onStart, onViewLeaderboard }: DailyStartScreenProps) {
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    setHasPlayed(!canPlayToday());
  }, []);

  const today = getTodayEastern();
  const formattedDate = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="start-screen">
      <div className="start-content">
        <h1 className="title">Daily Challenge</h1>
        <div className="subtitle">{formattedDate}</div>

        {hasPlayed ? (
          <div className="daily-played-message">
            <p>You've already completed today's challenge!</p>
            <p className="hint">Come back tomorrow for a new set of photos.</p>
            <button onClick={onViewLeaderboard} className="start-button">
              View Leaderboard
            </button>
          </div>
        ) : (
          <div className="daily-intro">
            <p>Today's challenge: 5 photos, same for everyone.</p>
            <p className="hint">Complete all 5 rounds to submit your score to the leaderboard!</p>
            <button onClick={onStart} className="start-button">
              Start Today's Challenge
            </button>
          </div>
        )}

        <div className="daily-nav">
          <a href="/" className="link-button">← Back to Free Play</a>
        </div>
      </div>
    </div>
  );
}
