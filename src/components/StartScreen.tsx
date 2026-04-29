interface Props {
  onStart: () => void;
}

export function StartScreen({ onStart }: Props) {
  return (
    <div className="start-screen">
      <div className="start-content">
        <div className="start-logo">
          <span className="logo-mark">⛰</span>
        </div>
        <h1 className="start-title">What Mile?</h1>
        <p className="start-subtitle">
          Can you identify where on the Appalachian Trail this photo was taken?
        </p>
        <div className="start-trail-info">
          <span className="trail-stat">Georgia → Maine</span>
          <span className="trail-divider">·</span>
          <span className="trail-stat">2,198 miles</span>
          <span className="trail-divider">·</span>
          <span className="trail-stat">5 rounds</span>
        </div>
        <button className="btn-primary btn-large" onClick={onStart}>
          Start Hiking
        </button>
        <p className="start-hint">
          Tap the trail on the map to drop your pin, then lock in your guess.
        </p>
      </div>
    </div>
  );
}
