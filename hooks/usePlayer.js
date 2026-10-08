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

async function syncScoreToServer(playerName, newScore) {
  if (!playerName || typeof newScore !== 'number' || newScore <= 0) return;
  try {
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName, score: newScore }),
    });
  } catch {}
}

export function usePlayer() {
  const [ready, setReady] = useState(false);
  const [name, setNameState] = useState('');
  const [score, setScoreState] = useState(0);

  useEffect(() => {
    const curName = readName();
    const curScore = readScore();
    setNameState(curName);
    setScoreState(curScore);
    setReady(true);
    if (curName && curScore > 0) {
      syncScoreToServer(curName, curScore);
    }
  }, []);

  const saveName = useCallback((raw) => {
    const clean = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!clean) return false;
    try { localStorage.setItem(NAME_KEY, clean); } catch {}
    setNameState(clean);
    const curScore = readScore();
    if (curScore > 0) syncScoreToServer(clean, curScore);
    return true;
  }, []);

  const setScore = useCallback((value) => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    try { localStorage.setItem(SCORE_KEY, String(n)); } catch {}
    setScoreState(n);
    const curName = readName();
    if (curName && n > 0) syncScoreToServer(curName, n);
    return n;
  }, []);

  const addScore = useCallback((delta) => {
    const n = Math.max(0, Math.floor(readScore() + (Number(delta) || 0)));
    try { localStorage.setItem(SCORE_KEY, String(n)); } catch {}
    setScoreState(n);
    const curName = readName();
    if (curName && n > 0) syncScoreToServer(curName, n);
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
