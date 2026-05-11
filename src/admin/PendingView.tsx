import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';
import { PhotoCard } from './PhotoCard';

interface PendingViewProps {
  photos: AdminPhoto[];
  loading: boolean;
  session: Session;
  refetch: () => void;
}

export function PendingView({ photos, loading, session, refetch }: PendingViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [skipping, setSkipping] = useState(false);
  const [skipProgress, setSkipProgress] = useState(0);

  // Initialize selection with all photos when photos change
  useEffect(() => {
    setSelectedIds(new Set(photos.map((p) => p.id)));
  }, [photos]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(photos.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

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

  const handleSkipSelected = async () => {
    const selectedPhotos = photos.filter((p) => selectedIds.has(p.id));
    if (selectedPhotos.length === 0) return;

    const confirmed = window.confirm(
      `Skip ${selectedPhotos.length} selected photo${selectedPhotos.length !== 1 ? 's' : ''}?`
    );

    if (!confirmed) return;

    setSkipping(true);
    setSkipProgress(0);

    for (let i = 0; i < selectedPhotos.length; i++) {
      try {
        const response = await fetch('/api/skip-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ photoId: selectedPhotos[i].id }),
        });

        if (!response.ok) {
          throw new Error('Failed to skip photo');
        }

        setSkipProgress(i + 1);
      } catch (err) {
        console.error(`Error skipping photo ${selectedPhotos[i].id}:`, err);
        alert(`Failed to skip photo ${i + 1}. See console for details.`);
        break;
      }
    }

    setSkipping(false);
    setSkipProgress(0);
    refetch();
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
        <div className="admin-empty-text">No photos pending approval</div>
      </div>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="pending-toolbar">
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
          disabled={approving || skipping || selectedCount === 0}
        >
          {approving
            ? `Approving ${progress}/${selectedCount}...`
            : `Approve Selected (${selectedCount})`}
        </button>
        <button
          className="btn-skip-selected"
          onClick={handleSkipSelected}
          disabled={skipping || approving || selectedCount === 0}
        >
          {skipping
            ? `Skipping ${skipProgress}/${selectedCount}...`
            : `Skip Selected (${selectedCount})`}
        </button>
      </div>
      <div className="photo-grid">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            session={session}
            onAction={refetch}
            mode="pending"
            selected={selectedIds.has(photo.id)}
            onToggle={() => toggleSelection(photo.id)}
          />
        ))}
      </div>
    </div>
  );
}
