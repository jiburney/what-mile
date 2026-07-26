import { useState, useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { GameMap } from './GameMap';
import { RoundResult } from './RoundResult';
import { DailyEntryVeil } from './DailyEntryVeil';
import type { ImageConfig, RoundResult as RoundResultType } from '../types';

interface GameScreenProps {
  // Game state
  phase: string;
  currentImage: ImageConfig | null;
  pendingGuess: [number, number] | null;
  currentRound: number;
  rounds: RoundResultType[];
  currentResult: RoundResultType | null;
  totalScore: number;
  totalRounds: number;
  nextImage: ImageConfig | null;

  // Game actions
  setGuess: (coords: [number, number]) => void;
  lockInGuess: () => void;
  nextRound: () => void;

  // Display customization
  headerTitle?: string;
  showEntryVeil?: boolean;
  onDismissVeil?: () => void;
}

export function GameScreen({
  phase,
  currentImage,
  pendingGuess,
  currentRound,
  rounds,
  currentResult,
  totalScore,
  totalRounds,
  nextImage,
  setGuess,
  lockInGuess,
  nextRound,
  headerTitle = 'What Mile?',
  showEntryVeil = false,
  onDismissVeil,
}: GameScreenProps) {
  const [mapExpanded, setMapExpanded] = useState(false);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPan, setPhotoPan] = useState({ x: 0, y: 0 });
  const mapRef = useRef<LeafletMap | null>(null);
  const photoContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const showResult = phase === 'result';
  const isLastRound = currentRound + 1 >= totalRounds;

  // Reset map to collapsed and photo to 1x on round change
  useEffect(() => {
    setMapExpanded(false);
    setPhotoZoom(1);
    setPhotoPan({ x: 0, y: 0 });
  }, [currentRound]);

  // Re-clamp pan offset when panel resizes (map expand/collapse)
  useEffect(() => {
    setPhotoPan(current => clampPhotoPan(photoZoom, current));
  }, [mapExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNudge = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (!pendingGuess || !mapRef.current) return;
    const zoom = mapRef.current.getZoom();
    // Scale step to zoom: 25 pixels on screen at mid-AT latitude
    const degreesPerPixel = 360 / (256 * Math.pow(2, zoom) * Math.cos(40 * Math.PI / 180));
    const delta = degreesPerPixel * 25;

    const [lat, lng] = pendingGuess;
    const newGuess: [number, number] =
      dir === 'up' ? [lat + delta, lng] :
      dir === 'down' ? [lat - delta, lng] :
      dir === 'left' ? [lat, lng - delta] :
      [lat, lng + delta];
    setGuess(newGuess);
  };

  const handleLockInGuess = () => {
    lockInGuess();
  };

  // Clamp pan offset based on current zoom and container size
  const clampPhotoPan = (zoom: number, pan: { x: number; y: number }) => {
    const container = photoContainerRef.current;
    if (!container) return pan;

    const rect = container.getBoundingClientRect();
    const panelWidth = rect.width;
    const panelHeight = rect.height;

    // Assume photo fills container at 1x (object-fit: contain behavior)
    // At higher zoom, image is larger than panel
    const imageDisplayWidth = panelWidth;
    const imageDisplayHeight = panelHeight;

    const maxOffsetX = Math.max(0, (imageDisplayWidth * zoom - panelWidth) / 2);
    const maxOffsetY = Math.max(0, (imageDisplayHeight * zoom - panelHeight) / 2);

    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, pan.x)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, pan.y))
    };
  };

  // Photo zoom handlers
  const handlePhotoZoom = (delta: number) => {
    setPhotoZoom(prev => {
      const newZoom = Math.max(1, Math.min(3, prev + delta));
      // Clamp pan after zoom changes
      setPhotoPan(current => clampPhotoPan(newZoom, current));
      return newZoom;
    });
  };

  const handlePhotoWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handlePhotoZoom(delta);
  };

  const handlePhotoMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (photoZoom <= 1) return; // No panning at 1x
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - photoPan.x, y: e.clientY - photoPan.y };
  };

  const handlePhotoMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || photoZoom <= 1) return;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;

    // Clamp based on zoom and container size
    setPhotoPan(clampPhotoPan(photoZoom, { x: newX, y: newY }));
  };

  const handlePhotoMouseUp = () => {
    isDraggingRef.current = false;
  };

  // RESULT STATE - standalone layout
  if (showResult && currentImage && currentResult) {
    return (
      <div className="game-screen">
        <header className="game-header">
          <span className="header-title">{headerTitle}</span>
          <div className="round-pips">
            {Array.from({ length: totalRounds }, (_, i) => (
              <span
                key={i}
                className={`round-pip ${
                  i < rounds.length ? 'pip-done' : i === currentRound ? 'pip-active' : 'pip-future'
                }`}
              />
            ))}
          </div>
          <span className="header-score">Round {currentRound + 1} · {totalScore.toLocaleString()}</span>
        </header>

        <div className="result-layout">
          <div className="result-map-container">
            <GameMap
              key={currentRound}
              mapRef={mapRef}
              pendingGuess={pendingGuess}
              actualLocation={currentResult.image.coordinates}
              actualName={currentResult.image.locationName}
              showResult={true}
            />
            <div className="map-trail-labels">
              <span className="map-trail-label-top">Maine ↑</span>
              <span className="map-trail-label-bottom">↓ Georgia</span>
            </div>
          </div>
          <RoundResult
            result={currentResult}
            roundNumber={currentRound + 1}
            totalRounds={totalRounds}
            totalScore={totalScore}
            onNext={nextRound}
            isLastRound={isLastRound}
          />
        </div>

      </div>
    );
  }

  // NORMAL GAMEPLAY - two-panel layout
  return (
    <div className="game-screen">
      {/* Header */}
      <header className="game-header">
        <span className="header-title">{headerTitle}</span>
        <div className="round-pips">
          {Array.from({ length: totalRounds }, (_, i) => (
            <span
              key={i}
              className={`round-pip ${
                i < rounds.length ? 'pip-done' : i === currentRound ? 'pip-active' : 'pip-future'
              }`}
            />
          ))}
        </div>
        <span className="header-score">Round {currentRound + 1} · {totalScore.toLocaleString()}</span>
      </header>

      {currentImage && (
        <div className="game-panels">
          {/* Photo panel */}
          <div
            ref={photoContainerRef}
            className={`photo-panel ${mapExpanded ? 'minimized' : 'normal'}`}
            onWheel={handlePhotoWheel}
            onMouseDown={handlePhotoMouseDown}
            onMouseMove={handlePhotoMouseMove}
            onMouseUp={handlePhotoMouseUp}
            onMouseLeave={handlePhotoMouseUp}
            style={{ cursor: photoZoom > 1 ? 'grab' : 'default' }}
          >
            <div
              className="photo-bg"
              style={{ backgroundImage: `url(${currentImage.r2_url})` }}
            />
            <img
              src={currentImage.r2_url}
              alt="Somewhere on the Appalachian Trail"
              className="trail-photo"
              fetchPriority="high"
              loading="eager"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              style={{
                transform: `scale(${photoZoom}) translate(${photoPan.x / photoZoom}px, ${photoPan.y / photoZoom}px)`,
                transformOrigin: 'center center',
                transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out'
              }}
              draggable={false}
            />

            {/* Photo zoom controls */}
            <div className="photo-zoom-controls">
              <button
                className="zoom-btn"
                onClick={() => handlePhotoZoom(0.25)}
                disabled={photoZoom >= 3}
              >
                +
              </button>
              <div className="zoom-readout">{photoZoom.toFixed(1)}×</div>
              <button
                className="zoom-btn"
                onClick={() => handlePhotoZoom(-0.25)}
                disabled={photoZoom <= 1}
              >
                −
              </button>
            </div>
          </div>

          {/* Map panel */}
          <div className={`map-panel ${mapExpanded ? 'expanded' : 'collapsed'}`}>
            <div className="map-container">
              <GameMap
                key={currentRound}
                mapRef={mapRef}
                pendingGuess={pendingGuess}
                onGuess={setGuess}
                showResult={false}
              />

              {/* Expanded controls */}
              {mapExpanded && (
                <>
                  <div className="map-controls">
                    <div className="nudge-controls">
                      <button
                        className="nudge-btn"
                        onClick={() => handleNudge('up')}
                        style={{ gridArea: '1 / 2' }}
                        title="Nudge north"
                      >
                        ↑
                      </button>
                      <button
                        className="nudge-btn"
                        onClick={() => handleNudge('left')}
                        style={{ gridArea: '2 / 1' }}
                        title="Nudge west"
                      >
                        ←
                      </button>
                      <button
                        className="nudge-btn"
                        onClick={() => handleNudge('right')}
                        style={{ gridArea: '2 / 3' }}
                        title="Nudge east"
                      >
                        →
                      </button>
                      <button
                        className="nudge-btn"
                        onClick={() => handleNudge('down')}
                        style={{ gridArea: '3 / 2' }}
                        title="Nudge south"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      className="reset-view-btn"
                      onClick={() => mapRef.current?.fitBounds([[34.0, -84.5], [45.9, -68.0]])}
                      title="Reset to full trail"
                    >
                      ⟲
                    </button>
                  </div>
                  <div className="scale-readout">
                    {mapRef.current && (() => {
                      const zoom = mapRef.current.getZoom();
                      const center = mapRef.current.getCenter();
                      const milesPerPixel = (24901 * Math.cos(center.lat * Math.PI / 180)) / (256 * Math.pow(2, zoom));
                      return `${milesPerPixel.toFixed(1)} mi/px`;
                    })()}
                  </div>
                </>
              )}

              {/* Mobile collapsed: tap to expand overlay */}
              <div className="mobile-tap-overlay" onClick={() => setMapExpanded(true)}>
                Tap to expand map
              </div>

              {/* Trail labels */}
              <div className="map-trail-labels">
                <span className="map-trail-label-top">Maine ↑</span>
                <span className="map-trail-label-bottom">↓ Georgia</span>
              </div>
            </div>

            {/* Expand/collapse button */}
            <button className="map-toggle-btn" onClick={() => setMapExpanded(!mapExpanded)}>
              {mapExpanded ? '← Collapse map' : 'Expand map →'}
            </button>

            {/* Confirm area */}
            <div className="confirm-area">
              {pendingGuess && (
                <span className="pin-status">Pin placed — drag to adjust</span>
              )}
              <button
                className="btn-primary btn-confirm"
                disabled={!pendingGuess}
                onClick={handleLockInGuess}
              >
                Confirm guess
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preload next round's photo */}
      {nextImage && phase === 'guessing' && (
        <link rel="preload" as="image" href={nextImage.r2_url} />
      )}

      {/* Daily challenge entry veil */}
      {showEntryVeil && onDismissVeil && (
        <DailyEntryVeil onStart={onDismissVeil} />
      )}
    </div>
  );
}
