'use client';

import { useCallback, useEffect, useState } from 'react';

const STREAK_KEY = 'nawa_streak';
const BEST_KEY = 'nawa_streak_best';

/**
 * Streak + combo multiplier.
 * streak 0-1 -> x1, 2-4 -> x2, 5+ -> x3
 */
export function useStreak() {
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setStreak(Number(localStorage.getItem(STREAK_KEY)) || 0);
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next, nextBest) => {
    try {
      localStorage.setItem(STREAK_KEY, String(next));
      if (nextBest != null) localStorage.setItem(BEST_KEY, String(nextBest));
    } catch {
      /* ignore */
    }
  }, []);

  const incrementStreak = useCallback(() => {
    setStreak((prev) => {
      const next = prev + 1;
      setBest((prevBest) => {
        const nextBest = Math.max(prevBest, next);
        persist(next, nextBest);
        return nextBest;
      });
      return next;
    });
  }, [persist]);

  const resetStreak = useCallback(() => {
    setStreak(0);
    persist(0);
  }, [persist]);

  const comboMultiplier = streak >= 5 ? 3 : streak >= 2 ? 2 : 1;

  return { streak, best, comboMultiplier, incrementStreak, resetStreak, ready };
}
