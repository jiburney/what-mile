import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';
import { useSignedUrl } from './useSignedUrl';

interface LibraryTileProps {
  photo: AdminPhoto;
  session: Session;
  onClick: () => void;
}

export function LibraryTile({ photo, session, onClick }: LibraryTileProps) {
  const { url, loading } = useSignedUrl(photo, session);

  return (
    <div className="library-tile" onClick={onClick}>
      {loading ? (
        <div className="library-tile-skeleton" />
      ) : (
        <>
          {url && <img src={url} alt={photo.locationName} className="library-tile-img" />}
          <div className="library-tile-label">{photo.locationName}</div>
        </>
      )}
    </div>
  );
}
