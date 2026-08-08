'use client';
import Link from 'next/link';
import { useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import Icon, { iconNames } from './icons';

function RenderIcon({ icon, size = 26 }) {
  if (!icon) return null;
  // Kalau icon adalah nama SVG yang terdaftar
  if (typeof icon === 'string' && iconNames.includes(icon)) {
    return <Icon name={icon} size={size} />;
  }
  // Fallback kalau masih ada page lama yang ngirim emoji
  return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{icon}</span>;
}

export default function ToolShell({ title, desc, icon, children, backHref = '/', backLabel = 'Kembali' }) {
  return (
    <div className="shell-tool">
      <Link href={backHref} className="back">
        <Icon name="arrowLeft" size={15} />
        {backLabel}
      </Link>
      <div className="tool-head">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ color: 'var(--accent-soft)', display: 'inline-flex' }}>
            <RenderIcon icon={icon} size={26} />
          </span>
          <span>{title}</span>
        </h1>
        {desc ? <p>{desc}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function CopyButton({ value, label = 'Copy', small = true, icon = 'copy' }) {
  const { addToast } = useToast();
  const copy = useCallback(async () => {
    const text = typeof value === 'function' ? value() : value;
    if (!text) { addToast('Belum ada yang bisa dicopy', 'warning'); return; }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      }
      addToast('Tercopy ke clipboard', 'success');
    } catch { addToast('Gagal copy, salin manual ya', 'error'); }
  }, [value, addToast]);

  return (
    <button type="button" className={`btn btn-ghost${small ? ' btn-sm' : ''}`} onClick={copy}>
      <Icon name={icon} size={small ? 14 : 16} />
      {label}
    </button>
  );
}

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
