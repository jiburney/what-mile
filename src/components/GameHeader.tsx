interface GameHeaderProps {
  title: string;
  roundsCompleted: number;
  currentRound: number; // 0-indexed
  totalRounds: number;
  score: number;
}

// Shared by GameScreen (mid-round and result states) and SummaryCard (the
// final summary). On the summary screen, callers pass roundsCompleted =
// totalRounds and currentRound = totalRounds - 1, which naturally produces
// "all pips done, Round {totalRounds} · {finalScore}" with no special-casing
// needed here — it's the exact same "just finished the last round" state
// this component already renders mid-game.
export function GameHeader({ title, roundsCompleted, currentRound, totalRounds, score }: GameHeaderProps) {
  return (
    <header className="game-header">
      <span className="header-title">{title}</span>
      <div className="round-pips">
        {Array.from({ length: totalRounds }, (_, i) => (
          <span
            key={i}
            className={`round-pip ${
              i < roundsCompleted ? 'pip-done' : i === currentRound ? 'pip-active' : 'pip-future'
            }`}
          />
        ))}
      </div>
      <span className="header-score">Round {currentRound + 1} · {score.toLocaleString()}</span>
    </header>
  );
}
