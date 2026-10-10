'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getDownloadTask, subscribeDownloadTask } from '@/lib/downloadTask.mjs';

/** Pesan penunjuk yang berganti bergantian supaya tunggu terasa hidup. */
const HINTS = [
  'File sedang disiapkan, sebentar lagi…',
  'Proses berjalan otomatis, kamu tinggal menunggu.',
  'Jangan tutup atau refresh halaman ini dulu, ya.',
  'File yang besar biasanya butuh waktu lebih lama.',
  'Setelah selesai, file langsung tersimpan di perangkatmu.',
];
const HINT_EVERY_MS = 3200;
const EMPTY_TASK = null;

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds} dtk`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} mnt ${String(seconds).padStart(2, '0')} dtk`;
}

function ClockGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function DownloadGlyph() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className="dl-arrow">
        <path d="M12 3v11" />
        <path d="m7 10 5 5 5-5" />
      </g>
      <path d="M4 20.5h16" />
    </svg>
  );
}

function DoneGlyph() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

function ErrorGlyph() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * Overlay tunggu unduhan global. Menampilkan diri otomatis begitu ada tugas
 * unduhan/penyiapan berkas (lihat lib/downloadTask.mjs) dari fitur apa pun,
 * lengkap dengan animasi indeterminate, durasi berjalan, dan pesan selesai.
 */
export default function DownloadOverlay() {
  const task = useSyncExternalStore(subscribeDownloadTask, getDownloadTask, () => EMPTY_TASK);
  const [now, setNow] = useState(() => Date.now());

  // Tick untuk durasi berjalan & rotasi pesan (hanya saat overlay tampil).
  useEffect(() => {
    if (!task) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [task]);

  // Kunci scroll halaman selama menunggu.
  useEffect(() => {
    if (!task || typeof document === 'undefined') return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [task]);

  if (!task || typeof document === 'undefined' || !document.body) return null;

  const working = task.phase === 'working';
  const elapsed = ((working ? now : task.endedAt || now) - task.startedAt) || 0;
  const hint = HINTS[Math.floor(elapsed / HINT_EVERY_MS) % HINTS.length];
  const percent = task.progress == null ? null : Math.round(task.progress * 100);

  return createPortal(
    <div
      className="dl-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-busy={working || undefined}
      aria-label={working ? task.label : task.phase === 'done' ? 'Unduhan selesai' : 'Unduhan gagal'}
    >
      <div className="dl-card">
        {working ? (
          <>
            <div className="dl-icon" aria-hidden="true">
              <DownloadGlyph />
            </div>
            <p className="dl-eyebrow">SEDANG DIPROSES</p>
            <h2 className="dl-title">{task.label}</h2>
            {task.detail ? <p className="dl-detail">{task.detail}</p> : null}
            <div className="dl-progress" aria-hidden="true">
              {percent == null ? (
                <div className="dl-bar-busy" />
              ) : (
                <div className="nv-bar">
                  <i style={{ width: `${percent}%` }} />
                </div>
              )}
              {percent != null ? <span className="dl-percent">{percent}%</span> : null}
            </div>
            <p className="dl-hint" key={hint}>
              {hint}
            </p>
            <p className="dl-meta mono">
              <ClockGlyph />
              {formatElapsed(elapsed)}
            </p>
          </>
        ) : task.phase === 'done' ? (
          <>
            <div className="dl-icon dl-icon-done" aria-hidden="true">
              <DoneGlyph />
            </div>
            <h2 className="dl-title">Selesai</h2>
            <p className="dl-detail">{task.doneDetail || 'File siap — cek folder Download di perangkatmu.'}</p>
          </>
        ) : (
          <>
            <div className="dl-icon dl-icon-error" aria-hidden="true">
              <ErrorGlyph />
            </div>
            <h2 className="dl-title">Ada yang tidak beres</h2>
            <p className="dl-detail">Proses unduhan terhenti. Coba lagi sebentar lagi, ya.</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
