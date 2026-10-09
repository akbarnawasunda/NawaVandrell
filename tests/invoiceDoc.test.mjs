import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcInvoice,
  createInvoice,
  createInvoiceXlsxBlob,
  invoiceRows,
  nextInvoiceNumber,
  receiptPurpose,
  sanitizeInvoice,
  terbilang,
  validateInvoice,
} from '../lib/invoiceDoc.mjs';

function sampleDoc(overrides = {}) {
  const doc = createInvoice('invoice', new Date('2026-10-09T03:00:00Z'));
  return {
    ...doc,
    nomor: 'INV/2026/10/001',
    penjual: { nama: 'Dapur Rasa Nusa', alamat: 'Bandung', kontak: '0812-0000-0000', rekening: 'BCA 123 a.n. Rasa' },
    pembeli: { nama: 'Kantin Sekolah Maju', alamat: 'Jl. Melati 1', kontak: '' },
    items: [
      { id: 'a', nama: 'Nasi kotak', qty: 10, satuan: 'kotak', harga: 15000 },
      { id: 'b', nama: 'Es teh', qty: 3, satuan: 'gelas', harga: 4000 },
    ],
    ...overrides,
  };
}

test('terbilang matches common Indonesian rupiah phrasing', () => {
  assert.equal(terbilang(0), 'nol');
  assert.equal(terbilang(11), 'sebelas');
  assert.equal(terbilang(15), 'lima belas');
  assert.equal(terbilang(21), 'dua puluh satu');
  assert.equal(terbilang(100), 'seratus');
  assert.equal(terbilang(101), 'seratus satu');
  assert.equal(terbilang(1000), 'seribu');
  assert.equal(terbilang(1500), 'seribu lima ratus');
  assert.equal(terbilang(2000000), 'dua juta');
  assert.equal(terbilang(1234567), 'satu juta dua ratus tiga puluh empat ribu lima ratus enam puluh tujuh');
  assert.equal(terbilang(1000000000), 'satu miliar');
  assert.equal(terbilang(-5), 'minus lima');
});

test('subtotal, diskon persen, dan PPN dihitung dengan pembulatan rupiah', () => {
  const doc = sampleDoc({ diskon: { tipe: 'persen', nilai: 10 }, pajak: { aktif: true, persen: 11 } });
  const totals = calcInvoice(doc);
  assert.equal(totals.subtotal, 162000); // 150.000 + 12.000
  assert.equal(totals.diskon, 16200);
  assert.equal(totals.dpp, 145800);
  assert.equal(totals.pajak, 16038); // 145.800 x 11%
  assert.equal(totals.total, 161838);
  assert.match(totals.terbilang, /seratus enam puluh satu ribu delapan ratus tiga puluh delapan rupiah/);
});

test('diskon nominal tidak pernah melebihi subtotal dan PPN dimatikan secara default', () => {
  const totals = calcInvoice(sampleDoc({ diskon: { tipe: 'nominal', nilai: 999999999 } }));
  assert.equal(totals.diskon, totals.subtotal);
  assert.equal(totals.dpp, 0);
  assert.equal(totals.pajak, 0);
  assert.equal(totals.total, 0);
  assert.equal(calcInvoice(sampleDoc()).pajakAktif, false);
});

test('input dari form berupa string tetap dihitung benar', () => {
  const totals = calcInvoice({
    items: [{ nama: 'Jasa', qty: '2', harga: '1.250.000' }],
    diskon: { tipe: 'nominal', nilai: '100.000' },
    pajak: { aktif: true, persen: '11' },
  });
  assert.equal(totals.subtotal, 2500000);
  assert.equal(totals.dpp, 2400000);
  assert.equal(totals.total, 2664000);
});

test('validasi menemukan data wajib yang belum lengkap', () => {
  const errors = validateInvoice(createInvoice('invoice'));
  assert.ok(errors.some((text) => /Nomor dokumen/.test(text)));
  assert.ok(errors.some((text) => /penjual/.test(text)));
  assert.ok(errors.some((text) => /pembeli/.test(text)));
  assert.ok(errors.some((text) => /minimal satu barang/.test(text)));
  assert.deepEqual(validateInvoice(sampleDoc()), []);
});

test('jatuh tempo tidak boleh mendahului tanggal dokumen', () => {
  const errors = validateInvoice(sampleDoc({ jatuhTempo: '2026-10-01' }));
  assert.ok(errors.some((text) => /Jatuh tempo tidak boleh/.test(text)));
});

test('nomor dokumen berurutan per jenis dan bulan', () => {
  const existing = [
    { jenis: 'invoice', tanggal: '2026-10-02' },
    { jenis: 'invoice', tanggal: '2026-10-20' },
    { jenis: 'invoice', tanggal: '2026-09-30' },
    { jenis: 'kuitansi', tanggal: '2026-10-03' },
  ];
  assert.equal(nextInvoiceNumber(existing, 'invoice', '2026-10-09'), 'INV/2026/10/003');
  assert.equal(nextInvoiceNumber(existing, 'kuitansi', '2026-10-09'), 'KWT/2026/10/002');
  assert.equal(nextInvoiceNumber([], 'penawaran', '2026-11-01'), 'PNW/2026/11/001');
});

test('sanitasi membuang dokumen tanpa id dan membersihkan nilai liar', () => {
  assert.equal(sanitizeInvoice({ nomor: 'x' }), null);
  const clean = sanitizeInvoice({
    id: 'dok-1',
    jenis: 'bukan-jenis',
    status: 'entah',
    tanggal: '2026-02-31',
    items: [{ nama: '  Barang   besar  ', qty: '-3', harga: 'abc' }],
    diskon: { tipe: 'aneh', nilai: '-5' },
    pajak: { aktif: 'ya', persen: 500 },
  });
  assert.equal(clean.jenis, 'invoice');
  assert.equal(clean.status, 'draf');
  assert.equal(clean.tanggal.length, 10);
  assert.equal(clean.items[0].nama, 'Barang besar');
  assert.equal(clean.items[0].qty, 0);
  assert.equal(clean.items[0].harga, 0);
  assert.equal(clean.diskon.tipe, 'persen');
  assert.equal(clean.diskon.nilai, 0);
  assert.equal(clean.pajak.persen, 100);
});

test('kuitansi menyebut keterangan pembayaran dari daftar barang', () => {
  const purpose = receiptPurpose(sampleDoc({ jenis: 'kuitansi' }));
  assert.equal(purpose, 'Pembayaran untuk Nasi kotak (10 kotak), Es teh (3 gelas)');
});

test('baris tabel menghitung subtotal dan memberi nomor urut', () => {
  const rows = invoiceRows(sampleDoc());
  assert.deepEqual(rows[0], [1, 'Nasi kotak', 10, 'kotak', 15000, 150000]);
  assert.deepEqual(rows[1], [2, 'Es teh', 3, 'gelas', 4000, 12000]);
});

test('ekspor XLSX bisa dibaca ulang dengan total dan terbilang yang benar', async () => {
  const doc = sampleDoc({ jenis: 'kuitansi', pajak: { aktif: true, persen: 11 } });
  const blob = await createInvoiceXlsxBlob(doc);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await blob.arrayBuffer()));
  const sheet = workbook.getWorksheet('Dokumen');
  const values = [];
  sheet.eachRow((row) => values.push(row.values));
  const flat = values.flat().filter((value) => value !== undefined);
  assert.ok(flat.includes('KUITANSI'));
  assert.ok(flat.includes('Nasi kotak'));
  assert.ok(flat.some((value) => value === 179820), "total 162.000 + PPN 11% = 179.820 harus tersimpan");
  assert.ok(flat.some((value) => typeof value === 'string' && value.startsWith('Pembayaran untuk')));
});
