import { formatScore } from '../utils/scoring';

interface GameHeaderProps {
  title: string;
  roundsCompleted: number;
  currentRound: number; // 0-indexed
  totalRounds: number;
  score: number;
  modeLabel?: string; // e.g. "Daily Challenge" or "Free Play"
}

// Shared by GameScreen (mid-round and result states) and SummaryCard (the
// final summary). On the summary screen, callers pass roundsCompleted =
// totalRounds and currentRound = totalRounds - 1, which naturally produces
// "all pips done, Round {totalRounds} · {finalScore}" with no special-casing
// needed here — it's the exact same "just finished the last round" state
// this component already renders mid-game.
export function GameHeader({ title, roundsCompleted, currentRound, totalRounds, score, modeLabel }: GameHeaderProps) {
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
      <div className="header-score-group">
        {modeLabel && <span className="header-mode-label">{modeLabel}</span>}
        <span className="header-score">{formatScore(score)}</span>
      </div>
    </header>
  );
}
