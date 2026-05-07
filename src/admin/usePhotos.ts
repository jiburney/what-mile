import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto, PhotoStatus } from '../types';

export function usePhotos(status: PhotoStatus, session: Session | null) {
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    if (!session) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/photos?status=${status}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch photos: ${response.statusText}`);
      }

      const data = await response.json();
      setPhotos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch photos');
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [status, session]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  return { photos, loading, error, refetch: fetchPhotos };
}
