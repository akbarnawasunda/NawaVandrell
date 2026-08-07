'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '@/components/GameShell';
import { useMode } from '@/context/ModeContext';
import { useToast } from '@/context/ToastContext';
import { useSound } from '@/hooks/useSound';
import { useStreak } from '@/hooks/useStreak';
import { usePlayer } from '@/hooks/usePlayer';
import { WORD_BANK } from '@/data/arcadeData';

const BANK = new Set(WORD_BANK);

function randomStart() {
  return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
}

/** Cari satu contoh kata valid yang belum dipakai, untuk tombol Lewati. */
function findSuggestion(letter, used) {
  const options = WORD_BANK.filter((w) => w[0] === letter && !used.has(w));
  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)];
}

export default function KataSambungPage() {
  const { isPro } = useMode();
  const { addToast } = useToast();
  const sound = useSound();
  const { streak, best, comboMultiplier, incrementStreak, resetStreak } = useStreak();
  const player = usePlayer();

  const [chain, setChain] = useState([]);
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const usedRef = useRef(new Set());

  const reset = useCallback(() => {
    const start = randomStart();
    usedRef.current = new Set([start]);
    setChain([start]);
    setValue('');
    setFeedback(null);
    setOver(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  useEffect(() => {
    reset();
  }, [reset]);

  const last = chain[chain.length - 1] || '';
  const needLetter = last ? last[last.length - 1] : '';

  const submit = () => {
    if (over) return;
    const word = value.trim().toLowerCase();
    if (!word) {
      addToast('Ketik katanya dulu', 'warning');
      return;
    }

    if (word[0] !== needLetter) {
      sound.playWrong();
      setFeedback({ kind: 'no', text: `Harus mulai dari huruf "${needLetter.toUpperCase()}".` });
      return;
    }
    if (usedRef.current.has(word)) {
      sound.playWrong();
      setFeedback({ kind: 'no', text: 'Kata itu sudah dipakai.' });
      return;
    }
    if (!BANK.has(word)) {
      sound.playWrong();
      setFeedback({ kind: 'no', text: 'Kata itu belum ada di kamus game ini. Coba kata benda lain.' });
      return;
    }

    const points = isPro ? 1 * comboMultiplier : 1;
    usedRef.current.add(word);
    setChain((c) => [...c, word]);
    setValue('');
    player.addPoints(points);
    incrementStreak();
    if (streak >= 2) sound.playCombo();
    else sound.playCorrect();
    setFeedback({ kind: 'ok', text: `Mantap! +${points} poin. Lanjut huruf "${word[word.length - 1].toUpperCase()}".` });
    inputRef.current?.focus();
  };

  const giveUp = () => {
    if (over) return;
    resetStreak();
    const hint = findSuggestion(needLetter, usedRef.current);
    setOver(true);
    setFeedback({
      kind: 'info',
      text: hint
        ? `Salah satu jawaban yang bisa dipakai: "${hint}". Rantai kamu ${chain.length} kata.`
        : `Sudah tidak ada kata tersisa untuk huruf "${needLetter.toUpperCase()}". Rantai kamu ${chain.length} kata.`,
    });
  };

  const stats = [
    { label: 'Poin', value: player.score, color: 'var(--accent-soft)' },
    { label: 'Rantai', value: chain.length },
    { label: 'Streak', value: streak > 0 ? `🔥${streak}` : '0', color: streak > 0 ? '#fbbf24' : undefined },
    { label: 'Rekor', value: best },
  ];

  return (
    <GameShell
      title="Kata Sambung"
      desc="Sambung kata pakai huruf terakhir."
      icon="🔗"
      stats={stats}
      sound={sound}
      playerName={player.name}
      score={player.score}
    >
      <div className="panel">
        <p className="hint" style={{ marginTop: 0 }}>
          Kata sekarang
        </p>
        <p className="question" style={{ marginTop: 4 }}>
          {last}
        </p>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-faint)', margin: '6px 0 0' }}>
          Kata berikutnya harus mulai huruf{' '}
          <strong style={{ color: 'var(--accent-soft)', fontSize: 18 }}>{needLetter?.toUpperCase()}</strong>
        </p>

        {over ? (
          <>
            {feedback ? <p className={`feedback ${feedback.kind}`}>{feedback.text}</p> : null}
            <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={reset}>
              Main Lagi →
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
                placeholder={`Kata mulai "${needLetter}"...`}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={submit}>
                Jawab
              </button>
              <button type="button" className="btn btn-ghost" onClick={giveUp}>
                Lewati
              </button>
            </div>
            {feedback ? <p className={`feedback ${feedback.kind}`}>{feedback.text}</p> : null}
          </>
        )}
      </div>

      {chain.length > 1 ? (
        <div className="panel" style={{ marginTop: 12 }}>
          <p className="label" style={{ marginBottom: 8 }}>
            Rantai kata ({chain.length})
          </p>
          <div className="chain-row">
            {chain.map((w, i) => (
              <span className="chain-item" key={`${i}-${w}`}>
                {w}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </GameShell>
  );
}
