'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell, { PlayerGate } from './GameShell';
import SkeletonLoader from './SkeletonLoader';
import { useMode } from '@/context/ModeContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/hooks/useSound';
import { useStreak } from '@/hooks/useStreak';
import { usePlayer } from '@/hooks/usePlayer';

const LEVELS = [
  { id: 'easy', label: 'Mudah', points: 1 },
  { id: 'medium', label: 'Sedang', points: 2 },
  { id: 'hard', label: 'Sulit', points: 3 },
];

/**
 * Engine kuis untuk 8 kategori.
 * Simple Mode: soal besar + input + 2 tombol (Jawab / Lewati). Level default easy,
 *              tidak ada pemilihan level, tidak ada XP/streak di header.
 * Pro Mode:    ada pemilih level, stats, streak, combo.
 */
export default function QuizEngine({ category, title, desc, icon }) {
  const { isPro } = useMode();
  const { addToast } = useToast();
  const sound = useSound();
  const { streak, best, comboMultiplier, incrementStreak, resetStreak } = useStreak();
  const player = usePlayer();

  const [level, setLevel] = useState('easy');
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState('loading'); // loading | playing | done | error
  const [feedback, setFeedback] = useState(null); // { kind, text }
  const [checking, setChecking] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const recentRef = useRef([]);
  const inputRef = useRef(null);

  const load = useCallback(
    async (lvl = level) => {
      setPhase('loading');
      setFeedback(null);
      setAnswer('');
      try {
        const exclude = recentRef.current.slice(-8).join(',');
        const res = await fetch(
          `/api/quiz?category=${encodeURIComponent(category)}&level=${lvl}&exclude=${encodeURIComponent(exclude)}`
        );
        const data = await res.json();
        if (!res.ok || data.error) {
          setPhase('error');
          setFeedback({ kind: 'no', text: data.error || 'Gagal memuat soal.' });
          return;
        }
        recentRef.current = [...recentRef.current, data.id].slice(-20);
        setQuestion(data);
        setPhase('playing');
        setTimeout(() => inputRef.current?.focus(), 60);
      } catch {
        setPhase('error');
        setFeedback({ kind: 'no', text: 'Koneksi bermasalah. Coba lagi.' });
      }
    },
    [category, level]
  );

  useEffect(() => {
    load('easy');
    // sengaja hanya sekali saat mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const submit = async () => {
    if (!question || checking || phase !== 'playing') return;
    if (!answer.trim()) {
      addToast('Isi jawabannya dulu', 'warning');
      return;
    }

    setChecking(true);
    setAttempts((n) => n + 1);

    try {
      const res = await fetch('/api/quiz/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: question.id, answer: answer.trim(), streak }),
      });
      const data = await res.json();

      if (data.correct) {
        const points = data.pointsAwarded || 1;
        setCorrectCount((n) => n + 1);
        player.addPoints(points);
        incrementStreak();
        if (streak >= 2) sound.playCombo();
        else sound.playCorrect();
        setFeedback({
          kind: 'ok',
          text: isPro
            ? `Benar! +${points} poin${data.multiplier > 1 ? ` (combo ×${data.multiplier})` : ''}`
            : `Benar! Jawabannya "${data.jawaban}"`,
        });
        setPhase('done');
      } else {
        resetStreak();
        sound.playWrong();
        setFeedback({ kind: 'no', text: 'Belum tepat. Coba lagi atau klik Lewati.' });
      }
    } catch {
      addToast('Gagal cek jawaban', 'error');
    } finally {
      setChecking(false);
    }
  };

  const skip = async () => {
    if (!question) return;
    resetStreak();
    try {
      const res = await fetch(`/api/quiz/reveal?id=${encodeURIComponent(question.id)}`);
      const data = await res.json();
      setFeedback({ kind: 'info', text: `Jawabannya: ${data.jawaban}` });
    } catch {
      setFeedback({ kind: 'info', text: 'Gagal mengambil jawaban.' });
    }
    setPhase('done');
  };

  const stats = [
    { label: 'Poin', value: player.score, color: 'var(--accent-soft)' },
    { label: 'Benar', value: `${correctCount}/${attempts}` },
    { label: 'Streak', value: streak > 0 ? `🔥${streak}` : '0', color: streak > 0 ? '#fbbf24' : undefined },
    { label: 'Rekor', value: best },
  ];

  return (
    <GameShell
      title={title}
      desc={desc}
      icon={icon}
      stats={stats}
      sound={sound}
      playerName={player.name}
      score={player.score}
    >
      {isPro && !player.name ? (
        <PlayerGate
          name={player.name}
          onSave={(value) => {
            if (player.saveName(value)) addToast('Nama tersimpan', 'success');
          }}
        />
      ) : null}

      {isPro ? (
        <div className="field">
          <label className="label">Tingkat kesulitan</label>
          <div className="btn-row">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`btn btn-sm ${level === l.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setLevel(l.id);
                  load(l.id);
                }}
              >
                {l.label} +{l.points}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {isPro && comboMultiplier > 1 ? (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <span className="combo-badge">🔥 Combo ×{comboMultiplier} aktif</span>
        </div>
      ) : null}

      <div className="panel">
        {phase === 'loading' ? (
          <SkeletonLoader type="quiz" />
        ) : phase === 'error' ? (
          <>
            <p className="err" style={{ marginTop: 0 }}>
              {feedback?.text}
            </p>
            <button type="button" className="btn btn-primary btn-full" onClick={() => load()}>
              Coba Lagi
            </button>
          </>
        ) : (
          <>
            <p className="question">{question?.soal}</p>

            {phase === 'playing' ? (
              <>
                <div className="field" style={{ marginTop: 15, marginBottom: 12 }}>
                  <input
                    ref={inputRef}
                    className="input"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                    placeholder="Ketik jawabanmu..."
                    autoComplete="off"
                    enterKeyHint="send"
                  />
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 2 }}
                    onClick={submit}
                    disabled={checking}
                  >
                    {checking ? '...' : 'Jawab'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={skip}>
                    Lewati
                  </button>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 15 }}>
                <button type="button" className="btn btn-primary btn-full" onClick={() => load()}>
                  Soal Berikutnya →
                </button>
              </div>
            )}

            {feedback ? <p className={`feedback ${feedback.kind}`}>{feedback.text}</p> : null}
          </>
        )}
      </div>

      {!isPro && player.score > 0 ? (
        <p className="hint" style={{ textAlign: 'center' }}>
          Total poin kamu: <strong style={{ color: 'var(--accent-soft)' }}>{player.score}</strong>
          {!player.name ? ' — aktifkan Pro Mode untuk simpan nama ke peringkat.' : ''}
        </p>
      ) : null}
    </GameShell>
  );
}
