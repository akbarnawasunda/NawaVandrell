'use client';

/**
 * Simple Mode (default) vs Pro Mode.
 * Mode disimpan di localStorage `nawa_mode` dan ditulis ke
 * <html data-mode="..."> supaya CSS variables yang ganti tema.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ModeContext = createContext({ mode: 'simple', setMode: () => {}, isPro: false });

const STORAGE_KEY = 'nawa_mode';

export function ModeProvider({ children }) {
  const [mode, setModeState] = useState('simple');

  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage diblokir */
    }
    if (saved === 'pro' || saved === 'simple') {
      setModeState(saved);
      document.documentElement.dataset.mode = saved;
    } else {
      document.documentElement.dataset.mode = 'simple';
    }
  }, []);

  const setMode = useCallback((next) => {
    const value = next === 'pro' ? 'pro' : 'simple';
    setModeState(value);
    document.documentElement.dataset.mode = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ mode, setMode, isPro: mode === 'pro' }), [mode, setMode]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}
