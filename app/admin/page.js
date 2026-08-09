'use client';

import { useCallback, useEffect, useState } from 'react';
import SkeletonLoader from '@/components/SkeletonLoader';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const TOKEN_KEY = 'nawa_admin_token';

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem(TOKEN_KEY) || '');
    } catch {}
    setReady(true);
  }, []);

  const login = (t) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch {}
    setToken(t);
  };

  const logout = () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
    setToken('');
  };

  if (!ready) {
    return (
      <div className="shell-tool">
        <SkeletonLoader lines={4} />
      </div>
    );
  }

  return token ? <Dashboard token={token} onLogout={logout} /> : <PinGate onSuccess={login} />;
}

function PinGate({ onSuccess }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!pin) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) onSuccess(data.token);
      else setError(data.message || 'PIN salah.');
    } catch {
      setError('Gagal terhubung ke server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell-tool">
      <div className="tool-head">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--accent-soft)', display: 'inline-flex' }}>
            <Icon name="lock" size={24} />
          </span>
          Area Admin
        </h1>
        <p>Masuk pakai PIN buat kelola leaderboard.</p>
      </div>

      <form className="panel" onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="admin-pin">
            PIN Admin
          </label>
          <input
            id="admin-pin"
            type="password"
            inputMode="numeric"
            className="input"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••"
            autoFocus
          />
        </div>
        <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
          {busy ? 'Memverifikasi...' : 'Masuk'}
        </button>
        {error ? <p className="err">{error}</p> : null}
      </form>
    </div>
  );
}

function RowEditor({ row, onSave }) {
  const [val, setVal] = useState(String(row.score));
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        className="admin-row-input"
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/\D/g, ''))}
      />
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSave(val)}>
        <Icon name="check" size={14} />
      </button>
    </div>
  );
}

function AddPlayerForm({ onAdd }) {
  const [name, setName] = useState('');
  const [score, setScore] = useState('0');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    await onAdd(name.trim(), Number(score) || 0);
    setName(''); setScore('0'); setBusy(false);
  };

  return (
    <form className="panel" onSubmit={submit} style={{ marginBottom: 14 }}>
      <div className="result-head" style={{ marginBottom: 10 }}>
        <span>Suntik Player Baru</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input 
          className="input" 
          placeholder="Nama player" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          maxLength={24}
          style={{ flex: '1 1 140px' }}
          required 
        />
        <input 
          className="input" 
          placeholder="Skor" 
          type="number" 
          inputMode="numeric"
          value={score} 
          onChange={(e) => setScore(e.target.value)} 
          style={{ flex: '0 1 100px' }}
        />
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ flexShrink: 0 }}>
          {busy ? '...' : '+ Tambah'}
        </button>
      </div>
    </form>
  );
}

function Dashboard({ token, onLogout }) {
  const { addToast } = useToast();
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, boardRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: authHeaders }),
        fetch('/api/leaderboard', { cache: 'no-store' }),
      ]);

      if (statsRes.status === 401) throw new Error('UNAUTH');

      const statsJson = await statsRes.json().catch(() => ({}));
      const boardJson = await boardRes.json().catch(() => ({}));
      const list = Array.isArray(boardJson)
        ? boardJson
        : Array.isArray(boardJson.leaderboard)
          ? boardJson.leaderboard
          : [];

      setStats(statsJson.stats || null);
      setRows(list);
    } catch (e) {
      if (e.message === 'UNAUTH') {
        onLogout();
        addToast('Sesi habis, masuk lagi', 'warning');
        return;
      }
      setError('Gagal memuat data admin.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const saveScore = async (name, score) => {
    const res = await fetch('/api/admin/player', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score: Number(score) }),
    });
    if (res.ok) {
      addToast(`Skor ${name} diupdate`, 'success');
      load();
    } else {
      addToast('Gagal update skor', 'error');
    }
  };

  const addPlayer = async (name, score) => {
    const res = await fetch('/api/admin/player', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score }),
    });
    if (res.ok) {
      addToast(`${name} disuntikkan`, 'success');
      load();
    } else {
      const j = await res.json().catch(() => ({}));
      addToast(j.message || 'Gagal nambah', 'error');
    }
  };

  const removePlayer = async () => {
    if (!toDelete) return;
    const res = await fetch(`/api/admin/player?name=${encodeURIComponent(toDelete)}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok) {
      addToast(`${toDelete} dihapus permanen`, 'success');
      load();
    } else {
      addToast('Gagal hapus player', 'error');
    }
  };

  return (
    <div className="shell">
      <div className="tool-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--accent-soft)', display: 'inline-flex' }}>
              <Icon name="trophy" size={24} />
            </span>
            Admin Dashboard
          </h1>
          <p>Kelola leaderboard & pantau statistik.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onLogout}>
          Keluar
        </button>
      </div>

      {loading ? (
        <SkeletonLoader type="stats" />
      ) : (
        <>
          {error ? <p className="feedback no">{error}</p> : null}

          {stats ? (
            <div className="admin-stats" style={{ marginBottom: 16 }}>
              <div className="admin-stat">
                <b>{stats.players}</b>
                <small>total player</small>
              </div>
              <div className="admin-stat">
                <b>{stats.topScore}</b>
                <small>skor tertinggi</small>
              </div>
              <div className="admin-stat">
                <b style={{ fontSize: 16 }}>{stats.topName}</b>
                <small>pemuncak</small>
              </div>
              <div className="admin-stat">
                <b style={{ fontSize: 16 }}>{stats.driver}</b>
                <small>storage driver</small>
              </div>
            </div>
          ) : null}

          <AddPlayerForm onAdd={addPlayer} />

          <div className="panel">
            <div className="result-head">
              <span>Leaderboard</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
                <Icon name="refresh" size={14} /> Muat Ulang
              </button>
            </div>

            {rows.length === 0 ? (
              <p className="empty">Belum ada player. Suntik manual di atas!</p>
            ) : (
              <div className="admin-rows">
                {rows.map((row, i) => (
                  <div className="admin-row" key={`${row.name}-${i}`}>
                    <span style={{ minWidth: 30, color: 'var(--text-faint)', fontWeight: 700 }}>
                      #{i + 1}
                    </span>
                    <span className="admin-row-name">{row.name}</span>
                    <RowEditor row={row} onSave={(v) => saveScore(row.name, v)} />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setToDelete(row.name)}
                      aria-label={`Hapus ${row.name}`}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={removePlayer}
        title="Hapus player permanen?"
        message={`Skor "${toDelete}" bakal dihapus dari database dan tidak akan bangkit lagi.`}
        confirmLabel="Hapus"
        variant="danger"
        icon="warning"
      />
    </div>
  );
}
