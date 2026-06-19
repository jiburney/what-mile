import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';
import { useSignedUrl } from './useSignedUrl';

interface LightboxProps {
  photo: AdminPhoto;
  session: Session;
  mode: 'pending' | 'review' | 'skip' | 'library';
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onAction: () => void;
}

export function Lightbox({
  photo,
  session,
  mode,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onAction,
}: LightboxProps) {
  const { url, loading } = useSignedUrl(photo, session);
  const [description, setDescription] = useState(photo.description || '');
  const [actionLoading, setActionLoading] = useState(false);

  // Lock body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext, onClose]);

  // Update description when photo changes
  useEffect(() => {
    setDescription(photo.description || '');
  }, [photo.id, photo.description]);

  const handleDescriptionBlur = async () => {
    if (description === (photo.description || '')) return;

    try {
      const response = await fetch('/api/update-photo', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          photoId: photo.id,
          description,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update description');
      }
    } catch (err) {
      console.error('Error updating description:', err);
      setDescription(photo.description || '');
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/approve-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ photoId: photo.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve photo');
      }

      onAction();
      onClose();
    } catch (err) {
      console.error('Error approving photo:', err);
      alert('Failed to approve photo. See console for details.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/skip-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ photoId: photo.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to skip photo');
      }

      onAction();
      onClose();
    } catch (err) {
      console.error('Error skipping photo:', err);
      alert('Failed to skip photo. See console for details.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescue = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/update-photo', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          photoId: photo.id,
          status: 'pending',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to rescue photo');
      }

      onAction();
      onClose();
    } catch (err) {
      console.error('Error rescuing photo:', err);
      alert('Failed to rescue photo. See console for details.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/remove-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ photoId: photo.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove photo from game');
      }

      onAction();
      onClose();
    } catch (err) {
      console.error('Error removing photo:', err);
      alert('Failed to remove photo from game. See console for details.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return null;
    }
  };

  const formatCoords = (lat?: number, lng?: number) => {
    if (lat === undefined || lng === undefined) return null;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  const getModeLabel = () => {
    switch (mode) {
      case 'pending':
        return 'Pending approval';
      case 'review':
        return 'Needs review';
      case 'skip':
        return 'Skipped';
      case 'library':
        return 'In game library';
    }
  };

  const coords = formatCoords(photo.coordinates[0], photo.coordinates[1]);

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-panel" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {loading ? (
          <div className="thumbnail-skeleton" style={{ aspectRatio: '4/3', width: '100%' }} />
        ) : (
          url && (
            <img
              src={url}
              alt={photo.locationName}
              className="lightbox-img"
              onClick={(e) => e.stopPropagation()}
            />
          )
        )}

        <div className="lightbox-location">{photo.locationName}</div>

        <div className="lightbox-meta">
          {photo.trail_section && <span>{photo.trail_section}</span>}
          {photo.trail_section && formatDate(photo.taken_at) && <span> • </span>}
          {formatDate(photo.taken_at)}
          {coords && (
            <>
              {(photo.trail_section || formatDate(photo.taken_at)) && <span> • </span>}
              <span>{coords}</span>
            </>
          )}
        </div>

        {photo.triage_reason && (
          <div className="lightbox-triage-reason">
            <strong>{getModeLabel()}:</strong> {photo.triage_reason}
          </div>
        )}

        <textarea
          className="lightbox-description"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
        />

        <div className="lightbox-actions">
          {(mode === 'pending' || mode === 'review') && (
            <>
              <button
                className="btn-approve"
                onClick={handleApprove}
                disabled={actionLoading}
              >
                {actionLoading ? 'Approving...' : 'Approve'}
              </button>
              <button
                className="btn-skip"
                onClick={handleSkip}
                disabled={actionLoading}
              >
                {actionLoading ? 'Skipping...' : 'Skip'}
              </button>
            </>
          )}
          {mode === 'skip' && (
            <button
              className="btn-rescue"
              onClick={handleRescue}
              disabled={actionLoading}
            >
              {actionLoading ? 'Rescuing...' : 'Rescue'}
            </button>
          )}
          {mode === 'library' && (
            <button
              className="btn-skip"
              onClick={handleRemove}
              disabled={actionLoading}
            >
              {actionLoading ? 'Removing...' : 'Remove from Game'}
            </button>
          )}
        </div>

        <div className="lightbox-nav">
          <button
            className="lightbox-nav-btn lightbox-nav-prev"
            onClick={onPrev}
            disabled={!hasPrev}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            className="lightbox-nav-btn lightbox-nav-next"
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
