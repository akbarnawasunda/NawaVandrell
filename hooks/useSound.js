'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SOUND_KEY = 'nawa_sound';

/**
 * WebAudio beep — tanpa file audio sama sekali.
 * correct = 800Hz, wrong = 200Hz (sesuai spek), combo = arpeggio naik.
 * AudioContext dibuat lazy karena browser butuh gesture user dulu.
 */
export function useSound() {
  const ctxRef = useRef(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SOUND_KEY);
      if (saved === 'off') setEnabled(false);
    } catch {
      /* ignore */
    }
    return () => {
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const getCtx = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioCtx();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const beep = useCallback(
    (freq, duration = 0.14, type = 'sine', delay = 0, volume = 0.18) => {
      if (!enabled) return;
      const ctx = getCtx();
      if (!ctx) return;
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    },
    [enabled, getCtx]
  );

  const playCorrect = useCallback(() => beep(800, 0.15, 'sine'), [beep]);
  const playWrong = useCallback(() => beep(200, 0.26, 'sawtooth', 0, 0.14), [beep]);
  const playCombo = useCallback(() => {
    beep(800, 0.1, 'sine', 0);
    beep(1000, 0.1, 'sine', 0.09);
    beep(1300, 0.16, 'sine', 0.18);
  }, [beep]);
  const playTick = useCallback(() => beep(560, 0.05, 'square', 0, 0.08), [beep]);
  const playEnd = useCallback(() => {
    beep(500, 0.14, 'triangle', 0);
    beep(380, 0.22, 'triangle', 0.13);
  }, [beep]);

  return { enabled, toggle, playCorrect, playWrong, playCombo, playTick, playEnd, beep };
}
