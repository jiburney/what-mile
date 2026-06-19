import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as dotenv from 'dotenv';
import { supabaseAdmin } from './supabase-admin.js';

// Load env vars from .config folder when running locally
if (process.env.WHAT_MILE_ENV) {
  dotenv.config({ path: process.env.WHAT_MILE_ENV });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    console.error('Photos need location error:', error);
    return res.status(500).json({ error: 'Failed to count photos' });
  }
}
