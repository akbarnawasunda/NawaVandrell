import test from 'node:test';
import assert from 'node:assert/strict';
import {
  certificateData,
  certificateRecipients,
  parseParticipants,
  rosterCsv,
  rosterXlsxBlob,
  sanitizeEvent,
  summarizeEvent,
} from '../lib/attendance.mjs';

function event() {
  return sanitizeEvent({
    id: 'acara-1',
    nama: 'Kerja Bakti RW 05',
    tanggal: '2026-10-18',
    tempat: 'Lapangan RW',
    penyelenggara: 'Pengurus RW 05',
    peserta: [
      { id: 'p1', nama: 'Dewi', kontak: '0812', status: 'hadir' },
      { id: 'p2', nama: 'Eko', status: 'izin', catatan: 'Ada keperluan keluarga' },
      { id: 'p3', nama: 'dewi', status: 'hadir' },
      { id: 'p4', nama: 'Fitri', status: 'entah' },
      { id: 'p5', nama: '' },
    ],
  });
}

test('participant text is parsed one person per line with optional contact', () => {
  const result = parseParticipants('Ani, 0812-1\n\n  Budi  \n, tanpa nama\nCici,cici@contoh.com');
  assert.deepEqual(result.peserta, [
    { nama: 'Ani', kontak: '0812-1' },
    { nama: 'Budi', kontak: '' },
    { nama: 'Cici', kontak: 'cici@contoh.com' },
  ]);
  assert.equal(result.skipped, 1);
});

test('sanitizer drops nameless participants and falls back to a registered status', () => {
  const e = event();
  assert.equal(e.peserta.length, 4);
  assert.equal(e.peserta.find((p) => p.nama === 'Fitri').status, 'terdaftar');
});

test('summary counts statuses and flags duplicate names regardless of case', () => {
  const summary = summarizeEvent(event());
  assert.equal(summary.total, 4);
  assert.equal(summary.hadir, 2);
  assert.equal(summary.izin, 1);
  assert.equal(summary.terdaftar, 1);
  assert.equal(summary.persenHadir, 50);
  assert.deepEqual(summary.duplicates, ['Dewi']);
});

test('roster CSV keeps the signature column blank and protects formulas', () => {
  const e = event();
  e.peserta[0].nama = '=cmd';
  const csv = rosterCsv(e);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"No","Nama","Kontak","Status","Catatan","Tanda tangan"/);
  assert.match(csv, /"'=cmd"/);
  assert.match(csv, /"Tidak hadir"|"Izin"/);
});

test('roster Excel has a signature sheet and a summary sheet', async () => {
  const blob = await rosterXlsxBlob(event());
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await blob.arrayBuffer()));
  assert.deepEqual(workbook.worksheets.map((w) => w.name), ['Daftar hadir', 'Ringkasan']);
  const sheet = workbook.getWorksheet('Daftar hadir');
  assert.equal(sheet.getCell('F4').value, 'Tanda tangan', 'header berada di baris 4');
  assert.equal(workbook.getWorksheet('Ringkasan').getCell('B2').value, 2);
});

test('only attendees receive certificates, and certificate text has no placeholders', () => {
  const e = event();
  const recipients = certificateRecipients(e);
  assert.deepEqual(recipients.map((p) => p.nama), ['Dewi', 'dewi']);
  const cert = certificateData(e, recipients[0], { penandatangan: 'Ketua RW', jabatan: 'Ketua', tanggal: '2026-10-19' });
  assert.equal(cert.judul, 'SERTIFIKAT KEHADIRAN');
  assert.equal(cert.tanggal, '19 Oktober 2026');
  assert.equal(cert.acara, 'Kerja Bakti RW 05');
  assert.doesNotMatch(JSON.stringify(cert), /\{[a-z]+\}/);
});
