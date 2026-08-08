// context/ToastContext.js

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import Icon from '@/components/icons';

const ToastContext = createContext(null);

const TOAST_DURATION = 3200;
const MAX_TOASTS = 3;

const TOAST_ICONS = {
  success: 'check',
  error: 'close',
  warning: 'warning',
  info: 'info',
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));

    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message, type = 'info', duration = TOAST_DURATION) => {
      const id = ++toastId;

      const toast = {
        id,
        message: String(message || ''),
        type,
      };

      setToasts((prev) => {
        const next = [...prev, toast];

        // Single-queue: kalau lebih dari MAX_TOASTS, buang yang paling lama
        if (next.length > MAX_TOASTS) {
          const removed = next.shift();
          const removedTimer = timersRef.current.get(removed.id);
          if (removedTimer) {
            clearTimeout(removedTimer);
            timersRef.current.delete(removed.id);
          }
        }

        return next.slice(-MAX_TOASTS);
      });

      // Auto-dismiss
      if (duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
    },
    [removeToast]
  );

  const value = useMemo(
    () => ({
      addToast,
      removeToast,
      toasts,
    }),
    [addToast, removeToast, toasts]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast viewport */}
      <div
        className="toast-host"
        role="region"
        aria-label="Notifikasi"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast ${toast.type}`}
            role="status"
            onClick={() => removeToast(toast.id)}
            style={{ cursor: 'pointer' }}
          >
            <Icon
              name={TOAST_ICONS[toast.type] || 'info'}
              size={16}
              style={{ flexShrink: 0 }}
            />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw new Error('useToast() harus dipake di dalam <ToastProvider>');
  }

  return ctx;
}

export default ToastProvider;
