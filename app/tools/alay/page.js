'use client';

import { useState } from 'react';
import ToolShell, { ResultBox } from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import { toAlay } from '@/lib/funTools';

const EXAMPLES = ['Halo kamu apa kabar', 'Aku sayang kamu selamanya', 'Selamat pagi semuanya'];

export default function AlayPage() {
  const { addToast } = useToast();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  const run = (text = input) => {
    const clean = String(text).trim();
    if (!clean) {
      addToast('Ketik teksnya dulu', 'warning');
      return;
    }
    setOutput(toAlay(clean));
  };

  return (
    <ToolShell title="Teks Alay" desc="Ubah tulisan biasa jadi 4L4Y maksimal." icon="🤪">
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="alay-in">
            Teks biasa
          </label>
          <textarea
            id="alay-in"
            className="textarea"
            style={{ minHeight: 90, fontFamily: 'inherit', fontSize: 15 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ketik teks biasa di sini..."
            maxLength={2000}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="chip"
                style={{ fontSize: 12, padding: '5px 11px' }}
                onClick={() => {
                  setInput(ex);
                  run(ex);
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={() => run()}>
          Ubah Jadi Alay
        </button>

        {output ? (
          <ResultBox label="Versi alay" value={output}>
            <p
              className="mono"
              style={{ margin: 0, fontSize: 16, lineHeight: 1.7, wordBreak: 'break-word' }}
            >
              {output}
            </p>
          </ResultBox>
        ) : null}

        {output ? (
          <button
            type="button"
            className="btn btn-ghost btn-full"
            style={{ marginTop: 10 }}
            onClick={() => run()}
          >
            🎲 Acak Ulang
          </button>
        ) : null}
      </div>
    </ToolShell>
  );
}
