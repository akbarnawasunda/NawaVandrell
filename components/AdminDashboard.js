'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SkeletonLoader from '@/components/SkeletonLoader';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

function RowEditor({ row, onSave }) {
  const [value, setValue] = useState(String(row.score));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await onSave(value);
    setBusy(false);
  };
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        className="admin-row-input"
        inputMode="numeric"
        aria-label={`Skor untuk ${row.name}`}
        value={value}
        onChange={(event) => setValue(event.target.value.replace(/\D/g, '').slice(0, 7))}
      />
      <button type="button" className="btn btn-ghost btn-sm" onClick={save} disabled={busy} aria-label={`Simpan skor ${row.name}`}>
        <Icon name="check" size={14} />
      </button>
    </div>
  );
}

function AddPlayerForm({ onAdd }) {
  const [name, setName] = useState('');
  const [score, setScore] = useState('0');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    await onAdd(name.trim(), Number(score) || 0);
    setName('');
    setScore('0');
    setBusy(false);
  };

  return (
    <form className="panel" onSubmit={submit} style={{ marginBottom: 14 }}>
      <div className="result-head" style={{ marginBottom: 10 }}><span>Tambah pemain</span></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="visually-hidden" htmlFor="admin-player-name">Nama pemain</label>
        <input
          id="admin-player-name"
          className="input"
          placeholder="Nama pemain"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={24}
          style={{ flex: '1 1 140px' }}
          required
        />
        <label className="visually-hidden" htmlFor="admin-player-score">Skor</label>
        <input
          id="admin-player-score"
          className="input"
          placeholder="Skor"
          type="number"
          min="0"
          max="9999999"
          inputMode="numeric"
          value={score}
          onChange={(event) => setScore(event.target.value)}
          style={{ flex: '0 1 100px' }}
        />
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ flexShrink: 0 }}>
          {busy ? 'Menyimpan…' : '+ Tambah'}
        </button>
      </div>
    </form>
  );
}

export default function AdminDashboard() {
  const { addToast } = useToast();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const redirectToLogin = useCallback(() => {
    router.replace('/admin/login');
    router.refresh();
  }, [router]);

  const checkSession = useCallback((response) => {
    if (response.status === 401 || response.status === 403) {
      redirectToLogin();
      return false;
    }
    return true;
  }, [redirectToLogin]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsResponse, boardResponse] = await Promise.all([
        fetch('/api/admin/stats', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/leaderboard', { credentials: 'same-origin', cache: 'no-store' }),
      ]);
      if (!checkSession(statsResponse)) return;
      if (!statsResponse.ok || !boardResponse.ok) throw new Error('Gagal memuat data.');

      const [statsJson, boardJson] = await Promise.all([
        statsResponse.json().catch(() => ({})),
        boardResponse.json().catch(() => ({})),
      ]);
      const list = Array.isArray(boardJson)
        ? boardJson
        : Array.isArray(boardJson.leaderboard)
          ? boardJson.leaderboard
          : [];
      setStats(statsJson.stats || null);
      setRows(list);
    } catch {
      setError('Gagal memuat data admin. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [checkSession]);

  useEffect(() => { void load(); }, [load]);

  const saveScore = async (name, score) => {
    try {
      const response = await fetch('/api/admin/player', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score: Number(score) }),
      });
      if (!checkSession(response)) return;
      if (!response.ok) throw new Error('Gagal menyimpan skor.');
      addToast(`Skor ${name} diperbarui.`, 'success');
      await load();
    } catch (saveError) {
      addToast(saveError.message || 'Gagal memperbarui skor.', 'error');
    }
  };

  const addPlayer = async (name, score) => {
    try {
      const response = await fetch('/api/admin/player', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score }),
      });
      if (!checkSession(response)) return;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Gagal menambah pemain.');
      addToast(`${name} ditambahkan.`, 'success');
      await load();
    } catch (addError) {
      addToast(addError.message || 'Gagal menambah pemain.', 'error');
    }
  };

  const removePlayer = async () => {
    if (!toDelete) return;
    try {
      const response = await fetch(`/api/admin/player?name=${encodeURIComponent(toDelete)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!checkSession(response)) return;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Gagal menghapus pemain.');
      addToast(`${toDelete} dihapus permanen.`, 'success');
      setToDelete(null);
      await load();
    } catch (deleteError) {
      addToast(deleteError.message || 'Gagal menghapus pemain.', 'error');
    }
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      redirectToLogin();
    }
  };

  return (
    <div className="shell admin-dashboard-shell">
      <header className="tool-head admin-dashboard-heading">
        <div>
          <h1><span aria-hidden="true"><Icon name="lock" size={22} /></span>Area terbatas</h1>
          <p>Kelola papan peringkat Nawa Vandrell.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={logout} disabled={loggingOut}>
          {loggingOut ? 'Keluar…' : 'Keluar'}
        </button>
      </header>

      {error ? <p className="feedback no" role="alert">{error}</p> : null}
      {loading ? <SkeletonLoader type="stats" /> : (
        <>
          {stats ? (
            <section className="admin-stats" aria-label="Statistik admin" style={{ marginBottom: 16 }}>
              <div className="admin-stat"><b>{stats.players}</b><small>Total pemain</small></div>
              <div className="admin-stat"><b>{stats.topScore}</b><small>Skor tertinggi</small></div>
              <div className="admin-stat"><b>{stats.topName}</b><small>Pemuncak</small></div>
              <div className="admin-stat"><b>{stats.driver}</b><small>Penyimpanan</small></div>
            </section>
          ) : null}

          <AddPlayerForm onAdd={addPlayer} />

          <section className="panel" aria-label="Kelola papan peringkat">
            <div className="result-head">
              <span>Papan peringkat</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
                <Icon name="refresh" size={14} /> Muat ulang
              </button>
            </div>
            {rows.length === 0 ? <p className="empty">Belum ada pemain di papan peringkat.</p> : (
              <div className="admin-rows">
                {rows.map((row, index) => (
                  <div className="admin-row" key={`${row.name}-${index}`}>
                    <span className="admin-row-rank">#{index + 1}</span>
                    <span className="admin-row-name">{row.name}</span>
                    <RowEditor row={row} onSave={(value) => saveScore(row.name, value)} />
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => setToDelete(row.name)} aria-label={`Hapus ${row.name}`}>
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={removePlayer}
        title="Hapus pemain permanen?"
        message={`Skor “${toDelete}” akan dihapus dari papan peringkat.`}
        confirmLabel="Hapus pemain"
        variant="danger"
        icon="warning"
      />
    </div>
  );
}
