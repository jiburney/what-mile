import type { RoundResult, TierName } from '../types';

const STORAGE_KEY = 'what-mile-daily-challenge';

export interface DailyChallengeState {
  clientFingerprint: string;     // UUID, generated once, persists forever
  lastPlayedDate: string;         // YYYY-MM-DD
  challengeId: string;            // Today's challenge UUID
  completedRounds: RoundResult[]; // Mid-game resume
  finalScore?: {
    total: number;
    tier: TierName;
    playerName?: string;
    yearHiked?: number;
  };
}

/**
 * Generate a unique client fingerprint (one-time, persists in localStorage)
 */
function generateFingerprint(): string {
  return crypto.randomUUID();
}

/**
 * Get or create client fingerprint
 */
export function getClientFingerprint(): string {
  const state = getDailyChallengeState();
  if (state?.clientFingerprint) {
    return state.clientFingerprint;
  }

  const fingerprint = generateFingerprint();
  saveDailyChallengeState({ clientFingerprint: fingerprint });
  return fingerprint;
}

/**
 * Get today's date in Eastern timezone as YYYY-MM-DD
 */
export function getTodayEastern(): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;

  return `${year}-${month}-${day}`;
}

/**
 * Load daily challenge state from localStorage
 */
export function getDailyChallengeState(): DailyChallengeState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load daily challenge state:', error);
    return null;
  }
}

/**
 * Save daily challenge state to localStorage
 */
export function saveDailyChallengeState(updates: Partial<DailyChallengeState>): void {
  try {
    const current = getDailyChallengeState() || {
      clientFingerprint: generateFingerprint(),
      lastPlayedDate: '',
      challengeId: '',
      completedRounds: [],
    };

    const updated = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save daily challenge state:', error);
  }
}

/**
 * Clear daily challenge state (used when starting a new day's challenge)
 */
export function clearDailyChallengeGame(): void {
  const fingerprint = getClientFingerprint();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    clientFingerprint: fingerprint,
    lastPlayedDate: '',
    challengeId: '',
    completedRounds: [],
  }));
}

/**
 * Check if user can play today's challenge
 */
export function canPlayToday(): boolean {
  const state = getDailyChallengeState();
  const today = getTodayEastern();

  // Never played, or played different day → can play
  if (!state || state.lastPlayedDate !== today) return true;

  // Started but didn't finish → can resume (not replay)
  if (!state.finalScore) return true;

  // Finished today → cannot replay
  return false;
}
