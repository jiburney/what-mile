import { supabaseAdmin } from './supabase-admin.js';
import { createSeededRandom } from './seeded-random.js';
import { distanceMiles } from './distance.js';

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
 * Select 5 photos for a daily challenge using deterministic seeded random
 *
 * Rules:
 * 1. Only approved photos
 * 2. Pure random (no section weighting) - seeded by date
 * 3. 1-mile minimum distance between any two photos in the set
 * 4. 60-day cooldown (photos used in last 60 days are excluded)
 */
export async function selectDailyPhotos(challengeDate: string): Promise<Photo[]> {
  // Calculate cooldown cutoff date (60 days before challenge date)
  const dateObj = new Date(challengeDate + 'T00:00:00Z');
  const cutoffDate = new Date(dateObj);
  cutoffDate.setDate(cutoffDate.getDate() - 60);
  const cutoffISO = cutoffDate.toISOString();

  // Fetch eligible photos (approved + either never used or last used > 60 days ago)
  const { data: eligiblePhotos, error } = await supabaseAdmin
    .from('photos')
    .select('id, lat, lng, filename, location_name, description, r2_url, times_shown, is_private, taken_at')
    .eq('status', 'approved')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .or(`last_daily_used_at.is.null,last_daily_used_at.lt.${cutoffISO}`);

  if (error) {
    throw new Error(`Failed to fetch eligible photos: ${error.message}`);
  }

  if (!eligiblePhotos || eligiblePhotos.length < 5) {
    throw new Error(`Insufficient photos for daily challenge: only ${eligiblePhotos?.length || 0} available`);
  }

  // Create seeded random generator from challenge date
  const rng = createSeededRandom(challengeDate);

  // Shuffle with seeded randomness
  const shuffled = rng.shuffle(eligiblePhotos);

  // Greedy selection with 1-mile minimum distance constraint
  const selected: Photo[] = [];

  for (const candidate of shuffled) {
    if (selected.length >= 5) break;

    // Check distance to all already-selected photos
    const tooClose = selected.some(photo =>
      distanceMiles(candidate.lat, candidate.lng, photo.lat, photo.lng) < 1.0
    );

    if (!tooClose) {
      selected.push(candidate as Photo);
    }
  }

  if (selected.length < 5) {
    throw new Error(`Could not select 5 photos with 1-mile constraint: only ${selected.length} found`);
  }

  // Update last_daily_used_at for selected photos
  const { error: updateError } = await supabaseAdmin
    .from('photos')
    .update({ last_daily_used_at: new Date(challengeDate + 'T00:00:00-05:00').toISOString() })
    .in('id', selected.map(p => p.id));

  if (updateError) {
    console.error('Failed to update last_daily_used_at:', updateError);
    // Don't throw - selection was successful, cooldown update is non-critical
  }

  return selected;
}
