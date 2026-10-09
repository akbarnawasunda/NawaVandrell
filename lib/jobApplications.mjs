/**
 * lib/jobApplications.mjs — logika pelacak lamaran kerja (status, tindak lanjut, ekspor).
 * Semua data tetap di perangkat. Pengingat dibuat sebagai berkas kalender .ics yang bisa dibuka di aplikasi kalender.
 */

import { addDaysIso, csvLine, daysBetweenIso, isValidIsoDate, toAmount, todayIso } from './format.mjs';
import { newId } from './localData.mjs';

export const APPLICATION_STATUSES = [
  { value: 'disimpan', label: 'Disimpan (belum melamar)', closed: false },
  { value: 'dilamar', label: 'Sudah melamar', closed: false },
  { value: 'tes', label: 'Tes / tahap online', closed: false },
  { value: 'wawancara', label: 'Wawancara', closed: false },
  { value: 'ditawari', label: 'Ditawari posisi', closed: false },
  { value: 'diterima', label: 'Diterima', closed: true },
  { value: 'ditolak', label: 'Ditolak', closed: true },
  { value: 'tanpaKabar', label: 'Tidak ada kabar', closed: true },
];

export const APPLICATION_SOURCES = [
  { value: 'lowongan-online', label: 'Lowongan online' },
  { value: 'referensi', label: 'Referensi / kenalan' },
  { value: 'media-sosial', label: 'Media sosial' },
  { value: 'job-fair', label: 'Job fair / bursa kerja' },
  { value: 'datang-langsung', label: 'Datang langsung' },
  { value: 'lainnya', label: 'Lainnya' },
];

const STATUS_VALUES = new Set(APPLICATION_STATUSES.map((item) => item.value));
const SOURCE_VALUES = new Set(APPLICATION_SOURCES.map((item) => item.value));
const MAX_TEXT = 300;

export function statusLabel(value) {
  return APPLICATION_STATUSES.find((item) => item.value === value)?.label || value;
}

export function isClosedStatus(value) {
  return APPLICATION_STATUSES.find((item) => item.value === value)?.closed === true;
}

function cleanText(value, max = MAX_TEXT) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function createApplication(now = new Date()) {
  const stamp = now.toISOString();
  return {
    id: newId('lamaran'),
    posisi: '',
    perusahaan: '',
    lokasi: '',
    sumber: 'lowongan-online',
    tanggalLamar: todayIso(now),
    status: 'dilamar',
    tindakLanjut: addDaysIso(todayIso(now), 7),
    link: '',
    gaji: '',
    catatan: '',
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** Membersihkan data dari penyimpanan atau impor. Null bila data tidak punya id. */
export function sanitizeApplication(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  return {
    id: raw.id.slice(0, 80),
    posisi: cleanText(raw.posisi, 120),
    perusahaan: cleanText(raw.perusahaan, 120),
    lokasi: cleanText(raw.lokasi, 120),
    sumber: SOURCE_VALUES.has(raw.sumber) ? raw.sumber : 'lainnya',
    tanggalLamar: isValidIsoDate(raw.tanggalLamar) ? raw.tanggalLamar : '',
    status: STATUS_VALUES.has(raw.status) ? raw.status : 'disimpan',
    tindakLanjut: isValidIsoDate(raw.tindakLanjut) ? raw.tindakLanjut : '',
    link: cleanText(raw.link, 400),
    gaji: cleanText(raw.gaji, 120),
    catatan: cleanText(raw.catatan, 1000),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

/** Daftar kesalahan untuk form. Kosong berarti siap disimpan. */
export function validateApplication(app) {
  const errors = [];
  if (!cleanText(app?.posisi)) errors.push('Posisi yang dilamar belum diisi.');
  if (!cleanText(app?.perusahaan)) errors.push('Nama perusahaan belum diisi.');
  if (app?.tanggalLamar && !isValidIsoDate(app.tanggalLamar)) errors.push('Tanggal melamar belum valid.');
  if (app?.tindakLanjut && !isValidIsoDate(app.tindakLanjut)) errors.push('Tanggal tindak lanjut belum valid.');
  if (app?.link && !/^https?:\/\//i.test(cleanText(app.link, 400))) errors.push('Tautan lowongan harus diawali http:// atau https://.');
  return errors;
}

/**
 * Status tindak lanjut relatif terhadap hari ini.
 * kind: 'selesai' (lamaran sudah ditutup) | 'tanpa' (belum ada tanggal) | 'terlambat' | 'hari-ini' | 'segera' (≤3 hari) | 'nanti'
 */
export function followUpState(app, today = todayIso()) {
  if (isClosedStatus(app?.status)) return { kind: 'selesai', days: null };
  if (!app?.tindakLanjut || !isValidIsoDate(app.tindakLanjut)) return { kind: 'tanpa', days: null };
  const days = daysBetweenIso(today, app.tindakLanjut);
  if (days < 0) return { kind: 'terlambat', days };
  if (days === 0) return { kind: 'hari-ini', days };
  if (days <= 3) return { kind: 'segera', days };
  return { kind: 'nanti', days };
}

const URGENCY_ORDER = { terlambat: 0, 'hari-ini': 1, segera: 2, nanti: 3, tanpa: 4, selesai: 5 };

/** Urutkan: yang paling mendesak dulu, lalu yang paling baru diubah. */
export function sortApplications(apps = [], today = todayIso()) {
  return [...apps].sort((a, b) => {
    const ua = URGENCY_ORDER[followUpState(a, today).kind];
    const ub = URGENCY_ORDER[followUpState(b, today).kind];
    if (ua !== ub) return ua - ub;
    const ta = followUpState(a, today).days ?? 0;
    const tb = followUpState(b, today).days ?? 0;
    if (ua <= 2 && ta !== tb) return ta - tb;
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
}

/** Ringkasan jumlah per status, lamaran aktif, dan yang sudah mendapat respons. */
export function summarizeApplications(apps = [], today = todayIso()) {
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((item) => [item.value, 0]));
  let dueNow = 0;
  let overdue = 0;
  for (const app of apps) {
    if (counts[app.status] !== undefined) counts[app.status] += 1;
    const state = followUpState(app, today).kind;
    if (state === 'terlambat') overdue += 1;
    if (state === 'terlambat' || state === 'hari-ini') dueNow += 1;
  }
  const total = apps.length;
  const active = apps.filter((app) => !isClosedStatus(app.status)).length;
  const responded = apps.filter((app) => ['tes', 'wawancara', 'ditawari', 'diterima', 'ditolak'].includes(app.status)).length;
  const applied = apps.filter((app) => app.status !== 'disimpan').length;
  return {
    total,
    active,
    counts,
    dueNow,
    overdue,
    responseRate: applied ? Math.round((responded / applied) * 100) : 0,
  };
}

/** CSV untuk dibuka di spreadsheet. Teks dengan awalan formula dinetralkan oleh csvLine. */
export function applicationsCsv(apps = []) {
  const header = csvLine(['Posisi', 'Perusahaan', 'Lokasi', 'Sumber', 'Tanggal melamar', 'Status', 'Tindak lanjut', 'Gaji (opsional)', 'Tautan', 'Catatan']);
  const rows = apps.map((app) => csvLine([
    app.posisi,
    app.perusahaan,
    app.lokasi,
    SOURCE_VALUES.has(app.sumber) ? (APPLICATION_SOURCES.find((item) => item.value === app.sumber)?.label || app.sumber) : app.sumber,
    app.tanggalLamar,
    statusLabel(app.status),
    app.tindakLanjut,
    app.gaji,
    app.link,
    app.catatan,
  ]));
  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`;
}

/** Escape teks iCalendar: koma, titik koma, backslash, dan baris baru. */
function icsText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Lipat baris iCalendar per 75 karakter sesuai RFC 5545. */
function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}

function icsDate(iso) {
  return iso.replace(/-/g, '');
}

/**
 * Berkas kalender .ics berisi satu pengingat sehari penuh untuk setiap tindak lanjut yang masih aktif.
 * @returns {string} isi berkas .ics
 */
export function buildFollowUpIcs(apps = [], now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const events = apps
    .filter((app) => !isClosedStatus(app.status) && isValidIsoDate(app.tindakLanjut))
    .map((app) => {
      const title = `Tindak lanjut lamaran: ${app.posisi || 'posisi'} di ${app.perusahaan || 'perusahaan'}`;
      const description = `Status: ${statusLabel(app.status)}.${app.catatan ? ` Catatan: ${app.catatan}` : ''}${app.link ? ` Tautan: ${app.link}` : ''}`;
      return [
        'BEGIN:VEVENT',
        `UID:${icsText(app.id)}@nawa-vandrell`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(app.tindakLanjut)}`,
        `DTEND;VALUE=DATE:${icsDate(addDaysIso(app.tindakLanjut, 1))}`,
        `SUMMARY:${icsText(title)}`,
        `DESCRIPTION:${icsText(description)}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsText(title)}`,
        'TRIGGER:-PT9H',
        'END:VALARM',
        'END:VEVENT',
      ].map(foldLine).join('\r\n');
    });
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nawa Vandrell//Pelacak Lamaran//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** Angka cepat untuk judul: "3 lamaran aktif". */
export function activeLabel(count) {
  return `${toAmount(count)} lamaran aktif`;
}
