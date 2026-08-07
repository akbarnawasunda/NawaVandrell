'use client';

import { useCallback, useEffect, useState } from 'react';

const NAME_KEY = 'nawa_username';
const BOARD_KEY = 'nawa_leaderboard';

function readBoard() {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Identitas pemain + skor lokal.
 * Skor disimpan di localStorage `nawa_leaderboard` sebagai { username: score }
 * lalu di-sync ke server. Kalau server menolak (butuh token), skor lokal tetap jalan.
 */
export function usePlayer() {
  const [name, setName] = useState('');
  const [score, setScore] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY) || '';
      setName(saved);
      if (saved) setScore(Number(readBoard()[saved]) || 0);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const saveName = useCallback((raw) => {
    const clean = String(raw || '').trim().slice(0, 24);
    if (!clean) return false;
    setName(clean);
    try {
      localStorage.setItem(NAME_KEY, clean);
      setScore(Number(readBoard()[clean]) || 0);
    } catch {
      /* ignore */
    }
    return true;
  }, []);

  const addPoints = useCallback(
    (points) => {
      const delta = Number(points) || 0;
      if (!delta) return score;

      let next = score + delta;
      setScore(next);

      if (name) {
        try {
          const board = readBoard();
          board[name] = Math.max(Number(board[name]) || 0, next);
          localStorage.setItem(BOARD_KEY, JSON.stringify(board));
        } catch {
          /* ignore */
        }
        // sync best-effort; endpoint publik hanya menerima kenaikan
        fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, score: next }),
        }).catch(() => {});
      }
      return next;
    },
    [name, score]
  );

  const localBoard = useCallback(() => {
    return Object.entries(readBoard())
      .map(([n, s]) => ({ name: n, score: Number(s) || 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, []);

  return { name, score, ready, saveName, addPoints, localBoard };
}
