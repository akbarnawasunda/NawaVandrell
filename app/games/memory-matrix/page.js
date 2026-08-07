'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '@/components/GameShell';
import { useMode } from '@/context/ModeContext';
import { useSound } from '@/hooks/useSound';
import { useStreak } from '@/hooks/useStreak';
import { usePlayer } from '@/hooks/usePlayer';

const GRID = 4;
const CELLS = GRID * GRID;

/** Level 1 -> 3 kotak, naik 1 tiap 2 level, maksimal 9. */
function targetCount(level) {
  return Math.min(3 + Math.floor((level - 1) / 2), 9);
}

function pickCells(count) {
  const pool = Array.from({ length: CELLS }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

export default function MemoryMatrixPage() {
  const sound = useSound();
  const { isPro } = useMode();
  const { streak, best, incrementStreak, resetStreak } = useStreak();
  const player = usePlayer();

  const [level, setLevel] = useState(1);
  const [pattern, setPattern] = useState([]);
  const [picked, setPicked] = useState([]);
  const [phase, setPhase] = useState('idle'); // idle | show | input | win | lose
  const [feedback, setFeedback] = useState(null);
  const timerRef = useRef(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const startLevel = useCallback(
    (lv) => {
      const cells = pickCells(targetCount(lv));
      setPattern(cells);
      setPicked([]);
      setFeedback(null);
      setPhase('show');
      if (timerRef.current) clearTimeout(timerRef.current);
      // makin tinggi level, makin singkat waktu lihat pola
      const showMs = Math.max(900, 2200 - lv * 110);
      timerRef.current = setTimeout(() => setPhase('input'), showMs);
    },
    []
  );

  const begin = () => {
    setLevel(1);
    startLevel(1);
  };

  const tap = (idx) => {
    if (phase !== 'input' || picked.includes(idx)) return;

    if (!pattern.includes(idx)) {
      resetStreak();
      sound.playWrong();
      setPicked((p) => [...p, idx]);
      setPhase('lose');
      setFeedback({ kind: 'no', text: `Salah kotak. Kamu sampai level ${level}.` });
      return;
    }

    const nextPicked = [...picked, idx];
    setPicked(nextPicked);
    sound.playTick();

    if (nextPicked.length === pattern.length) {
      const points = isPro ? level * 2 : level;
      player.addPoints(points);
      incrementStreak();
      sound.playCorrect();
      setPhase('win');
      setFeedback({ kind: 'ok', text: `Level ${level} selesai! +${points} poin` });
    }
  };

  const nextLevel = () => {
    const lv = level + 1;
    setLevel(lv);
    startLevel(lv);
  };

  const stats = [
    { label: 'Poin', value: player.score, color: 'var(--accent-soft)' },
    { label: 'Level', value: level },
    { label: 'Streak', value: streak > 0 ? `🔥${streak}` : '0', color: streak > 0 ? '#fbbf24' : undefined },
    { label: 'Rekor', value: best },
  ];

  const showing = phase === 'show';

  return (
    <GameShell
      title="Memory Matrix"
      desc="Ingat kotak yang menyala, lalu klik ulang."
      icon="🧠"
      stats={stats}
      sound={sound}
      playerName={player.name}
      score={player.score}
    >
      <div className="panel">
        {phase === 'idle' ? (
          <>
            <p className="question" style={{ marginTop: 0 }}>
              Ingat kotak yang menyala
            </p>
            <p className="hint" style={{ textAlign: 'center' }}>
              Kotak akan menyala sebentar. Setelah mati, klik kotak yang tadi menyala.
            </p>
            <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={begin}>
              Mulai
            </button>
          </>
        ) : (
          <>
            <p
              style={{
                textAlign: 'center',
                margin: '0 0 14px',
                fontSize: 15,
                color: showing ? 'var(--accent-soft)' : 'var(--text-faint)',
                fontWeight: 600,
              }}
            >
              {showing
                ? `Hafalkan ${pattern.length} kotak...`
                : phase === 'input'
                  ? `Klik ${pattern.length - picked.length} kotak lagi`
                  : `Level ${level}`}
            </p>

            <div className="matrix" role="grid" aria-label="Memory matrix">
              {Array.from({ length: CELLS }, (_, i) => {
                const isTarget = pattern.includes(i);
                const isPicked = picked.includes(i);
                const revealMistake = phase === 'lose' && isTarget;
                const wrongPick = phase === 'lose' && isPicked && !isTarget;
                const lit = showing ? isTarget : isPicked || revealMistake;

                return (
                  <button
                    key={i}
                    type="button"
                    className={`matrix-cell${lit ? ' on' : ''}${wrongPick ? ' bad' : ''}`}
                    onClick={() => tap(i)}
                    disabled={phase !== 'input'}
                    aria-label={`Kotak ${i + 1}`}
                  />
                );
              })}
            </div>

            {feedback ? <p className={`feedback ${feedback.kind}`}>{feedback.text}</p> : null}

            {phase === 'win' ? (
              <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={nextLevel}>
                Level {level + 1} →
              </button>
            ) : null}

            {phase === 'lose' ? (
              <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={begin}>
                Coba Lagi
              </button>
            ) : null}
          </>
        )}
      </div>
    </GameShell>
  );
}
