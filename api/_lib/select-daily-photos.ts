import { supabaseAdmin } from './supabase-admin.js';

interface Photo {
  id: string;
  lat: number;
  lng: number;
  filename: string;
  location_name: string;
  description?: string;
  r2_url: string;
  times_shown: number;
  is_private: boolean;
  taken_at?: string;
}

/**
 * Select 5 photos for a daily challenge using deterministic seeded random.
 *
 * Rules:
 * 1. Only approved photos
 * 2. Pure random (no section weighting) - seeded by date, same for everyone
 * 3. 1-mile minimum distance between any two photos in the set
 * 4. 60-day cooldown (photos used in last 60 days are excluded)
 *
 * The random pool + 1-mile distance filtering happens inside Postgres via
 * select_game_photos — the same function free-play uses (without a seed or
 * cooldown). Keeping selection in one place means both modes stay in sync
 * and neither is limited by PostgREST's default 1000-row response cap,
 * since the candidate scan happens inside the function, not over the API.
 */
export async function selectDailyPhotos(challengeDate: string): Promise<Photo[]> {
  // Calculate cooldown cutoff date (60 days before challenge date)
  const dateObj = new Date(challengeDate + 'T00:00:00Z');
  const cutoffDate = new Date(dateObj);
  cutoffDate.setDate(cutoffDate.getDate() - 60);
  const cutoffISO = cutoffDate.toISOString();

  // Deterministic seed derived from the date, so every player gets the same
  // 5 photos on the same day. Postgres setseed() requires a value in [-1, 1].
  const seed = dateStringToSeed(challengeDate);

  const { data: selected, error } = await supabaseAdmin.rpc('select_game_photos', {
    p_count: 5,
    p_min_distance_miles: 1.0,
    p_seed: seed,
    p_cooldown_cutoff: cutoffISO,
  });

  if (error) {
    throw new Error(`Failed to select daily photos: ${error.message}`);
  }

  if (!selected || selected.length < 5) {
    throw new Error(`Could not select 5 photos with 1-mile constraint: only ${selected?.length || 0} found`);
  }

  // Update last_daily_used_at for selected photos
  const { error: updateError } = await supabaseAdmin
    .from('photos')
    .update({ last_daily_used_at: new Date(challengeDate + 'T00:00:00-05:00').toISOString() })
    .in('id', selected.map((p: Photo) => p.id));

  if (updateError) {
    console.error('Failed to update last_daily_used_at:', updateError);
    // Don't throw - selection was successful, cooldown update is non-critical
  }

  return selected as Photo[];
}

/** Deterministic seed in Postgres setseed() range [-1, 1], derived from a date string */
function dateStringToSeed(dateString: string): number {
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    hash = (hash << 5) - hash + dateString.charCodeAt(i);
    hash |= 0; // force 32-bit int
  }
  return (Math.abs(hash) % 2_000_000) / 1_000_000 - 1;
}
