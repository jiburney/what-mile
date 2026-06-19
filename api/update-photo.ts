import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './lib/supabase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', step: 'auth' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized', step: 'auth' });
    }

    const { photoId, description, status } = req.body;
    if (!photoId) {
      return res.status(400).json({ error: 'Missing photoId', step: 'validation' });
    }

    // Build update object
    const updates: Record<string, any> = {};
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update', step: 'validation' });
    }

    // Update photo
    const { error: updateError } = await supabaseAdmin
      .from('photos')
      .update(updates)
      .eq('id', photoId);

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Database update failed', step: 'db_update' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Update photo error:', error);
    return res.status(500).json({ error: 'Failed to update photo', step: 'unknown' });
  }
}
