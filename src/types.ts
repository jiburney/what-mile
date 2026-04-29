export interface ImageConfig {
  id: string;
  filename: string;
  locationName: string;
  coordinates: [number, number]; // [lat, lng]
  description?: string;
}

export interface RoundResult {
  image: ImageConfig;
  guess: [number, number];
  score: number;
  tier: TierName;
  distanceMiles: number;
}

export type TierName = 'Thru-Hiker' | 'LASHer' | 'Section Hiker' | 'Day Hiker';

export type GamePhase = 'start' | 'guessing' | 'result' | 'summary';

export interface GameState {
  phase: GamePhase;
  rounds: RoundResult[];
  currentRound: number;
  currentImage: ImageConfig | null;
  pendingGuess: [number, number] | null;
}
