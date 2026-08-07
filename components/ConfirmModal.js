'use client';

import { useEffect } from 'react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  message,
  confirmLabel = 'Yakin',
  cancelLabel = 'Batal',
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Enter') onConfirm?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="modal">
        <p style={{ margin: '0 0 20px', fontSize: 15.5, lineHeight: 1.55 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
