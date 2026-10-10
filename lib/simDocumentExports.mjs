import { downloadBlob } from './fileDownload.mjs';
import { runDownloadTask } from './downloadTask.mjs';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_MIME = 'text/csv;charset=utf-8';
const JSON_MIME = 'application/json;charset=utf-8';

const DISCLAIMER = 'DRAF PRIBADI — BUKAN SIM, BUKAN BUKTI PENDAFTARAN/PEMBAYARAN, DAN BUKAN FORMULIR RESMI. Lembar ini tidak memberi hak untuk mengemudi. Periksa persyaratan terbaru melalui Satpas atau kanal resmi.';

function valueOrEmpty(value) {
  const text = String(value ?? '').trim();
  return text || 'Belum diisi';
}

function safeFilePart(value) {
  const cleaned = String(value || 'pemohon')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return cleaned || 'pemohon';
}

function allRows(data) {
  return [
    ...data.requestRows.map(([label, value]) => ['Permohonan', label, value]),
    ...data.identityRows.map(([label, value]) => ['Identitas', label, value]),
    ...data.addressRows.map(([label, value]) => ['Alamat KTP', label, value]),
    ...data.contactRows.map(([label, value]) => ['Kontak & catatan', label, value]),
    ...data.checklist.map((item, index) => ['Checklist', `Langkah ${index + 1}`, item]),
  ];
}

export function createSimExportData({ form, simLabel, checklist, dateLabel }) {
  const identityRows = [
    ['Nama lengkap', valueOrEmpty(form.name)],
    ['NIK', valueOrEmpty(form.nik)],
    ['Tempat lahir', valueOrEmpty(form.placeOfBirth)],
    ['Tanggal lahir', valueOrEmpty(form.birthDate)],
    ['Jenis kelamin', valueOrEmpty(form.gender)],
    ['Golongan darah', valueOrEmpty(form.bloodType)],
    ['Agama', valueOrEmpty(form.religion)],
    ['Status perkawinan', valueOrEmpty(form.maritalStatus)],
    ['Pekerjaan', valueOrEmpty(form.occupation)],
    ['Kewarganegaraan', valueOrEmpty(form.citizenship)],
    ['Masa berlaku KTP', valueOrEmpty(form.validUntil)],
  ];
  const addressRows = [
    ['Alamat', valueOrEmpty(form.address)],
    ['RT / RW', valueOrEmpty(form.rtRw)],
    ['Kelurahan / desa', valueOrEmpty(form.village)],
    ['Kecamatan', valueOrEmpty(form.district)],
    ['Kabupaten / kota', valueOrEmpty(form.city)],
    ['Provinsi', valueOrEmpty(form.province)],
  ];
  const requestRows = [
    ['Golongan SIM yang dituju', valueOrEmpty(simLabel)],
    ['Jenis permohonan', valueOrEmpty(form.applicationType)],
    ['Tanggal persiapan', valueOrEmpty(dateLabel)],
    ['Satpas / lokasi tujuan', valueOrEmpty(form.satpas)],
  ];
  const contactRows = [
    ['Nomor kontak', valueOrEmpty(form.phone)],
    ['Email', valueOrEmpty(form.email)],
    ['Catatan pribadi', valueOrEmpty(form.notes)],
  ];

  return {
    title: 'Lembar Persiapan Permohonan SIM',
    filePart: safeFilePart(form.name),
    disclaimer: DISCLAIMER,
    requestRows,
    identityRows,
    addressRows,
    contactRows,
    checklist: Array.isArray(checklist) ? checklist.map((item) => String(item)) : [],
    createdAt: new Date().toISOString(),
  };
}

export function buildSimCsv(data) {
  const rows = [
    ['Bagian', 'Nama data', 'Nilai'],
    ...allRows(data),
    ['Informasi', 'Status dokumen', data.disclaimer],
  ];
  const csvCell = (value) => {
    let text = String(value ?? '');
    // Mencegah aplikasi spreadsheet menafsirkan nilai bebas sebagai formula.
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

export function exportSimCsv(data) {
  const csv = buildSimCsv(data);
  downloadBlob(new Blob([csv], { type: CSV_MIME }), `berkas-persiapan-sim-${data.filePart}.csv`);
}

export function buildSimJson(data) {
  const output = {
    judul: data.title,
    status: 'Draf pribadi — bukan dokumen resmi',
    dibuatPada: data.createdAt,
    permohonan: Object.fromEntries(data.requestRows),
    identitasPemohon: Object.fromEntries(data.identityRows),
    alamatKTP: Object.fromEntries(data.addressRows),
    kontakDanCatatan: Object.fromEntries(data.contactRows),
    checklistPersiapan: data.checklist.map((item) => ({ item, selesai: false })),
    keterangan: data.disclaimer,
  };
  return `${JSON.stringify(output, null, 2)}\n`;
}

export function exportSimJson(data) {
  const json = buildSimJson(data);
  downloadBlob(new Blob([json], { type: JSON_MIME }), `berkas-persiapan-sim-${data.filePart}.json`);
}

export async function createSimXlsxBlob(data) {
  const XLSXModule = await import('@e965/xlsx');
  const XLSX = XLSXModule.default || XLSXModule;
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: data.title,
    Subject: 'Lembar persiapan pribadi permohonan SIM',
    Author: 'Dibuat pengguna',
    Keywords: 'SIM, persiapan, draf pribadi',
  };

  const requestSheet = XLSX.utils.aoa_to_sheet([
    [data.title],
    ['DRAF PRIBADI — BUKAN SIM / FORMULIR RESMI'],
    ['Nama data', 'Nilai'],
    ...data.requestRows,
    ['Kontak dan catatan', ''],
    ...data.contactRows,
    ['Keterangan', data.disclaimer],
  ]);
  requestSheet['!cols'] = [{ wch: 30 }, { wch: 72 }];
  requestSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }];

  const identitySheet = XLSX.utils.aoa_to_sheet([
    ['IDENTITAS PEMOHON — DATA HASIL OCR HARUS DIVERIFIKASI'],
    ['Nama data', 'Nilai'],
    ...data.identityRows,
  ]);
  identitySheet['!cols'] = [{ wch: 28 }, { wch: 64 }];
  identitySheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

  const addressSheet = XLSX.utils.aoa_to_sheet([
    ['ALAMAT SESUAI KTP'],
    ['Nama data', 'Nilai'],
    ...data.addressRows,
  ]);
  addressSheet['!cols'] = [{ wch: 28 }, { wch: 64 }];
  addressSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

  const checklistSheet = XLSX.utils.aoa_to_sheet([
    ['CHECKLIST PERSIAPAN'],
    ['No.', 'Hal yang perlu diperiksa', 'Selesai?'],
    ...data.checklist.map((item, index) => [index + 1, item, '☐']),
    [],
    ['Catatan pribadi', valueOrEmpty(data.contactRows.find(([label]) => label === 'Catatan pribadi')?.[1])],
    ['Keterangan', data.disclaimer],
  ]);
  checklistSheet['!cols'] = [{ wch: 8 }, { wch: 96 }, { wch: 12 }];
  checklistSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

  XLSX.utils.book_append_sheet(workbook, requestSheet, 'Permohonan');
  XLSX.utils.book_append_sheet(workbook, identitySheet, 'Identitas');
  XLSX.utils.book_append_sheet(workbook, addressSheet, 'Alamat KTP');
  XLSX.utils.book_append_sheet(workbook, checklistSheet, 'Checklist');

  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([bytes], { type: XLSX_MIME });
}

export async function exportSimXlsx(data) {
  const fname = `berkas-persiapan-sim-${data.filePart}.xlsx`;
  return runDownloadTask('Menyiapkan berkas persiapan SIM (Excel)…', async () => {
    const blob = await createSimXlsxBlob(data);
    downloadBlob(blob, fname);
  }, fname);
}

export async function createSimDocxBlob(data) {
  const docx = await import('docx');
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = docx;

  const cellMargins = { top: 90, bottom: 90, left: 120, right: 120 };
  const makeRows = (rows) => rows.map(([label, value]) => new TableRow({
    children: [
      new TableCell({
        margins: cellMargins,
        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: '475569', size: 18 })] })],
      }),
      new TableCell({
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: valueOrEmpty(value), size: 18 })] })],
      }),
    ],
  }));
  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  };
  const table = (rows) => new Table({
    width: { size: 50, type: WidthType.PERCENTAGE },
    columnWidths: [3600, 6940],
    borders: tableBorders,
    rows: makeRows(rows),
  });
  const sectionHeading = (text) => new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    keepNext: true,
  });
  const heading = new Paragraph({
    children: [new TextRun({ text: data.title, bold: true, size: 34, color: '172033' })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 80, after: 100 },
  });
  const warning = new Paragraph({
    children: [new TextRun({ text: 'BUKAN SIM · BUKAN IZIN MENGEMUDI · BUKAN FORMULIR RESMI', bold: true, color: '9A3412', size: 18 })],
    shading: { type: ShadingType.CLEAR, fill: 'FFF7ED' },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'D97706', space: 4 } },
    spacing: { before: 100, after: 180 },
  });
  const checklistItems = data.checklist.map((item, index) => new Paragraph({
    children: [
      new TextRun({ text: `☐ ${index + 1}. `, bold: true, color: '334155' }),
      new TextRun({ text: item }),
    ],
    indent: { left: 260 },
    spacing: { after: 90 },
  }));
  const document = new Document({
    creator: 'Nawa Editor',
    title: data.title,
    subject: 'Catatan pribadi persiapan permohonan SIM',
    description: data.disclaimer,
    sections: [{
      properties: { page: { margin: { top: 850, right: 850, bottom: 850, left: 850 } } },
      children: [
        new Paragraph({ children: [new TextRun({ text: 'CATATAN PRIBADI · DOKUMEN PERSIAPAN', bold: true, color: '64748B', size: 16 })], spacing: { after: 60 } }),
        heading,
        new Paragraph({ text: 'Ringkasan data untuk diperiksa sebelum mengurus permohonan melalui layanan resmi.', spacing: { after: 120 } }),
        warning,
        table(data.requestRows),
        sectionHeading('01 · IDENTITAS PEMOHON'),
        table(data.identityRows),
        sectionHeading('02 · ALAMAT SESUAI KTP'),
        table(data.addressRows),
        sectionHeading('03 · KONTAK & CATATAN'),
        table(data.contactRows),
        sectionHeading('04 · CHECKLIST PERSIAPAN'),
        ...checklistItems,
        new Paragraph({
          children: [new TextRun({ text: data.disclaimer, bold: true, color: '7F1D1D', size: 16 })],
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1', space: 5 } },
          spacing: { before: 180, after: 80 },
        }),
        new Paragraph({ children: [new TextRun({ text: `Dibuat: ${new Date(data.createdAt).toLocaleString('id-ID')}`, size: 16, color: '64748B' })] }),
      ],
    }],
  });

  return Packer.toBlob(document);
}

export async function exportSimDocx(data) {
  const fname = `berkas-persiapan-sim-${data.filePart}.docx`;
  return runDownloadTask('Menyiapkan berkas persiapan SIM (Word)…', async () => {
    const blob = await createSimDocxBlob(data);
    downloadBlob(blob, fname);
  }, fname);
}
