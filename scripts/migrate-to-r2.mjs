/**
 * One-time migration: upload existing photos to R2 and populate Supabase.
 *
 * Reads src/data/images.json and for each entry:
 *   1. Uploads the file from public/images/ to R2 at approved/${filename}
 *   2. Inserts metadata into Supabase photos table
 *
 * Idempotent: safe to re-run. Uses upsert on Supabase and skips R2 upload if file exists.
 *
 * Usage:
 *   node scripts/migrate-to-r2.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: process.env.WHAT_MILE_ENV });

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Environment validation
const required = [
  'SUPABASE_SERVICE_KEY',
  'VITE_SUPABASE_URL',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'VITE_R2_PUBLIC_URL',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('Error: Missing required environment variables:');
  missing.forEach((key) => console.error(`  - ${key}`));
  console.error('\nEnsure your .env file at $WHAT_MILE_ENV contains all required values.');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY, // service key for write access
);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.VITE_R2_PUBLIC_URL;

// Load images.json
const imagesPath = join(__dirname, '../src/data/images.json');
const { images } = JSON.parse(readFileSync(imagesPath, 'utf8'));

console.log(`Found ${images.length} photos in images.json\n`);

let succeeded = 0;
let failed = 0;

for (const img of images) {
  const { id, filename, locationName, coordinates, description } = img;
  const [lat, lng] = coordinates;
  const r2Key = `approved/${filename}`;
  const r2Url = `${R2_PUBLIC_URL}/${r2Key}`;

  try {
    // Step 1: Upload to R2 (skip if already exists)
    const localPath = join(__dirname, '../public/images', filename);
    let r2Status = 'skipped (already exists)';

    try {
      await r2.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: r2Key,
        }),
      );
    } catch (headErr) {
      if (headErr.name === 'NotFound') {
        // File doesn't exist — upload it
        const fileBuffer = readFileSync(localPath);
        await r2.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: r2Key,
            Body: fileBuffer,
            ContentType: filename.endsWith('.jpg') || filename.endsWith('.jpeg') ? 'image/jpeg' : 'image/png',
          }),
        );
        r2Status = 'uploaded';
      } else {
        throw headErr; // unexpected error
      }
    }

    // Step 2: Upsert into Supabase
    const { error: dbError } = await supabase.from('photos').upsert(
      {
        id: randomUUID(),
        slug: id,
        filename,
        r2_url: r2Url,
        location_name: locationName,
        lat,
        lng,
        description: description || null,
        status: 'approved',
        source: 'owner',
      },
      { onConflict: 'filename' },
    );

    if (dbError) throw dbError;

    console.log(`✓ ${filename} → R2: ${r2Status}, DB: upserted`);
    succeeded++;
  } catch (err) {
    console.error(`✗ ${filename} → Error: ${err.message}`);
    failed++;
  }
}

console.log('');
console.log('Migration complete.');
console.log(`  ${succeeded} succeeded`);
console.log(`  ${failed} failed`);

if (failed > 0) {
  console.log('\nReview errors above and re-run if needed (script is idempotent).');
  process.exit(1);
}
