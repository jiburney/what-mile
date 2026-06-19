import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';
import { Thumbnail } from './Thumbnail';

interface LibraryTileProps {
  photo: AdminPhoto;
  session: Session;
  onClick: () => void;
}

export function LibraryTile({ photo, session, onClick }: LibraryTileProps) {
  return (
    <div className="library-tile" onClick={onClick}>
      <Thumbnail photo={photo} session={session} />
      <div className="library-tile-label">{photo.locationName}</div>
    </div>
  );
}
