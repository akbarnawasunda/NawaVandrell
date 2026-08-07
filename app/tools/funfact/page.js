'use client';

import { useState } from 'react';
import ToolShell, { CopyButton } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import { funfact } from '@/lib/funTools';

export default function FunfactPage() {
  const { addToast } = useToast();
  const [date, setDate] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = () => {
    if (!date) {
      addToast('Pilih tanggal lahir dulu', 'warning');
      return;
    }
    const res = funfact(date);
    if (res.error) {
      setError(res.error);
      setResult(null);
      return;
    }
    setError('');
    setResult(res);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <ToolShell title="Fakta Tanggal Lahir" desc="Umur, zodiak, shio, dan fakta unik dari tanggal lahir kamu." icon="🎂">
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="ff-date">
            Tanggal lahir
          </label>
          <input
            id="ff-date"
            className="input"
            type="date"
            value={date}
            max={today}
            min="1900-01-01"
            onChange={(e) => {
              setDate(e.target.value);
              setError('');
            }}
          />
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={run}>
          Lihat Faktanya
        </button>

        {error ? <p className="err">{error}</p> : null}

        {result ? (
          <>
            <div className="stat-row" style={{ marginTop: 16, marginBottom: 0 }}>
              <div className="stat">
                <b style={{ color: 'var(--accent-soft)' }}>{result.meta.age}</b>
                <small>Tahun</small>
              </div>
              <div className="stat">
                <b style={{ fontSize: 17 }}>{result.meta.days.toLocaleString('id-ID')}</b>
                <small>Hari</small>
              </div>
              <div className="stat">
                <b style={{ fontSize: 17 }}>{result.meta.daysToBday}</b>
                <small>Hari ke ultah</small>
              </div>
            </div>

            <div className="result">
              <div className="result-head">
                <span>Fakta kamu</span>
                <CopyButton value={result.result} />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14.5,
                  lineHeight: 1.9,
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text)',
                }}
              >
                {result.result}
              </p>
            </div>

            <button type="button" className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={run}>
              🎲 Fakta Lain
            </button>
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
