import { useGame } from './hooks/useGame';
import { StartScreen } from './components/StartScreen';
import { GameMap } from './components/GameMap';
import { RoundResult } from './components/RoundResult';
import { GameSummary } from './components/GameSummary';

export default function App() {
  const {
    state,
    currentResult,
    totalScore,
    totalRounds,
    startGame,
    setGuess,
    lockInGuess,
    nextRound,
    loading,
    error,
  } = useGame();

  const { phase, currentImage, pendingGuess, currentRound, rounds } = state;
  const isLastRound = currentRound + 1 >= totalRounds;

  // Loading state
  if (loading) {
    return (
      <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Loading photos...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#d32f2f' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Error loading photos</div>
          <div style={{ fontSize: '1rem' }}>{error}</div>
        </div>
      </div>
    );
  }

  if (phase === 'start') {
    return <StartScreen onStart={startGame} />;
  }

  if (phase === 'summary') {
    return (
      <div className="app-layout">
        <GameSummary
          rounds={rounds}
          totalScore={totalScore}
          onPlayAgain={startGame}
        />
      </div>
    );
  }

  const showResult = phase === 'result';

  return (
    <div className="app-layout">
      {/* Header bar */}
      <header className="game-header">
        <div className="game-header-left">
          <span className="header-title">What Mile?</span>
        </div>
        <div className="game-header-center">
          <div className="round-pips">
            {Array.from({ length: totalRounds }, (_, i) => (
              <span
                key={i}
                className={`round-pip ${
                  i < rounds.length ? 'pip-done' : i === currentRound ? 'pip-active' : 'pip-future'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="game-header-right">
          <span className="header-score">{totalScore.toLocaleString()}</span>
        </div>
      </header>

      {/* Photo */}
      {currentImage && (
        <div className="photo-area">
          <img
            src={currentImage.r2_url}
            alt=""
            className="photo-bg"
          />
          <img
            src={currentImage.r2_url}
            alt="Somewhere on the Appalachian Trail"
            className="trail-photo"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="photo-round-badge">
            Round {currentRound + 1} / {totalRounds}
          </div>
        </div>
      )}

      {/* Map */}
      <div className="map-area">
        <GameMap
          onGuess={setGuess}
          pendingGuess={pendingGuess}
          actualLocation={showResult ? currentResult?.image.coordinates : undefined}
          actualName={showResult ? currentResult?.image.locationName : undefined}
          showResult={showResult}
        />
        {!showResult && (
          <div className="map-overlay-bottom">
            {pendingGuess ? (
              <button className="btn-primary btn-lock" onClick={lockInGuess}>
                Lock In Guess
              </button>
            ) : (
              <div className="map-hint">Tap the trail to drop your pin</div>
            )}
          </div>
        )}
      </div>

      {/* Result panel */}
      {showResult && currentResult && (
        <RoundResult
          result={currentResult}
          roundNumber={currentRound + 1}
          totalRounds={totalRounds}
          totalScore={totalScore}
          onNext={nextRound}
          isLastRound={isLastRound}
        />
      )}
    </div>
  );
}
