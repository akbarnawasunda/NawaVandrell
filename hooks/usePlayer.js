'use client';

import { useCallback, useEffect, useState } from 'react';

const NAME_KEY = 'nawa_player_name';
const SCORE_KEY = 'nawa_player_score';

function readName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}

function readScore() {
  try { return Number(localStorage.getItem(SCORE_KEY)) || 0; } catch { return 0; }
}

export function usePlayer() {
  const [ready, setReady] = useState(false);
  const [name, setNameState] = useState('');
  const [score, setScoreState] = useState(0);

  useEffect(() => {
    setNameState(readName());
    setScoreState(readScore());
    setReady(true);
  }, []);

  const saveName = useCallback((raw) => {
    const clean = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!clean) return false;
    try { localStorage.setItem(NAME_KEY, clean); } catch {}
    setNameState(clean);
    return true;
  }, []);

  const setScore = useCallback((value) => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    try { localStorage.setItem(SCORE_KEY, String(n)); } catch {}
    setScoreState(n);
    return n;
  }, []);

  const addScore = useCallback((delta) => {
    const n = Math.max(0, Math.floor(readScore() + (Number(delta) || 0)));
    try { localStorage.setItem(SCORE_KEY, String(n)); } catch {}
    setScoreState(n);
    return n;
  }, []);

  const localBoard = useCallback(() => {
    const n = readName();
    const s = readScore();
    if (!n || s <= 0) return [];
    return [{ name: n, score: s }];
  }, []);

  return {
    ready,
    name,
    score,
    saveName,
    setName: saveName,
    setScore,
    addScore,
    localBoard,
  };
}
