import { useSearchParams } from 'react-router-dom';
import { GameSummary } from '../components/GameSummary';
import { SummaryCard } from '../components/SummaryCard';
import { calculateScore } from '../utils/scoring';
import type { ImageConfig, RoundResult } from '../types';

// Dev-only preview of the final summary screen — real photo data pulled from
// a live Supabase sample, so it exercises real coordinates/dates/images
// without needing to play a full 5-round game every time this screen is
// being iterated on. Never linked from anywhere in the app; only reachable
// by typing the URL directly, and the route itself is DEV-gated in main.tsx
// so it doesn't ship in the production build at all.

const MOCK_PHOTOS: Array<Omit<ImageConfig, 'times_shown' | 'is_private'>> = [
  {
    id: 'aaa7f1b7-adad-4247-a63f-f1e85b47287c',
    filename: '7f7ac51a-ef41-42b1-9164-d768f8c039ee.webp',
    r2_url: 'https://pub-068ac296c4464dd88c86ede80a2bdc0d.r2.dev/approved/7f7ac51a-ef41-42b1-9164-d768f8c039ee.webp',
    locationName: 'Carter County, TN',
    coordinates: [36.1237305556, -82.054275],
    description: 'Found this old red barn sitting on the ridge with a view for miles down the valley.',
    taken_at: '2023-05-10T18:38:43+00:00',
  },
  {
    id: '51153b7a-952a-4875-ac20-ad4e0c98e210',
    filename: 'b6189015-70e6-4474-ac67-6cbd9dae114a.webp',
    r2_url: 'https://pub-068ac296c4464dd88c86ede80a2bdc0d.r2.dev/approved/b6189015-70e6-4474-ac67-6cbd9dae114a.webp',
    locationName: 'Rutland County, VT',
    coordinates: [43.60455, -72.8185638889],
    description: 'Made it to a ridge with some killer views of the Green Mountains rolling out in every direction.',
    taken_at: '2023-08-18T15:01:13+00:00',
  },
  {
    id: '01e297fd-3ce5-4d7b-af80-605931092c92',
    filename: '55a2caf2-a915-46fe-9c5f-74338b74bdb4.webp',
    r2_url: 'https://pub-068ac296c4464dd88c86ede80a2bdc0d.r2.dev/approved/55a2caf2-a915-46fe-9c5f-74338b74bdb4.webp',
    locationName: 'Oxford County, ME',
    coordinates: [44.6153638889, -70.8921805556],
    description: 'Rock outcrop with a killer view stretching all the way to the mountains in the distance.',
    taken_at: '2023-09-07T15:37:33+00:00',
  },
  {
    id: 'fa3e6bab-85dd-4fc7-a0be-4f728655fc76',
    filename: 'eb9f4fc3-c7f0-44f9-a3c2-3233fa788493.webp',
    r2_url: 'https://pub-068ac296c4464dd88c86ede80a2bdc0d.r2.dev/approved/eb9f4fc3-c7f0-44f9-a3c2-3233fa788493.webp',
    locationName: 'Greene County, TN',
    coordinates: [36.0152333333, -82.7359083333],
    description: "Found this old shelter nestled in the woods—solid stone and wood construction that's held up better than most.",
    taken_at: '2023-05-03T19:38:51+00:00',
  },
  {
    id: '7d916a58-2477-48e7-ba53-229c801833e6',
    filename: '35996b21-1522-47ba-a6bd-e112bd591819.webp',
    r2_url: 'https://pub-068ac296c4464dd88c86ede80a2bdc0d.r2.dev/approved/35996b21-1522-47ba-a6bd-e112bd591819.webp',
    locationName: 'Graham County, NC',
    coordinates: [35.3314305556, -83.6666638889],
    description: 'Morning fog hanging thick through the bare trees on what felt like a never-ending climb.',
    taken_at: '2023-04-16T12:39:46+00:00',
  },
];

// Spread across tiers (short/mid/long/very-long/short) so all four TIER_COLORS
// and both narrow and wide "off by" values show up in one screen at once —
// deliberately more varied than any single real game would produce.
const MOCK_DISTANCES = [8, 45, 120, 310, 15];

function buildMockRounds(): RoundResult[] {
  return MOCK_PHOTOS.map((photo, i) => {
    const distanceMiles = MOCK_DISTANCES[i];
    const { score, tier } = calculateScore(distanceMiles);
    const image: ImageConfig = { ...photo, times_shown: 0, is_private: false };
    return {
      image,
      guess: image.coordinates,
      score,
      tier,
      distanceMiles,
    };
  });
}

export function SummaryPreview() {
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'daily' ? 'daily' : 'free-play';
  const rounds = buildMockRounds();
  const totalScore = rounds.reduce((sum, r) => sum + r.score, 0);

  return (
    <SummaryCard totalRounds={rounds.length} totalScore={totalScore}>
      <GameSummary
        rounds={rounds}
        totalScore={totalScore}
        onPlayAgain={() => {}}
        mode={mode}
        challengeDate={mode === 'daily' ? '2026-07-24' : undefined}
      />
    </SummaryCard>
  );
}
