'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '@/components/GameShell';
import { useMode } from '@/context/ModeContext';
import { useSound } from '@/hooks/useSound';
import { useStreak } from '@/hooks/useStreak';
import { usePlayer } from '@/hooks/usePlayer';
import { makeMathQuestion } from '@/data/arcadeData';

const DURATION = 30;

export default function MathRushPage() {
  const sound = useSound();
  const { isPro } = useMode();
  const { streak, best, comboMultiplier, incrementStreak, resetStreak } = useStreak();
  const player = usePlayer();

  const [q, setQ] = useState(null);
  const [value, setValue] = useState('');
  const [left, setLeft] = useState(DURATION);
  const [phase, setPhase] = useState('idle'); // idle | run | end
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [flash, setFlash] = useState(null);
  const [awarded, setAwarded] = useState(0);
  const roundRef = useRef(0);
  const inputRef = useRef(null);
  const tickRef = useRef(null);

  const stop = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = () => {
    roundRef.current = 0;
    setQ(makeMathQuestion(0));
    setValue('');
    setLeft(DURATION);
    setRight(0);
    setWrong(0);
    setFlash(null);
    setAwarded(0);
    setPhase('run');
    setTimeout(() => inputRef.current?.focus(), 60);

    stop();
    tickRef.current = setInterval(() => {
      setLeft((t) => {
        if (t <= 1) {
          stop();
          setPhase('end');
          return 0;
        }
        if (t <= 6) sound.playTick();
        return t - 1;
      });
    }, 1000);
  };

  // hitung poin sekali saat ronde berakhir
  useEffect(() => {
    if (phase !== 'end' || awarded) return;
    const points = isPro ? right * 2 : right;
    setAwarded(points);
    if (points > 0) {
      player.addPoints(points);
      incrementStreak();
      sound.playEnd();
    } else {
      resetStreak();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const submit = () => {
    if (phase !== 'run' || !q) return;
    const raw = value.trim();
    if (!raw) return;
    const num = Number(raw);

    if (Number.isFinite(num) && num === q.answer) {
      setRight((n) => n + 1);
      setFlash('ok');
      sound.playCorrect();
    } else {
      setWrong((n) => n + 1);
      setFlash('no');
      sound.playWrong();
    }

    roundRef.current += 1;
    setQ(makeMathQuestion(roundRef.current));
    setValue('');
    setTimeout(() => setFlash(null), 250);
  };

  const stats = [
    { label: 'Poin', value: player.score, color: 'var(--accent-soft)' },
    { label: 'Benar', value: right },
    { label: 'Streak', value: streak > 0 ? `🔥${streak}` : '0', color: streak > 0 ? '#fbbf24' : undefined },
    { label: 'Rekor', value: best },
  ];

  return (
    <GameShell
      title="Math Rush"
      desc={`Hitung sebanyak mungkin dalam ${DURATION} detik.`}
      icon="➗"
      stats={stats}
      sound={sound}
      playerName={player.name}
      score={player.score}
    >
      <div className="panel">
        {phase === 'idle' ? (
          <>
            <p className="question" style={{ marginTop: 0 }}>
              Hitung cepat, {DURATION} detik
            </p>
            <p className="hint" style={{ textAlign: 'center' }}>
              Tekan Enter untuk kirim jawaban. Soal makin sulit tiap beberapa ronde.
            </p>
            <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={start}>
              Mulai
            </button>
          </>
        ) : phase === 'run' ? (
          <>
            <div className="timer-row">
              <span className="timer-num">{left}s</span>
              <div className="timer-bar">
                <span style={{ width: `${(left / DURATION) * 100}%` }} />
              </div>
            </div>

            <p className={`math-q${flash ? ` flash-${flash}` : ''}`}>{q?.text} = ?</p>

            <input
              ref={inputRef}
              className="input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Jawaban..."
              inputMode="numeric"
              autoComplete="off"
            />
            <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 10 }} onClick={submit}>
              Jawab
            </button>
            <p className="hint">
              Benar {right} · salah {wrong}
            </p>
          </>
        ) : (
          <>
            <p className="question" style={{ marginTop: 0 }}>
              Waktu habis!
            </p>
            <div className="stat-row" style={{ marginBottom: 12 }}>
              <div className="stat">
                <b style={{ color: 'var(--accent-soft)' }}>{right}</b>
                <small>Benar</small>
              </div>
              <div className="stat">
                <b>{wrong}</b>
                <small>Salah</small>
              </div>
              <div className="stat">
                <b>{right + wrong ? Math.round((right / (right + wrong)) * 100) : 0}%</b>
                <small>Akurasi</small>
              </div>
            </div>
            <p className={`feedback ${awarded > 0 ? 'ok' : 'info'}`}>
              {awarded > 0 ? `Dapat +${awarded} poin.` : 'Belum ada jawaban benar. Coba lagi!'}
            </p>
            <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={start}>
              Main Lagi
            </button>
          </>
        )}
      </div>
    </GameShell>
  );
}
