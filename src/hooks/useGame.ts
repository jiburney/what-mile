import { useState, useCallback, useEffect } from 'react';
import type { GameState, ImageConfig, RoundResult } from '../types';
import { distanceMiles } from '../utils/distance';
import { calculateScore } from '../utils/scoring';
import { supabaseGame } from '../lib/supabase';

const ROUNDS_PER_GAME = 5;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRounds(images: ImageConfig[]): ImageConfig[] {
  const shuffled = shuffle(images);
  return shuffled.slice(0, Math.min(ROUNDS_PER_GAME, shuffled.length));
}

export function useGame(
  mode: 'free-play' | 'daily' = 'free-play',
  predeterminedPhotos: ImageConfig[] | null = null
) {
  const [allImages, setAllImages] = useState<ImageConfig[]>([]);
  const [loading, setLoading] = useState(mode === 'free-play'); // Daily mode doesn't need to load
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<ImageConfig[]>([]);

  const [state, setState] = useState<GameState>({
    phase: 'start',
    rounds: [],
    currentRound: 0,
    currentImage: null,
    pendingGuess: null,
  });

  // Fetch approved photos from Supabase on mount (free-play mode only)
  useEffect(() => {
    if (mode === 'daily') {
      // Daily mode uses predetermined photos, skip Supabase fetch
      setLoading(false);
      return;
    }

    async function fetchPhotos() {
      try {
        const { data, error: fetchError } = await supabaseGame
          .from('photos')
          .select('id, filename, location_name, lat, lng, description, r2_url, times_shown, is_private')
          .eq('status', 'approved');

        if (fetchError) throw fetchError;

        if (!data || data.length === 0) {
          throw new Error('No approved photos found');
        }

        // Map Supabase rows to ImageConfig objects
        const images: ImageConfig[] = data.map((row) => ({
          id: row.id,
          filename: row.filename,
          locationName: row.location_name,
          coordinates: [row.lat, row.lng],
          description: row.description ?? undefined,
          r2_url: row.r2_url,
          times_shown: row.times_shown ?? 0,
          is_private: row.is_private ?? false,
        }));

        setAllImages(images);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load photos');
        setLoading(false);
      }
    }

    fetchPhotos();
  }, [mode]);

  const startGame = useCallback(() => {
    const selected = mode === 'daily' && predeterminedPhotos
      ? predeterminedPhotos
      : pickRounds(allImages);

    setQueue(selected);
    setState({
      phase: 'guessing',
      rounds: [],
      currentRound: 0,
      currentImage: selected[0],
      pendingGuess: null,
    });
  }, [allImages, mode, predeterminedPhotos]);

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
