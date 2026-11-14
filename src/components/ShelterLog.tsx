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
  submitStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onRetrySubmit?: () => void;
}

interface PlayerRowProps {
  rank: number;
  score: number;
  playerName: string | null;
  signingMode: boolean;
  nameInput: string;
  signError: string | null;
  signing: boolean;
  onSignClick: () => void;
  onCancelSign: () => void;
  onSign: () => void;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function PlayerRow({
  rank,
  score,
  playerName,
  signingMode,
  nameInput,
  signError,
  signing,
  onSignClick,
  onCancelSign,
  onSign,
  onNameChange
}: PlayerRowProps) {
  return (
    <li className="shelter-log-row is-you" aria-label="Your entry">
      {/* Top line: 3-column grid */}
      <div className="shelter-log-row-grid">
        <span className="shelter-log-rank">#{rank}</span>
        <span className="shelter-log-name">
          {playerName ? `${playerName} (you)` : 'You'}
        </span>
        <span className="shelter-log-score">{formatScore(score)}</span>
      </div>

      {/* Unsigned: subtitle + button */}
      {!playerName && !signingMode && (
        <>
          <div className="shelter-log-row-subtitle">Not in the log yet</div>
          <button className="shelter-log-row-button" onClick={onSignClick}>
            Sign the log
          </button>
        </>
      )}

      {/* Editing: form */}
      {!playerName && signingMode && (
        <div className="shelter-log-sign-form">
          <label className="shelter-log-label">
            Name or trail name
            <input
              className="shelter-log-input"
              value={nameInput}
              onChange={onNameChange}
              maxLength={50}
              autoFocus
              disabled={signing}
            />
          </label>
          <div className="shelter-log-button-row">
            <button className="shelter-log-btn-cancel" onClick={onCancelSign} disabled={signing}>
              Cancel
            </button>
            <button className="shelter-log-btn-sign" onClick={onSign} disabled={signing}>
              {signing ? 'Signing...' : 'Sign'}
            </button>
          </div>
          {signError && (
            <div className="shelter-log-error" role="alert">{signError}</div>
          )}
        </div>
      )}
    </li>
  );
}

export function ShelterLog({ challengeId, submitStatus = 'idle', onRetrySubmit }: ShelterLogProps) {
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

  // Fetch only after score is saved - guard against StrictMode
  useEffect(() => {
    if (submitStatus !== 'saved') return;
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchLeaderboard();
  }, [submitStatus, challengeId]);

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

  // Show saving state
  if (submitStatus === 'saving') {
    return (
      <div className="shelter-log">
        <div className="shelter-log-frame">
          <div className="shelter-log-loading">Saving your score...</div>
        </div>
      </div>
    );
  }

  // Show error state with retry
  if (submitStatus === 'error') {
    return (
      <div className="shelter-log">
        <div className="shelter-log-frame">
          <div className="shelter-log-error">
            Couldn't save your score.
            {onRetrySubmit && (
              <button onClick={onRetrySubmit} className="shelter-log-retry-btn">Try again</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Still loading after save
  if (loading) {
    return (
      <div className="shelter-log">
        <div className="shelter-log-frame">
          <div className="shelter-log-loading">Loading shelter log...</div>
        </div>
      </div>
    );
  }

  // Fetch error
  if (error || !data) {
    return (
      <div className="shelter-log">
        <div className="shelter-log-frame">
          <div className="shelter-log-error">{error || 'Failed to load shelter log'}</div>
        </div>
      </div>
    );
  }

  const { yourScore, topFive, totalPlayers } = data;

  // Determine display logic
  const showTopThree = yourScore && yourScore.rank > 5;
  const displayEntries = showTopThree ? topFive.slice(0, 3) : topFive;

  return (
    <div className="shelter-log">
      <div className="shelter-log-frame">
        <div className="shelter-log-header">
          <h3 className="shelter-log-title">Shelter Log</h3>
          <div className="shelter-log-count">{totalPlayers} {totalPlayers === 1 ? 'hiker' : 'hikers'} today</div>
        </div>

        <ol className="shelter-log-page">
          {/* Regular rows (non-player or player in top 5) */}
          {displayEntries.map((entry, idx) => {
            const isYou = entry.isYou;

            if (isYou) {
              // Player row in top 5
              return (
                <PlayerRow
                  key={idx}
                  rank={entry.rank}
                  score={entry.totalScore}
                  playerName={entry.playerName}
                  signingMode={signingMode}
                  nameInput={nameInput}
                  signError={signError}
                  signing={signing}
                  onSignClick={handleSignClick}
                  onCancelSign={handleCancelSign}
                  onSign={handleSign}
                  onNameChange={(e) => setNameInput(e.target.value)}
                />
              );
            }

            // Regular row (not player)
            const displayName = entry.playerName || 'Anonymous hiker';
            return (
              <li key={idx} className="shelter-log-row">
                <div className="shelter-log-row-grid">
                  <span className="shelter-log-rank">#{entry.rank}</span>
                  <span className="shelter-log-name">{displayName}</span>
                  <span className="shelter-log-score">{formatScore(entry.totalScore)}</span>
                </div>
              </li>
            );
          })}

          {/* Gap marker and player row when ranked > 5 */}
          {showTopThree && yourScore && (
            <>
              <li className="shelter-log-break">· · ·</li>
              <PlayerRow
                rank={yourScore.rank}
                score={yourScore.totalScore}
                playerName={yourScore.playerName}
                signingMode={signingMode}
                nameInput={nameInput}
                signError={signError}
                signing={signing}
                onSignClick={handleSignClick}
                onCancelSign={handleCancelSign}
                onSign={handleSign}
                onNameChange={(e) => setNameInput(e.target.value)}
              />
            </>
          )}
        </ol>
      </div>
    </div>
  );
}
