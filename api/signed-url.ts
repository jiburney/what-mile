import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as dotenv from 'dotenv';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

    // Get the R2 object key from query params
    const key = req.query.key as string;
    if (!key) {
      return res.status(400).json({ error: 'Missing key parameter' });
    }

    // Generate signed URL (expires in 1 hour)
    const url = await getSignedUrl(
      r2,
      new GetObjectCommand({
        Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
        Key: key,
      }),
      { expiresIn: 3600 }
    );

    return res.status(200).json({ url });
  } catch (error) {
    console.error('Signed URL error:', error);
    return res.status(500).json({ error: 'Failed to generate signed URL' });
  }
}
