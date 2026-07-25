import { useGame } from './hooks/useGame';
import { StartScreen } from './components/StartScreen';
import { GameSummary } from './components/GameSummary';
import { GameScreen } from './components/GameScreen';

export default function App() {
  const {
    state,
    currentResult,
    totalScore,
    totalRounds,
    nextImage,
    startGame,
    setGuess,
    lockInGuess,
    nextRound,
    loading,
    error,
  } = useGame();

  const { phase, currentImage, pendingGuess, currentRound, rounds } = state;

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

  return (
    <div className="app-layout">
      <GameScreen
        phase={phase}
        currentImage={currentImage}
        pendingGuess={pendingGuess}
        currentRound={currentRound}
        rounds={rounds}
        currentResult={currentResult}
        totalScore={totalScore}
        totalRounds={totalRounds}
        nextImage={nextImage}
        setGuess={setGuess}
        lockInGuess={lockInGuess}
        nextRound={nextRound}
      />
    </div>
  );
}
