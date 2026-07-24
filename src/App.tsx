import { useState, useEffect } from 'react';
import { useGame } from './hooks/useGame';
import { StartScreen } from './components/StartScreen';
import { GameMap } from './components/GameMap';
import { RoundResult } from './components/RoundResult';
import { GameSummary } from './components/GameSummary';
import { PhotoFullscreen } from './components/PhotoFullscreen';
import { DailyEntryVeil } from './components/DailyEntryVeil';

export default function App() {
  const {
    state,
    currentResult,
    totalScore,
    totalRounds,
    nextImage,
    startGame,
    setGuess,
    lockInGuess,
    nextRound,
    loading,
    error,
  } = useGame();

  const { phase, currentImage, pendingGuess, currentRound, rounds } = state;
  const isLastRound = currentRound + 1 >= totalRounds;

  const [mapExpanded, setMapExpanded] = useState(false);
  const [photoFullscreen, setPhotoFullscreen] = useState(false);
  const [showEntryVeil, setShowEntryVeil] = useState(false);

  // Show entry veil for daily challenge on first load
  useEffect(() => {
    const isDailyChallenge = window.location.pathname === '/daily';
    if (isDailyChallenge && phase === 'guessing' && currentRound === 0 && currentImage) {
      setShowEntryVeil(true);
    }
  }, [phase, currentRound, currentImage]);

  // Loading state
  if (loading) {
    return (
      <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Loading photos...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#d32f2f' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Error loading photos</div>
          <div style={{ fontSize: '1rem' }}>{error}</div>
        </div>
      </div>
    );
  }

  if (phase === 'start') {
    return <StartScreen onStart={startGame} />;
  }

  if (phase === 'summary') {
    return (
      <div className="app-layout">
        <GameSummary
          rounds={rounds}
          totalScore={totalScore}
          onPlayAgain={startGame}
        />
      </div>
    );
  }

  const showResult = phase === 'result';

  const handleLockInGuess = () => {
    lockInGuess();
    setMapExpanded(true); // Keep map expanded for result
  };

  return (
    <div className="app-layout">
      <div className="game-screen">
        {/* Header floats over photo */}
        <header className="game-header">
          <span className="header-title">What Mile?</span>
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

        {/* Photo fills viewport */}
        {currentImage && (
          <div className="photo-viewport">
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
              onClick={() => !showResult && setPhotoFullscreen(true)}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />

            {/* Enlarge hint (bottom-left) */}
            {!showResult && (
              <button className="enlarge-photo-hint" onClick={() => setPhotoFullscreen(true)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7"></circle>
                  <path d="M16.5 16.5 L21 21"></path>
                  <path d="M8 11h6"></path>
                  <path d="M11 8v6"></path>
                </svg>
                <span>Click photo to enlarge</span>
              </button>
            )}

            {/* Map card collapsed */}
            {!mapExpanded && !showResult && (
              <button className="map-card-collapsed" onClick={() => setMapExpanded(true)}>
                <div className="map-card-collapsed-preview">
                  <svg viewBox="0 0 200 130" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                    <rect x="0" y="0" width="200" height="130" fill="#ede9e1"></rect>
                    <path d="M0,96 L60,90 L130,94 L200,86" stroke="#c9c3b6" strokeWidth="1" fill="none"></path>
                    <path d="M0,52 L70,46 L140,52 L200,44" stroke="#c9c3b6" strokeWidth="1" fill="none"></path>
                    <path d="M52,128 L60,112 L68,96 L78,80 L88,64 L98,50 L108,36 L118,22 L126,8" stroke="#2d5016" strokeWidth="2.6" fill="none" strokeLinecap="round"></path>
                  </svg>
                </div>
                <div className="map-card-collapsed-footer">
                  <span className="map-card-label">Open map to guess</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d5016" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M7 14 L12 9 L17 14"></path>
                  </svg>
                </div>
              </button>
            )}

            {/* Map card expanded */}
            {(mapExpanded || showResult) && (
              <div className={`map-card-expanded ${showResult ? 'has-result' : ''}`}>
                <div className={`map-card-map-container ${showResult ? 'has-result' : ''}`}>
                  <GameMap
                    onGuess={setGuess}
                    pendingGuess={pendingGuess}
                    actualLocation={showResult ? currentResult?.image.coordinates : undefined}
                    actualName={showResult ? currentResult?.image.locationName : undefined}
                    showResult={showResult}
                  />

                  {/* Zoom controls inside map */}
                  <div className="map-zoom-controls">
                    <button className="map-zoom-btn">+</button>
                    <button className="map-zoom-btn">−</button>
                  </div>

                  {/* Maine/Georgia labels */}
                  <div className="map-trail-labels">
                    <span className="map-trail-label-top">Maine ↑</span>
                    <span className="map-trail-label-bottom">↓ Georgia</span>
                  </div>
                </div>

                {/* Map footer (guessing state only) */}
                {!showResult && (
                  <div className="map-card-footer">
                    <span className="map-pin-status">Pin dropped — drag to adjust</span>
                    <div className="map-card-actions">
                      <button className="map-close-btn" onClick={() => setMapExpanded(false)}>Close</button>
                      <button
                        className="btn-primary btn-lock"
                        onClick={handleLockInGuess}
                        disabled={!pendingGuess}
                      >
                        Confirm guess
                      </button>
                    </div>
                  </div>
                )}

                {/* Result panel (result state only) */}
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
            )}
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
        {showEntryVeil && (
          <DailyEntryVeil onStart={() => setShowEntryVeil(false)} />
        )}
      </div>
    </div>
  );
}
