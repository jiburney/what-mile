import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';
import { PhotoCard } from './PhotoCard';
import { Lightbox } from './Lightbox';
import { usePhotoSelection } from './usePhotoSelection';

interface SkipViewProps {
  photos: AdminPhoto[];
  loading: boolean;
  session: Session;
  refetch: () => void;
}

export function SkipView({ photos, loading, session, refetch }: SkipViewProps) {
  const { selectedIds, toggleSelection, selectAll, deselectAll } = usePhotoSelection(photos);
  const [purging, setPurging] = useState(false);
  const [approving, setApproving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleApproveSelected = async () => {
    const selectedPhotos = photos.filter((p) => selectedIds.has(p.id));
    if (selectedPhotos.length === 0) return;

    const confirmed = window.confirm(
      `Approve ${selectedPhotos.length} selected photo${selectedPhotos.length !== 1 ? 's' : ''}?`
    );

    if (!confirmed) return;

    setApproving(true);
    setProgress(0);

    for (let i = 0; i < selectedPhotos.length; i++) {
      try {
        const response = await fetch('/api/approve-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ photoId: selectedPhotos[i].id }),
        });

        if (!response.ok) {
          throw new Error('Failed to approve photo');
        }

        setProgress(i + 1);
      } catch (err) {
        console.error(`Error approving photo ${selectedPhotos[i].id}:`, err);
        alert(`Failed to approve photo ${i + 1}. See console for details.`);
        break;
      }
    }

    setApproving(false);
    setProgress(0);
    refetch();
  };

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

  const selectedCount = selectedIds.size;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="skip-view-header">
        <button className="btn-select" onClick={selectAll}>
          Select All
        </button>
        <button className="btn-select" onClick={deselectAll}>
          Deselect All
        </button>
        <button
          className="btn-approve-selected"
          style={{ marginLeft: 'auto' }}
          onClick={handleApproveSelected}
          disabled={approving || purging || selectedCount === 0}
        >
          {approving
            ? `Approving ${progress}/${selectedCount}...`
            : `Approve Selected (${selectedCount})`}
        </button>
        <button
          className="btn-purge"
          onClick={handlePurgeAll}
          disabled={purging || approving}
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
            selected={selectedIds.has(photo.id)}
            onToggle={() => toggleSelection(photo.id)}
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
