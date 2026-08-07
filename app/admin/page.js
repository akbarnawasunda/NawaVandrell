'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useToast } from '@/context/ToastContext';
import { quizCategoryKeys, quizMeta } from '@/data/quizDatabase';

const TOKEN_KEY = 'nawa_admin_token';
const CUSTOM_QUIZ_KEY = 'nawa_custom_quiz';

export default function AdminPage() {
  const { addToast } = useToast();
  const [token, setToken] = useState('');
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem(TOKEN_KEY) || '');
    } catch {
      /* ignore */
    }
    setBooted(true);
  }, []);

  const saveToken = (value) => {
    setToken(value);
    try {
      sessionStorage.setItem(TOKEN_KEY, value);
    } catch {
      /* ignore */
    }
  };

  const logout = () => {
    setToken('');
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    addToast('Keluar dari admin', 'info');
  };

  if (!booted) {
    return (
      <div className="shell-tool">
        <SkeletonLoader lines={4} />
      </div>
    );
  }

  if (!token) return <PinGate onSuccess={saveToken} />;

  return <Dashboard token={token} onLogout={logout} onInvalid={logout} />;
}

/* ============================== PIN GATE ============================== */

function PinGate({ onSuccess }) {
  const { addToast } = useToast();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!pin.trim()) {
      setError('Masukkan PIN dulu.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'PIN salah.');
        setPin('');
        return;
      }
      addToast('Berhasil masuk', 'success');
      onSuccess(data.token);
    } catch {
      setError('Koneksi bermasalah. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell-tool">
      <Link href="/" className="back">
        ← Kembali
      </Link>

      <div className="tool-head">
        <h1>🔐 Admin</h1>
        <p>Masukkan PIN untuk mengelola data.</p>
      </div>

      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="admin-pin">
            PIN Admin
          </label>
          <input
            id="admin-pin"
            className="input"
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="••••••"
            autoComplete="current-password"
            inputMode="numeric"
          />
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={submit} disabled={busy}>
          {busy ? 'Memeriksa...' : 'Masuk'}
        </button>

        {error ? <p className="err">{error}</p> : null}

        <p className="hint">
          PIN diambil dari environment <code>ADMIN_PIN</code>. Dibatasi 5 percobaan per 10 menit.
        </p>
      </div>
    </div>
  );
}

/* ============================== DASHBOARD ============================== */

function Dashboard({ token, onLogout, onInvalid }) {
  const { addToast } = useToast();
  const [tab, setTab] = useState('stats');

  return (
    <div className="shell">
      <Link href="/" className="back">
        ← Kembali ke situs
      </Link>

      <div
        className="tool-head"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}
      >
        <div>
          <h1>🛠️ Panel Admin</h1>
          <p>Statistik, papan peringkat, dan soal kuis.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onLogout} style={{ flexShrink: 0 }}>
          Keluar
        </button>
      </div>

      <div className="chips" style={{ justifyContent: 'flex-start', marginBottom: 18 }}>
        {[
          { id: 'stats', label: '📊 Statistik' },
          { id: 'board', label: '🏆 Peringkat' },
          { id: 'quiz', label: '📝 Soal' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stats' ? <StatsPanel token={token} onInvalid={onInvalid} addToast={addToast} /> : null}
      {tab === 'board' ? <BoardPanel token={token} onInvalid={onInvalid} addToast={addToast} /> : null}
      {tab === 'quiz' ? <QuizPanel addToast={addToast} /> : null}
    </div>
  );
}

/* ============================== STATS ============================== */

function StatsPanel({ token, onInvalid, addToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.status === 401) {
        addToast('Sesi habis, masuk ulang', 'error');
        onInvalid();
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'gagal');
      setData(json);
    } catch (err) {
      setError(err.message || 'Gagal memuat statistik.');
    } finally {
      setLoading(false);
    }
  }, [token, onInvalid, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="panel">
        <SkeletonLoader lines={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <p className="err" style={{ marginTop: 0 }}>
          {error}
        </p>
        <button type="button" className="btn btn-primary btn-full" onClick={load}>
          Coba Lagi
        </button>
      </div>
    );
  }

  const cards = [
    { label: 'Pemain', value: data.players },
    { label: 'Total poin', value: data.totalScore },
    { label: 'Rata-rata', value: data.avgScore },
    { label: 'Skor tertinggi', value: data.topScore },
    { label: 'Tools', value: data.tools },
    { label: 'Game', value: data.games },
    { label: 'Soal kuis', value: data.quizQuestions },
    { label: 'Penyimpanan', value: data.storage },
  ];

  return (
    <>
      <div className="admin-stats">
        {cards.map((c) => (
          <div className="admin-stat" key={c.label}>
            <b>{c.value}</b>
            <small>{c.label}</small>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <p className="label" style={{ marginBottom: 10 }}>
          Soal per kategori
        </p>
        <div style={{ display: 'grid', gap: 6 }}>
          {Object.entries(data.quizPerCategory || {}).map(([cat, n]) => (
            <div
              key={cat}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-dim)' }}
            >
              <span>
                {quizMeta[cat]?.icon} {quizMeta[cat]?.name || cat}
              </span>
              <strong style={{ color: 'var(--accent-soft)' }}>{n}</strong>
            </div>
          ))}
        </div>

        <p className="hint">
          Pemain teratas: <strong>{data.topPlayer || '—'}</strong> · runtime {data.runtime} · driver{' '}
          {data.storage}
        </p>

        <button type="button" className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={load}>
          🔄 Muat Ulang
        </button>
      </div>
    </>
  );
}

/* ============================== LEADERBOARD ============================== */

function BoardPanel({ token, onInvalid, addToast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState({});
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/leaderboard?raw=1', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.status === 401) {
        addToast('Sesi habis, masuk ulang', 'error');
        onInvalid();
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'gagal');
      const list = Object.entries(json)
        .map(([name, score]) => ({ name, score: Number(score) || 0 }))
        .sort((a, b) => b.score - a.score);
      setRows(list);
      setEdits({});
    } catch (err) {
      setError(err.message || 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, [token, onInvalid, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (name) => {
    const raw = edits[name];
    const score = Number(raw);
    if (!Number.isFinite(score) || score < 0) {
      addToast('Skor harus angka >= 0', 'warning');
      return;
    }
    setBusy(name);
    try {
      const res = await fetch('/api/admin/player', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, score }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'gagal');
      setRows((r) => r.map((x) => (x.name === name ? { ...x, score: json.score } : x)));
      setEdits((e) => {
        const next = { ...e };
        delete next[name];
        return next;
      });
      addToast(json.persisted ? 'Skor tersimpan' : 'Tersimpan sementara (server read-only)', 'success');
    } catch (err) {
      addToast(err.message || 'Gagal menyimpan', 'error');
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    const name = target;
    setTarget(null);
    if (!name) return;
    setBusy(name);
    try {
      const res = await fetch(`/api/admin/player?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'gagal');
      setRows((r) => r.filter((x) => x.name !== name));
      addToast(`"${name}" dihapus`, 'success');
    } catch (err) {
      addToast(err.message || 'Gagal menghapus', 'error');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="panel">
        <SkeletonLoader lines={6} />
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        {error ? <p className="err" style={{ marginTop: 0 }}>{error}</p> : null}

        {rows.length === 0 ? (
          <p className="empty">Belum ada pemain.</p>
        ) : (
          <div className="admin-rows">
            {rows.map((row) => {
              const dirty = edits[row.name] !== undefined && Number(edits[row.name]) !== row.score;
              return (
                <div className="admin-row" key={row.name}>
                  <span className="admin-row-name" title={row.name}>
                    {row.name}
                  </span>
                  <input
                    className="input admin-row-input"
                    value={edits[row.name] ?? row.score}
                    onChange={(e) => setEdits((s) => ({ ...s, [row.name]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && dirty && save(row.name)}
                    inputMode="numeric"
                    aria-label={`Skor ${row.name}`}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => save(row.name)}
                    disabled={!dirty || busy === row.name}
                  >
                    {busy === row.name ? '...' : 'Simpan'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setTarget(row.name)}
                    disabled={busy === row.name}
                    aria-label={`Hapus ${row.name}`}
                  >
                    Hapus
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button type="button" className="btn btn-ghost btn-full" style={{ marginTop: 12 }} onClick={load}>
          🔄 Muat Ulang
        </button>

        <p className="hint">
          Ubah angka lalu tekan Simpan. Admin boleh menurunkan skor; endpoint publik tidak bisa.
        </p>
      </div>

      <ConfirmModal
        isOpen={Boolean(target)}
        message={`Hapus pemain "${target}" dari papan peringkat? Tindakan ini tidak bisa dibatalkan.`}
        onConfirm={remove}
        onClose={() => setTarget(null)}
      />
    </>
  );
}

/* ============================== QUIZ MANAGER ============================== */

function readCustom() {
  try {
    const raw = localStorage.getItem(CUSTOM_QUIZ_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function QuizPanel({ addToast }) {
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState(quizCategoryKeys[0]);
  const [level, setLevel] = useState('easy');
  const [soal, setSoal] = useState('');
  const [jawaban, setJawaban] = useState('');
  const [target, setTarget] = useState(null);

  useEffect(() => {
    setItems(readCustom());
  }, []);

  const persist = (next) => {
    setItems(next);
    try {
      localStorage.setItem(CUSTOM_QUIZ_KEY, JSON.stringify(next));
    } catch {
      addToast('Gagal menyimpan ke browser', 'error');
    }
  };

  const add = () => {
    if (!soal.trim() || !jawaban.trim()) {
      addToast('Soal dan jawaban wajib diisi', 'warning');
      return;
    }
    const entry = {
      id: `custom-${Date.now()}`,
      category,
      level,
      soal: soal.trim(),
      jawaban: jawaban.trim(),
      createdAt: new Date().toISOString(),
    };
    persist([entry, ...items]);
    setSoal('');
    setJawaban('');
    addToast('Soal ditambahkan', 'success');
  };

  const remove = () => {
    const id = target;
    setTarget(null);
    if (!id) return;
    persist(items.filter((x) => x.id !== id));
    addToast('Soal dihapus', 'success');
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'soal-custom.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addToast('File JSON diunduh', 'success');
  };

  return (
    <>
      <div className="panel">
        <p className="label" style={{ marginBottom: 10 }}>
          Tambah soal baru
        </p>

        <div className="field">
          <label className="label" htmlFor="q-cat">
            Kategori
          </label>
          <select id="q-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {quizCategoryKeys.map((k) => (
              <option key={k} value={k}>
                {quizMeta[k]?.name || k}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Tingkat</label>
          <div className="btn-row">
            {['easy', 'medium', 'hard'].map((l) => (
              <button
                key={l}
                type="button"
                className={`btn btn-sm ${level === l ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setLevel(l)}
              >
                {l === 'easy' ? 'Mudah' : l === 'medium' ? 'Sedang' : 'Sulit'}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="q-soal">
            Soal
          </label>
          <textarea
            id="q-soal"
            className="input textarea"
            value={soal}
            onChange={(e) => setSoal(e.target.value)}
            placeholder="Tulis pertanyaannya..."
            rows={3}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="q-jawab">
            Jawaban
          </label>
          <input
            id="q-jawab"
            className="input"
            value={jawaban}
            onChange={(e) => setJawaban(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Jawaban benar"
          />
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={add}>
          Tambah Soal
        </button>

        <p className="hint">
          Soal tambahan disimpan di browser ini (<code>nawa_custom_quiz</code>). Untuk masuk ke
          database permanen, ekspor JSON lalu tempel ke <code>data/quizDatabase.js</code>.
        </p>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <p className="label" style={{ margin: 0 }}>
            Soal custom ({items.length})
          </p>
          {items.length ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportJson}>
              ⬇ Ekspor JSON
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="empty">Belum ada soal custom.</p>
        ) : (
          <div className="admin-rows" style={{ marginTop: 12 }}>
            {items.map((it) => (
              <div className="admin-qrow" key={it.id}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{it.soal}</p>
                  <small style={{ color: 'var(--text-faint)' }}>
                    {quizMeta[it.category]?.name || it.category} · {it.level} · jawab: {it.jawaban}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setTarget(it.id)}
                  style={{ flexShrink: 0 }}
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(target)}
        message="Hapus soal ini dari daftar custom?"
        onConfirm={remove}
        onClose={() => setTarget(null)}
      />
    </>
  );
}
