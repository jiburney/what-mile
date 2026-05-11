import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';

interface PhotoCardProps {
  photo: AdminPhoto;
  session: Session;
  onAction: () => void;
  mode: 'pending' | 'review' | 'skip' | 'upload' | 'library';
  selected?: boolean;
  onToggle?: () => void;
}

export function PhotoCard({ photo, session, onAction, mode, selected, onToggle }: PhotoCardProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState(photo.description || '');
  const [actionLoading, setActionLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > el.clientHeight);
  }, [description, expanded]);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!photo.is_private) {
        // Public photo — use direct URL
        setSignedUrl(photo.r2_url);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/signed-url?key=${encodeURIComponent(photo.r2_url)}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch signed URL');
        }

        const data = await response.json();
        setSignedUrl(data.url);
      } catch (err) {
        console.error('Error fetching signed URL:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [photo.r2_url, photo.is_private, session.access_token]);

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

      // Update successful — photo.description will be updated on next refetch
    } catch (err) {
      console.error('Error updating description:', err);
      // Revert to original
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

  const handleCardClick = () => {
    if (mode === 'pending' && onToggle && selected !== undefined) {
      onToggle();
    }
  };

  const showCheckbox = mode === 'pending' && selected !== undefined;
  const cardClassName = `photo-card${selected ? ' selected' : ''}`;

  return (
    <div className={cardClassName} onClick={handleCardClick}>
      {loading ? (
        <div className="photo-card-img-skeleton" />
      ) : (
        <div className="photo-card-img-wrapper">
          {signedUrl && <img src={signedUrl} alt={photo.locationName} className="photo-card-img" />}
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
      )}

      <div className="photo-card-body">
        <div className="photo-card-location">{photo.locationName}</div>
        <div className="photo-card-meta">
          {photo.trail_section && <span>{photo.trail_section}</span>}
          {photo.trail_section && formatDate(photo.taken_at) && <span> • </span>}
          {formatDate(photo.taken_at)}
        </div>
        {photo.status === 'skip' && (
          <div className="photo-card-reason">{photo.description || 'Skipped by triage'}</div>
        )}
        <textarea
          ref={textareaRef}
          className="photo-card-description"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          style={{ minHeight: expanded ? '200px' : '60px' }}
        />
        {(isOverflowing || expanded) && (
          <button
            type="button"
            className="photo-card-expand"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {mode !== 'upload' && (
        <div className="photo-card-actions">
          {(mode === 'pending' || mode === 'review') && (
            <>
              <button
                className="btn-approve"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApprove();
                }}
                disabled={actionLoading}
              >
                {actionLoading ? 'Approving...' : 'Approve'}
              </button>
              <button
                className="btn-skip"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSkip();
                }}
                disabled={actionLoading}
              >
                Skip
              </button>
            </>
          )}
          {mode === 'skip' && (
            <button
              className="btn-rescue"
              onClick={(e) => {
                e.stopPropagation();
                handleRescue();
              }}
              disabled={actionLoading}
            >
              {actionLoading ? 'Rescuing...' : 'Rescue'}
            </button>
          )}
          {mode === 'library' && (
            <button
              className="btn-skip"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              disabled={actionLoading}
            >
              {actionLoading ? 'Removing...' : 'Remove from Game'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
