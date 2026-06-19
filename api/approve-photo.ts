import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as dotenv from 'dotenv';
import { S3Client, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './lib/supabase-admin.js';

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

    // Generate description via Haiku
    let description: string | null = null;
    try {
      // Fetch image from R2 private bucket
      const getObjectResponse = await r2.send(
        new GetObjectCommand({
          Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
          Key: photo.r2_url,
        })
      );

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      if (getObjectResponse.Body) {
        for await (const chunk of getObjectResponse.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
      }
      const imageBuffer = Buffer.concat(chunks);

      // Call Haiku
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/webp',
                  data: imageBuffer.toString('base64'),
                },
              },
              {
                type: 'text',
                text: `You're an AT thru-hiker writing a short caption for a photo in your trail journal. This photo was taken near ${photo.location_name}. Write 1-2 casual, grounded sentences describing what's in the photo — focus on what a hiker would actually notice: the trail, the terrain, the weather, the view. Avoid botanical language. Sound human, not like a nature guide. Return ONLY the caption, no quotes or extra text.`,
              },
            ],
          },
        ],
      });

      const textContent = message.content.find((block) => block.type === 'text');
      if (textContent && textContent.type === 'text') {
        description = textContent.text.trim();
      }
    } catch (descriptionError) {
      console.error('Failed to generate description:', descriptionError);
      // Continue with approval — missing description is better than failed approval
    }

    // Copy from private bucket to public bucket
    try {
      await r2.send(
        new CopyObjectCommand({
          Bucket: process.env.R2_PUBLIC_BUCKET_NAME,
          CopySource: `${process.env.R2_PRIVATE_BUCKET_NAME}/${photo.r2_url}`,
          Key: `approved/${photo.filename}`,
          ContentType: 'image/webp',
        })
      );
    } catch (copyError) {
      console.error('R2 copy error:', copyError);
      return res.status(500).json({ error: 'Failed to copy photo to public storage', step: 'r2_copy' });
    }

    // Update Supabase
    const publicUrl = `${process.env.VITE_R2_PUBLIC_URL}/approved/${photo.filename}`;
    const { error: updateError } = await supabaseAdmin
      .from('photos')
      .update({
        status: 'approved',
        r2_url: publicUrl,
        is_private: false,
        description,
      })
      .eq('id', photoId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({ error: 'Database update failed', step: 'db_update' });
    }

    // Delete from private bucket
    await r2.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
        Key: photo.r2_url,
      })
    );

    return res.status(200).json({
      success: true,
      description,
    });
  } catch (error) {
    console.error('Approve photo error:', error);
    return res.status(500).json({ error: 'Failed to approve photo', step: 'unknown' });
  }
}
