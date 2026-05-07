import { useState } from 'react';
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
  const [approving, setApproving] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleApproveAll = async () => {
    if (photos.length === 0) return;

    const confirmed = window.confirm(
      `Approve all ${photos.length} photo${photos.length !== 1 ? 's' : ''}?`
    );

    if (!confirmed) return;

    setApproving(true);
    setProgress(0);

    for (let i = 0; i < photos.length; i++) {
      try {
        const response = await fetch('/api/approve-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ photoId: photos[i].id }),
        });

        if (!response.ok) {
          throw new Error('Failed to approve photo');
        }

        setProgress(i + 1);
      } catch (err) {
        console.error(`Error approving photo ${photos[i].id}:`, err);
        alert(`Failed to approve photo ${i + 1}. See console for details.`);
        break;
      }
    }

    setApproving(false);
    setProgress(0);
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--parchment)' }}>
        <button
          className="btn-primary"
          onClick={handleApproveAll}
          disabled={approving}
        >
          {approving
            ? `Approving ${progress}/${photos.length}...`
            : `Approve All (${photos.length})`}
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
          />
        ))}
      </div>
    </div>
  );
}
