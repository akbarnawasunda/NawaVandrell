/**
 * lib/invoiceDoc.mjs — invoice, penawaran harga, dan kuitansi untuk usaha kecil.
 *
 * Aturan hitung (ditampilkan juga di halaman):
 *  - Subtotal   = Σ (jumlah × harga satuan), dibulatkan per baris ke rupiah
 *  - Diskon     = persen dari subtotal, atau nominal; tidak pernah melebihi subtotal
 *  - DPP        = subtotal − diskon
 *  - PPN        = DPP × persen (hanya bila diaktifkan), dibulatkan ke rupiah
 *  - Total      = DPP + PPN
 * Terbilang dipakai pada kuitansi. Semua fungsi murni dan bisa diuji.
 */

import { formatDateId, isValidIsoDate, addDaysIso, todayIso, toAmount, safeSpreadsheetText } from './format.mjs';
import { newId } from './localData.mjs';

export const INVOICE_TYPES = [
  { value: 'invoice', label: 'Invoice (tagihan)', title: 'INVOICE', prefix: 'INV' },
  { value: 'penawaran', label: 'Penawaran harga', title: 'PENAWARAN HARGA', prefix: 'PNW' },
  { value: 'kuitansi', label: 'Kuitansi (tanda terima)', title: 'KUITANSI', prefix: 'KWT' },
];

export const INVOICE_STATUSES = [
  { value: 'draf', label: 'Draf' },
  { value: 'terkirim', label: 'Sudah dikirim' },
  { value: 'lunas', label: 'Lunas' },
];

const MAX_ITEMS = 100;
const MAX_TEXT = 300;
const SATUAN_KATA = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];

function ratusan(n) {
  if (n < 10) return SATUAN_KATA[n];
  if (n < 12) return n === 10 ? 'sepuluh' : 'sebelas';
  if (n < 20) return `${SATUAN_KATA[n - 10]} belas`;
  if (n < 100) {
    const puluh = Math.floor(n / 10);
    const sisa = n % 10;
    return `${SATUAN_KATA[puluh]} puluh${sisa ? ` ${SATUAN_KATA[sisa]}` : ''}`;
  }
  const ratus = Math.floor(n / 100);
  const sisa = n % 100;
  const kata = ratus === 1 ? 'seratus' : `${SATUAN_KATA[ratus]} ratus`;
  return sisa ? `${kata} ${ratusan(sisa)}` : kata;
}

/** Terbilang Indonesia untuk bilangan bulat rupiah, mis. 1500 → "seribu lima ratus". */
export function terbilang(value) {
  const amount = Math.round(Number(value) || 0);
  if (amount < 0) return `minus ${terbilang(-amount)}`;
  if (amount === 0) return 'nol';
  const units = [
    [1e12, 'triliun'],
    [1e9, 'miliar'],
    [1e6, 'juta'],
    [1e3, 'ribu'],
  ];
  const parts = [];
  let rest = amount;
  for (const [size, name] of units) {
    const count = Math.floor(rest / size);
    if (count > 0) {
      parts.push(name === 'ribu' && count === 1 ? 'seribu' : `${terbilang(count)} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0) parts.push(ratusan(rest));
  return parts.join(' ');
}

export function createInvoice(jenis = 'invoice', now = new Date()) {
  const date = todayIso(now);
  const timestamp = now.toISOString();
  return {
    id: newId('dok'),
    jenis: INVOICE_TYPES.some((type) => type.value === jenis) ? jenis : 'invoice',
    nomor: '',
    tanggal: date,
    jatuhTempo: addDaysIso(date, 14),
    status: 'draf',
    penjual: { nama: '', alamat: '', kontak: '', rekening: '' },
    pembeli: { nama: '', alamat: '', kontak: '' },
    items: [{ id: newId('baris'), nama: '', qty: 1, satuan: 'pcs', harga: 0 }],
    diskon: { tipe: 'persen', nilai: 0 },
    pajak: { aktif: false, persen: 11 },
    catatan: '',
    syarat: 'Pembayaran paling lambat sesuai jatuh tempo.',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function cleanText(value, max = MAX_TEXT) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Membersihkan dokumen dari penyimpanan atau impor. Mengembalikan null bila tidak bisa dipakai. */
export function sanitizeInvoice(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const jenis = INVOICE_TYPES.some((type) => type.value === raw.jenis) ? raw.jenis : 'invoice';
  const status = INVOICE_STATUSES.some((item) => item.value === raw.status) ? raw.status : 'draf';
  const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, MAX_ITEMS).map((row) => ({
    id: typeof row?.id === 'string' && row.id ? row.id.slice(0, 80) : newId('baris'),
    nama: cleanText(row?.nama, 120),
    qty: toAmount(row?.qty, { max: 1_000_000 }),
    satuan: cleanText(row?.satuan, 20),
    harga: toAmount(row?.harga, { max: 1_000_000_000_000 }),
  }));
  return {
    id: raw.id.slice(0, 80),
    jenis,
    nomor: cleanText(raw.nomor, 60),
    tanggal: isValidIsoDate(raw.tanggal) ? raw.tanggal : todayIso(),
    jatuhTempo: isValidIsoDate(raw.jatuhTempo) ? raw.jatuhTempo : '',
    status,
    penjual: {
      nama: cleanText(raw.penjual?.nama, 120),
      alamat: cleanText(raw.penjual?.alamat, 300),
      kontak: cleanText(raw.penjual?.kontak, 120),
      rekening: cleanText(raw.penjual?.rekening, 200),
    },
    pembeli: {
      nama: cleanText(raw.pembeli?.nama, 120),
      alamat: cleanText(raw.pembeli?.alamat, 300),
      kontak: cleanText(raw.pembeli?.kontak, 120),
    },
    items,
    diskon: {
      tipe: raw.diskon?.tipe === 'nominal' ? 'nominal' : 'persen',
      nilai: toAmount(raw.diskon?.nilai, { max: 1_000_000_000_000 }),
    },
    pajak: {
      aktif: Boolean(raw.pajak?.aktif),
      persen: toAmount(raw.pajak?.persen, { max: 100 }),
    },
    catatan: cleanText(raw.catatan, 600),
    syarat: cleanText(raw.syarat, 600),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

/**
 * Menghitung seluruh angka dokumen. Input boleh berupa string dari form; semuanya dinormalisasi.
 */
export function calcInvoice(doc) {
  const items = (doc?.items || []).map((row) => {
    const qty = toAmount(row?.qty, { max: 1_000_000 });
    const harga = toAmount(row?.harga, { max: 1_000_000_000_000 });
    return { ...row, qty, harga, subtotal: Math.round(qty * harga) };
  });
  const subtotal = items.reduce((sum, row) => sum + row.subtotal, 0);
  const diskonTipe = doc?.diskon?.tipe === 'nominal' ? 'nominal' : 'persen';
  const diskonNilai = toAmount(doc?.diskon?.nilai, { max: 1_000_000_000_000 });
  const rawDiskon = diskonTipe === 'nominal'
    ? diskonNilai
    : subtotal * (toAmount(diskonNilai, { min: 0, max: 100 }) / 100);
  const diskon = Math.min(subtotal, Math.max(0, Math.round(rawDiskon)));
  const dpp = subtotal - diskon;
  const pajakAktif = Boolean(doc?.pajak?.aktif);
  const persenPajak = toAmount(doc?.pajak?.persen, { min: 0, max: 100 });
  const pajak = pajakAktif ? Math.round(dpp * (persenPajak / 100)) : 0;
  const total = dpp + pajak;
  return {
    items,
    subtotal,
    diskon,
    diskonTipe,
    dpp,
    pajakAktif,
    persenPajak,
    pajak,
    total,
    terbilang: `${terbilang(total)} rupiah`,
  };
}

/** Daftar kesalahan yang harus diperbaiki sebelum dokumen dicetak atau diekspor. */
export function validateInvoice(doc) {
  const errors = [];
  const type = INVOICE_TYPES.find((item) => item.value === doc?.jenis) || INVOICE_TYPES[0];
  if (!cleanText(doc?.nomor)) errors.push('Nomor dokumen belum diisi.');
  if (!isValidIsoDate(doc?.tanggal)) errors.push('Tanggal dokumen belum valid.');
  if (doc?.jatuhTempo && !isValidIsoDate(doc.jatuhTempo)) errors.push('Tanggal jatuh tempo belum valid.');
  if (doc?.jatuhTempo && isValidIsoDate(doc.jatuhTempo) && isValidIsoDate(doc.tanggal) && doc.jatuhTempo < doc.tanggal) {
    errors.push('Jatuh tempo tidak boleh sebelum tanggal dokumen.');
  }
  if (!cleanText(doc?.penjual?.nama)) errors.push('Nama penjual atau usaha belum diisi.');
  if (!cleanText(doc?.pembeli?.nama)) errors.push('Nama pembeli belum diisi.');
  const rows = (doc?.items || []).filter((row) => cleanText(row?.nama) || toAmount(row?.harga) > 0);
  if (!rows.length) errors.push('Tambahkan minimal satu barang atau jasa.');
  rows.forEach((row, index) => {
    if (!cleanText(row?.nama)) errors.push(`Baris ${index + 1} belum punya nama barang atau jasa.`);
    if (!(toAmount(row?.qty) > 0)) errors.push(`Jumlah pada baris ${index + 1} harus lebih dari nol.`);
  });
  if (doc?.pajak?.aktif && toAmount(doc.pajak.persen, { max: 100 }) > 100) errors.push('Persen pajak tidak boleh lebih dari 100.');
  if (type.value === 'kuitansi' && !rows.length) errors.push('Kuitansi memerlukan keterangan pembayaran.');
  const totals = calcInvoice(doc);
  if (totals.total <= 0) errors.push('Total dokumen masih nol. Periksa jumlah dan harga.');
  return errors;
}

/** Nomor dokumen berikutnya, mis. INV/2026/10/001 berdasarkan jumlah dokumen jenis dan bulan yang sama. */
export function nextInvoiceNumber(existing = [], jenis = 'invoice', tanggal = todayIso()) {
  const type = INVOICE_TYPES.find((item) => item.value === jenis) || INVOICE_TYPES[0];
  const [year, month] = isValidIsoDate(tanggal) ? tanggal.split('-') : todayIso().split('-');
  const sameMonth = existing.filter((doc) => doc?.jenis === type.value
    && isValidIsoDate(doc?.tanggal)
    && doc.tanggal.startsWith(`${year}-${month}`)).length;
  return `${type.prefix}/${year}/${month}/${String(sameMonth + 1).padStart(3, '0')}`;
}

/** Keterangan kuitansi: "Pembayaran untuk: barang A (2), barang B (1)". */
export function receiptPurpose(doc) {
  const names = (doc?.items || [])
    .filter((row) => cleanText(row?.nama))
    .map((row) => `${cleanText(row.nama)} (${toAmount(row.qty)} ${cleanText(row.satuan) || 'pcs'})`);
  return names.length ? `Pembayaran untuk ${names.join(', ')}` : 'Pembayaran';
}

export function documentTitle(jenis) {
  return (INVOICE_TYPES.find((item) => item.value === jenis) || INVOICE_TYPES[0]).title;
}

export function dueLabel(doc) {
  if (!doc?.jatuhTempo) return 'Tidak ditentukan';
  return formatDateId(doc.jatuhTempo);
}

/** Baris tabel ringkas untuk spreadsheet atau teks: [No, Nama, Jumlah, Satuan, Harga, Subtotal]. */
export function invoiceRows(doc) {
  const totals = calcInvoice(doc);
  return totals.items.map((row, index) => [
    index + 1,
    safeSpreadsheetText(row.nama),
    row.qty,
    safeSpreadsheetText(row.satuan),
    row.harga,
    row.subtotal,
  ]);
}

/**
 * Membuat berkas XLSX dokumen (lembar "Dokumen" + "Rincian"). Memakai exceljs yang sudah ada di proyek.
 * @returns {Promise<Blob>}
 */
export async function createInvoiceXlsxBlob(doc) {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const totals = calcInvoice(doc);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nawa Vandrell — dibuat di perangkat pengguna';
  workbook.created = new Date();
  workbook.title = `${documentTitle(doc.jenis)} ${doc.nomor}`;

  const sheet = workbook.addWorksheet('Dokumen');
  sheet.columns = [{ width: 24 }, { width: 46 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 18 }];
  sheet.addRow([documentTitle(doc.jenis)]).font = { bold: true, size: 15 };
  sheet.addRow(['Nomor', safeSpreadsheetText(doc.nomor)]);
  sheet.addRow(['Tanggal', formatDateId(doc.tanggal)]);
  sheet.addRow(['Jatuh tempo', dueLabel(doc)]);
  sheet.addRow([]);
  sheet.addRow(['Penjual', safeSpreadsheetText(doc.penjual.nama)]);
  sheet.addRow(['Alamat penjual', safeSpreadsheetText(doc.penjual.alamat)]);
  sheet.addRow(['Kontak penjual', safeSpreadsheetText(doc.penjual.kontak)]);
  sheet.addRow(['Pembeli', safeSpreadsheetText(doc.pembeli.nama)]);
  sheet.addRow(['Alamat pembeli', safeSpreadsheetText(doc.pembeli.alamat)]);
  sheet.addRow([]);
  const header = sheet.addRow(['No', 'Nama barang / jasa', 'Jumlah', 'Satuan', 'Harga satuan', 'Subtotal']);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  });
  totals.items.forEach((row, index) => {
    sheet.addRow([index + 1, safeSpreadsheetText(row.nama), row.qty, safeSpreadsheetText(row.satuan), row.harga, row.subtotal]);
  });
  sheet.addRow([]);
  sheet.addRow(['', '', '', '', 'Subtotal', totals.subtotal]);
  sheet.addRow(['', '', '', '', `Diskon${totals.diskonTipe === 'persen' ? ` (${doc.diskon.nilai}%)` : ''}`, -totals.diskon]);
  if (totals.pajakAktif) sheet.addRow(['', '', '', '', `PPN ${totals.persenPajak}%`, totals.pajak]);
  const totalRow = sheet.addRow(['', '', '', '', 'Total', totals.total]);
  totalRow.font = { bold: true };
  sheet.addRow([]);
  sheet.addRow(['Terbilang', totals.terbilang]);
  if (doc.jenis === 'kuitansi') sheet.addRow(['Keterangan', receiptPurpose(doc)]);
  if (doc.penjual.rekening) sheet.addRow(['Rekening', safeSpreadsheetText(doc.penjual.rekening)]);
  if (doc.catatan) sheet.addRow(['Catatan', safeSpreadsheetText(doc.catatan)]);
  if (doc.syarat) sheet.addRow(['Syarat', safeSpreadsheetText(doc.syarat)]);
  sheet.getColumn(5).numFmt = '#,##0';
  sheet.getColumn(6).numFmt = '#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
