/**
 * lib/focusPlanner.mjs — siklus fokus (Pomodoro), catatan sesi, dan rencana belajar sederhana.
 * Timer memakai waktu akhir (endAt) sehingga tetap akurat walau tab sempat dijeda browser.
 */

import { addDaysIso, isValidIsoDate, toAmount } from './format.mjs';

export const FOCUS_DEFAULTS = {
  fokusMenit: 25,
  istirahatMenit: 5,
  istirahatPanjangMenit: 15,
  siklusPanjangSetelah: 4,
};

export const PHASE_LABEL = {
  fokus: 'Fokus',
  istirahat: 'Istirahat singkat',
  'istirahat-panjang': 'Istirahat panjang',
};

/** Pengaturan yang aman: setiap angka dijepit ke rentang wajar. */
export function normalizeSettings(input = {}) {
  return {
    fokusMenit: Math.round(toAmount(input.fokusMenit ?? FOCUS_DEFAULTS.fokusMenit, { min: 1, max: 180 })),
    istirahatMenit: Math.round(toAmount(input.istirahatMenit ?? FOCUS_DEFAULTS.istirahatMenit, { min: 1, max: 60 })),
    istirahatPanjangMenit: Math.round(toAmount(input.istirahatPanjangMenit ?? FOCUS_DEFAULTS.istirahatPanjangMenit, { min: 1, max: 120 })),
    siklusPanjangSetelah: Math.round(toAmount(input.siklusPanjangSetelah ?? FOCUS_DEFAULTS.siklusPanjangSetelah, { min: 1, max: 12 })),
  };
}

function minutesFor(phase, settings) {
  if (phase === 'fokus') return settings.fokusMenit;
  if (phase === 'istirahat-panjang') return settings.istirahatPanjangMenit;
  return settings.istirahatMenit;
}

/** Keadaan timer baru untuk fase tertentu. */
export function startPhase({ phase = 'fokus', settings = FOCUS_DEFAULTS, cycle = 0, now = Date.now() } = {}) {
  const s = normalizeSettings(settings);
  return {
    phase,
    cycle,
    settings: s,
    running: true,
    endAt: now + minutesFor(phase, s) * 60_000,
    pausedRemainingMs: null,
  };
}

/** Sisa waktu dalam milidetik (nol bila sudah habis). */
export function remainingMs(state, now = Date.now()) {
  if (!state) return 0;
  if (!state.running && state.pausedRemainingMs != null) return Math.max(0, state.pausedRemainingMs);
  return Math.max(0, (state.endAt || 0) - now);
}

export function pause(state, now = Date.now()) {
  if (!state?.running) return state;
  return { ...state, running: false, pausedRemainingMs: remainingMs(state, now), endAt: 0 };
}

export function resume(state, now = Date.now()) {
  if (!state || state.running) return state;
  return { ...state, running: true, endAt: now + (state.pausedRemainingMs ?? 0), pausedRemainingMs: null };
}

/**
 * Fase berikutnya setelah sebuah fase selesai.
 * Setelah fokus, siklus bertambah; setiap N fokus diikuti istirahat panjang.
 */
export function nextAfter(state) {
  const s = normalizeSettings(state.settings);
  if (state.phase === 'fokus') {
    const cycle = (state.cycle || 0) + 1;
    const phase = cycle % s.siklusPanjangSetelah === 0 ? 'istirahat-panjang' : 'istirahat';
    return { phase, cycle };
  }
  return { phase: 'fokus', cycle: state.cycle || 0 };
}

/** Total menit fokus pada tanggal tertentu dari catatan sesi. */
export function focusMinutesOn(log = [], date) {
  return log.filter((entry) => entry.tanggal === date).reduce((sum, entry) => sum + (Number(entry.menit) || 0), 0);
}

/** Total menit fokus selama N hari terakhir (termasuk hari ini). */
export function focusMinutesLastDays(log = [], today, days = 7) {
  const start = addDaysIso(today, -(days - 1));
  return log.filter((entry) => entry.tanggal >= start && entry.tanggal <= today).reduce((sum, entry) => sum + (Number(entry.menit) || 0), 0);
}

export function sanitizeSession(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  if (!isValidIsoDate(raw.tanggal)) return null;
  const menit = Math.round(toAmount(raw.menit, { min: 1, max: 600 }));
  return { id: raw.id.slice(0, 80), tanggal: raw.tanggal, menit, dicatat: typeof raw.dicatat === 'string' ? raw.dicatat : '' };
}

/**
 * Membagi topik ke hari belajar. Topik boleh terbagi lintas hari bila melebihi kapasitas harian.
 * @param {{topics:{nama:string,menit:number}[], mulai:string, hariBelajar:number[], menitPerHari:number, maksHari?:number}} input
 * hariBelajar: 0 = Minggu … 6 = Sabtu
 */
export function buildStudyPlan({ topics = [], mulai, hariBelajar = [1, 2, 3, 4, 5], menitPerHari = 60, maksHari = 365 } = {}) {
  const errors = [];
  const list = topics
    .map((topic) => ({ nama: String(topic?.nama || '').trim().slice(0, 120), sisa: Math.round(toAmount(topic?.menit, { max: 100_000 })) }))
    .filter((topic) => topic.nama && topic.sisa > 0);
  const perDay = Math.round(toAmount(menitPerHari, { max: 1440 }));
  const days = [...new Set(hariBelajar.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (!list.length) errors.push('Isi minimal satu topik dengan perkiraan menit belajar.');
  if (!isValidIsoDate(mulai)) errors.push('Tanggal mulai belum valid.');
  if (!days.length) errors.push('Pilih minimal satu hari belajar.');
  if (!(perDay >= 10)) errors.push('Waktu belajar per hari minimal 10 menit.');
  if (errors.length) return { errors, rows: [], selesai: '', totalMenit: 0, hariDipakai: 0 };

  const rows = [];
  let cursor = mulai;
  let index = 0;
  let guard = 0;
  while (index < list.length && guard < maksHari) {
    const weekday = new Date(`${cursor}T00:00:00`).getDay();
    if (days.includes(weekday)) {
      let capacity = perDay;
      while (capacity > 0 && index < list.length) {
        const topic = list[index];
        const take = Math.min(capacity, topic.sisa);
        rows.push({ tanggal: cursor, topik: topic.nama, menit: take });
        topic.sisa -= take;
        capacity -= take;
        if (topic.sisa <= 0) index += 1;
      }
    }
    cursor = addDaysIso(cursor, 1);
    guard += 1;
  }
  const totalMenit = rows.reduce((sum, row) => sum + row.menit, 0);
  const hariDipakai = new Set(rows.map((row) => row.tanggal)).size;
  if (index < list.length) errors.push(`Rencana melebihi ${maksHari} hari. Kurangi topik atau tambah waktu per hari.`);
  return { errors, rows, selesai: rows.at(-1)?.tanggal || '', totalMenit, hariDipakai };
}
