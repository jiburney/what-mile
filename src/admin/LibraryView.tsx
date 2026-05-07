import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';
import { PhotoCard } from './PhotoCard';

interface LibraryViewProps {
  photos: AdminPhoto[];
  loading: boolean;
  session: Session;
  refetch: () => void;
}

export function LibraryView({ photos, loading, session, refetch }: LibraryViewProps) {
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
        <div className="admin-empty-icon">📚</div>
        <div className="admin-empty-text">No approved photos yet</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="photo-card-meta" style={{ padding: '16px', borderBottom: '1px solid var(--parchment)' }}>
        Photos shown here are live in the game
      </div>
      <div className="photo-grid">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            session={session}
            onAction={refetch}
            mode="library"
          />
        ))}
      </div>
    </div>
  );
}
