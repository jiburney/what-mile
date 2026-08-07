import { GameHeader } from './GameHeader';

interface SummaryCardProps {
  children: React.ReactNode;
  totalRounds: number;
  totalScore: number;
  headerTitle?: string;
}

// Wraps the summary screen in the same persistent header the rest of the
// game uses. roundsCompleted = totalRounds and currentRound = totalRounds - 1
// reuse GameHeader's existing "just finished the last round" state exactly
// as-is — every pip reads done, score reads the real final total.
export function SummaryCard({ children, totalRounds, totalScore, headerTitle = 'What Mile?' }: SummaryCardProps) {
  return (
    <div className="game-screen">
      <GameHeader
        title={headerTitle}
        roundsCompleted={totalRounds}
        currentRound={totalRounds - 1}
        totalRounds={totalRounds}
        score={totalScore}
      />
      {children}
    </div>
  );
}
