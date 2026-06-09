import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as dotenv from 'dotenv';
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { supabaseAdmin } from './supabase-admin.js';

// Load env vars from .config folder when running locally
if (process.env.WHAT_MILE_ENV) {
  dotenv.config({ path: process.env.WHAT_MILE_ENV });
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
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

    const { photoId } = req.body;
    if (!photoId) {
      return res.status(400).json({ error: 'Missing photoId', step: 'validation' });
    }

    // Fetch photo from Supabase
    const { data: photo, error: fetchError } = await supabaseAdmin
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError || !photo) {
      return res.status(404).json({ error: 'Photo not found', step: 'db_fetch' });
    }

    // Only pending or review photos can be skipped via this endpoint.
    // Approved → skip flows through remove-photo.ts (different bucket).
    if (photo.status !== 'pending' && photo.status !== 'review') {
      return res.status(400).json({
        error: `Cannot skip a photo with status '${photo.status}'`,
        step: 'validation',
      });
    }

    const sourceKey: string = photo.r2_url;
    if (!sourceKey || typeof sourceKey !== 'string') {
      return res.status(400).json({ error: 'Invalid r2_url on photo row', step: 'validation' });
    }

    const destKey = `skip/${photo.filename}`;

    // Idempotent safety: if the file is already at the destination, skip the
    // copy+delete (a self-copy followed by a delete would erase the file).
    if (sourceKey !== destKey) {
      try {
        await r2.send(
          new CopyObjectCommand({
            Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
            CopySource: `${process.env.R2_PRIVATE_BUCKET_NAME}/${sourceKey}`,
            Key: destKey,
            ContentType: 'image/webp',
          })
        );
      } catch (copyError) {
        console.error('R2 copy error:', copyError);
        return res.status(500).json({ error: 'Failed to move photo to skip folder', step: 'r2_copy' });
      }

      // Delete the source. Mirrors remove-photo.ts: if this fails the copy
      // already succeeded, so we log and continue rather than fail the request.
      try {
        await r2.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
            Key: sourceKey,
          })
        );
      } catch (deleteError) {
        console.error('R2 delete error:', deleteError);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('photos')
      .update({
        status: 'skip',
        r2_url: destKey,
      })
      .eq('id', photoId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({ error: 'Database update failed', step: 'db_update' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Skip photo error:', error);
    return res.status(500).json({ error: 'Failed to skip photo', step: 'unknown' });
  }
}
