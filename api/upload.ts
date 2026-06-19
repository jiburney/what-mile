import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import exifr from 'exifr';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './lib/supabase-admin.js';
import { getTrailSection } from './lib/trail-sections.js';
import { getCountyLocation } from './lib/geocode-county.js';

// IMPORTANT: Vercel's request body size limit for serverless functions is 4.5MB on Hobby plan.
// Photos larger than ~4MB must be compressed client-side before upload (use Canvas API to target ~3MB).

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 4,
});

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Retry helper for transient failures
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  shouldRetry: (err: unknown) => boolean
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!shouldRetry(err) || attempt === maxRetries) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Unreachable');
}

function isTransientError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    return status === 429 || status >= 500;
  }
  return true; // Retry unknown/network errors
}

// Simple in-memory rate limiting
const MAX_UPLOADS_PER_HOUR = 500;
const uploadCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = uploadCounts.get(ip);

  if (!record || now > record.resetAt) {
    uploadCounts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (record.count >= 500) return false;

  record.count++;
  return true;
}

// Strip markdown code fences from JSON response
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  // Remove ```json ... ``` or ``` ... ``` wrappers
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

// Haiku triage classification
async function triagePhoto(imageBuffer: Buffer): Promise<{ status: string; reason: string }> {
  const base64Image = imageBuffer.toString('base64');

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/webp',
            data: base64Image,
          },
        },
        {
          type: 'text',
          text: `You are triaging photos for an Appalachian Trail guessing game called What Mile?

Classify this photo into exactly one of three categories:

READY — Clear AT experience with a recognizable location. Good quality. No people visible. Includes: trail, shelters, viewpoints, trail towns, hostels, road crossings, resupply stops, signs, scenic views.

REVIEW — Needs human review before publishing. Use for: any photo containing people or faces (even partial, even far away), interesting wildlife, ambiguous content that might be AT-related, low but usable quality.

SKIP — Not suitable for the game. Use for: blurry beyond use, completely dark/overexposed, screenshots, food closeups with no trail context, clearly not AT-related content.

Respond with ONLY a JSON object, no markdown, no explanation:
{"status": "ready"|"review"|"skip", "reason": "one sentence explanation"}`,
        },
      ],
    }],
  });

  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Haiku');
  }

  const cleanedJson = cleanJsonResponse(textContent.text);
  const parsed = JSON.parse(cleanedJson);

  // Map Haiku status to Supabase status
  const statusMap: Record<string, string> = {
    ready: 'pending',
    review: 'review',
    skip: 'skip',
  };

  return {
    status: statusMap[parsed.status] || 'skip',
    reason: parsed.reason,
  };
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: `Rate limit exceeded. Maximum ${MAX_UPLOADS_PER_HOUR} uploads per hour.`, step: 'validation' });
  }

  let uploadedKey: string | null = null;

  try {
    // Parse multipart form data
    const form = formidable({ maxFileSize: 4.5 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const source = fields.source?.[0] as 'owner' | 'community' | undefined;
    if (!source || !['owner', 'community'].includes(source)) {
      return res.status(400).json({ error: 'Invalid or missing source field', step: 'validation' });
    }

    // Check for duplicate via content hash
    const contentHash = fields.content_hash?.[0];
    if (contentHash) {
      const { data: existing } = await supabaseAdmin
        .from('photos')
        .select('id')
        .eq('content_hash', contentHash)
        .maybeSingle();

      if (existing) {
        console.log(`Duplicate detected: content_hash=${contentHash}`);
        return res.status(200).json({
          success: true,
          status: 'duplicate',
          message: 'Already uploaded',
        });
      }
    }

    const fileArray = files.file;
    if (!fileArray || fileArray.length === 0) {
      return res.status(400).json({ error: 'No file uploaded', step: 'validation' });
    }

    const file = fileArray[0];
    const originalFilename = file.originalFilename || 'unknown';
    const fileSize = file.size;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only images allowed.', step: 'validation' });
    }

    console.log(`Processing upload: ${originalFilename} (${fileSize} bytes)`);

    // Prefer client-side EXIF extraction (from original file before compression)
    let lat: number | null = null;
    let lng: number | null = null;
    let taken_at: Date | null = null;

    const clientLat = parseFloat(fields.lat?.[0] || '');
    const clientLng = parseFloat(fields.lng?.[0] || '');
    const clientTakenAt = fields.taken_at?.[0];

    if (Number.isFinite(clientLat)) lat = clientLat;
    if (Number.isFinite(clientLng)) lng = clientLng;
    if (clientTakenAt) taken_at = new Date(clientTakenAt);

    // Fallback: server-side EXIF extraction when client didn't provide coords
    if (lat === null || lng === null || taken_at === null) {
      const exifData = await exifr.parse(file.filepath, {
        pick: ['latitude', 'longitude', 'DateTimeOriginal'],
      });

      if (lat === null) lat = exifData?.latitude ?? null;
      if (lng === null) lng = exifData?.longitude ?? null;
      if (taken_at === null) taken_at = exifData?.DateTimeOriginal ?? null;
    }

    console.log(`GPS: lat=${lat}, lng=${lng}, taken_at=${taken_at}`);

    // Skip photos without GPS data
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.log('No GPS data — skipping upload');
      return res.status(200).json({
        status: 'skip',
        message: 'No GPS data — skipped',
      });
    }

    // Process image: auto-rotate, resize, convert to WebP, strip EXIF
    let processed: Buffer;
    try {
      processed = await sharp(file.filepath)
        .rotate() // auto-rotate based on EXIF orientation
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (sharpError) {
      console.error('Sharp processing error:', sharpError);
      return res.status(500).json({ error: 'Image processing failed', step: 'sharp' });
    }

    // Generate UUID filename
    const filename = `${crypto.randomUUID()}.webp`;
    uploadedKey = `pending/${filename}`;

    // Upload to R2 private bucket
    try {
      await r2.send(
        new PutObjectCommand({
          Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
          Key: uploadedKey,
          Body: processed,
          ContentType: 'image/webp',
        })
      );
      console.log(`Uploaded to R2: ${uploadedKey}`);
    } catch (r2Error) {
      console.error('R2 upload error:', r2Error);
      return res.status(500).json({ error: 'Storage upload failed', step: 'r2_upload' });
    }

    // Run Haiku triage with retry and fallback
    let triageStatus = 'review';
    let reason = 'Triage skipped (rate limited) — needs manual review';
    try {
      const result = await withRetry(
        () => triagePhoto(processed),
        2,
        isTransientError
      );
      triageStatus = result.status;
      reason = result.reason;
      console.log(`Triage result: ${triageStatus} - ${reason}`);
    } catch (triageError) {
      console.error('Triage failed, defaulting to review:', triageError);
    }

    // Determine trail section and county location
    const trail_section = lat !== null && lng !== null ? getTrailSection(lat, lng) : null;
    const location_name = lat !== null && lng !== null ? (getCountyLocation(lat, lng) ?? 'Unknown') : 'Unknown';

    // Insert into Supabase
    const { data, error: dbError } = await supabaseAdmin
      .from('photos')
      .insert({
        filename,
        r2_url: uploadedKey,
        location_name,
        lat,
        lng,
        taken_at: taken_at?.toISOString() ?? null,
        trail_section,
        description: null,
        status: triageStatus,
        triage_reason: reason,
        source,
        is_private: true,
        times_shown: 0,
        content_hash: contentHash || null,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      // Clean up R2 upload
      await r2.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
          Key: uploadedKey,
        })
      );
      return res.status(500).json({ error: 'Database insert failed', step: 'db_insert' });
    }

    console.log(`Success: photo ${data.id} created with status ${triageStatus}`);

    return res.status(200).json({
      success: true,
      photoId: data.id,
      status: triageStatus,
      message: `Photo uploaded and triaged as ${triageStatus}`,
    });
  } catch (error) {
    console.error('Upload error:', error);

    // Cleanup attempt if R2 upload succeeded but something else failed
    if (uploadedKey) {
      try {
        await r2.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
            Key: uploadedKey,
          })
        );
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    return res.status(500).json({ error: 'Upload failed. Please try again.', step: 'unknown' });
  }
}

// Disable body parser for multipart forms
export const config = {
  api: {
    bodyParser: false,
  },
};
