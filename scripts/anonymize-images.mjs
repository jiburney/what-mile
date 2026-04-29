/**
 * One-time migration: rename descriptive image filenames to UUID v4.
 *
 * - Reads src/data/images.json
 * - Skips entries whose filename already looks like a UUID
 * - Renames the file in public/images/ and updates images.json
 * - Idempotent: safe to run multiple times
 *
 * Usage:
 *   node scripts/anonymize-images.mjs
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_JSON = join(__dirname, '..', 'src', 'data', 'images.json');
const IMAGES_DIR = join(__dirname, '..', 'public', 'images');

// UUID v4 pattern — 8-4-4-4-12 hex chars separated by hyphens
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z]+$/i;

const imagesData = JSON.parse(readFileSync(IMAGES_JSON, 'utf8'));

let renamed = 0;
let skipped = 0;

for (const entry of imagesData.images) {
  const oldFilename = entry.filename;

  // Skip if already a UUID filename
  if (UUID_RE.test(oldFilename)) {
    console.log(`–  ${oldFilename} — already anonymized, skipping`);
    skipped++;
    continue;
  }

  const ext = extname(oldFilename).toLowerCase();
  const newFilename = `${randomUUID()}${ext}`;

  const oldPath = join(IMAGES_DIR, oldFilename);
  const newPath = join(IMAGES_DIR, newFilename);

  if (!existsSync(oldPath)) {
    console.warn(`⚠  ${oldFilename} — file not found in public/images/, skipping`);
    skipped++;
    continue;
  }

  renameSync(oldPath, newPath);
  entry.filename = newFilename;

  console.log(`✓  ${oldFilename} → ${newFilename}`);
  renamed++;
}

if (renamed > 0) {
  writeFileSync(IMAGES_JSON, JSON.stringify(imagesData, null, 2) + '\n');
  console.log(`\nDone. ${renamed} renamed, ${skipped} skipped. images.json updated.`);
} else {
  console.log(`\nDone. Nothing to rename (${skipped} already anonymized).`);
}
