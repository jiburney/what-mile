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
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { photoId } = req.body;
    if (!photoId) {
      return res.status(400).json({ error: 'Missing photoId' });
    }

    // Fetch photo from Supabase
    const { data: photo, error: fetchError } = await supabaseAdmin
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError || !photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Verify photo is approved
    if (photo.status !== 'approved') {
      return res.status(400).json({ error: 'Photo is not approved' });
    }

    // Copy from public bucket to private bucket (skip folder)
    try {
      await r2.send(
        new CopyObjectCommand({
          Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
          CopySource: `${process.env.R2_PUBLIC_BUCKET_NAME}/approved/${photo.filename}`,
          Key: `skip/${photo.filename}`,
          ContentType: 'image/webp',
        })
      );
    } catch (copyError) {
      console.error('R2 copy error:', copyError);
      return res.status(500).json({ error: 'Failed to copy photo to private storage' });
    }

    // Delete from public bucket
    try {
      await r2.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_PUBLIC_BUCKET_NAME,
          Key: `approved/${photo.filename}`,
        })
      );
    } catch (deleteError) {
      console.error('R2 delete error:', deleteError);
      // Don't fail the request if delete fails — the copy succeeded
      // The photo will just exist in both places temporarily
    }

    // Update Supabase (only after R2 operations succeed)
    const { error: updateError } = await supabaseAdmin
      .from('photos')
      .update({
        status: 'skip',
        r2_url: `skip/${photo.filename}`,
        is_private: true,
      })
      .eq('id', photoId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      throw updateError;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Remove photo error:', error);
    return res.status(500).json({ error: 'Failed to remove photo from game' });
  }
}
