import { useEffect, useState } from 'react';

interface Props {
  imageUrl: string;
  onClose: () => void;
}

export function PhotoFullscreen({ imageUrl, onClose }: Props) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleZoomIn = () => setZoom(Math.min(4, zoom + 0.5));
  const handleZoomOut = () => setZoom(Math.max(1, zoom - 0.5));

  return (
    <div className="photo-fullscreen">
      <div
        className="photo-fullscreen-image"
        style={{
          backgroundImage: `url(${imageUrl})`,
          transform: `scale(${zoom})`,
        }}
      />

      <button className="photo-fullscreen-close" onClick={onClose}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6 L18 18"></path>
          <path d="M18 6 L6 18"></path>
        </svg>
      </button>

      <div className="photo-fullscreen-controls">
        <button className="zoom-btn" onClick={handleZoomOut}>−</button>
        <span className="zoom-label">{zoom.toFixed(1)}×</span>
        <button className="zoom-btn" onClick={handleZoomIn}>+</button>
        <div className="zoom-divider"></div>
        <span className="photo-fullscreen-hint">Scroll to zoom · esc to close</span>
      </div>
    </div>
  );
}
