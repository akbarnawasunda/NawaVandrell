/**
 * lib/routines.mjs — checklist rutinitas harian: langkah, centang per tanggal, streak, dan jadwal pengingat.
 * Riwayat centang disimpan per rutinitas dan dipangkas ke 120 hari terakhir agar penyimpanan tetap ringan.
 */

import { addDaysIso, isValidIsoDate, todayIso } from './format.mjs';
import { newId } from './localData.mjs';

export const WEEKDAYS = [
  { value: 1, label: 'Sen' }, { value: 2, label: 'Sel' }, { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' }, { value: 5, label: 'Jum' }, { value: 6, label: 'Sab' }, { value: 0, label: 'Min' },
];

const RETAIN_DAYS = 120;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function weekdayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function createRoutine(nama = 'Rutinitas baru') {
  return { id: newId('rutin'), nama: String(nama).slice(0, 80) || 'Rutinitas baru', waktu: '', hari: [1, 2, 3, 4, 5, 6, 0], langkah: [], checks: {} };
}

export function sanitizeRoutine(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const langkah = (Array.isArray(raw.langkah) ? raw.langkah : []).slice(0, 40).map((step) => ({
    id: typeof step?.id === 'string' && step.id ? step.id.slice(0, 80) : newId('langkah'),
    teks: String(step?.teks ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
  })).filter((step) => step.teks);
  const ids = new Set(langkah.map((step) => step.id));
  const checks = {};
  for (const [date, list] of Object.entries(raw.checks && typeof raw.checks === 'object' ? raw.checks : {})) {
    if (!isValidIsoDate(date) || !Array.isArray(list)) continue;
    checks[date] = [...new Set(list.filter((id) => ids.has(id)))];
  }
  const hari = Array.isArray(raw.hari) ? [...new Set(raw.hari.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
  return {
    id: raw.id.slice(0, 80),
    nama: String(raw.nama ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Rutinitas',
    waktu: TIME_RE.test(raw.waktu) ? raw.waktu : '',
    hari: hari.length ? hari : [0, 1, 2, 3, 4, 5, 6],
    langkah,
    checks: pruneChecks(checks, todayIso()),
  };
}

function pruneChecks(checks, today) {
  const cutoff = addDaysIso(today, -RETAIN_DAYS);
  const out = {};
  for (const [date, list] of Object.entries(checks)) {
    if (date >= cutoff && list.length) out[date] = list;
  }
  return out;
}

export function isRoutineOn(routine, date) {
  return routine.hari.includes(weekdayOf(date));
}

export function progressOn(routine, date) {
  const total = routine.langkah.length;
  const selesai = (routine.checks[date] || []).filter((id) => routine.langkah.some((s) => s.id === id)).length;
  return { selesai, total, persen: total ? Math.round((selesai / total) * 100) : 0, lengkap: total > 0 && selesai === total };
}

/** Mencentang atau membatalkan satu langkah. Mengembalikan rutinitas baru. */
export function toggleStep(routine, date, stepId, today = todayIso()) {
  const current = new Set(routine.checks[date] || []);
  if (current.has(stepId)) current.delete(stepId);
  else current.add(stepId);
  const checks = { ...routine.checks };
  if (current.size) checks[date] = [...current];
  else delete checks[date];
  return { ...routine, checks: pruneChecks(checks, today) };
}

/**
 * Jumlah hari berurutan yang lengkap, dihitung mundur dari hari ini.
 * Hari yang bukan jadwal rutinitas dilewati. Jika hari ini belum lengkap, dihitung dari kemarin.
 */
export function streakOf(routine, today = todayIso()) {
  let count = 0;
  let date = today;
  let guard = 0;
  if (!progressOn(routine, today).lengkap && isRoutineOn(routine, today)) date = addDaysIso(today, -1);
  while (guard < RETAIN_DAYS) {
    if (isRoutineOn(routine, date)) {
      if (!progressOn(routine, date).lengkap) break;
      count += 1;
    }
    date = addDaysIso(date, -1);
    guard += 1;
  }
  return count;
}

/** Waktu pengingat berikutnya (hari ini atau besok) untuk satu rutinitas. */
export function nextReminder(routine, now = new Date()) {
  if (!routine.waktu || !routine.langkah.length) return null;
  const [hh, mm] = routine.waktu.split(':').map(Number);
  for (let offset = 0; offset < 8; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hh, mm, 0, 0);
    if (!routine.hari.includes(day.getDay())) continue;
    if (day > now) return day;
  }
  return null;
}

/**
 * Rutinitas yang pengingatnya sudah waktunya (dalam 2 menit terakhir) dan belum diingatkan hari ini.
 * notified: objek { [tanggal]: [routineId] } dari penyimpanan browser.
 */
export function dueReminders(routines, now = new Date(), notified = {}) {
  const today = todayIso(now);
  const sent = new Set(notified[today] || []);
  return routines.filter((routine) => {
    if (!routine.waktu || sent.has(routine.id)) return false;
    if (!isRoutineOn(routine, today) || !routine.langkah.length) return false;
    const [hh, mm] = routine.waktu.split(':').map(Number);
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
    const diff = now - at;
    return diff >= 0 && diff <= 2 * 60_000 && !progressOn(routine, today).lengkap;
  });
}
