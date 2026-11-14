import { useState, useEffect, useRef } from 'react';
import { getClientFingerprint } from '../utils/daily-challenge-storage';
import { formatScore } from '../utils/scoring';

interface LeaderboardEntry {
  rank: number;
  totalScore: number;
  playerName: string | null;
  isYou: boolean;
}

interface ShelterLogData {
  yourScore: LeaderboardEntry | null;
  topFive: LeaderboardEntry[];
  totalPlayers: number;
}

interface ShelterLogProps {
  challengeId: string;
}

export function ShelterLog({ challengeId }: ShelterLogProps) {
  const [data, setData] = useState<ShelterLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [signingMode, setSigningMode] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [signError, setSignError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const hasFetchedRef = useRef(false);

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    try {
      const fingerprint = getClientFingerprint();
      const response = await fetch(
        `/api/daily?action=get-leaderboard&challengeId=${challengeId}&clientFingerprint=${fingerprint}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      setError('Couldn\'t load the shelter log. Try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch - guard against StrictMode double-mount
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchLeaderboard();
  }, [challengeId]);

  const handleSignClick = () => {
    setSigningMode(true);
    setSignError(null);
  };

  const handleCancelSign = () => {
    setSigningMode(false);
    setNameInput('');
    setSignError(null);
  };

  const handleSign = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setSignError('Please enter a name');
      return;
    }
    if (trimmed.length > 50) {
      setSignError('Name must be 50 characters or less');
      return;
    }

    setSigning(true);
    setSignError(null);

    try {
      const fingerprint = getClientFingerprint();
      const response = await fetch('/api/daily?action=sign-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          clientFingerprint: fingerprint,
          playerName: trimmed,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sign log');
      }

      // Success - refetch to show updated name
      setSigningMode(false);
      setNameInput('');
      await fetchLeaderboard();
    } catch (err) {
      console.error('Sign log error:', err);
      setSignError('Couldn\'t save. Try again.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="shelter-log">
        <div className="shelter-log-loading">Loading shelter log...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="shelter-log">
        <div className="shelter-log-error">{error || 'Failed to load shelter log'}</div>
      </div>
    );
  }

  const { yourScore, topFive, totalPlayers } = data;

  // Determine display logic
  const showTopThree = yourScore && yourScore.rank > 5;
  const displayEntries = showTopThree ? topFive.slice(0, 3) : topFive;

  return (
    <div className="shelter-log">
      <div className="shelter-log-header">
        <h3 className="shelter-log-title">Shelter Log</h3>
        <div className="shelter-log-count">{totalPlayers} {totalPlayers === 1 ? 'hiker' : 'hikers'} today</div>
      </div>

      <div className="shelter-log-page">
        <div className="shelter-log-entries">
          {displayEntries.map((entry, idx) => {
            const isYou = entry.isYou;
            const displayName = entry.playerName || 'Anonymous hiker';

            return (
              <div
                key={idx}
                className={`shelter-log-row ${isYou ? 'is-you' : ''}`}
              >
                <span className="shelter-log-rank">#{entry.rank}</span>
                <span className="shelter-log-name">
                  {isYou && !entry.playerName ? 'You' : displayName}
                  {isYou && entry.playerName ? ' (you)' : ''}
                </span>
                <span className="shelter-log-score">{formatScore(entry.totalScore)}</span>
                {isYou && !entry.playerName && !signingMode && (
                  <button
                    className="shelter-log-sign-btn"
                    onClick={handleSignClick}
                  >
                    Sign the log
                  </button>
                )}
              </div>
            );
          })}

          {showTopThree && (
            <>
              <div className="shelter-log-break">· · ·</div>
              <div className="shelter-log-row is-you">
                <span className="shelter-log-rank">#{yourScore.rank}</span>
                <span className="shelter-log-name">
                  {yourScore.playerName ? `${yourScore.playerName} (you)` : 'You'}
                </span>
                <span className="shelter-log-score">{formatScore(yourScore.totalScore)}</span>
                {!yourScore.playerName && !signingMode && (
                  <button
                    className="shelter-log-sign-btn"
                    onClick={handleSignClick}
                  >
                    Sign the log
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {signingMode && (
          <div className="shelter-log-sign-form">
            <input
              type="text"
              className="shelter-log-input"
              placeholder="Name or trail name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={50}
              autoFocus
              disabled={signing}
            />
            <div className="shelter-log-sign-actions">
              <button
                className="shelter-log-btn-cancel"
                onClick={handleCancelSign}
                disabled={signing}
              >
                Cancel
              </button>
              <button
                className="shelter-log-btn-sign"
                onClick={handleSign}
                disabled={signing}
              >
                {signing ? 'Signing...' : 'Sign'}
              </button>
            </div>
            {signError && (
              <div className="shelter-log-sign-error">{signError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
