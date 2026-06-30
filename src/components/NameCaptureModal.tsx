import { useState } from 'react';

interface NameCaptureModalProps {
  onSubmit: (playerName: string | null, yearHiked: number | null) => void;
  onSkip: () => void;
}

export function NameCaptureModal({ onSubmit, onSkip }: NameCaptureModalProps) {
  const [playerName, setPlayerName] = useState('');
  const [yearHiked, setYearHiked] = useState('');

  const handleSubmit = () => {
    const name = playerName.trim() || null;
    const year = yearHiked ? parseInt(yearHiked, 10) : null;
    onSubmit(name, year);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => currentYear - i);

  return (
    <div className="modal-overlay">
      <div className="modal-content name-capture-modal">
        <h2>Share Your Score</h2>
        <p className="modal-subtitle">Optional: Add your name to the leaderboard</p>

        <div className="form-group">
          <label htmlFor="player-name">Trail name or First L.</label>
          <input
            id="player-name"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="e.g., Strider or John D."
            maxLength={50}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="year-hiked">Year hiked (optional)</label>
          <select
            id="year-hiked"
            value={yearHiked}
            onChange={(e) => setYearHiked(e.target.value)}
          >
            <option value="">Select year...</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="modal-actions">
          <button onClick={onSkip} className="secondary-button">
            Skip
          </button>
          <button onClick={handleSubmit} className="primary-button">
            Submit Score
          </button>
        </div>

        <p className="modal-note">
          Your score will be saved either way. Adding your name helps build community!
        </p>
      </div>
    </div>
  );
}
