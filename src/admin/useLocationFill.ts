import { useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';

export function useLocationFill(session: Session | null, onComplete: () => void) {
  const [filling, setFilling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [needsFilling, setNeedsFilling] = useState(0);

  const checkNeedsFilling = useCallback(async () => {
    if (!session) return;

    try {
      const response = await fetch('/api/enrich?action=count-need-location', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNeedsFilling(data.count || 0);
      }
    } catch (err) {
      console.error('Error checking photos needing location:', err);
    }
  }, [session]);

  const startFill = useCallback(async () => {
    if (!session || filling) return;

    setFilling(true);
    setProgress(0);
    setTotal(needsFilling);

    let totalProcessed = 0;

    // Loop until no photos remain
    while (true) {
      try {
        const response = await fetch('/api/enrich?action=fill-locations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fill locations');
        }

        const data = await response.json();
        totalProcessed += data.processed;
        setProgress(totalProcessed);

        if (data.remaining === 0) {
          // Done
          break;
        }
      } catch (err) {
        console.error('Error filling locations:', err);
        alert('Failed to fill locations. See console for details.');
        break;
      }
    }

    setFilling(false);
    setProgress(0);
    onComplete();
    // Recheck count after completion
    await checkNeedsFilling();
  }, [session, filling, needsFilling, onComplete, checkNeedsFilling]);

  return {
    filling,
    progress,
    total,
    needsFilling,
    checkNeedsFilling,
    startFill,
  };
}
