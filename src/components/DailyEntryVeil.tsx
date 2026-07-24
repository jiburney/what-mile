import { getTodayEastern } from '../utils/daily-challenge-storage';

interface Props {
  onStart: () => void;
}

export function DailyEntryVeil({ onStart }: Props) {
  const today = getTodayEastern();
  const formattedDate = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="daily-entry-veil-overlay">
      <div className="daily-entry-content">
        <div className="daily-entry-label">Daily challenge · {formattedDate}</div>
        <h1 className="daily-entry-title">What Mile?</h1>
        <p className="daily-entry-description">
          Five photos from the Appalachian Trail. Open the map, drop a pin where you think each one was taken.
        </p>

        {/* Round pips */}
        <div className="daily-entry-pips">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`daily-entry-pip ${i === 0 ? 'active' : 'inactive'}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="daily-entry-actions">
          <button className="btn-primary" onClick={onStart}>
            Start round 1
          </button>
          <a href="/" className="daily-entry-link">Free play instead</a>
        </div>

        {/* Yesterday's score (static/non-functional) */}
        <div className="daily-entry-yesterday">Yesterday: 3,140 · LASHer</div>
      </div>
    </div>
  );
}
