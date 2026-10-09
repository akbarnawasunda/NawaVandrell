/**
 * lib/attendance.mjs — pendaftaran, daftar hadir, roster, dan data sertifikat untuk kegiatan komunitas.
 * Data kegiatan disimpan lokal (lihat app/tools/daftar-hadir). Sertifikat dibuat di browser (cetak PDF).
 */

import { csvLine, formatDateId, isValidIsoDate, safeSpreadsheetText, todayIso } from './format.mjs';
import { newId } from './localData.mjs';

export const ATTENDANCE_STATUS = [
  { value: 'terdaftar', label: 'Terdaftar' },
  { value: 'hadir', label: 'Hadir' },
  { value: 'izin', label: 'Izin' },
  { value: 'tidak-hadir', label: 'Tidak hadir' },
];

const STATUS_VALUES = new Set(ATTENDANCE_STATUS.map((s) => s.value));
export const MAX_PARTICIPANTS = 500;

const clean = (value, max = 120) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function createEvent(now = new Date()) {
  return { id: newId('acara'), nama: '', tanggal: todayIso(now), tempat: '', penyelenggara: '', peserta: [], dibuat: now.toISOString() };
}

export function sanitizeEvent(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const peserta = (Array.isArray(raw.peserta) ? raw.peserta : []).slice(0, MAX_PARTICIPANTS).map((p) => ({
    id: typeof p?.id === 'string' && p.id ? p.id.slice(0, 80) : newId('peserta'),
    nama: clean(p?.nama),
    kontak: clean(p?.kontak, 120),
    status: STATUS_VALUES.has(p?.status) ? p.status : 'terdaftar',
    catatan: clean(p?.catatan, 300),
  })).filter((p) => p.nama);
  return {
    id: raw.id.slice(0, 80),
    nama: clean(raw.nama, 160),
    tanggal: isValidIsoDate(raw.tanggal) ? raw.tanggal : '',
    tempat: clean(raw.tempat, 160),
    penyelenggara: clean(raw.penyelenggara, 160),
    peserta,
    dibuat: typeof raw.dibuat === 'string' ? raw.dibuat : new Date().toISOString(),
  };
}

/** Membaca daftar nama dari teks: satu orang per baris, "Nama, kontak" boleh. */
export function parseParticipants(text) {
  const out = [];
  let skipped = 0;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [nama, ...rest] = line.split(',');
    const name = clean(nama);
    if (!name) {
      skipped += 1;
      continue;
    }
    out.push({ nama: name, kontak: clean(rest.join(','), 120) });
  }
  return { peserta: out.slice(0, MAX_PARTICIPANTS), skipped };
}

export function summarizeEvent(event) {
  const list = event?.peserta || [];
  const count = (status) => list.filter((p) => p.status === status).length;
  const seen = new Map();
  for (const p of list) {
    const key = p.nama.toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([key]) => list.find((p) => p.nama.toLowerCase() === key).nama);
  const total = list.length;
  return {
    total,
    terdaftar: count('terdaftar'),
    hadir: count('hadir'),
    izin: count('izin'),
    tidakHadir: count('tidak-hadir'),
    persenHadir: total ? Math.round((count('hadir') / total) * 100) : 0,
    duplicates,
  };
}

const statusLabel = (value) => ATTENDANCE_STATUS.find((s) => s.value === value)?.label || value;

export function rosterCsv(event) {
  const rows = [
    csvLine(['No', 'Nama', 'Kontak', 'Status', 'Catatan', 'Tanda tangan']),
    ...event.peserta.map((p, i) => csvLine([i + 1, p.nama, p.kontak, statusLabel(p.status), p.catatan, ''])),
  ];
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

/** Excel: lembar daftar hadir (dengan kolom tanda tangan) dan lembar ringkasan. */
export async function rosterXlsxBlob(event) {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nawa Editor — dibuat di perangkat pengguna';
  workbook.created = new Date();
  workbook.title = `Daftar hadir ${event.nama}`;
  const sheet = workbook.addWorksheet('Daftar hadir', { views: [{ state: 'frozen', ySplit: 4 }] });
  sheet.columns = [{ width: 6 }, { width: 30 }, { width: 22 }, { width: 14 }, { width: 28 }, { width: 24 }];
  sheet.addRow([safeSpreadsheetText(event.nama || 'Daftar hadir')]).font = { bold: true, size: 14 };
  sheet.addRow(['Tanggal', formatDateId(event.tanggal) || '-']);
  sheet.addRow(['Tempat', safeSpreadsheetText(event.tempat) || '-']);
  const header = sheet.addRow(['No', 'Nama', 'Kontak', 'Status', 'Catatan', 'Tanda tangan']);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; });
  event.peserta.forEach((p, i) => {
    const row = sheet.addRow([i + 1, safeSpreadsheetText(p.nama), safeSpreadsheetText(p.kontak), statusLabel(p.status), safeSpreadsheetText(p.catatan), '']);
    row.height = 24;
  });
  const summary = workbook.addWorksheet('Ringkasan');
  const s = summarizeEvent(event);
  summary.addRow(['Jumlah peserta', s.total]);
  summary.addRow(['Hadir', s.hadir]);
  summary.addRow(['Izin', s.izin]);
  summary.addRow(['Tidak hadir', s.tidakHadir]);
  summary.addRow(['Belum dikonfirmasi', s.terdaftar]);
  summary.getColumn(1).width = 26;
  summary.getColumn(2).width = 12;
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Peserta yang berhak menerima sertifikat (status hadir). */
export function certificateRecipients(event) {
  return (event?.peserta || []).filter((p) => p.status === 'hadir');
}

/** Data satu sertifikat. Teks dibersihkan dan tidak ada placeholder. */
export function certificateData(event, participant, options = {}) {
  return {
    judul: clean(options.judul, 100) || 'SERTIFIKAT KEHADIRAN',
    nama: clean(participant?.nama, 120),
    acara: clean(event?.nama, 160),
    tanggal: formatDateId(clean(options.tanggal, 20) || event?.tanggal || ''),
    tempat: clean(event?.tempat, 160),
    penandatangan: clean(options.penandatangan, 120),
    jabatan: clean(options.jabatan, 120),
    keterangan: clean(options.keterangan, 240) || 'Telah mengikuti kegiatan di atas dengan baik.',
    nomor: clean(options.nomor, 60),
  };
}
