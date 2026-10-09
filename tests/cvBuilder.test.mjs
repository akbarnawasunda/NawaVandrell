import test from 'node:test';
import assert from 'node:assert/strict';
import {
  atsReport,
  bulletsOf,
  createCv,
  createCvDocxBlob,
  cvPlainText,
  sanitizeCv,
  skillList,
} from '../lib/cvBuilder.mjs';

function strongCv() {
  return sanitizeCv({
    nama: 'Rina Wulandari',
    judulTarget: 'Admin Keuangan',
    email: 'rina.wulandari@contoh.com',
    telepon: '+62 812 3456 7890',
    kota: 'Bandung',
    tautan: 'linkedin.com/in/rina',
    ringkasan: 'Admin keuangan dengan 4 tahun pengalaman di perusahaan distribusi. Terbiasa menyusun laporan bulanan, rekonsiliasi bank, dan menjaga akurasi pencatatan transaksi harian.',
    pengalaman: [{
      posisi: 'Staf Administrasi Keuangan',
      perusahaan: 'PT Sumber Makmur',
      lokasi: 'Bandung',
      mulai: '2021-03',
      selesai: '',
      sekarang: true,
      poin: 'Menyusun laporan keuangan bulanan untuk 3 cabang\nMengurangi selisih kas hingga 40% dalam setahun\nMengelola rekonsiliasi bank harian',
    }],
    pendidikan: [{ jenjang: 'S1 Akuntansi', institusi: 'Universitas Contoh', mulai: '2015-08', selesai: '2019-07' }],
    keterampilan: 'Excel, Accurate, rekonsiliasi bank, pelaporan keuangan, Bahasa Inggris',
    sertifikat: 'Pelatihan Perpajakan Dasar 2023',
    bahasa: 'Indonesia (native), Inggris (aktif)',
  });
}

test('sanitize keeps structure, clips text, and normalises months', () => {
  const clean = sanitizeCv({
    nama: '  Budi  ',
    pengalaman: [{ posisi: 'Kasir', perusahaan: 'Toko', mulai: '2024-13', selesai: '2025-01', poin: ' satu \n\n dua ' }],
  });
  assert.equal(clean.nama, 'Budi');
  assert.equal(clean.pengalaman[0].mulai, '');
  assert.equal(clean.pengalaman[0].selesai, '2025-01');
  assert.deepEqual(bulletsOf(clean.pengalaman[0]), ['satu', 'dua']);
  assert.equal(sanitizeCv(null).pengalaman.length, 1, 'empty input falls back to a blank experience row');
});

test('a complete CV scores high and has no blocking problems', () => {
  const report = atsReport(strongCv());
  assert.ok(report.score >= 80, `skor ${report.score} harus tinggi untuk CV yang lengkap`);
  assert.equal(report.checks.filter((check) => check.level === 'perbaiki').length, 0);
  assert.ok(report.keywords.found.includes('admin'));
  assert.match(report.disclaimer, /bukan skor ATS resmi/i);
});

test('missing or invalid contact details are flagged as things to fix', () => {
  const missing = atsReport(sanitizeCv({ nama: 'Budi Santoso' }));
  assert.ok(missing.checks.some((check) => check.id === 'kontak' && check.level === 'perbaiki'));
  const badEmail = atsReport(sanitizeCv({ nama: 'Budi Santoso', email: 'budi-at-contoh', telepon: '0812' }));
  assert.ok(badEmail.checks.some((check) => check.id === 'kontak' && /email/i.test(check.title)));
});

test('decorative symbols and emoji are flagged because ATS parsers often misread them', () => {
  const cv = strongCv();
  cv.ringkasan = '💼 Admin keuangan | berpengalaman ★ dan teliti';
  const report = atsReport(cv);
  assert.ok(report.checks.some((check) => check.id === 'dekorasi' && check.level === 'perbaiki'));
});

test('date ranges that end before they start are reported', () => {
  const cv = strongCv();
  cv.pengalaman[0].sekarang = false;
  cv.pengalaman[0].selesai = '2020-01';
  const report = atsReport(cv);
  assert.ok(report.checks.some((check) => check.id === 'tanggal' && check.level === 'perbaiki'));
});

test('keyword coverage compares the target title with the CV text', () => {
  const cv = strongCv();
  cv.judulTarget = 'Data Analyst Pemasaran';
  const report = atsReport(cv);
  assert.equal(report.keywords.total, 3);
  assert.deepEqual(report.keywords.found, []);
  assert.deepEqual(report.keywords.missing, ['data', 'analyst', 'pemasaran']);
  assert.ok(report.checks.some((check) => check.id === 'kata-kunci' && check.level === 'info'));
});

test('bullet quality checks reward numbers and action verbs', () => {
  const cv = strongCv();
  cv.pengalaman[0].poin = 'Tanggung jawab umum\nBerkomunikasi dengan tim';
  const report = atsReport(cv);
  assert.ok(report.checks.some((check) => check.id === 'angka' && check.level === 'info'));
  assert.ok(report.checks.some((check) => check.id === 'kata-kerja' && check.level === 'info'));
});

test('plain text export is ATS-friendly: capital headings, dash bullets, no tables', () => {
  const text = cvPlainText(strongCv());
  assert.match(text, /^RINA WULANDARI/);
  assert.match(text, /PENGALAMAN KERJA/);
  assert.match(text, /- Mengelola rekonsiliasi bank harian/);
  assert.match(text, /Keterampilan|KETERAMPILAN/);
  assert.match(text, /Maret 2021 – Sekarang/);
  assert.doesNotMatch(text, /[|│]\s*\w+\s*[|│]/, 'no table-like separators between words');
  assert.equal(skillList(strongCv()).length, 5);
});

test('DOCX export is a valid ZIP with headings and bullets but no tables or images', async () => {
  const blob = await createCvDocxBlob(strongCv());
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK');
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default || JSZipModule;
  const archive = await JSZip.loadAsync(bytes);
  const xml = await archive.file('word/document.xml').async('string');
  assert.match(xml, /Rina Wulandari/);
  assert.match(xml, /PENGALAMAN KERJA/);
  assert.match(xml, /Mengelola rekonsiliasi bank harian/);
  assert.doesNotMatch(xml, /<w:tbl>/, 'CV tidak boleh memakai tabel');
  assert.equal(Object.keys(archive.files).filter((name) => name.startsWith('word/media/')).length, 0);
});

test('a fresh CV starts with one blank experience and education row', () => {
  const cv = createCv(new Date('2026-10-09T00:00:00Z'));
  assert.equal(cv.pengalaman.length, 1);
  assert.equal(cv.pendidikan.length, 1);
  assert.equal(cv.id, 'cv-utama');
  const report = atsReport(cv);
  assert.ok(report.checks.some((check) => check.id === 'pengalaman' && check.level === 'perbaiki'));
});
