import { formatScore, overallTier, MAX_SCORE, TIER_COLORS } from '../utils/scoring';

interface ScoreHeroProps {
  totalScore: number;
  mode: 'daily' | 'free-play';
  challengeDate?: string;
  totalDistance: number;
  bestRoundDist: string | null;
  bestRoundState: string | null;
}

// "July 24" from a YYYY-MM-DD challenge date — parsed as UTC midnight so the
// calendar day can't shift based on the viewer's local timezone.
function formatChallengeDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

// "Monday, October 12" for desktop eyebrow
function formatChallengeDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

export function ScoreHero({
  totalScore,
  mode,
  challengeDate,
  totalDistance,
  bestRoundDist,
  bestRoundState
}: ScoreHeroProps) {
  const tier = overallTier(totalScore);
  const pct = Math.round((totalScore / MAX_SCORE) * 100);

  return (
    <div className="score-hero">
      {mode === 'daily' && challengeDate && (
        <>
          <div className="score-hero-eyebrow score-hero-eyebrow-mobile">
            Daily Challenge · {formatChallengeDate(challengeDate)}
          </div>
          <div className="score-hero-eyebrow score-hero-eyebrow-desktop">
            Daily Challenge · {formatChallengeDateLong(challengeDate)}
          </div>
        </>
      )}

      <h2 className="score-hero-headline">You hiked like a {tier}.</h2>

      <div className="score-hero-score-row">
        <span className="score-hero-score">{formatScore(totalScore)}</span>
        <span className="score-hero-score-denom">/ {MAX_SCORE.toFixed(1)}</span>
      </div>

      <div className="score-hero-chips">
        <span className="score-hero-tier-chip" style={{ background: TIER_COLORS[tier] }}>
          {tier}
        </span>
        <span className="score-hero-accuracy">{pct}% accuracy</span>
      </div>

      <p className="score-hero-stats">
        Five photos, {totalDistance.toLocaleString()} miles off in total.
        {bestRoundDist && bestRoundState && ` Best round: ${bestRoundDist} in ${bestRoundState}.`}
      </p>
    </div>
  );
}
