'use client';

import { useCallback, useEffect, useState } from 'react';
import GameShell from '@/components/GameShell';
import { useMode } from '@/context/ModeContext';
import { useSound } from '@/hooks/useSound';
import { useStreak } from '@/hooks/useStreak';
import { usePlayer } from '@/hooks/usePlayer';
import { makeLogicQuestion } from '@/data/arcadeData';

const GATE_HINT = {
  AND: 'Output 1 kalau KEDUA input 1.',
  OR: 'Output 1 kalau SALAH SATU input 1.',
  NAND: 'Kebalikan AND.',
  NOR: 'Kebalikan OR.',
  XOR: 'Output 1 kalau input BEDA.',
  XNOR: 'Output 1 kalau input SAMA.',
};

export default function LogicGatePage() {
  const { isPro } = useMode();
  const sound = useSound();
  const { streak, best, comboMultiplier, incrementStreak, resetStreak } = useStreak();
  const player = usePlayer();

  const [q, setQ] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const next = useCallback(() => {
    setQ(makeLogicQuestion());
    setFeedback(null);
    setAnswered(false);
  }, []);

  useEffect(() => {
    next();
  }, [next]);

  const pick = (value) => {
    if (!q || answered) return;
    setAnswered(true);
    setAttempts((n) => n + 1);

    if (value === q.answer) {
      const points = isPro ? 2 * comboMultiplier : 2;
      setCorrectCount((n) => n + 1);
      player.addPoints(points);
      incrementStreak();
      if (streak >= 2) sound.playCombo();
      else sound.playCorrect();
      setFeedback({ kind: 'ok', text: `Benar! +${points} poin` });
    } else {
      resetStreak();
      sound.playWrong();
      setFeedback({ kind: 'no', text: `Salah. Output ${q.gate} yang benar adalah ${q.answer}.` });
    }
  };

  const stats = [
    { label: 'Poin', value: player.score, color: 'var(--accent-soft)' },
    { label: 'Benar', value: `${correctCount}/${attempts}` },
    { label: 'Streak', value: streak > 0 ? `🔥${streak}` : '0', color: streak > 0 ? '#fbbf24' : undefined },
    { label: 'Rekor', value: best },
  ];

  return (
    <GameShell
      title="Logic Gate Puzzle"
      desc="Tentukan output dari gerbang logika."
      icon="⚡"
      stats={stats}
      sound={sound}
      playerName={player.name}
      score={player.score}
    >
      <div className="panel">
        <p className="question" style={{ marginTop: 0 }}>
          Berapa output-nya?
        </p>

        <div className="gate-box">
          <div className="gate-io">
            <span className="gate-pin">A = {q?.a}</span>
            <span className="gate-pin">B = {q?.b}</span>
          </div>
          <div className="gate-name">{q?.gate}</div>
          <div className="gate-out">? </div>
        </div>

        {isPro ? <p className="hint" style={{ textAlign: 'center' }}>{GATE_HINT[q?.gate]}</p> : null}

        <div className="btn-row" style={{ marginTop: 14 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => pick(0)} disabled={answered}>
            0
          </button>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => pick(1)} disabled={answered}>
            1
          </button>
        </div>

        {feedback ? <p className={`feedback ${feedback.kind}`}>{feedback.text}</p> : null}

        {answered ? (
          <button type="button" className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={next}>
            Soal Berikutnya →
          </button>
        ) : null}
      </div>

      {!isPro ? (
        <p className="hint" style={{ textAlign: 'center' }}>
          Tabel kebenaran: AND butuh dua-duanya 1, OR cukup satu, XOR harus beda. NAND/NOR/XNOR itu
          kebalikannya.
        </p>
      ) : null}
    </GameShell>
  );
}
