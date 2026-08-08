// components/ConfirmModal.js

'use client';

import { useEffect, useRef } from 'react';
import Icon from './icons';

/**
 * Modal konfirmasi reusable.
 * Support: Escape key, backdrop click, auto-focus ke tombol konfirmasi.
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Konfirmasi',
  message = 'Apakah kamu yakin?',
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger', // 'danger' | 'primary'
  icon = 'warning',
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEsc);
    
    // Auto-focus ke tombol konfirmasi biar user bisa langsung tekan Enter
    setTimeout(() => confirmRef.current?.focus(), 50);

    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        // Tutup cuma kalau yang diklik adalah backdrop (luar modal)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background:
              variant === 'danger'
                ? 'rgba(248, 113, 113, 0.15)'
                : 'var(--accent-ghost)',
            color:
              variant === 'danger' ? 'var(--danger)' : 'var(--accent-soft)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Icon name={icon} size={24} />
        </div>

        <h2
          id="modal-title"
          style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}
        >
          {title}
        </h2>

        <p
          style={{
            color: 'var(--text-dim)',
            fontSize: 14,
            margin: '0 0 24px',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${
              variant === 'danger' ? 'btn-danger' : 'btn-primary'
            }`}
            style={{ flex: 1 }}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
