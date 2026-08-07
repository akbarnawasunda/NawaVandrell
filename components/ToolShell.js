'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { useToast } from '@/context/ToastContext';

/** Wrapper standar tiap tool: max 480px, back link, judul, isi. */
export default function ToolShell({ title, desc, icon, children, backHref = '/', backLabel = 'Kembali' }) {
  return (
    <div className="shell-tool">
      <Link href={backHref} className="back">
        ← {backLabel}
      </Link>
      <div className="tool-head">
        <h1>
          {icon ? <span aria-hidden="true">{icon} </span> : null}
          {title}
        </h1>
        {desc ? <p>{desc}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Tombol copy dengan fallback untuk browser tanpa clipboard API. */
export function CopyButton({ value, label = 'Copy', small = true }) {
  const { addToast } = useToast();

  const copy = useCallback(async () => {
    const text = typeof value === 'function' ? value() : value;
    if (!text) {
      addToast('Belum ada yang bisa dicopy', 'warning');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      addToast('Tercopy ke clipboard', 'success');
    } catch {
      addToast('Gagal copy, salin manual ya', 'error');
    }
  }, [value, addToast]);

  return (
    <button type="button" className={`btn btn-ghost${small ? ' btn-sm' : ''}`} onClick={copy}>
      📋 {label}
    </button>
  );
}

/** Kotak hasil + tombol copy. */
export function ResultBox({ label = 'Hasil', value, children, actions }) {
  return (
    <div className="result">
      <div className="result-head">
        <span>{label}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {actions}
          {value ? <CopyButton value={value} /> : null}
        </div>
      </div>
      {children ?? <pre>{value}</pre>}
    </div>
  );
}
