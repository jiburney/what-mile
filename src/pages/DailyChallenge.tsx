import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGame } from '../hooks/useGame';
import { DailyStartScreen } from '../components/DailyStartScreen';
import { GameMap } from '../components/GameMap';
import { RoundResult } from '../components/RoundResult';
import { GameSummary } from '../components/GameSummary';
import { NameCaptureModal } from '../components/NameCaptureModal';
import { DailyLeaderboard } from '../components/DailyLeaderboard';
import {
  canPlayToday,
  getTodayEastern,
  getClientFingerprint,
  saveDailyChallengeState,
  getDailyChallengeState,
  clearDailyChallengeGame,
} from '../utils/daily-challenge-storage';
import type { ImageConfig } from '../types';

type DailyPhase = 'start' | 'playing' | 'name-capture' | 'leaderboard';

export function DailyChallenge() {
  const { date } = useParams<{ date?: string }>();
  const targetDate = date || getTodayEastern();
  const isToday = targetDate === getTodayEastern();

  const [dailyPhase, setDailyPhase] = useState<DailyPhase>('start');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [dailyPhotos, setDailyPhotos] = useState<ImageConfig[] | null>(null);
  const [submittedScore, setSubmittedScore] = useState(false);

  const {
    state,
    currentResult,
    totalScore,
    totalRounds,
    startGame,
    setGuess,
    lockInGuess,
    nextRound,
    loading,
    error,
  } = useGame('daily', dailyPhotos);

  // Load today's challenge on mount
  useEffect(() => {
    async function loadChallenge() {
      try {
        const response = await fetch(`/api/daily?action=get-challenge&date=${targetDate}`);
        if (!response.ok) {
          throw new Error('Failed to load daily challenge');
        }

        const data = await response.json();
        setChallengeId(data.challengeId);
        setDailyPhotos(data.photos);

        // Check if we should resume mid-game
        if (isToday) {
          const savedState = getDailyChallengeState();
          if (
            savedState?.lastPlayedDate === targetDate &&
            savedState.challengeId === data.challengeId &&
            savedState.completedRounds.length > 0 &&
            !savedState.finalScore
          ) {
            // Resume in progress
            setDailyPhase('playing');
          } else if (savedState?.finalScore && savedState.lastPlayedDate === targetDate) {
            // Already completed today
            setDailyPhase('leaderboard');
          }
        }
      } catch (err) {
        console.error('Failed to load challenge:', err);
      }
    }

    loadChallenge();
  }, [targetDate, isToday]);

  // Save round progress to localStorage
  useEffect(() => {
    if (state.phase !== 'start' && isToday && challengeId) {
      saveDailyChallengeState({
        lastPlayedDate: targetDate,
        challengeId,
        completedRounds: state.rounds,
      });
    }
  }, [state.rounds, state.phase, isToday, challengeId, targetDate]);

  // Handle game completion
  useEffect(() => {
    if (state.phase === 'summary' && !submittedScore && isToday) {
      // Show name capture modal
      setDailyPhase('name-capture');
    }
  }, [state.phase, submittedScore, isToday]);

  const handleStart = () => {
    if (isToday && !canPlayToday()) {
      setDailyPhase('leaderboard');
      return;
    }

    if (isToday) {
      clearDailyChallengeGame();
      saveDailyChallengeState({
        lastPlayedDate: targetDate,
        challengeId: challengeId!,
        completedRounds: [],
      });
    }

    startGame();
    setDailyPhase('playing');
  };

  const handleViewLeaderboard = () => {
    setDailyPhase('leaderboard');
  };

  const handleSubmitScore = async (playerName: string | null, yearHiked: number | null) => {
    if (!challengeId) return;

    try {
      const fingerprint = getClientFingerprint();
      const overallTier = determineOverallTier(totalScore);

      const response = await fetch('/api/daily?action=submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          totalScore,
          overallTier,
          roundScores: state.rounds.map(r => r.score),
          clientFingerprint: fingerprint,
          playerName,
          yearHiked,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit score');
      }

      // Save final score to localStorage
      saveDailyChallengeState({
        finalScore: {
          total: totalScore,
          tier: overallTier,
          playerName: playerName || undefined,
          yearHiked: yearHiked || undefined,
        },
      });

      setSubmittedScore(true);
      setDailyPhase('leaderboard');
    } catch (err) {
      console.error('Submit score error:', err);
      alert('Failed to submit score. Please try again.');
    }
  };

  const handleSkipNameCapture = () => {
    handleSubmitScore(null, null);
  };

  function determineOverallTier(score: number): 'Thru-Hiker' | 'LASHer' | 'Section Hiker' | 'Day Hiker' {
    if (score >= 1760) return 'Thru-Hiker';
    if (score >= 1100) return 'LASHer';
    if (score >= 440) return 'Section Hiker';
    return 'Day Hiker';
  }

  // Loading/error states
  if (loading || !dailyPhotos) {
    return (
      <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Loading today's challenge...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#d32f2f' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Error loading challenge</div>
          <div style={{ fontSize: '1rem' }}>{error}</div>
        </div>
      </div>
    );
  }

  // Daily challenge phases
  if (dailyPhase === 'start') {
    return <DailyStartScreen onStart={handleStart} onViewLeaderboard={handleViewLeaderboard} />;
  }

  if (dailyPhase === 'leaderboard') {
    return challengeId ? (
      <DailyLeaderboard
        challengeId={challengeId}
        onPlayAgain={!isToday ? handleStart : undefined}
      />
    ) : null;
  }

  if (dailyPhase === 'name-capture') {
    return (
      <>
        <GameSummary
          rounds={state.rounds}
          totalScore={totalScore}
          onPlayAgain={() => {}} // No replay for daily mode
        />
        <NameCaptureModal
          onSubmit={handleSubmitScore}
          onSkip={handleSkipNameCapture}
        />
      </>
    );
  }

  // Playing phase - use standard game flow
  const { phase, currentImage, pendingGuess, currentRound, rounds } = state;
  const isLastRound = currentRound + 1 >= totalRounds;
  const showResult = phase === 'result';

  if (phase === 'summary') {
    return (
      <div className="app-layout">
        <GameSummary
          rounds={rounds}
          totalScore={totalScore}
          onPlayAgain={() => {}} // Handled by name-capture modal
        />
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Header bar */}
      <header className="game-header">
        <div className="game-header-left">
          <span className="header-title">Daily Challenge</span>
        </div>
        <div className="game-header-center">
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
        </div>
        <div className="game-header-right">
          <span className="header-score">{totalScore.toLocaleString()}</span>
        </div>
      </header>

      {/* Photo */}
      {currentImage && (
        <div className="photo-area">
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
          />
          <div className="photo-round-badge">
            Round {currentRound + 1} / {totalRounds}
          </div>
        </div>
      )}

      {/* Map */}
      <div className="map-area">
        <GameMap
          onGuess={setGuess}
          pendingGuess={pendingGuess}
          actualLocation={showResult ? currentResult?.image.coordinates : undefined}
          actualName={showResult ? currentResult?.image.locationName : undefined}
          showResult={showResult}
        />
        {!showResult && (
          <div className="map-overlay-bottom">
            {pendingGuess ? (
              <button className="btn-primary btn-lock" onClick={lockInGuess}>
                Lock In Guess
              </button>
            ) : (
              <div className="map-hint">Tap the trail to drop your pin</div>
            )}
          </div>
        )}
      </div>

      {/* Result panel */}
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
  );
}
