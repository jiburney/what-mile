import { getTodayEastern } from '../utils/daily-challenge-storage';

interface Props {
  mode: 'free-play' | 'daily';
  onStart: () => void;
  imageUrl?: string;
  resumeRoundNumber?: number;
  completedCount?: number;
}

export function EntryVeil({ mode, onStart, imageUrl, resumeRoundNumber, completedCount }: Props) {
  const today = getTodayEastern();
  const formattedDate = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  const label = mode === 'daily' ? `Daily challenge · ${formattedDate}` : 'Free play';
  const secondaryHref = mode === 'daily' ? '/play' : '/';
  const secondaryText = mode === 'daily' ? 'Free play instead' : 'Daily challenge instead';

  // Resume state: button text and pip display
  const isResuming = resumeRoundNumber !== undefined && completedCount !== undefined;
  const buttonText = isResuming ? `Resume Round ${resumeRoundNumber}` : 'Start round 1';

  return (
    <div className="daily-entry-veil-overlay">
      {imageUrl && (
        <div className="daily-entry-veil-backdrop" style={{ backgroundImage: `url(${imageUrl})` }} />
      )}
      <div className="daily-entry-veil-scrim" />
      <div className="daily-entry-content">
        <div className="daily-entry-label">{label}</div>
        <h1 className="daily-entry-title">What Mile?</h1>
        <p className="daily-entry-description">
          Five photos from the Appalachian Trail. Open the map, drop a pin where you think each one was taken.
        </p>

        {/* Round pips */}
        <div className="daily-entry-pips">
          {Array.from({ length: 5 }, (_, i) => {
            // Fresh start: only pip 0 is active
            // Resume: completed rounds + current round (resuming into) are active
            const isActive = isResuming
              ? i < (completedCount ?? 0) || i === (completedCount ?? 0)
              : i === 0;

            return (
              <span
                key={i}
                className={`daily-entry-pip ${isActive ? 'active' : 'inactive'}`}
              />
            );
          })}
        </div>

        {/* Actions — button, link, and (daily mode) yesterday's score stack
            in a centered column. */}
        <div className="daily-entry-actions">
          <button className="btn-primary" onClick={onStart}>
            {buttonText}
          </button>
          <a href={secondaryHref} className="daily-entry-link">{secondaryText}</a>
          {mode === 'daily' && (
            <div className="daily-entry-yesterday">Yesterday: 3,140 · LASHer</div>
          )}
        </div>
      </div>
    </div>
  );
}
