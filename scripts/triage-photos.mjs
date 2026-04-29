/**
 * Pre-ingest triage for What Mile.
 *
 * Three-stage pipeline:
 *   Stage 1 — Local heuristics (blur, screenshot, duplicate) — sharp only, instant
 *   Stage 2 — Face detection — @vladmandic/face-api + tfjs-node
 *   Stage 3 — Claude Haiku classification — Anthropic API
 *
 * Sorts photos into:
 *   ready/   — clear trail photo, safe to ingest
 *   review/  — faces, wildlife, ambiguous content
 *   skip/    — blurry, duplicate, screenshot, non-trail
 *
 * Usage:
 *   node scripts/triage-photos.mjs --folder ~/path/to/photos/
 *
 * State is persisted to <folder>/.triage-state.json — safe to interrupt and resume.
 */

import dotenv from 'dotenv';
dotenv.config({ path: process.env.WHAT_MILE_ENV });
import * as tf from '@tensorflow/tfjs-node';
import * as faceapi from '@vladmandic/face-api';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync,
} from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

// Use the Node.js tf backend inside face-api (avoids dual-instance issues)
faceapi.env.monkeyPatch({ tf });

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR    = join(__dirname, 'models');
const MODEL_MANIFEST = join(MODELS_DIR, 'ssd_mobilenetv1_model-weights_manifest.json');

const IMAGE_EXTS      = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tiff', '.tif']);
const FACE_CONFIDENCE = 0.5;
const BLUR_THRESHOLD  = 100;   // Laplacian variance below this → blurry
const BATCH_SIZE      = 100;
const STATE_FILENAME  = '.triage-state.json';

// Common iPhone screenshot resolutions
const SCREENSHOT_RESOLUTIONS = new Set([
  '750x1334',   '1334x750',
  '828x1792',   '1792x828',
  '1125x2436',  '2436x1125',
  '1170x2532',  '2532x1170',
  '1179x2556',  '2556x1179',
  '1242x2208',  '2208x1242',
  '1242x2688',  '2688x1242',
  '1284x2778',  '2778x1284',
  '1290x2796',  '2796x1290',
  '1080x1920',  '1920x1080',
  '1440x2560',  '2560x1440',
  '1800x2880',  '2880x1800',
  '2560x1600',  '1600x2560',
]);

// ---------------------------------------------------------------------------
// Model check
// ---------------------------------------------------------------------------

function checkModels() {
  if (!existsSync(MODEL_MANIFEST)) {
    console.error('Error: SSD MobileNet V1 model weights not found.');
    console.error('');
    console.error(`Expected at: ${MODEL_MANIFEST}`);
    console.error('');
    console.error('Copy them from the installed package:');
    console.error('  mkdir -p scripts/models');
    console.error('  cp node_modules/@vladmandic/face-api/model/ssd_mobilenetv1* scripts/models/');
    console.error('');
    console.error('Or download from: https://github.com/vladmandic/face-api/tree/master/model');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function loadState(folder) {
  const stateFile = join(folder, STATE_FILENAME);
  if (!existsSync(stateFile)) return { triaged: [], decisions: {} };
  return JSON.parse(readFileSync(stateFile, 'utf8'));
}

function saveState(folder, state) {
  writeFileSync(join(folder, STATE_FILENAME), JSON.stringify(state, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Stage 1a — Blur detection
// Variance of the Laplacian on a grayscale image. Low variance = blurry.
// ---------------------------------------------------------------------------

async function computeBlurScore(imagePath) {
  const { data } = await sharp(imagePath)
    .grayscale()
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .convolve({ width: 3, height: 3, kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0] })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  const n = pixels.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += pixels[i];
  const mean = sum / n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (pixels[i] - mean) ** 2;
  return variance / n;
}

// ---------------------------------------------------------------------------
// Stage 1b — Screenshot detection
// Exact match on common screen resolutions, or screen-like aspect ratio
// combined with low color entropy (flat UI regions).
// ---------------------------------------------------------------------------

async function isScreenshot(imagePath) {
  const { width, height } = await sharp(imagePath).metadata();

  if (SCREENSHOT_RESOLUTIONS.has(`${width}x${height}`)) return true;

  const ratio = width / height;
  const isScreenRatio = [16 / 9, 9 / 16, 4 / 3, 3 / 4].some(
    (r) => Math.abs(ratio - r) < 0.02,
  );
  if (!isScreenRatio) return false;

  // Count quantized distinct colors at 32×32. Natural photos have many;
  // screenshots have large flat regions with few distinct colors.
  const { data } = await sharp(imagePath)
    .resize(32, 32, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  const colors = new Set();
  for (let i = 0; i < pixels.length; i += 3) {
    colors.add(((pixels[i] >> 3) << 10) | ((pixels[i + 1] >> 3) << 5) | (pixels[i + 2] >> 3));
  }
  return colors.size < 200;
}

// ---------------------------------------------------------------------------
// Stage 2 — Face detection
// ---------------------------------------------------------------------------

async function countFaces(imagePath) {
  const { data, info } = await sharp(imagePath)
    .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
  try {
    const detections = await faceapi.detectAllFaces(
      tensor,
      new faceapi.SsdMobilenetv1Options({ minConfidence: FACE_CONFIDENCE }),
    );
    return detections.length;
  } finally {
    tensor.dispose();
  }
}

// ---------------------------------------------------------------------------
// Stage 3 — Claude Haiku triage
// All non-JPEG/PNG/WebP formats (e.g. HEIC) are converted to JPEG buffer
// before sending, since Claude does not accept HEIC directly.
// On API failure, defaults to 'review' — never silently skips.
// ---------------------------------------------------------------------------

const HAIKU_PROMPT =
  'You are triaging photos for a GeoGuessr-style game about the Appalachian Trail.\n' +
  'The game covers the full AT experience — not just wilderness trail, but also trail\n' +
  'towns, hostels, shelters, road crossings, and resupply stops. These are all\n' +
  'meaningful and recognizable locations for AT hikers.\n\n' +
  'Categorize this photo as exactly one of:\n' +
  '- ready: trail scenes, forest paths, shelters, viewpoints, water sources, trail\n' +
  '  towns, hostels, general stores, road crossings, and any other recognizable AT\n' +
  '  location or experience — with no people visible\n' +
  '- review: contains people or faces, interesting wildlife or animals, flowers or\n' +
  '  very close-up nature, or genuinely ambiguous whether it relates to the AT\n' +
  '- skip: screenshot, severely blurry, food closeup, gear closeup with no context,\n' +
  '  pure interior shot with no AT context, or otherwise not useful for the game\n\n' +
  'When in doubt between ready and review, choose review.\n' +
  'When in doubt between review and skip, choose review.\n' +
  'Only skip photos that are clearly not useful for the game.\n' +
  'Reply with ONLY the category word: ready, review, or skip';

async function claudeTriage(imagePath, client) {
  // Always re-encode as JPEG — normalizes HEIC/TIFF/etc. and caps size
  const buffer = await sharp(imagePath)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: buffer.toString('base64') },
          },
          { type: 'text', text: HAIKU_PROMPT },
        ],
      }],
    });

    const text = response.content[0].text.trim().toLowerCase();
    if (['ready', 'review', 'skip'].includes(text)) return text;
    return 'review'; // unexpected response → safe default
  } catch (err) {
    process.stderr.write(`\n  ⚠ Haiku API error (${err.message}) — defaulting to review\n`);
    return 'review';
  }
}

// ---------------------------------------------------------------------------
// Console output
// ---------------------------------------------------------------------------

function logLine(idx, total, filename, outcome, detail) {
  const w   = String(total).length;
  const pos = `[${String(idx).padStart(w)}/${total}]`;

  if (outcome === 'already-triaged') {
    console.log(`${pos} ~ ${filename} → already triaged, skipping`);
    return;
  }

  const icon = outcome === 'ready' ? '✓' : outcome === 'review' ? '⚠' : '–';
  const detailStr = detail ? ` (${detail})` : '';
  console.log(`${pos} ${icon} ${filename} → ${outcome}${detailStr}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args      = process.argv.slice(2);
  const folderIdx = args.indexOf('--folder');

  if (folderIdx === -1 || !args[folderIdx + 1] || args[folderIdx + 1].startsWith('--')) {
    console.error('Usage: ANTHROPIC_API_KEY=sk-... node scripts/triage-photos.mjs --folder <path>');
    process.exit(1);
  }

  const folder = args[folderIdx + 1].replace(/^~/, process.env.HOME ?? '~');

  if (!existsSync(folder)) {
    console.error(`Error: folder not found: ${folder}`);
    process.exit(1);
  }

  checkModels();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const client = apiKey ? new Anthropic({ apiKey }) : null;
  if (!client) {
    console.warn(
      'Warning: ANTHROPIC_API_KEY not set — Stage 3 (Claude Haiku) will be skipped ' +
      'and all photos that pass stages 1 & 2 will be sent to review/.\n',
    );
  }

  console.log('Loading face detection model...');
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
  console.log('Model loaded.\n');

  const readyDir  = join(folder, 'ready');
  const reviewDir = join(folder, 'review');
  const skipDir   = join(folder, 'skip');
  for (const d of [readyDir, reviewDir, skipDir]) mkdirSync(d, { recursive: true });

  const state      = loadState(folder);
  const triagedSet = new Set(state.triaged);

  const allFiles = readdirSync(folder).filter(
    (f) => IMAGE_EXTS.has(extname(f).toLowerCase()),
  );

  if (allFiles.length === 0) {
    console.log('No image files found in folder.');
    process.exit(0);
  }

  const newFiles = allFiles.filter((f) => !triagedSet.has(f));

  const total = allFiles.length;
  let readyCount  = 0;
  let reviewCount = 0;
  let skipCount   = 0;
  let skippedCount = 0;
  let processed   = 0;

  for (let batchStart = 0; batchStart < allFiles.length; batchStart += BATCH_SIZE) {
    const batch = allFiles.slice(batchStart, batchStart + BATCH_SIZE);

    for (const filename of batch) {
      processed++;
      const srcPath = join(folder, filename);

      // Already triaged in a previous run
      if (triagedSet.has(filename)) {
        logLine(processed, total, filename, 'already-triaged');
        skippedCount++;
        continue;
      }

      let decision = null;
      let detail   = null;
      let destDir  = null;

      try {
        // ---------------------------------------------------------------
        // Stage 1a: blur
        // ---------------------------------------------------------------
        if (!decision) {
          const blurScore = await computeBlurScore(srcPath);
          if (blurScore < BLUR_THRESHOLD) {
            decision = 'skip';
            detail   = 'blurry';
            destDir  = skipDir;
          }
        }

        // ---------------------------------------------------------------
        // Stage 1b: screenshot
        // ---------------------------------------------------------------
        if (!decision) {
          if (await isScreenshot(srcPath)) {
            decision = 'skip';
            detail   = 'screenshot';
            destDir  = skipDir;
          }
        }

        // ---------------------------------------------------------------
        // Stage 2: face detection
        // ---------------------------------------------------------------
        if (!decision) {
          const faces = await countFaces(srcPath);
          if (faces > 0) {
            decision = 'review';
            detail   = `faces: ${faces}`;
            destDir  = reviewDir;
          }
        }

        // ---------------------------------------------------------------
        // Stage 3: Claude Haiku
        // ---------------------------------------------------------------
        if (!decision) {
          if (client) {
            const result = await claudeTriage(srcPath, client);
            decision = result;
            detail   = 'haiku';
          } else {
            decision = 'review';
            detail   = 'no api key';
          }
          destDir =
            decision === 'ready'  ? readyDir  :
            decision === 'review' ? reviewDir :
                                    skipDir;
        }

        renameSync(srcPath, join(destDir, filename));

        state.triaged.push(filename);
        state.decisions[filename] = decision;
        triagedSet.add(filename);

        if (decision === 'ready')       readyCount++;
        else if (decision === 'review') reviewCount++;
        else                            skipCount++;

        logLine(processed, total, filename, decision, detail);

      } catch (err) {
        const w   = String(total).length;
        const pos = `[${String(processed).padStart(w)}/${total}]`;
        console.warn(`${pos} ⚠ ${filename} — error: ${err.message}`);
        skippedCount++;
      }
    }

    // Checkpoint after each batch so progress survives interruptions
    saveState(folder, state);
  }

  const pad = (n) => String(n).padStart(3);
  console.log('');
  console.log('Triage complete.');
  console.log(`${pad(readyCount)} → ready/`);
  console.log(`${pad(reviewCount)} → review/`);
  console.log(`${pad(skipCount)} → skip/`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Browse review/ in Finder and move any keepers into ready/');
  console.log('2. Spot check skip/ to verify nothing good was filtered out');
  console.log('3. When satisfied, run:');
  console.log(`   node scripts/ingest-photos.mjs --folder ${readyDir} --descriptions`);
}

main();
