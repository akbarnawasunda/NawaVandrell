'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import Icon, { iconNames } from './icons';

function RenderIcon({ icon, size = 26 }) {
  if (!icon) return null;
  if (typeof icon === 'string' && iconNames.includes(icon)) return <Icon name={icon} size={size} />;
  return <span className="tool-emoji-icon">{icon}</span>;
}

export default function ToolShell({ title, desc, icon, children, backHref = '/', backLabel = 'Kembali', className = '' }) {
  return (
    <div className={`shell-tool${className ? ` ${className}` : ''}`}>
      <Link href={backHref} className="back">
        <Icon name="arrowLeft" size={15} />
        <span>{backLabel}</span>
      </Link>
      <header className="tool-head tool-shell-head">
        <span className="tool-head-mark" aria-hidden="true"><RenderIcon icon={icon} size={25} /></span>
        <div className="tool-head-copy">
          <p className="tool-eyebrow">NAWA VANDRELL <i /> TOOLS</p>
          <h1>{title}</h1>
          {desc ? <p className="tool-head-description">{desc}</p> : null}
        </div>
      </header>
      {children}
    </div>
  );
}

export function CopyButton({ value, label = 'Copy', small = true, icon = 'copy' }) {
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
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      addToast('Tercopy ke clipboard', 'success');
    } catch {
      addToast('Gagal copy, salin manual ya', 'error');
    }
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
        <div className="result-actions">
          {actions}
          {value ? <CopyButton value={value} /> : null}
        </div>
      </div>
      {children ?? <pre>{value}</pre>}
    </div>
  );
}
