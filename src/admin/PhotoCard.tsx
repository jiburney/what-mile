import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';
import { Thumbnail } from './Thumbnail';

interface PhotoCardProps {
  photo: AdminPhoto;
  session: Session;
  mode: 'pending' | 'review' | 'skip' | 'upload' | 'library';
  selected?: boolean;
  onToggle?: () => void;
  onImageClick?: () => void;
}

export function PhotoCard({ photo, session, mode, selected, onToggle, onImageClick }: PhotoCardProps) {
  const handleCardClick = () => {
    if ((mode === 'pending' || mode === 'review') && onToggle && selected !== undefined) {
      onToggle();
    }
  };

  const showCheckbox = (mode === 'pending' || mode === 'review') && selected !== undefined;
  const cardClassName = `photo-card${selected ? ' selected' : ''}`;

  return (
    <div className={cardClassName} onClick={handleCardClick}>
      <Thumbnail photo={photo} session={session} onClick={onImageClick} />
      {showCheckbox && (
        <input
          type="checkbox"
          className="photo-card-checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
