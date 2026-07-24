interface Props {
  onStart: () => void;
}

export function StartScreen({ onStart }: Props) {
  return (
    <div className="start-screen">
      <div className="start-content">
        <h1 className="start-title">What Mile?</h1>
        <p className="start-subtitle">
          Five photos from the Appalachian Trail. Open the map, drop a pin where you think each one was taken.
        </p>
        <button className="btn-primary btn-large" onClick={onStart}>
          Start Free Play
        </button>
        <p className="start-hint">
          Random photos · Play as many rounds as you want
        </p>
        <div className="daily-nav">
          <a href="/daily" className="link-button">Try Daily Challenge →</a>
        </div>
      </div>
    </div>
  );
}
