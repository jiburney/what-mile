import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as dotenv from 'dotenv';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { selectDailyPhotos } from './_lib/select-daily-photos.js';

// Load env vars from .config folder when running locally
// On Vercel, process.env is populated automatically — WHAT_MILE_ENV is not set there
if (process.env.WHAT_MILE_ENV) {
  dotenv.config({ path: process.env.WHAT_MILE_ENV });
}

/**
 * Get today's date in Eastern timezone as YYYY-MM-DD
 */
function getTodayEastern(): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;

  return `${year}-${month}-${day}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers (allow public access - no auth required)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action as string;

  try {
    switch (action) {
      case 'get-challenge':
        return await handleGetChallenge(req, res);
      case 'submit-score':
        return await handleSubmitScore(req, res);
      case 'get-leaderboard':
        return await handleGetLeaderboard(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid action. Supported: get-challenge, submit-score, get-leaderboard'
        });
    }
  } catch (error) {
    console.error('Daily challenge error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/daily?action=get-challenge&date=YYYY-MM-DD (optional)
 * Returns today's (or specified date's) challenge, creating it if it doesn't exist
 */
async function handleGetChallenge(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const challengeDate = (req.query.date as string) || getTodayEastern();

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(challengeDate)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  // Check if challenge already exists
  const { data: existingChallenge, error: fetchError } = await supabaseAdmin
    .from('daily_challenges')
    .select('*')
    .eq('challenge_date', challengeDate)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('Fetch error:', fetchError);
    return res.status(500).json({ error: 'Failed to fetch challenge' });
  }

  let challenge = existingChallenge;

  // Create new challenge if it doesn't exist
  if (!challenge) {
    try {
      const selectedPhotos = await selectDailyPhotos(challengeDate);
      const photoIds = selectedPhotos.map(p => p.id);

      const { data: newChallenge, error: createError } = await supabaseAdmin
        .from('daily_challenges')
        .insert({
          challenge_date: challengeDate,
          photo_ids: photoIds,
        })
        .select()
        .single();

      if (createError) {
        console.error('Create error:', createError);
        return res.status(500).json({ error: 'Failed to create challenge' });
      }

      challenge = newChallenge;
    } catch (error) {
      console.error('Photo selection error:', error);
      return res.status(500).json({
        error: 'Failed to select photos for challenge',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Fetch full photo details
  const { data: photos, error: photosError } = await supabaseAdmin
    .from('photos')
    .select('id, filename, location_name, lat, lng, description, r2_url, times_shown, is_private, taken_at')
    .in('id', challenge.photo_ids);

  if (photosError) {
    console.error('Photos fetch error:', photosError);
    return res.status(500).json({ error: 'Failed to fetch challenge photos' });
  }

  // Sort photos to match challenge.photo_ids order (important for deterministic order)
  const sortedPhotos = challenge.photo_ids.map((id: string) =>
    photos!.find(p => p.id === id)
  ).filter(Boolean);

  return res.status(200).json({
    challengeId: challenge.id,
    date: challenge.challenge_date,
    photos: sortedPhotos.map(photo => ({
      id: photo.id,
      filename: photo.filename,
      locationName: photo.location_name,
      coordinates: [photo.lat, photo.lng],
      description: photo.description,
      r2_url: photo.r2_url,
      taken_at: photo.taken_at,
      times_shown: photo.times_shown,
      is_private: photo.is_private,
    })),
  });
}

/**
 * POST /api/daily?action=submit-score
 * Body: { challengeId, totalScore, overallTier, roundScores, clientFingerprint, playerName?, yearHiked? }
 */
async function handleSubmitScore(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    challengeId,
    totalScore,
    overallTier,
    roundScores,
    clientFingerprint,
    playerName,
    yearHiked,
  } = req.body;

  // Validation
  if (!challengeId || !clientFingerprint) {
    return res.status(400).json({ error: 'Missing required fields: challengeId, clientFingerprint' });
  }

  if (typeof totalScore !== 'number' || totalScore < 0 || totalScore > 2200) {
    return res.status(400).json({ error: 'Invalid totalScore: must be 0-2200' });
  }

  if (!Array.isArray(roundScores) || roundScores.length !== 5) {
    return res.status(400).json({ error: 'Invalid roundScores: must be array of 5 scores' });
  }

  // Validate each round score ≤ 440
  for (let i = 0; i < roundScores.length; i++) {
    if (typeof roundScores[i] !== 'number' || roundScores[i] < 0 || roundScores[i] > 440) {
      return res.status(400).json({ error: `Invalid round score at index ${i}: must be 0-440` });
    }
  }

  // Validate round scores sum to total
  const sum = roundScores.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - totalScore) > 0.01) { // Allow tiny floating point error
    return res.status(400).json({
      error: `Round scores sum (${sum}) does not match totalScore (${totalScore})`
    });
  }

  const validTiers = ['Thru-Hiker', 'LASHer', 'Section Hiker', 'Day Hiker'];
  if (!validTiers.includes(overallTier)) {
    return res.status(400).json({ error: 'Invalid overallTier' });
  }

  // Verify challenge exists
  const { data: challenge, error: challengeError } = await supabaseAdmin
    .from('daily_challenges')
    .select('id')
    .eq('id', challengeId)
    .single();

  if (challengeError || !challenge) {
    return res.status(404).json({ error: 'Challenge not found' });
  }

  // Insert score (will fail if duplicate clientFingerprint for this challenge)
  const { error: insertError } = await supabaseAdmin
    .from('daily_scores')
    .insert({
      challenge_id: challengeId,
      total_score: totalScore,
      overall_tier: overallTier,
      round_scores: roundScores,
      client_fingerprint: clientFingerprint,
      player_name: playerName || null,
      year_hiked: yearHiked || null,
    });

  if (insertError) {
    if (insertError.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'You have already submitted a score for this challenge' });
    }
    console.error('Insert error:', insertError);
    return res.status(500).json({ error: 'Failed to submit score' });
  }

  // Calculate rank (shared rank for ties)
  const { data: rankData, error: rankError } = await supabaseAdmin
    .from('daily_scores')
    .select('total_score')
    .eq('challenge_id', challengeId)
    .order('total_score', { ascending: false });

  if (rankError) {
    console.error('Rank calculation error:', rankError);
    // Don't fail the request - score was saved successfully
    return res.status(200).json({ rank: null, totalPlayers: null });
  }

  // Find rank (1-indexed, shared for ties)
  let rank = 1;
  let prevScore = null;
  for (const entry of rankData!) {
    if (entry.total_score === totalScore) {
      break;
    }
    if (prevScore !== entry.total_score) {
      rank++;
    }
    prevScore = entry.total_score;
  }

  return res.status(200).json({
    rank,
    totalPlayers: rankData!.length,
  });
}

/**
 * GET /api/daily?action=get-leaderboard&challengeId=UUID&clientFingerprint=UUID (optional)
 * OR: GET /api/daily?action=get-leaderboard&date=YYYY-MM-DD&clientFingerprint=UUID (optional)
 */
async function handleGetLeaderboard(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let challengeId = req.query.challengeId as string;
  const clientFingerprint = req.query.clientFingerprint as string;
  const date = req.query.date as string;

  // If date provided instead of challengeId, look up the challenge
  if (date && !challengeId) {
    const { data: challenge, error } = await supabaseAdmin
      .from('daily_challenges')
      .select('id')
      .eq('challenge_date', date)
      .single();

    if (error || !challenge) {
      return res.status(404).json({ error: 'Challenge not found for date' });
    }

    challengeId = challenge.id;
  }

  if (!challengeId) {
    return res.status(400).json({ error: 'Missing required parameter: challengeId or date' });
  }

  // Fetch all scores for this challenge, ordered by score desc
  const { data: scores, error: scoresError } = await supabaseAdmin
    .from('daily_scores')
    .select('id, total_score, player_name, year_hiked, client_fingerprint')
    .eq('challenge_id', challengeId)
    .order('total_score', { ascending: false });

  if (scoresError) {
    console.error('Leaderboard fetch error:', scoresError);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }

  if (!scores || scores.length === 0) {
    return res.status(200).json({
      yourScore: null,
      topFive: [],
      totalPlayers: 0,
    });
  }

  // Calculate ranks (shared for ties)
  const rankedScores = [];
  let currentRank = 1;
  let prevScore = null;

  for (let i = 0; i < scores.length; i++) {
    const score = scores[i];

    // If score changed, update rank to current position
    if (prevScore !== null && score.total_score < prevScore) {
      currentRank = i + 1;
    }

    rankedScores.push({
      rank: currentRank,
      totalScore: score.total_score,
      playerName: score.player_name || 'Anonymous Hiker',
      yearHiked: score.year_hiked,
      isYou: clientFingerprint ? score.client_fingerprint === clientFingerprint : false,
    });

    prevScore = score.total_score;
  }

  // Find user's score if fingerprint provided
  const yourScore = rankedScores.find(s => s.isYou) || null;

  // Get top 5
  const topFive = rankedScores.slice(0, 5).map(s => ({
    rank: s.rank,
    totalScore: s.totalScore,
    playerName: s.playerName,
    yearHiked: s.yearHiked,
  }));

  return res.status(200).json({
    yourScore: yourScore ? {
      rank: yourScore.rank,
      totalScore: yourScore.totalScore,
      playerName: yourScore.playerName,
      yearHiked: yourScore.yearHiked,
    } : null,
    topFive,
    totalPlayers: scores.length,
  });
}
