'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '@/components/GameShell';
import { useMode } from '@/context/ModeContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/hooks/useSound';
import { useStreak } from '@/hooks/useStreak';
import { usePlayer } from '@/hooks/usePlayer';
import { makeSequence } from '@/data/arcadeData';

export default function AngkaEnigmaPage() {
  const { isPro } = useMode();
  const { addToast } = useToast();
  const sound = useSound();
  const { streak, best, comboMultiplier, incrementStreak, resetStreak } = useStreak();
  const player = usePlayer();

  const [q, setQ] = useState(null);
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef(null);

  const next = useCallback(() => {
    setQ(makeSequence());
    setValue('');
    setFeedback(null);
    setAnswered(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  useEffect(() => {
    next();
  }, [next]);

  const submit = () => {
    if (!q || answered) return;
    const raw = value.trim();
    if (!raw) {
      addToast('Isi angkanya dulu', 'warning');
      return;
    }
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      setFeedback({ kind: 'no', text: 'Masukkan angka ya.' });
      return;
    }

    setAttempts((n) => n + 1);

    if (num === q.next) {
      const points = isPro ? 3 * comboMultiplier : 3;
      setAnswered(true);
      setCorrectCount((n) => n + 1);
      player.addPoints(points);
      incrementStreak();
      if (streak >= 2) sound.playCombo();
      else sound.playCorrect();
      setFeedback({ kind: 'ok', text: `Benar! Polanya "${q.label}". +${points} poin` });
    } else {
      resetStreak();
      sound.playWrong();
      setFeedback({ kind: 'no', text: 'Belum tepat. Perhatikan selisih antar angka.' });
    }
  };

  const reveal = () => {
    if (!q || answered) return;
    resetStreak();
    setAnswered(true);
    setFeedback({ kind: 'info', text: `Jawabannya ${q.next} — polanya "${q.label}".` });
  };

  const stats = [
    { label: 'Poin', value: player.score, color: 'var(--accent-soft)' },
    { label: 'Benar', value: `${correctCount}/${attempts}` },
    { label: 'Streak', value: streak > 0 ? `🔥${streak}` : '0', color: streak > 0 ? '#fbbf24' : undefined },
    { label: 'Rekor', value: best },
  ];

  return (
    <GameShell
      title="Angka Enigma"
      desc="Cari angka lanjutan dari deret."
      icon="🔢"
      stats={stats}
      sound={sound}
      playerName={player.name}
      score={player.score}
    >
      <div className="panel">
        <p className="question" style={{ marginTop: 0 }}>
          Lanjutkan deret ini:
        </p>

        <div className="seq-row">
          {q?.seq.map((n, i) => (
            <span className="seq-cell" key={`${i}-${n}`}>
              {n}
            </span>
          ))}
          <span className="seq-cell seq-cell-q">?</span>
        </div>

        {answered ? (
          <>
            {feedback ? <p className={`feedback ${feedback.kind}`}>{feedback.text}</p> : null}
            <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={next}>
              Soal Berikutnya →
            </button>
          </>
        ) : (
          <>
            <div className="field" style={{ marginTop: 15, marginBottom: 12 }}>
              <input
                ref={inputRef}
                className="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Angka berikutnya..."
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={submit}>
                Jawab
              </button>
              <button type="button" className="btn btn-ghost" onClick={reveal}>
                Lewati
              </button>
            </div>
            {feedback ? <p className={`feedback ${feedback.kind}`}>{feedback.text}</p> : null}
          </>
        )}
      </div>
    </GameShell>
  );
}
