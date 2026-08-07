'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '@/components/GameShell';
import { useMode } from '@/context/ModeContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/hooks/useSound';
import { useStreak } from '@/hooks/useStreak';
import { usePlayer } from '@/hooks/usePlayer';
import { EMOJI_STORIES } from '@/data/arcadeData';

function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function EmojiStoryPage() {
  const { isPro } = useMode();
  const { addToast } = useToast();
  const sound = useSound();
  const { streak, best, comboMultiplier, incrementStreak, resetStreak } = useStreak();
  const player = usePlayer();

  const [item, setItem] = useState(null);
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef(null);
  const seenRef = useRef([]);

  const next = useCallback(() => {
    const pool = EMOJI_STORIES.filter((s) => !seenRef.current.includes(s.emoji));
    const list = pool.length ? pool : EMOJI_STORIES;
    if (!pool.length) seenRef.current = [];
    const picked = list[Math.floor(Math.random() * list.length)];
    seenRef.current = [...seenRef.current, picked.emoji].slice(-12);
    setItem(picked);
    setValue('');
    setFeedback(null);
    setAnswered(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  useEffect(() => {
    next();
  }, [next]);

  const submit = () => {
    if (!item || answered) return;
    const guess = normalize(value);
    if (!guess) {
      addToast('Tulis tebakanmu dulu', 'warning');
      return;
    }

    setAttempts((n) => n + 1);
    const candidates = [item.answer, ...(item.alt || [])].map(normalize);
    const hit = candidates.some((c) => c === guess || (guess.length >= 4 && c.includes(guess)));

    if (hit) {
      const points = isPro ? 2 * comboMultiplier : 2;
      setAnswered(true);
      setCorrectCount((n) => n + 1);
      player.addPoints(points);
      incrementStreak();
      if (streak >= 2) sound.playCombo();
      else sound.playCorrect();
      setFeedback({ kind: 'ok', text: `Benar! "${item.answer}" +${points} poin` });
    } else {
      resetStreak();
      sound.playWrong();
      setFeedback({ kind: 'no', text: 'Belum tepat. Coba lagi atau klik Lewati.' });
    }
  };

  const skip = () => {
    if (!item || answered) return;
    resetStreak();
    setAnswered(true);
    setFeedback({ kind: 'info', text: `Jawabannya: ${item.answer}` });
  };

  const stats = [
    { label: 'Poin', value: player.score, color: 'var(--accent-soft)' },
    { label: 'Benar', value: `${correctCount}/${attempts}` },
    { label: 'Streak', value: streak > 0 ? `🔥${streak}` : '0', color: streak > 0 ? '#fbbf24' : undefined },
    { label: 'Rekor', value: best },
  ];

  return (
    <GameShell
      title="Emoji Story"
      desc="Tebak arti rangkaian emoji."
      icon="🎭"
      stats={stats}
      sound={sound}
      playerName={player.name}
      score={player.score}
    >
      <div className="panel">
        <p className="emoji-story" aria-label="rangkaian emoji">
          {item?.emoji}
        </p>

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
                placeholder="Artinya apa?"
                autoComplete="off"
              />
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={submit}>
                Jawab
              </button>
              <button type="button" className="btn btn-ghost" onClick={skip}>
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
