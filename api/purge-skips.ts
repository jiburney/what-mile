import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { supabaseAdmin } from './supabase-admin.js';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
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

    // Fetch all skip photos
    const { data: skipPhotos, error: fetchError } = await supabaseAdmin
      .from('photos')
      .select('*')
      .eq('status', 'skip');

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      throw fetchError;
    }

    if (!skipPhotos || skipPhotos.length === 0) {
      return res.status(200).json({ success: true, deleted: 0 });
    }

    // Delete from R2 (handle missing files gracefully)
    for (const photo of skipPhotos) {
      try {
        await r2.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
            Key: photo.r2_url,
          })
        );
      } catch (r2Error) {
        console.error(`Failed to delete R2 object ${photo.r2_url}:`, r2Error);
        // Continue — file might already be deleted
      }
    }

    // Delete from Supabase
    const { error: deleteError } = await supabaseAdmin
      .from('photos')
      .delete()
      .eq('status', 'skip');

    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw deleteError;
    }

    return res.status(200).json({
      success: true,
      deleted: skipPhotos.length,
    });
  } catch (error) {
    console.error('Purge skips error:', error);
    return res.status(500).json({ error: 'Failed to purge skipped photos' });
  }
}
