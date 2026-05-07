import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';
import { PhotoCard } from './PhotoCard';

interface ReviewViewProps {
  photos: AdminPhoto[];
  loading: boolean;
  session: Session;
  refetch: () => void;
}

export function ReviewView({ photos, loading, session, refetch }: ReviewViewProps) {
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
        <div className="admin-empty-text">No photos need review</div>
      </div>
    );
  }

  return (
    <div className="photo-grid">
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          session={session}
          onAction={refetch}
          mode="review"
        />
      ))}
    </div>
  );
}
