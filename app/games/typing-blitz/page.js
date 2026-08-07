'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '@/components/GameShell';
import { useMode } from '@/context/ModeContext';
import { useSound } from '@/hooks/useSound';
import { useStreak } from '@/hooks/useStreak';
import { usePlayer } from '@/hooks/usePlayer';
import { TYPING_SENTENCES } from '@/data/arcadeData';

const DURATION = 30;

function pickSentence(prev) {
  const pool = TYPING_SENTENCES.filter((s) => s !== prev);
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function TypingBlitzPage() {
  const sound = useSound();
  const { isPro } = useMode();
  const { best, incrementStreak, resetStreak } = useStreak();
  const player = usePlayer();

  const [target, setTarget] = useState('');
  const [typed, setTyped] = useState('');
  const [left, setLeft] = useState(DURATION);
  const [phase, setPhase] = useState('idle'); // idle | run | end
  const [done, setDone] = useState({ words: 0, chars: 0, correct: 0, typed: 0 });
  const [awarded, setAwarded] = useState(0);
  const inputRef = useRef(null);
  const tickRef = useRef(null);

  const stop = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = () => {
    setTarget(pickSentence(null));
    setTyped('');
    setLeft(DURATION);
    setDone({ words: 0, chars: 0, correct: 0, typed: 0 });
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

  // saat waktu habis, hitung skor sekali
  useEffect(() => {
    if (phase !== 'end' || awarded) return;
    const wpm = Math.round((done.chars / 5) * (60 / DURATION));
    const acc = done.typed ? Math.round((done.correct / done.typed) * 100) : 0;
    const points = Math.max(0, Math.round((wpm * acc) / 100 / (isPro ? 2 : 4)));
    setAwarded(points || 0);
    if (points > 0) {
      player.addPoints(points);
      incrementStreak();
      sound.playEnd();
    } else {
      resetStreak();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const onChange = (e) => {
    if (phase !== 'run') return;
    const value = e.target.value;

    // selesai satu kalimat -> catat statistik, ganti kalimat baru
    if (value.length >= target.length) {
      let correct = 0;
      for (let i = 0; i < target.length; i++) if (value[i] === target[i]) correct++;
      setDone((d) => ({
        words: d.words + 1,
        chars: d.chars + correct,
        correct: d.correct + correct,
        typed: d.typed + target.length,
      }));
      sound.playCorrect();
      setTarget(pickSentence(target));
      setTyped('');
      return;
    }

    setTyped(value);
  };

  // statistik hidup untuk kalimat yang sedang dikerjakan
  const liveCorrect = (() => {
    let n = 0;
    for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) n++;
    return n;
  })();

  const totalChars = done.chars + liveCorrect;
  const totalTyped = done.typed + typed.length;
  const totalCorrect = done.correct + liveCorrect;
  const elapsed = DURATION - left || 1;
  const liveWpm = phase === 'idle' ? 0 : Math.round((totalChars / 5) * (60 / elapsed));
  const accuracy = totalTyped ? Math.round((totalCorrect / totalTyped) * 100) : 100;

  const stats = [
    { label: 'Poin', value: player.score, color: 'var(--accent-soft)' },
    { label: 'WPM', value: liveWpm },
    { label: 'Akurasi', value: `${accuracy}%` },
    { label: 'Rekor', value: best },
  ];

  return (
    <GameShell
      title="Typing Blitz"
      desc={`Ketik secepat mungkin dalam ${DURATION} detik.`}
      icon="⌨️"
      stats={stats}
      sound={sound}
      playerName={player.name}
      score={player.score}
    >
      <div className="panel">
        {phase === 'idle' ? (
          <>
            <p className="question" style={{ marginTop: 0 }}>
              Ketik secepat mungkin
            </p>
            <p className="hint" style={{ textAlign: 'center' }}>
              Kamu punya {DURATION} detik. Kalimat baru muncul otomatis tiap selesai.
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

            <p className="typing-target">
              {target.split('').map((ch, i) => {
                const state = i < typed.length ? (typed[i] === ch ? 'ok' : 'bad') : i === typed.length ? 'cur' : '';
                return (
                  <span key={i} className={state}>
                    {ch}
                  </span>
                );
              })}
            </p>

            <input
              ref={inputRef}
              className="input"
              value={typed}
              onChange={onChange}
              placeholder="Ketik di sini..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <p className="hint">Kalimat ke-{done.words + 1} · jangan pakai copy-paste ya.</p>
          </>
        ) : (
          <>
            <p className="question" style={{ marginTop: 0 }}>
              Waktu habis!
            </p>
            <div className="stat-row" style={{ marginBottom: 12 }}>
              <div className="stat">
                <b style={{ color: 'var(--accent-soft)' }}>{liveWpm}</b>
                <small>WPM</small>
              </div>
              <div className="stat">
                <b>{accuracy}%</b>
                <small>Akurasi</small>
              </div>
              <div className="stat">
                <b>{done.words}</b>
                <small>Kalimat</small>
              </div>
              <div className="stat">
                <b>{totalChars}</b>
                <small>Huruf benar</small>
              </div>
            </div>
            <p className={`feedback ${awarded > 0 ? 'ok' : 'info'}`}>
              {awarded > 0 ? `Dapat +${awarded} poin.` : 'Belum dapat poin. Coba lagi, pasti lebih cepat!'}
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
