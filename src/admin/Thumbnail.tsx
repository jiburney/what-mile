import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';

interface ThumbnailProps {
  photo: AdminPhoto;
  session: Session;
  onClick?: () => void;
}

export function Thumbnail({ photo, session, onClick }: ThumbnailProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!photo.is_private) {
        setSignedUrl(photo.r2_url);
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
        setSignedUrl(data.url);
      } catch (err) {
        console.error('Error fetching signed URL:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [photo.r2_url, photo.is_private, session.access_token]);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div className="thumbnail-wrapper" onClick={handleClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {loading ? (
        <div className="thumbnail-skeleton" />
      ) : (
        signedUrl && <img src={signedUrl} alt={photo.locationName} className="thumbnail-img" />
      )}
    </div>
  );
}
