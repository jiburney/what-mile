import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useGame } from '../hooks/useGame';
import { DailyStartScreen } from '../components/DailyStartScreen';
import { GameScreen } from '../components/GameScreen';
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
  const [showVeil, setShowVeil] = useState(false);
  const hasAutoStarted = useRef(false);

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

        if (isToday) {
          // Resume mid-game — preserved exactly as before: no veil, no
          // auto-start, just the existing local phase flag.
          const savedState = getDailyChallengeState();
          if (
            savedState?.lastPlayedDate === targetDate &&
            savedState.challengeId === data.challengeId &&
            savedState.completedRounds.length > 0 &&
            !savedState.finalScore
          ) {
            setDailyPhase('playing');
            return;
          }

          // Already completed today — leave dailyPhase at its default
          // 'start' so DailyStartScreen renders its already-played branch
          // (View Leaderboard action) instead of auto-starting into the veil.
          if (!canPlayToday()) {
            return;
          }
        }

        // Fresh start (today, not yet played — or viewing a past challenge
        // date). Reveal the veil; the actual startGame() call happens in the
        // effect below once this render's dailyPhotos/startGame are current.
        setShowVeil(true);
        setDailyPhase('playing');
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

  // Auto-start behind the veil once fresh photos are loaded. Reuses
  // handleStart() rather than calling startGame() directly, so the
  // localStorage clear/save semantics for a fresh game match exactly what
  // the button click used to do. Guarded against StrictMode's
  // mount/cleanup/remount double-invoke in dev.
  useEffect(() => {
    if (!showVeil || !dailyPhotos || hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    handleStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVeil, dailyPhotos]);

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

  // Playing phase - use shared GameScreen component
  const { phase, currentImage, pendingGuess, currentRound, rounds } = state;

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
      <GameScreen
        phase={phase}
        currentImage={currentImage}
        pendingGuess={pendingGuess}
        currentRound={currentRound}
        rounds={rounds}
        currentResult={currentResult}
        totalScore={totalScore}
        totalRounds={totalRounds}
        nextImage={null}
        setGuess={setGuess}
        lockInGuess={lockInGuess}
        nextRound={nextRound}
        headerTitle="Daily Challenge"
        showEntryVeil={showVeil}
        onDismissVeil={() => setShowVeil(false)}
        veilMode="daily"
      />
    </div>
  );
}
