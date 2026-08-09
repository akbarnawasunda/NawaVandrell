'use client';

import { useEffect, useRef, useState } from 'react';
import GameShell from '@/components/GameShell';
import { usePlayer } from '@/hooks/usePlayer';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const TIME_LIMIT = { easy: 15, medium: 30, hard: 60 };
const BASE_POINT = { easy: 10, medium: 20, hard: 30 };

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export default function QuizEngine({ cat }) {
  const { addToast } = useToast();
  const player = usePlayer();

  const [displayName, setDisplayName] = useState('Quiz');
  const [phase, setPhase] = useState('pick');
  const [diff, setDiff] = useState('easy');
  const [current, setCurrent] = useState(null);
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [hintShown, setHintShown] = useState(false);
  const [lastPts, setLastPts] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [tally, setTally] = useState({ correct: 0, total: 0 });
  const excludeRef = useRef([]);
  const lockRef = useRef(false);

  useEffect(() => {
    fetch('/api/quiz?list=1')
      .then((r) => r.json())
      .then((list) => {
        const found = (Array.isArray(list) ? list : []).find((c) => c.slug === cat);
        if (found) setDisplayName(found.name);
      })
      .catch(() => {});
  }, [cat]);

  const nextQuestion = async (d) => {
    lockRef.current = false;
    setPhase('loading');
    try {
      const ex = excludeRef.current.slice(-60).join(',');
      const res = await fetch(`/api/quiz?cat=${cat}&diff=${d}&exclude=${ex}&_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const q = await res.json();
      excludeRef.current.push(q.id);
      setCurrent(q);
      setAnswer('');
      setResult(null);
      setReveal(null);
      setHintShown(false);
      setPhase('question');
    } catch {
      addToast(`Gagal: ${err.message} | cat=${cat}`, 'error');
      setPhase('pick');
    }
  };

  useEffect(() => {
    if (phase !== 'question' || !current) return;
    setTimeLeft(TIME_LIMIT[current.d] || 30);
    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, current]);

  const fetchReveal = async () => {
    if (reveal) return reveal;
    const res = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: current.id, cat }),
    });
    const rev = await res.json();
    setReveal(rev);
    return rev;
  };

  const settle = async (outcome) => {
    if (phase !== 'question' || lockRef.current) return;
    lockRef.current = true;
    const rev = await fetchReveal();
    setResult(outcome);
    setPhase('reveal');
    setTally((s) => ({ correct: s.correct + (outcome === 'correct' ? 1 : 0), total: s.total + 1 }));
    if (outcome === 'correct') {
      const bonus = hintShown ? 0 : timeLeft;
      const pts = (BASE_POINT[current.d] || 10) + bonus;
      setLastPts(pts);
      setScore((s) => s + pts);
      setStreak((k) => k + 1);
      player.addScore(pts);
      addToast(`BENAR! +${pts} poin`, 'success');
    } else {
      setStreak(0);
    }
  };

  useEffect(() => {
    if (phase === 'question' && timeLeft === 0 && current) settle('timeout');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase]);

  const submit = async () => {
    if (!answer.trim() || phase !== 'question' || lockRef.current) return;
    const rev = await fetchReveal();
    const ok =
      normalize(rev.a) === normalize(answer) ||
      (rev.alt || []).some((x) => normalize(x) === normalize(answer));
    settle(ok ? 'correct' : 'wrong');
  };

  const limit = TIME_LIMIT[current?.d] || 30;
  const pct = Math.round((timeLeft / limit) * 100);
  const barColor = pct > 50 ? 'var(--accent)' : pct > 25 ? 'var(--warn, #fbbf24)' : 'var(--danger, #f87171)';

  return (
    <GameShell
      title={displayName}
      desc="Jawab sebelum waktu habis. Makin cepet, makin gede poinnya."
      icon="quiz"
      slug={cat}
      stats={[
        { label: 'skor sesi', value: score },
        { label: 'streak', value: streak },
        { label: 'benar', value: `${tally.correct}/${tally.total}` },
      ]}
    >
      {phase === 'pick' ? (
        <div className="panel">
          <p className="label" style={{ marginBottom: 10 }}>Pilih tingkat kesulitan</p>
          <div style={{ display: 'grid', gap: 9 }}>
            {['easy', 'medium', 'hard'].map((d) => (
              <button key={d} type="button" className="btn btn-ghost btn-full" onClick={() => { setDiff(d); nextQuestion(d); }}>
                {d.toUpperCase()} · {TIME_LIMIT[d]} detik · base {BASE_POINT[d]} poin
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {phase === 'loading' ? (
        <div className="panel">
          <p className="hint">Ngambil soal dari server...</p>
        </div>
      ) : null}

      {phase === 'question' && current ? (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="label">{current.d} · sisa</span>
            <strong style={{ color: barColor, fontSize: 18 }}>{timeLeft}s</strong>
          </div>
          <div className="quiz-timer">
            <div className="quiz-timer-fill" style={{ width: `${pct}%`, background: barColor }} />
          </div>

          <p className="quiz-q">{current.q}</p>

          <input
            className="input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Ketik jawaban lu..."
            autoFocus
          />

          {hintShown && current.hint ? (
            <p className="hint" style={{ marginTop: 10 }}>Petunjuk: {current.hint} (bonus waktu hangus)</p>
          ) : null}

          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary" onClick={submit}>
              <Icon name="check" size={16} /> Kunci
            </button>
            {!hintShown && current.hint ? (
              <button type="button" className="btn btn-ghost" onClick={() => setHintShown(true)}>
                Petunjuk
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => settle('nyerah')}>
              Nyerah
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'reveal' ? (
        <div className="panel">
          <p style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: result === 'correct' ? 'var(--accent-soft)' : 'var(--danger, #f87171)' }}>
            {result === 'correct' ? `BENAR! +${lastPts} poin` : result === 'timeout' ? 'WAKTU HABIS!' : result === 'nyerah' ? 'MENYERAH!' : 'SALAH!'}
          </p>
          <p style={{ marginBottom: 6 }}>
            Jawaban: <strong style={{ color: 'var(--accent-soft)' }}>{reveal?.a}</strong>
          </p>
          <p className="hint" style={{ marginBottom: 14 }}>{reveal?.explain}</p>
          <div style={{ display: 'grid', gap: 9 }}>
            <button type="button" className="btn btn-primary btn-full" onClick={() => nextQuestion(diff)}>
              Soal Berikutnya
            </button>
            <button type="button" className="btn btn-ghost btn-full" onClick={() => { lockRef.current = false; setPhase('pick'); }}>
              Ganti Kesulitan
            </button>
          </div>
        </div>
      ) : null}
    </GameShell>
  );
}
