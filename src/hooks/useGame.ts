import { useState, useCallback } from 'react';
import type { GameState, ImageConfig, RoundResult } from '../types';
import { distanceMiles } from '../utils/distance';
import { calculateScore } from '../utils/scoring';
import { supabaseGame } from '../lib/supabase';

const ROUNDS_PER_GAME = 5;
const MIN_DISTANCE_MILES = 1.0;

export function useGame(
  mode: 'free-play' | 'daily' = 'free-play',
  predeterminedPhotos: ImageConfig[] | null = null
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<ImageConfig[]>([]);

  const [state, setState] = useState<GameState>({
    phase: 'start',
    rounds: [],
    currentRound: 0,
    currentImage: null,
    pendingGuess: null,
  });

  // Fetches a fresh random set on every call (initial start AND "Play Again"),
  // so free-play never reuses the same 5 photos twice in a session.
  // Selection (random pool + 1-mile minimum distance apart) happens inside
  // Postgres via select_game_photos — same function Daily Challenge uses.
  const startGame = useCallback(async () => {
    if (mode === 'daily' && predeterminedPhotos) {
      setQueue(predeterminedPhotos);
      setState({
        phase: 'guessing',
        rounds: [],
        currentRound: 0,
        currentImage: predeterminedPhotos[0],
        pendingGuess: null,
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabaseGame.rpc('select_game_photos', {
        p_count: ROUNDS_PER_GAME,
        p_min_distance_miles: MIN_DISTANCE_MILES,
      });

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        throw new Error('No approved photos found');
      }

      // Map Supabase rows to ImageConfig objects
      const selected: ImageConfig[] = data.map((row: any) => ({
        id: row.id,
        filename: row.filename,
        locationName: row.location_name,
        coordinates: [row.lat, row.lng],
        description: row.description ?? undefined,
        r2_url: row.r2_url,
        times_shown: row.times_shown ?? 0,
        is_private: row.is_private ?? false,
      }));

      setQueue(selected);
      setState({
        phase: 'guessing',
        rounds: [],
        currentRound: 0,
        currentImage: selected[0],
        pendingGuess: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [mode, predeterminedPhotos]);

  const setGuess = useCallback((coords: [number, number]) => {
    setState((s) => ({ ...s, pendingGuess: coords }));
  }, []);

  const lockInGuess = useCallback(() => {
    setState((s) => {
      if (!s.pendingGuess || !s.currentImage) return s;
      const [gLat, gLng] = s.pendingGuess;
      const [aLat, aLng] = s.currentImage.coordinates;
      const dist = distanceMiles(gLat, gLng, aLat, aLng);
      const { score, tier } = calculateScore(dist);
      const result: RoundResult = {
        image: s.currentImage,
        guess: s.pendingGuess,
        score,
        tier,
        distanceMiles: dist,
      };
      return {
        ...s,
        phase: 'result',
        rounds: [...s.rounds, result],
      };
    });
  }, []);

  const nextRound = useCallback(() => {
    setState((s) => {
      const nextIndex = s.currentRound + 1;
      if (nextIndex >= ROUNDS_PER_GAME || nextIndex >= queue.length) {
        return { ...s, phase: 'summary' };
      }
      return {
        ...s,
        phase: 'guessing',
        currentRound: nextIndex,
        currentImage: queue[nextIndex],
        pendingGuess: null,
      };
    });
  }, [queue]);

  const totalScore = state.rounds.reduce((sum, r) => sum + r.score, 0);
  const currentResult = state.rounds[state.rounds.length - 1] ?? null;
  const nextImage = queue[state.currentRound + 1] ?? null;

  return {
    state,
    currentResult,
    totalScore,
    nextImage,
    startGame,
    setGuess,
    lockInGuess,
    nextRound,
    totalRounds: ROUNDS_PER_GAME,
    loading,
    error,
  };
}
