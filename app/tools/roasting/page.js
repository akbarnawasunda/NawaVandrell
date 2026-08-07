'use client';

import { useState } from 'react';
import ToolShell, { CopyButton } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import { roast } from '@/lib/funTools';

export default function RoastingPage() {
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [output, setOutput] = useState('');

  const run = () => {
    const clean = name.trim();
    if (!clean) {
      addToast('Isi nama targetnya dulu', 'warning');
      return;
    }
    setOutput(roast(clean));
  };

  return (
    <ToolShell title="Mesin Roasting" desc="Masukin nama, siap-siap kena sindir savage." icon="🔥">
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="roast-name">
            Nama yang mau di-roasting
          </label>
          <input
            id="roast-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Contoh: Akbar (atau nama sendiri, berani?)"
            maxLength={40}
          />
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={run}>
          🔥 Roasting Sekarang
        </button>

        {output ? (
          <>
            <div className="result">
              <div className="result-head">
                <span>Roasting untuk {name.trim()}</span>
                <CopyButton value={output} />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14.5,
                  lineHeight: 1.75,
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text)',
                }}
              >
                {output}
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={run}>
              🎲 Roasting Lagi
            </button>
          </>
        ) : null}

        <p className="hint">
          Semua roasting dibuat dari template acak. Cuma buat lucu-lucuan, jangan dipakai buat
          nyakitin orang ya.
        </p>
      </div>
    </ToolShell>
  );
}
