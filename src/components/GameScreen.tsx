import { useState, useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { GameMap } from './GameMap';
import { GameHeader } from './GameHeader';
import { RoundResult } from './RoundResult';
import { EntryVeil } from './EntryVeil';
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
  veilMode?: 'free-play' | 'daily';
  resumeRoundNumber?: number;
  completedCount?: number;
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
  veilMode = 'free-play',
  resumeRoundNumber,
  completedCount,
}: GameScreenProps) {
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPan, setPhotoPan] = useState({ x: 0, y: 0 });
  const mapRef = useRef<LeafletMap | null>(null);
  const photoContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const showResult = phase === 'result';
  const isLastRound = currentRound + 1 >= totalRounds;

  // Reset photo to 1x on round change
  useEffect(() => {
    setPhotoZoom(1);
    setPhotoPan({ x: 0, y: 0 });
  }, [currentRound]);

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

  // UNIFIED LAYOUT - persistent map shared across guessing and result phases
  return (
    <div className="game-screen">
      {/* Header */}
      <GameHeader
        title={headerTitle}
        roundsCompleted={rounds.length}
        currentRound={currentRound}
        totalRounds={totalRounds}
        score={totalScore}
      />

      {currentImage && (
        <>
        <div className={`game-panels ${showResult ? 'result-mode' : ''}`}>
          {/* Photo panel - visible during both guessing and result phases */}
          <div
            ref={photoContainerRef}
            className="photo-panel"
            onWheel={handlePhotoWheel}
            onMouseDown={handlePhotoMouseDown}
            onMouseMove={handlePhotoMouseMove}
            onMouseUp={handlePhotoMouseUp}
            onMouseLeave={handlePhotoMouseUp}
            style={{
              cursor: photoZoom > 1 ? 'grab' : 'default',
              order: 1
            }}
          >
            {/* Photo content wrapper - clips photo/controls only, not result card */}
            <div className="photo-content-wrapper">
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

              {/* Photo zoom controls - guessing phase only */}
              {!showResult && (
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
              )}
            </div>

            {/* Result card overlay - anchored to bottom of photo panel */}
            {showResult && currentResult && (
              <RoundResult
                result={currentResult}
                roundNumber={currentRound + 1}
                totalRounds={totalRounds}
                totalScore={totalScore}
                onNext={nextRound}
                isLastRound={isLastRound}
              />
            )}
          </div>

          {/* Map panel - persistent across both phases, fixed size always */}
          <div
            className="map-panel"
            style={{ order: 2 }}
          >
            <div className="map-container">
              <GameMap
                mapRef={mapRef}
                pendingGuess={pendingGuess}
                onGuess={setGuess}
                actualLocation={showResult && currentResult ? currentResult.image.coordinates : undefined}
                actualName={showResult && currentResult ? currentResult.image.locationName : undefined}
                showResult={showResult}
              />

              {/* Trail direction chips */}
              <span className="map-trail-chip chip-top-left">
                <span className="chip-arrow">↑</span>NOBO
              </span>
              <span className="map-trail-chip chip-bottom-left">
                <span className="chip-arrow">↓</span>SOBO
              </span>
            </div>
          </div>
        </div>

        {/* Persistent confirm/next button - normal flow, always present */}
        <button
          className="btn-primary btn-persistent-action"
          disabled={!showResult && !pendingGuess}
          onClick={showResult ? nextRound : handleLockInGuess}
        >
          {showResult
            ? (isLastRound ? 'See Final Score' : `Round ${currentRound + 2} →`)
            : 'Confirm guess'
          }
        </button>
        </>
      )}

      {/* Preload next round's photo */}
      {nextImage && phase === 'guessing' && (
        <link rel="preload" as="image" href={nextImage.r2_url} />
      )}

      {/* Entry veil — shown over the loading/loaded first round until dismissed */}
      {showEntryVeil && onDismissVeil && (
        <EntryVeil
          mode={veilMode}
          onStart={onDismissVeil}
          imageUrl={currentImage?.r2_url}
          resumeRoundNumber={resumeRoundNumber}
          completedCount={completedCount}
        />
      )}
    </div>
  );
}
