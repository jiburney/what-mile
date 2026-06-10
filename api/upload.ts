import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import exifr from 'exifr';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './supabase-admin.js';
import { getTrailSection } from './trail-sections.js';

// IMPORTANT: Vercel's request body size limit for serverless functions is 4.5MB on Hobby plan.
// Photos larger than ~4MB must be compressed client-side before upload (use Canvas API to target ~3MB).

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

// Simple in-memory rate limiting: 20 uploads per IP per hour
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

// Infer location from image when no GPS data exists
async function inferLocation(imageBuffer: Buffer): Promise<{
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
}> {
  const base64Image = imageBuffer.toString('base64');

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
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
          text: `This is a photo from the Appalachian Trail. Analyze the image and provide:
1. A specific location name (state + landmark if identifiable, or general description)
2. Your best estimate of GPS coordinates (latitude, longitude)
3. A one-sentence description of what's visible

The AT runs from Georgia (lat ~34.6) to Maine (lat ~47.5), generally northeast along the spine of the Appalachian Mountains.

Respond with ONLY a JSON object:
{"locationName": "...", "lat": number, "lng": number, "description": "..."}

If you cannot determine coordinates confidently, use null for lat/lng.`,
        },
      ],
    }],
  });

  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return { locationName: null, lat: null, lng: null, description: null };
  }

  try {
    const cleanedJson = cleanJsonResponse(textContent.text);
    const parsed = JSON.parse(cleanedJson);

    // Validate coordinates are within AT bounding box
    const lat = parsed.lat;
    const lng = parsed.lng;

    if (lat !== null && lng !== null) {
      const inBounds = lat >= 34.6 && lat <= 47.5 && lng >= -84.2 && lng <= -66.9;
      if (!inBounds) {
        // Outside AT corridor — reject inference
        return { locationName: parsed.locationName || null, lat: null, lng: null, description: parsed.description || null };
      }
    }

    return {
      locationName: parsed.locationName || null,
      lat: lat || null,
      lng: lng || null,
      description: parsed.description || null,
    };
  } catch {
    return { locationName: null, lat: null, lng: null, description: null };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Maximum 20 uploads per hour.' });
  }

  let uploadedKey: string | null = null;

  try {
    // Parse multipart form data
    const form = formidable({ maxFileSize: 4.5 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const source = fields.source?.[0] as 'owner' | 'community' | undefined;
    if (!source || !['owner', 'community'].includes(source)) {
      return res.status(400).json({ error: 'Invalid or missing source field' });
    }

    const fileArray = files.file;
    if (!fileArray || fileArray.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = fileArray[0];
    const originalFilename = file.originalFilename || 'unknown';
    const fileSize = file.size;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only images allowed.' });
    }

    console.log(`Processing upload: ${originalFilename} (${fileSize} bytes)`);

    // Extract EXIF data BEFORE Sharp processing (Sharp strips EXIF)
    const exifData = await exifr.parse(file.filepath, {
      pick: ['latitude', 'longitude', 'DateTimeOriginal'],
    });

    let lat = exifData?.latitude ?? null;
    let lng = exifData?.longitude ?? null;
    const taken_at = exifData?.DateTimeOriginal ?? null;

    console.log(`EXIF: lat=${lat}, lng=${lng}, taken_at=${taken_at}`);

    // Process image: auto-rotate, resize, convert to WebP, strip EXIF
    const processed = await sharp(file.filepath)
      .rotate() // auto-rotate based on EXIF orientation
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Generate UUID filename
    const filename = `${crypto.randomUUID()}.webp`;
    uploadedKey = `pending/${filename}`;

    // Upload to R2 private bucket
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
        Key: uploadedKey,
        Body: processed,
        ContentType: 'image/webp',
      })
    );

    console.log(`Uploaded to R2: ${uploadedKey}`);

    // Run Haiku triage
    const { status: triageStatus, reason } = await triagePhoto(processed);
    console.log(`Triage result: ${triageStatus} - ${reason}`);

    // If no GPS coords, try to infer location from image
    let locationName: string | null = null;
    let description: string | null = null;

    if (lat === null || lng === null) {
      console.log('No GPS data, attempting location inference...');
      const inference = await inferLocation(processed);
      locationName = inference.locationName;
      lat = inference.lat;
      lng = inference.lng;
      description = inference.description;
      console.log(`Inference: ${locationName}, lat=${lat}, lng=${lng}`);
    }

    // Determine trail section
    const trail_section = lat !== null && lng !== null ? getTrailSection(lat, lng) : null;

    // Insert into Supabase
    const { data, error: dbError } = await supabaseAdmin
      .from('photos')
      .insert({
        filename,
        r2_url: uploadedKey,
        location_name: locationName || 'Unknown',
        lat,
        lng,
        taken_at: taken_at?.toISOString() ?? null,
        trail_section,
        description,
        status: triageStatus,
        source,
        is_private: true,
        times_shown: 0,
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
      throw dbError;
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

    return res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
}

// Disable body parser for multipart forms
export const config = {
  api: {
    bodyParser: false,
  },
};
