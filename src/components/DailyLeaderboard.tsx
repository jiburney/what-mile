import { useEffect, useState } from 'react';
import { getClientFingerprint } from '../utils/daily-challenge-storage';

interface LeaderboardEntry {
  rank: number;
  totalScore: number;
  playerName: string;
  yearHiked?: number;
}

interface LeaderboardData {
  yourScore: LeaderboardEntry | null;
  topFive: LeaderboardEntry[];
  totalPlayers: number;
}

interface DailyLeaderboardProps {
  challengeId: string;
  onPlayAgain?: () => void; // For historical leaderboards, allow replay
}

export function DailyLeaderboard({ challengeId, onPlayAgain }: DailyLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const fingerprint = getClientFingerprint();
        const response = await fetch(
          `/api/daily?action=get-leaderboard&challengeId=${challengeId}&clientFingerprint=${fingerprint}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard');
        }

        const data = await response.json();
        setLeaderboard(data);
      } catch (err) {
        console.error('Leaderboard error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [challengeId]);

  if (loading) {
    return (
      <div className="leaderboard-container">
        <div className="loading-message">Loading leaderboard...</div>
      </div>
    );
  }

  if (error || !leaderboard) {
    return (
      <div className="leaderboard-container">
        <div className="error-message">Failed to load leaderboard</div>
      </div>
    );
  }

  const { yourScore, topFive, totalPlayers } = leaderboard;

  return (
    <div className="leaderboard-container">
      <h2 className="leaderboard-title">Daily Challenge Leaderboard</h2>

      {yourScore && (
        <div className="your-score-card">
          <div className="score-header">Your Score</div>
          <div className="score-details">
            <div className="rank">#{yourScore.rank}</div>
            <div className="score">{yourScore.totalScore} points</div>
            <div className="player-name">
              {yourScore.playerName}
              {yourScore.yearHiked && ` (${yourScore.yearHiked})`}
            </div>
          </div>
        </div>
      )}

      <div className="top-five-section">
        <h3>Top 5</h3>
        {topFive.length === 0 ? (
          <p className="empty-leaderboard">No scores yet. Be the first!</p>
        ) : (
          <ol className="leaderboard-list">
            {topFive.map((entry, index) => (
              <li key={index} className="leaderboard-entry">
                <span className="entry-rank">#{entry.rank}</span>
                <span className="entry-name">
                  {entry.playerName}
                  {entry.yearHiked && ` (${entry.yearHiked})`}
                </span>
                <span className="entry-score">{entry.totalScore}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="leaderboard-footer">
        <p className="total-players">{totalPlayers} hikers played today</p>
      </div>

      <div className="leaderboard-actions">
        {onPlayAgain ? (
          <button onClick={onPlayAgain} className="primary-button">
            Play This Challenge
          </button>
        ) : (
          <a href="/" className="secondary-button">
            Back to Free Play
          </a>
        )}
      </div>
    </div>
  );
}
