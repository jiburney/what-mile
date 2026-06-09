import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as dotenv from 'dotenv';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './supabase-admin.js';

// Load env vars from .config folder when running locally
if (process.env.WHAT_MILE_ENV) {
  dotenv.config({ path: process.env.WHAT_MILE_ENV });
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

    // Run all three checks in parallel
    const results = await Promise.allSettled([
      // R2 check
      r2.send(
        new ListObjectsV2Command({
          Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
          MaxKeys: 1,
        })
      ),
      // Supabase check
      supabaseAdmin.from('photos').select('id', { count: 'exact', head: true }),
      // Anthropic check
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ]);

    // Extract statuses
    const r2Status = results[0].status === 'fulfilled' ? 'ok' : 'error';
    const supabaseStatus = results[1].status === 'fulfilled' ? 'ok' : 'error';

    let anthropicStatus: 'ok' | 'no_credits' | 'error' = 'ok';
    if (results[2].status === 'rejected') {
      const err = results[2].reason;
      // Check for 400 status (no credits)
      if (err && typeof err === 'object' && 'status' in err && err.status === 400) {
        anthropicStatus = 'no_credits';
      } else {
        anthropicStatus = 'error';
      }
    }

    return res.status(200).json({
      r2: r2Status,
      supabase: supabaseStatus,
      anthropic: anthropicStatus,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({ error: 'Health check failed', step: 'unknown' });
  }
}
