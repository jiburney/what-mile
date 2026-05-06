import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabase-admin';

const VALID_STATUSES = ['pending', 'review', 'approved', 'skip'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check: verify Supabase session token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Missing or invalid authorization header.' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized. Invalid session token.' });
    }

    // Validate status parameter
    const status = req.query.status as string;
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    // Fetch photos with the given status
    const { data, error: dbError } = await supabaseAdmin
      .from('photos')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Failed to fetch photos' });
    }

    // Map database rows to AdminPhoto format
    const photos = data.map((row) => ({
      id: row.id,
      filename: row.filename,
      locationName: row.location_name,
      coordinates: [row.lat, row.lng],
      description: row.description ?? undefined,
      r2_url: row.r2_url,
      taken_at: row.taken_at ?? undefined,
      trail_section: row.trail_section ?? undefined,
      times_shown: row.times_shown,
      avg_score: row.avg_score ?? undefined,
      is_private: row.is_private,
      status: row.status,
      source: row.source,
      created_at: row.created_at,
      slug: row.slug ?? undefined,
    }));

    return res.status(200).json(photos);
  } catch (error) {
    console.error('Photos API error:', error);
    return res.status(500).json({ error: 'Failed to fetch photos' });
  }
}
