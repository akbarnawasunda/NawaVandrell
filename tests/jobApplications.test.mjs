import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applicationsCsv,
  buildFollowUpIcs,
  followUpState,
  sanitizeApplication,
  sortApplications,
  summarizeApplications,
  validateApplication,
} from '../lib/jobApplications.mjs';

const TODAY = '2026-10-09';

function app(overrides = {}) {
  return {
    id: overrides.id || `app-${Math.random().toString(36).slice(2, 7)}`,
    posisi: 'Staf Admin',
    perusahaan: 'PT Contoh Jaya',
    lokasi: 'Bandung',
    sumber: 'lowongan-online',
    tanggalLamar: '2026-10-01',
    status: 'dilamar',
    tindakLanjut: '2026-10-12',
    link: '',
    gaji: '',
    catatan: '',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

test('validation requires position, company, and valid dates or links', () => {
  const errors = validateApplication({ posisi: ' ', perusahaan: '', tanggalLamar: '2026-02-30', tindakLanjut: 'besok', link: 'ftp://x' });
  assert.equal(errors.length, 5);
  assert.deepEqual(validateApplication(app()), []);
});

test('follow-up states classify overdue, today, soon, later, closed, and missing dates', () => {
  assert.equal(followUpState(app({ tindakLanjut: '2026-10-08' }), TODAY).kind, 'terlambat');
  assert.equal(followUpState(app({ tindakLanjut: TODAY }), TODAY).kind, 'hari-ini');
  assert.equal(followUpState(app({ tindakLanjut: '2026-10-12' }), TODAY).kind, 'segera');
  assert.equal(followUpState(app({ tindakLanjut: '2026-10-30' }), TODAY).kind, 'nanti');
  assert.equal(followUpState(app({ tindakLanjut: '' }), TODAY).kind, 'tanpa');
  assert.equal(followUpState(app({ status: 'ditolak', tindakLanjut: TODAY }), TODAY).kind, 'selesai');
});

test('sorting puts the most urgent follow-ups first and closed applications last', () => {
  const apps = [
    app({ id: 'selesai', status: 'diterima', tindakLanjut: TODAY }),
    app({ id: 'nanti', tindakLanjut: '2026-11-20' }),
    app({ id: 'terlambat', tindakLanjut: '2026-10-05' }),
    app({ id: 'hari-ini', tindakLanjut: TODAY }),
  ];
  assert.deepEqual(sortApplications(apps, TODAY).map((item) => item.id), ['terlambat', 'hari-ini', 'nanti', 'selesai']);
});

test('summary counts statuses, overdue items, and response rate among applied jobs', () => {
  const apps = [
    app({ status: 'disimpan', tindakLanjut: '' }),
    app({ status: 'dilamar', tindakLanjut: '2026-10-05' }),
    app({ status: 'wawancara', tindakLanjut: TODAY }),
    app({ status: 'ditolak', tindakLanjut: '' }),
  ];
  const summary = summarizeApplications(apps, TODAY);
  assert.equal(summary.total, 4);
  assert.equal(summary.active, 3);
  assert.equal(summary.counts.wawancara, 1);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.dueNow, 2);
  // 3 dari 3 lamaran yang sudah dilamar (dilamar, wawancara, ditolak) -> respons: wawancara + ditolak = 2 dari 3
  assert.equal(summary.responseRate, 67);
});

test('CSV export neutralises spreadsheet formulas and keeps Indonesian labels', () => {
  const csv = applicationsCsv([app({ posisi: '=HYPERLINK("x")', perusahaan: 'PT, Maju', catatan: 'Ditelepon "HRD"' })]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"PT, Maju"/);
  assert.match(csv, /"Sudah melamar"/);
  assert.match(csv, /Ditelepon ""HRD""/);
});

test('calendar export has one all-day reminder per open application with escaped text', () => {
  const ics = buildFollowUpIcs([
    app({ id: 'buka', catatan: 'Minta jadwal; kirim email, besok', tindakLanjut: '2026-10-12' }),
    app({ id: 'tutup', status: 'ditolak', tindakLanjut: '2026-10-12' }),
    app({ id: 'tanpa-tanggal', tindakLanjut: '' }),
  ], new Date('2026-10-09T02:00:00Z'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(ics, /DTSTART;VALUE=DATE:20261012/);
  assert.match(ics, /DTEND;VALUE=DATE:20261013/);
  assert.match(ics, /UID:buka@nawa-vandrell/);
  // RFC 5545: baris panjang dilipat dengan CRLF + spasi; buka lipatan sebelum mencocokkan
  const unfolded = ics.replace(/\r\n /g, '');
  assert.match(unfolded, /Minta jadwal\\; kirim email\\, besok/);
  assert.ok(ics.split('\r\n').every((line) => line.length <= 75));
  assert.match(ics, /BEGIN:VALARM/);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.trimEnd().endsWith('END:VCALENDAR'));
});

test('sanitizer falls back to safe defaults for unknown statuses and sources', () => {
  const clean = sanitizeApplication({ id: 'x', status: 'entah', sumber: 'aneh', tanggalLamar: '2026-13-01', posisi: '  Desainer  ' });
  assert.equal(clean.status, 'disimpan');
  assert.equal(clean.sumber, 'lainnya');
  assert.equal(clean.tanggalLamar, '');
  assert.equal(clean.posisi, 'Desainer');
  assert.equal(sanitizeApplication({ posisi: 'tanpa id' }), null);
});
