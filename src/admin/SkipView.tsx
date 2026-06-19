import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';
import { PhotoCard } from './PhotoCard';
import { Lightbox } from './Lightbox';

interface SkipViewProps {
  photos: AdminPhoto[];
  loading: boolean;
  session: Session;
  refetch: () => void;
}

export function SkipView({ photos, loading, session, refetch }: SkipViewProps) {
  const [purging, setPurging] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handlePurgeAll = async () => {
    if (photos.length === 0) return;

    const confirmed = window.confirm(
      `This will permanently delete ${photos.length} skipped photo${
        photos.length !== 1 ? 's' : ''
      } from storage and the database. This cannot be undone.`
    );

    if (!confirmed) return;

    setPurging(true);

    try {
      const response = await fetch('/api/purge-skips', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to purge skipped photos');
      }

      const result = await response.json();
      alert(`Successfully deleted ${result.deleted} photo${result.deleted !== 1 ? 's' : ''}`);
      refetch();
    } catch (err) {
      console.error('Error purging skips:', err);
      alert('Failed to purge skipped photos. See console for details.');
    } finally {
      setPurging(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-empty">
        <div className="admin-empty-text">Loading...</div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="admin-empty">
        <div className="admin-empty-icon">✓</div>
        <div className="admin-empty-text">No skipped photos</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="skip-view-header">
        <div className="skip-view-title">{photos.length} skipped photo{photos.length !== 1 ? 's' : ''}</div>
        <button
          className="btn-purge"
          onClick={handlePurgeAll}
          disabled={purging}
        >
          {purging ? 'Purging...' : 'Purge All Skips'}
        </button>
      </div>
      <div className="photo-grid">
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            session={session}
            mode="skip"
            onImageClick={() => setLightboxIndex(index)}
          />
        ))}
      </div>

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <Lightbox
          photo={photos[lightboxIndex]}
          session={session}
          mode="skip"
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(Math.max(0, lightboxIndex - 1))}
          onNext={() => setLightboxIndex(Math.min(photos.length - 1, lightboxIndex + 1))}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < photos.length - 1}
          onAction={() => {
            setLightboxIndex(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
