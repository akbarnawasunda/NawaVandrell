// context/ModeContext.js

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const MODE_KEY = 'nawa_mode';
const VALID_MODES = new Set(['simple', 'pro']);

const ModeContext = createContext(null);

function getInitialMode() {
  // SSR-safe default. Jangan baca localStorage di sini biar gak hydration mismatch.
  return 'simple';
}

function applyModeToDom(mode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.mode = mode;
}

function persistMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // localStorage bisa gagal di private browsing atau storage full.
    // Mode tetep jalan, cuma gak persist.
  }
}

export function ModeProvider({ children }) {
  const [mode, setModeState] = useState(getInitialMode);
  const [hydrated, setHydrated] = useState(false);

  // Hydration: baca localStorage sekali di client, sinkronin sama inline script di layout.js
  useEffect(() => {
    setHydrated(true);

    let stored = null;
    try {
      stored = localStorage.getItem(MODE_KEY);
    } catch {
      // ignore
    }

    const resolved = VALID_MODES.has(stored) ? stored : 'simple';

    setModeState(resolved);
    applyModeToDom(resolved);
  }, []);

  const setMode = useCallback((next) => {
    const clean = VALID_MODES.has(next) ? next : 'simple';

    setModeState(clean);
    applyModeToDom(clean);
    persistMode(clean);
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'pro' ? 'simple' : 'pro';
      applyModeToDom(next);
      persistMode(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggle,
      isPro: mode === 'pro',
      isSimple: mode === 'simple',
      hydrated,
    }),
    [mode, setMode, toggle, hydrated]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);

  if (!ctx) {
    throw new Error('useMode() harus dipake di dalam <ModeProvider>');
  }

  return ctx;
}

export default ModeProvider;
