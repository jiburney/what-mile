import { useState, useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { GameMap } from './GameMap';
import { RoundResult } from './RoundResult';
import { PhotoFullscreen } from './PhotoFullscreen';
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
  const [photoFullscreen, setPhotoFullscreen] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  const showResult = phase === 'result';
  const isLastRound = currentRound + 1 >= totalRounds;

  // Reset map to collapsed on round change
  useEffect(() => {
    setMapExpanded(false);
  }, [currentRound]);

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

        {photoFullscreen && currentImage && (
          <PhotoFullscreen
            imageUrl={currentImage.r2_url}
            onClose={() => setPhotoFullscreen(false)}
          />
        )}
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
          <div className={`photo-panel ${mapExpanded ? 'minimized' : 'normal'}`}>
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
              onClick={() => setPhotoFullscreen(true)}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <button className="enlarge-photo-hint" onClick={() => setPhotoFullscreen(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                <circle cx="11" cy="11" r="7"></circle>
                <path d="M16.5 16.5 L21 21"></path>
                <path d="M8 11h6"></path>
                <path d="M11 8v6"></path>
              </svg>
              <span>Click photo to enlarge</span>
            </button>
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

      {/* Photo fullscreen viewer */}
      {photoFullscreen && currentImage && (
        <PhotoFullscreen
          imageUrl={currentImage.r2_url}
          onClose={() => setPhotoFullscreen(false)}
        />
      )}

      {/* Daily challenge entry veil */}
      {showEntryVeil && onDismissVeil && (
        <DailyEntryVeil onStart={onDismissVeil} />
      )}
    </div>
  );
}
