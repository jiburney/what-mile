/**
 * Automated photo ingestion for What Mile.
 *
 * For each photo:
 *   1. Extracts GPS coordinates from EXIF (exifr)
 *   2. Reverse-geocodes a location name (Nominatim, free)
 *   3. Optionally generates a description via Claude vision (--descriptions flag)
 *   4. Falls back to Claude vision for photos with no GPS data
 *   5. Copies photo to public/images/ and appends entry to src/data/images.json
 *
 * Usage:
 *   node scripts/ingest-photos.mjs --folder ~/Desktop/trail-photos/
 *   node scripts/ingest-photos.mjs --files ~/a.jpg ~/b.jpg
 *   node scripts/ingest-photos.mjs --folder ~/photos/ --descriptions
 */

import dotenv from 'dotenv';
dotenv.config({ path: process.env.WHAT_MILE_ENV });
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import exifr from 'exifr';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_JSON = join(__dirname, '..', 'src', 'data', 'images.json');
const INGESTED_JSON = join(__dirname, '..', 'src', 'data', 'ingested.json');
const IMAGES_DIR = join(__dirname, '..', 'public', 'images');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.tiff', '.tif', '.webp']);
const CLAUDE_SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const STATE_ABBR = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK',
  Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI',
  Wyoming: 'WY',
};

function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueId(base, existingIds) {
  if (!existingIds.has(base)) return base;
  let i = 2;
  while (existingIds.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function formatLocationName(address) {
  const feature =
    address.peak ??
    address.natural ??
    address.mountain_pass ??
    address.historic ??
    address.tourism ??
    address.leisure ??
    address.amenity ??
    null;

  const state = STATE_ABBR[address.state] ?? address.state ?? '';

  // Ignore generic "Appalachian Trail" as the feature name — not specific enough
  if (feature && feature !== 'Appalachian Trail' && feature !== 'Appalachian National Scenic Trail') {
    return state ? `${feature}, ${state}` : feature;
  }

  const place = address.village ?? address.town ?? address.city ?? address.county ?? null;
  if (place) return state ? `${place}, ${state}` : place;

  return state ? `AT, ${state}` : 'Appalachian Trail';
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'what-mile-ingest/1.0 (https://github.com/jiburney/what-mile)' },
  });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const data = await res.json();
  return formatLocationName(data.address ?? {});
}

async function buildClaudeImageContent(imagePath) {
  // Resize to max 1568px and re-encode as JPEG to stay well under the 5MB API limit
  const buffer = await sharp(imagePath)
    .resize(1568, 1568, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return {
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: buffer.toString('base64') },
  };
}

async function getDescription(imagePath, locationName, client) {
  const prompt =
  `You're an AT thru-hiker writing a short caption for a photo in your trail journal. ` +
  `This photo was taken near ${locationName}.` +
  `Write 1-2 casual, grounded sentences describing what's in the photo — ` +
  `focus on what a hiker would actually notice: the trail, the terrain, the weather, ` +
  `the view. Avoid botanical language. Sound human, not like a nature guide. ` +
  `Return ONLY the caption, no quotes or extra text.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{ role: 'user', content: [await buildClaudeImageContent(imagePath), { type: 'text', text: prompt }] }],
  });
  return response.content[0].text.trim();
}

async function inferFromImage(imagePath, client) {
  const prompt =
    `You are helping build a GeoGuessr-style game for the Appalachian Trail. ` +
    `This photo was taken somewhere on the AT. Identify the specific location or landmark ` +
    `if recognizable, estimate precise GPS coordinates, and write a 1-2 sentence description. ` +
    `Return ONLY valid JSON with no markdown fences: ` +
    `{ "locationName": "...", "coordinates": [lat, lng], "description": "..." }`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: [await buildClaudeImageContent(imagePath), { type: 'text', text: prompt }] }],
  });

  const text = response.content[0].text.trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude did not return valid JSON');
  return JSON.parse(match[0]);
}

// Nominatim asks for max 1 req/sec
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function redescribe(client, force = false) {
  const imagesData = JSON.parse(readFileSync(IMAGES_JSON, 'utf8'));
  const targets = imagesData.images.filter((i) => force || !i.description);

  if (targets.length === 0) {
    console.log('All entries already have descriptions.');
    return;
  }

  console.log(`Generating descriptions for ${targets.length} entries...\n`);

  let updated = 0;
  let skipped = 0;

  for (const entry of targets) {
    const photoPath = join(IMAGES_DIR, entry.filename);
    const ext = extname(entry.filename).toLowerCase();

    if (!existsSync(photoPath)) {
      console.warn(`⚠  ${entry.filename} — file not found in public/images/, skipping`);
      skipped++;
      continue;
    }
    if (!CLAUDE_SUPPORTED_EXTS.has(ext)) {
      console.warn(`⚠  ${entry.filename} — ${ext} not supported by Claude, skipping`);
      skipped++;
      continue;
    }

    try {
      const oldDescription = entry.description ?? '(none)';
      entry.description = await getDescription(photoPath, entry.locationName, client);
      console.log(`✓  ${entry.locationName}`);
      console.log(`   OLD: ${oldDescription}`);
      console.log(`   NEW: ${entry.description}\n`);
      updated++;
    } catch (err) {
      console.warn(`⚠  ${entry.filename} — ${err.message}`);
      skipped++;
    }
  }

  if (updated > 0) {
    writeFileSync(IMAGES_JSON, JSON.stringify(imagesData, null, 2) + '\n');
  }

  console.log(`\nDone. ${updated} updated, ${skipped} skipped.`);
}

async function main() {
  const args = process.argv.slice(2);
  const wantDescriptions = args.includes('--descriptions');
  const wantRedescribe = args.includes('--redescribe');
  const folderIdx = args.indexOf('--folder');
  const filesIdx = args.indexOf('--files');

  if (wantRedescribe) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('Error: ANTHROPIC_API_KEY is required for --redescribe');
      process.exit(1);
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await redescribe(client, args.includes('--force'));
    return;
  }

  let photoPaths = [];

  if (folderIdx !== -1) {
    const folder = args[folderIdx + 1];
    if (!folder || folder.startsWith('--')) {
      console.error('Error: --folder requires a path argument');
      process.exit(1);
    }
    photoPaths = readdirSync(folder)
      .filter((e) => IMAGE_EXTS.has(extname(e).toLowerCase()))
      .map((e) => join(folder, e));
  } else if (filesIdx !== -1) {
    photoPaths = args.slice(filesIdx + 1).filter((a) => !a.startsWith('--'));
  } else {
    console.error('Usage:');
    console.error('  node scripts/ingest-photos.mjs --folder <path> [--descriptions]');
    console.error('  node scripts/ingest-photos.mjs --files <f1> <f2> ... [--descriptions]');
    console.error('  ANTHROPIC_API_KEY=sk-... node scripts/ingest-photos.mjs --redescribe');
    process.exit(1);
  }

  if (photoPaths.length === 0) {
    console.error('No image files found.');
    process.exit(1);
  }

  if (wantDescriptions && !process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is required when using --descriptions');
    process.exit(1);
  }

  const client = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  const imagesData = JSON.parse(readFileSync(IMAGES_JSON, 'utf8'));
  const existingIds = new Set(imagesData.images.map((i) => i.id));
  const existingFilenames = new Set(imagesData.images.map((i) => i.filename));

  const ingestedData = existsSync(INGESTED_JSON)
    ? JSON.parse(readFileSync(INGESTED_JSON, 'utf8'))
    : { sources: [] };
  const ingestedSources = new Set(ingestedData.sources);

  mkdirSync(IMAGES_DIR, { recursive: true });

  console.log(`Processing ${photoPaths.length} photo${photoPaths.length === 1 ? '' : 's'}...\n`);

  let added = 0;
  let skipped = 0;
  let nominatimCallCount = 0;

  for (const photoPath of photoPaths) {
    const origFilename = basename(photoPath);
    const ext = extname(photoPath).toLowerCase();

    try {
      // Check if this source file was already ingested
      if (ingestedSources.has(origFilename)) {
        console.log(`–  ${origFilename} — already ingested, skipping`);
        skipped++;
        continue;
      }

      let coordinates = null;
      let locationName = null;
      let description = null;

      // Step 1: Extract GPS from EXIF
      const gps = await exifr.gps(photoPath).catch(() => null);
      if (gps?.latitude && gps?.longitude) {
        coordinates = [
          Math.round(gps.latitude * 10000) / 10000,
          Math.round(gps.longitude * 10000) / 10000,
        ];
      }

      if (coordinates) {
        // Step 2: Reverse geocode — respect Nominatim's 1 req/sec policy
        if (nominatimCallCount > 0) await sleep(1100);
        locationName = await reverseGeocode(coordinates[0], coordinates[1]);
        nominatimCallCount++;

        // Step 3: Claude description (optional)
        if (wantDescriptions) {
          if (!CLAUDE_SUPPORTED_EXTS.has(ext)) {
            console.log(`  ↳ description skipped for ${ext} (convert to JPEG/PNG first)`);
          } else {
            description = await getDescription(photoPath, locationName, client);
          }
        }
      } else {
        // No GPS — fall back to Claude vision
        if (!client) {
          console.warn(`⚠  ${origFilename} — no GPS data (set ANTHROPIC_API_KEY to enable fallback)`);
          skipped++;
          continue;
        }
        if (!CLAUDE_SUPPORTED_EXTS.has(ext)) {
          console.warn(`⚠  ${origFilename} — no GPS data and ${ext} not supported by Claude, skipping`);
          skipped++;
          continue;
        }
        const result = await inferFromImage(photoPath, client);
        if (!result.coordinates || !result.locationName) {
          console.warn(`⚠  ${origFilename} — Claude couldn't identify location, skipping`);
          skipped++;
          continue;
        }
        coordinates = [
          Math.round(result.coordinates[0] * 10000) / 10000,
          Math.round(result.coordinates[1] * 10000) / 10000,
        ];
        locationName = result.locationName;
        description = result.description ?? null;
      }

      // Step 4: Generate unique ID and UUID-based destination filename
      const id = uniqueId(toKebabCase(locationName), existingIds);
      const filename = `${randomUUID()}${ext}`;

      // Step 5: Copy photo (skip if already exists at destination)
      const destPath = join(IMAGES_DIR, filename);
      if (!existsSync(destPath)) {
        copyFileSync(photoPath, destPath);
      }

      // Step 6: Build and append JSON entry
      const entry = { id, filename, locationName, coordinates };
      if (description) entry.description = description;

      imagesData.images.push(entry);
      existingIds.add(id);
      existingFilenames.add(filename);
      ingestedSources.add(origFilename);
      ingestedData.sources.push(origFilename);

      const tag = description ? ' + description' : '';
      console.log(`✓  ${locationName.padEnd(42)} [${coordinates[0]}, ${coordinates[1]}]${tag}`);
      added++;
    } catch (err) {
      console.warn(`⚠  ${origFilename} — ${err.message}`);
      skipped++;
    }
  }

  if (added > 0) {
    writeFileSync(IMAGES_JSON, JSON.stringify(imagesData, null, 2) + '\n');
    writeFileSync(INGESTED_JSON, JSON.stringify(ingestedData, null, 2) + '\n');
  }

  console.log(`\nDone. ${added} added, ${skipped} skipped.`);
}

main();
