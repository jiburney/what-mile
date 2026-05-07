#!/usr/bin/env node
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { homedir } from 'os';
import { join } from 'path';

// Load from centralized config directory
config({ path: join(homedir(), 'dev', '.config', 'what-mile', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Determine which AT section (US state) a photo is in based on GPS coordinates
function getTrailSection(lat, lng) {
  if (lat >= 34.6 && lat < 35.1) return 'Georgia';

  if (lat >= 35.1 && lat < 36.6) {
    return lng < -83.0 ? 'Tennessee' : 'North Carolina';
  }

  if (lat >= 36.6 && lat < 39.3) return 'Virginia';
  if (lat >= 39.3 && lat < 39.5) return 'West Virginia';
  if (lat >= 39.5 && lat < 39.75) return 'Maryland';
  if (lat >= 39.75 && lat < 41.0) return 'Pennsylvania';
  if (lat >= 41.0 && lat < 41.2) return 'New Jersey';
  if (lat >= 41.2 && lat < 41.9) return 'New York';
  if (lat >= 41.9 && lat < 42.1) return 'Connecticut';
  if (lat >= 42.1 && lat < 42.75) return 'Massachusetts';

  if (lat >= 42.75 && lat < 45.0) {
    return lat < 44.0 ? 'Vermont' : (lng < -72.0 ? 'Vermont' : 'New Hampshire');
  }

  if (lat >= 44.0 && lat < 45.3) return 'New Hampshire';
  if (lat >= 45.1 && lat <= 47.5) return 'Maine';

  return 'Unknown';
}

async function backfillMetadata() {
  console.log('Fetching approved photos...');

  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, lat, lng, trail_section, times_shown, is_private')
    .eq('status', 'approved');

  if (error) {
    console.error('Error fetching photos:', error);
    process.exit(1);
  }

  console.log(`Found ${photos.length} approved photos`);

  let updated = 0;

  for (const photo of photos) {
    const updates = {};

    // Calculate trail_section if missing but coordinates exist
    if (!photo.trail_section && photo.lat !== null && photo.lng !== null) {
      updates.trail_section = getTrailSection(photo.lat, photo.lng);
      console.log(`Photo ${photo.id}: calculated trail_section = ${updates.trail_section}`);
    }

    // Set times_shown default if null
    if (photo.times_shown === null) {
      updates.times_shown = 0;
    }

    // Set is_private default if null (approved photos are in public bucket)
    if (photo.is_private === null) {
      updates.is_private = false;
    }

    // Update if there are changes
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('photos')
        .update(updates)
        .eq('id', photo.id);

      if (updateError) {
        console.error(`Error updating photo ${photo.id}:`, updateError);
      } else {
        updated++;
      }
    }
  }

  console.log(`\nBackfill complete! Updated ${updated} of ${photos.length} photos.`);
}

backfillMetadata().catch(console.error);
