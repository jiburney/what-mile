export interface ImageConfig {
  id: string;
  filename: string;
  locationName: string;
  coordinates: [number, number]; // [lat, lng]
  description?: string;
  r2_url: string;
  taken_at?: string;        // EXIF timestamp (ISO 8601)
  trail_section?: string;   // State or named section (e.g. "Georgia")
  times_shown: number;      // How many times this photo has appeared in a game
  avg_score?: number;       // Running average score players get on this photo
  is_private: boolean;      // Whether photo is in private bucket (requires signed URL)
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

// Photo pipeline types (admin UI only)
export type PhotoStatus = 'pending' | 'review' | 'approved' | 'skip';
export type PhotoSource = 'owner' | 'community';

export interface AdminPhoto extends ImageConfig {
  status: PhotoStatus;
  source: PhotoSource;
  created_at: string;  // ISO 8601 timestamp
  slug?: string;       // Human-readable identifier (optional)
}
