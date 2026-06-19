import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as dotenv from 'dotenv';
import { supabaseAdmin } from './supabase-admin.js';
import { getCountyLocation } from './lib/geocode-county.js';

// Load env vars from .config folder when running locally
if (process.env.WHAT_MILE_ENV) {
  dotenv.config({ path: process.env.WHAT_MILE_ENV });
}

const BATCH_SIZE = 100; // Process this many photos per request to avoid timeout

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const action = req.query.action as string;

    // Route to appropriate handler based on action
    switch (action) {
      case 'fill-locations':
        return await handleFillLocations(req, res);
      case 'count-need-location':
        return await handleCountNeedLocation(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action. Supported: fill-locations, count-need-location' });
    }
  } catch (error) {
    console.error('Enrich error:', error);
    return res.status(500).json({ error: 'Failed to process enrichment action' });
  }
}

async function handleFillLocations(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch photos needing location (any status, with coords, missing or "Unknown" location)
    const { data: photos, error: fetchError } = await supabaseAdmin
      .from('photos')
      .select('id, lat, lng, location_name')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .or('location_name.is.null,location_name.eq.Unknown')
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch photos' });
    }

    if (!photos || photos.length === 0) {
      return res.status(200).json({
        processed: 0,
        remaining: 0,
        updated: 0,
      });
    }

    let updated = 0;

    // Process each photo
    for (const photo of photos) {
      const location = getCountyLocation(photo.lat, photo.lng);

      if (location) {
        // Update location_name
        const { error: updateError } = await supabaseAdmin
          .from('photos')
          .update({ location_name: location })
          .eq('id', photo.id);

        if (updateError) {
          console.error(`Failed to update photo ${photo.id}:`, updateError);
          // Continue processing others
        } else {
          updated++;
        }
      }
      // If location is null, skip (point outside all counties)
    }

    // Count remaining photos needing location
    const { count: remainingCount, error: countError } = await supabaseAdmin
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .or('location_name.is.null,location_name.eq.Unknown');

    const remaining = countError ? 0 : (remainingCount || 0);

    return res.status(200).json({
      processed: photos.length,
      remaining,
      updated,
    });
  } catch (error) {
    console.error('Fill locations error:', error);
    return res.status(500).json({ error: 'Failed to fill locations' });
  }
}

async function handleCountNeedLocation(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Count photos needing location
    const { count, error: countError } = await supabaseAdmin
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .or('location_name.is.null,location_name.eq.Unknown');

    if (countError) {
      console.error('Count error:', countError);
      return res.status(500).json({ error: 'Failed to count photos' });
    }

    return res.status(200).json({ count: count || 0 });
  } catch (error) {
    console.error('Count need location error:', error);
    return res.status(500).json({ error: 'Failed to count photos' });
  }
}
