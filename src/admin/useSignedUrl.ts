import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';

export function useSignedUrl(photo: AdminPhoto, session: Session) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!photo.is_private) {
        // Public photo — use direct URL
        setUrl(photo.r2_url);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/signed-url?key=${encodeURIComponent(photo.r2_url)}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch signed URL');
        }

        const data = await response.json();
        setUrl(data.url);
      } catch (err) {
        console.error('Error fetching signed URL:', err);
        setUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [photo.r2_url, photo.is_private, session.access_token]);

  return { url, loading };
}
