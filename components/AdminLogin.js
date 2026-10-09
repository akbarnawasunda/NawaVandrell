'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/icons';

export default function AdminLogin() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!secret || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: secret }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || (response.status === 429 ? 'Terlalu banyak percobaan.' : 'Akses ditolak.'));
        return;
      }
      setSecret('');
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="shell-tool admin-access-shell" aria-labelledby="admin-access-heading">
      <div className="tool-head">
        <h1 id="admin-access-heading" className="admin-access-title">
          <span aria-hidden="true"><Icon name="lock" size={23} /></span>
          Akses terbatas
        </h1>
        <p>Area ini hanya untuk pengelola Nawa Editor.</p>
      </div>
      <form className="panel admin-access-form" onSubmit={submit}>
        <label className="field" htmlFor="admin-secret">
          <span className="label">Kunci admin</span>
          <input
            id="admin-secret"
            name="admin-secret"
            type="password"
            className="input"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="Masukkan kunci rahasia"
            autoComplete="current-password"
            maxLength={256}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary btn-full" disabled={busy || !secret}>
          {busy ? 'Memeriksa…' : 'Masuk dengan aman'}
        </button>
        <p className="admin-access-note">Sesi admin berlaku 30 menit dan tersimpan dalam cookie HttpOnly.</p>
        {error ? <p className="err" role="alert">{error}</p> : null}
      </form>
    </section>
  );
}
