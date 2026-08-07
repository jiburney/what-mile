import { useEffect, useRef, useState } from 'react';
import { useGame } from './hooks/useGame';
import { GameSummary } from './components/GameSummary';
import { GameScreen } from './components/GameScreen';
import { SummaryCard } from './components/SummaryCard';

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
    error,
  } = useGame();

  const { phase, currentImage, pendingGuess, currentRound, rounds } = state;

  const [veilDismissed, setVeilDismissed] = useState(false);
  const hasAutoStarted = useRef(false);

  // Auto-start on mount so the first photo is loading behind the entry veil.
  // Guarded against React StrictMode's dev-mode double-invoke.
  useEffect(() => {
    if (hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    startGame();
  }, [startGame]);

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

  if (phase === 'summary') {
    return (
      <SummaryCard totalRounds={totalRounds} totalScore={totalScore}>
        <GameSummary
          rounds={rounds}
          totalScore={totalScore}
          onPlayAgain={startGame}
          mode="free-play"
        />
      </SummaryCard>
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
        showEntryVeil={!veilDismissed}
        onDismissVeil={() => setVeilDismissed(true)}
        veilMode="free-play"
      />
    </div>
  );
}
