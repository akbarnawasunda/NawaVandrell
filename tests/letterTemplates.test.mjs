import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LETTER_TEMPLATES,
  buildLetter,
  createLetterDocxBlob,
  emptyLetterValues,
  hasLeftoverPlaceholder,
  letterPlainText,
  letterValuesFromCv,
  requiredFieldsFor,
} from '../lib/letterTemplates.mjs';

const common = { kota: 'Bandung', tanggal: '2026-10-09' };

function lamaranValues(overrides = {}) {
  return {
    ...common,
    nama: 'Rina Wulandari',
    alamat: 'Jl. Melati No. 12, Bandung',
    telepon: '0812-3456-7890',
    email: 'rina@contoh.com',
    posisi: 'Admin Keuangan',
    perusahaan: 'PT Sumber Makmur',
    penerima: '',
    sumber: 'situs lowongan',
    kualifikasi: 'Empat tahun pengalaman administrasi keuangan di perusahaan distribusi.',
    motivasi: 'Saya ingin berkembang di bidang pelaporan keuangan.',
    lampiran: 'CV\nFotokopi ijazah',
    ...overrides,
  };
}

test('every template has a label and required fields exist for each', () => {
  assert.equal(LETTER_TEMPLATES.length, 4);
  for (const template of LETTER_TEMPLATES) {
    const required = requiredFieldsFor(template.id);
    assert.ok(required.some((field) => field.key === 'kota'), `${template.id} wajib kota`);
  }
});

test('lamaran letter is complete, formal, and contains no leftover placeholders', () => {
  const { errors, doc } = buildLetter('lamaran', lamaranValues());
  assert.deepEqual(errors, []);
  const text = letterPlainText(doc);
  assert.match(text, /Bandung, 9 Oktober 2026/);
  assert.match(text, /Hal: Lamaran pekerjaan sebagai Admin Keuangan/);
  assert.match(text, /Kepada Yth\.\nBagian Human Resources \(HRD\)\nPT Sumber Makmur/);
  assert.match(text, /melalui situs lowongan/);
  assert.match(text, /Lampiran:\n- CV\n- Fotokopi ijazah/);
  assert.match(text, /Hormat saya,/);
  assert.equal(hasLeftoverPlaceholder(doc), false);
});

test('lamaran requires a way to reach the applicant and a position', () => {
  const { errors } = buildLetter('lamaran', lamaranValues({ telepon: '', email: '' }));
  assert.ok(errors.some((text) => /telepon atau email/.test(text)));
  const missing = buildLetter('lamaran', lamaranValues({ posisi: '   ' }));
  assert.ok(missing.errors.some((text) => /Posisi yang dilamar/.test(text)));
  assert.equal(missing.doc, null);
});

test('kuasa letter lists both parties, the purpose, and the place/date before signatures', () => {
  const { errors, doc } = buildLetter('kuasa', {
    ...common,
    pemberiNama: 'Budi',
    pemberiAlamat: 'Jl. Kenanga 1',
    penerimaNama: 'Siti',
    penerimaAlamat: 'Jl. Kenanga 2',
    keperluan: 'mengambil berkas di kelurahan',
  });
  assert.deepEqual(errors, []);
  const text = letterPlainText(doc);
  assert.match(text, /SURAT KUASA/);
  assert.match(text, /Untuk keperluan: mengambil berkas di kelurahan\./);
  assert.match(text, /Kuasa ini berlaku sampai keperluan di atas selesai\./);
  assert.ok(text.indexOf('Bandung, 9 Oktober 2026') < text.indexOf('Penerima kuasa'));
  assert.equal(doc.tandaTangan.length, 2);
  assert.equal(hasLeftoverPlaceholder(doc), false);
});

test('pernyataan numbers each point and optionally adds the responsibility clause', () => {
  const values = { ...common, nama: 'Andi', alamat: 'Jl. Mawar 3', pernyataan: 'Data yang saya isi benar\nSaya bersedia diperiksa' };
  const withClause = buildLetter('pernyataan', values).doc;
  assert.match(letterPlainText(withClause), /1\. Data yang saya isi benar\n2\. Saya bersedia diperiksa/);
  assert.match(letterPlainText(withClause), /bersedia menanggung akibat/);
  const withoutClause = buildLetter('pernyataan', { ...values, tanggungJawab: false }).doc;
  assert.doesNotMatch(letterPlainText(withoutClause), /bersedia menanggung akibat/);
  assert.ok(buildLetter('pernyataan', { ...values, pernyataan: '  ' }).errors.length > 0);
});

test('undangan includes date, place, agenda, and confirmation contact', () => {
  const { errors, doc } = buildLetter('undangan', {
    ...common,
    acara: 'Rapat koordinasi RT',
    hari: 'Senin, 19 Oktober 2026',
    waktu: '19.00 WIB',
    tempat: 'Balai warga',
    agenda: 'Iuran kebersihan\nJadwal ronda',
    penerima: 'Seluruh warga RT 03',
    kontakKonfirmasi: '0812-0000-0000',
    penyelenggara: 'Ketua RT 03',
    jabatanPenyelenggara: 'Ketua',
  });
  assert.deepEqual(errors, []);
  const text = letterPlainText(doc);
  assert.match(text, /SURAT UNDANGAN/);
  assert.match(text, /Agenda:\n1\. Iuran kebersihan\n2\. Jadwal ronda/);
  assert.match(text, /Mohon konfirmasi kehadiran melalui 0812-0000-0000\./);
  assert.match(text, /Ketua/);
});

test('missing required values produce Indonesian messages and no document', () => {
  const { errors, doc } = buildLetter('kuasa', { ...common, pemberiNama: '' });
  assert.equal(doc, null);
  assert.ok(errors.some((text) => /Pemberi kuasa: nama belum diisi/.test(text)));
  const badDate = buildLetter('undangan', { ...common, tanggal: '2026-02-31', acara: 'x', hari: 'x', tempat: 'x', penerima: 'x', penyelenggara: 'x' });
  assert.ok(badDate.errors.some((text) => /Tanggal surat belum valid/.test(text)));
});

test('values from CV fill only fields that exist in the letter and never invent an address', () => {
  const fill = letterValuesFromCv({
    nama: 'Rina',
    email: 'rina@contoh.com',
    telepon: '0812',
    kota: 'Bandung',
    judulTarget: 'Admin',
    ringkasan: 'Pengalaman admin.',
    pengalaman: [{ posisi: 'Staf' }],
  });
  assert.equal(fill.nama, 'Rina');
  assert.equal(fill.posisi, 'Admin');
  assert.equal(fill.alamat, undefined, 'alamat lengkap tidak diisi dari kota saja');
  assert.deepEqual(Object.keys(letterValuesFromCv(null)), []);
  assert.equal(Object.keys(emptyLetterValues()).includes('kota'), true);
});

test('DOCX letter is a ZIP package containing the letter text and no tables', async () => {
  const { doc } = buildLetter('lamaran', lamaranValues());
  const blob = await createLetterDocxBlob(doc);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK');
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default || JSZipModule;
  const archive = await JSZip.loadAsync(bytes);
  const xml = await archive.file('word/document.xml').async('string');
  assert.match(xml, /Lamaran pekerjaan sebagai Admin Keuangan/);
  assert.doesNotMatch(xml, /<w:tbl>/);
});
