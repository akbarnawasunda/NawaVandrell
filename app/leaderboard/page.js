'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import SkeletonLoader from '@/components/SkeletonLoader';
import { usePlayer } from '@/hooks/usePlayer';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const player = usePlayer();
  const [rows, setRows] = useState([]);
  const [source, setSource] = useState('server');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'gagal');
      const list = Array.isArray(data) ? data : Array.isArray(data.leaderboard) ? data.leaderboard : [];
      setRows(list);
      setSource('server');
    } catch {
      // fallback: papan lokal supaya halaman tetap berguna offline
      setRows(player.localBoard());
      setSource('local');
      setError('Server peringkat tidak terjangkau, menampilkan skor di perangkat ini.');
    } finally {
      setLoading(false);
    }
  }, [player]);

  useEffect(() => {
    if (!player.ready) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.ready]);

  const myRank = player.name ? rows.findIndex((r) => r.name === player.name) + 1 : 0;

  return (
    <div className="shell">
      <Link href="/games" className="back">
        ← Semua game
      </Link>

      <div className="tool-head">
        <h1>🏆 Papan Peringkat</h1>
        <p>20 pemain dengan poin tertinggi. Poin naik otomatis tiap jawaban benar.</p>
      </div>

      {player.name ? (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <p className="label" style={{ marginBottom: 4 }}>
                Kamu
              </p>
              <strong style={{ fontSize: 16, color: 'var(--accent-soft)' }}>{player.name}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ fontSize: 22, display: 'block' }}>{player.score}</strong>
              <small style={{ color: 'var(--text-faint)' }}>
                {myRank > 0 ? `peringkat #${myRank}` : 'belum masuk 20 besar'}
              </small>
            </div>
          </div>
        </div>
      ) : (
        <p className="hint" style={{ textAlign: 'center', marginBottom: 14 }}>
          Belum ada nama tersimpan. Main game apa pun, isi nama, dan skormu masuk ke sini.
        </p>
      )}

      <div className="panel">
        {loading ? (
          <SkeletonLoader lines={6} />
        ) : (
          <>
            {error ? <p className="feedback info">{error}</p> : null}

            {rows.length === 0 ? (
              <p className="empty">
                Belum ada skor. Jadi yang pertama!
                <br />
                <Link href="/games" style={{ color: 'var(--accent-soft)', fontWeight: 600 }}>
                  Pilih game →
                </Link>
              </p>
            ) : (
              <ol className="rank-list">
                {rows.map((row, i) => (
                  <li key={`${row.name}-${i}`} className={`rank-item${row.name === player.name ? ' me' : ''}`}>
                    <span className="rank-pos">{MEDALS[i] || i + 1}</span>
                    <span className="rank-name">{row.name}</span>
                    <span className="rank-score">{row.score}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className="btn-row" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-ghost btn-full" onClick={load}>
                🔄 Muat Ulang
              </button>
            </div>

            <p className="hint">
              Sumber data: {source === 'server' ? 'server' : 'perangkat ini'}. Skor tersimpan juga di
              browser, jadi tidak hilang walau server sedang mati.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
