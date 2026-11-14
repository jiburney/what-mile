import { useEffect, useState } from 'react';

interface SummaryActionsProps {
  mode: 'daily' | 'free-play';
  onPlayAgain: () => void;
}

// Ms remaining until the next America/New_York midnight, derived from the
// current ET wall-clock time-of-day. DST-safe since it never reconstructs a
// Date from a formatted string — only reads hour/minute/second parts.
function msUntilNextEasternMidnight(): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  const msSinceMidnight = ((get('hour') % 24 * 60 + get('minute')) * 60 + get('second')) * 1000;
  return 24 * 60 * 60 * 1000 - msSinceMidnight;
}

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function SummaryActions({ mode, onPlayAgain }: SummaryActionsProps) {
  const [countdownMs, setCountdownMs] = useState<number | null>(null);

  useEffect(() => {
    if (mode !== 'daily') return;
    const update = () => setCountdownMs(msUntilNextEasternMidnight());
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [mode]);

  return (
    <div className="summary-actions">
      <div className="summary-actions-buttons">
        {mode === 'daily' ? (
          <a href="/play" className="btn-summary-outline">
            Free Play
          </a>
        ) : (
          <button
            type="button"
            className="btn-summary-primary"
            onClick={onPlayAgain}
          >
            Hike Again
          </button>
        )}
      </div>

      {mode === 'daily' && countdownMs !== null && (
        <div className="summary-actions-countdown">
          Next Daily Challenge in {formatCountdown(countdownMs)}
        </div>
      )}
    </div>
  );
}
