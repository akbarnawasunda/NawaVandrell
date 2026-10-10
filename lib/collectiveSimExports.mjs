import { downloadBlob } from './fileDownload.mjs';
import { runDownloadTask } from './downloadTask.mjs';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_MIME = 'text/csv;charset=utf-8';
const JSON_MIME = 'application/json;charset=utf-8';

export const KTP_EXPORT_FIELDS = [
  ['name', 'Nama'],
  ['nik', 'NIK'],
  ['placeOfBirth', 'Tempat lahir'],
  ['birthDate', 'Tanggal lahir'],
  ['gender', 'Jenis kelamin'],
  ['bloodType', 'Golongan darah'],
  ['address', 'Alamat'],
  ['rtRw', 'RT / RW'],
  ['village', 'Kelurahan / desa'],
  ['district', 'Kecamatan'],
  ['city', 'Kabupaten / kota'],
  ['province', 'Provinsi'],
  ['religion', 'Agama'],
  ['maritalStatus', 'Status perkawinan'],
  ['occupation', 'Pekerjaan'],
  ['citizenship', 'Kewarganegaraan'],
  ['validUntil', 'Berlaku hingga'],
];

const DISCLAIMER = 'DRAF REKAP PRIBADI — bukan SIM, bukti pendaftaran/pembayaran, atau formulir resmi. Cocokkan semua data dan persyaratan dengan Satpas atau kanal resmi.';

function clean(value) {
  return String(value ?? '').trim();
}

function masklessPerson(person = {}) {
  return Object.fromEntries([
    ...KTP_EXPORT_FIELDS.map(([key]) => [key, clean(person[key])]),
    ['simType', clean(person.simType)],
    ['note', clean(person.note)],
    ['photoData', clean(person.photoData)],
    ['photoLayout', person.photoLayout ? {
      fit: person.photoLayout.fit === 'cover' ? 'cover' : 'contain',
      zoom: Number.isFinite(Number(person.photoLayout.zoom)) ? Math.max(0.7, Math.min(2.5, Number(person.photoLayout.zoom))) : 1,
      positionX: Number.isFinite(Number(person.photoLayout.positionX)) ? Math.max(0, Math.min(1, Number(person.photoLayout.positionX))) : 0.5,
      positionY: Number.isFinite(Number(person.photoLayout.positionY)) ? Math.max(0, Math.min(1, Number(person.photoLayout.positionY))) : 0.5,
    } : null],
  ]);
}

export function createCollectiveExportData(roster = [], { includeNIK = false } = {}) {
  const people = (Array.isArray(roster) ? roster : []).map(masklessPerson);
  const allNew = people.length > 0 && people.every((person) => /BIKIN\s+BARU|PEMBUATAN\s+BARU/i.test(person.note));
  const action = allNew ? 'SIM BARU' : 'SIM';
  return {
    title: `DATA PEMBUATAN ${action} KOLEKTIF - ${people.length} ORANG`,
    people,
    includeNIK: Boolean(includeNIK),
    disclaimer: DISCLAIMER,
    createdAt: new Date().toISOString(),
    fileBase: `rekap-sim-kolektif-${people.length}-orang`,
  };
}

function csvCell(value) {
  let text = String(value ?? '');
  // Hindari formula injection ketika file CSV dibuka di aplikasi spreadsheet.
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCollectiveCsv(data) {
  const headers = [
    'No',
    'NAMA',
    'NIK',
    'TEMPAT LAHIR',
    'TANGGAL LAHIR',
    'JENIS KELAMIN',
    'GOLONGAN DARAH',
    'ALAMAT',
    'RT / RW',
    'KELURAHAN / DESA',
    'KECAMATAN',
    'KABUPATEN / KOTA',
    'PROVINSI',
    'AGAMA',
    'STATUS PERKAWINAN',
    'PEKERJAAN',
    'KEWARGANEGARAAN',
    'BERLAKU HINGGA',
    'SIM',
    'KETERANGAN',
    'FOTO KTP',
  ];
  const rows = [headers];
  data.people.forEach((person, index) => {
    rows.push([
      index + 1,
      person.name,
      person.nik,
      person.placeOfBirth,
      person.birthDate,
      person.gender,
      person.bloodType,
      person.address,
      person.rtRw,
      person.village,
      person.district,
      person.city,
      person.province,
      person.religion,
      person.maritalStatus,
      person.occupation,
      person.citizenship,
      person.validUntil,
      person.simType,
      person.note,
      person.photoData ? `Foto KTP baris ${index + 1} (tertanam di XLSX/DOCX/PDF)` : '',
    ]);
  });
  rows.push([], ['Keterangan', data.disclaimer]);
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

export function buildCollectiveJson(data) {
  return `${JSON.stringify({
    judul: data.title,
    status: 'Draf rekap pribadi — bukan dokumen resmi',
    dibuatPada: data.createdAt,
    daftarPemohon: data.people.map((person, index) => ({
      nomor: index + 1,
      nama: person.name,
      nik: person.nik,
      tempatLahir: person.placeOfBirth,
      tanggalLahir: person.birthDate,
      jenisKelamin: person.gender,
      golonganDarah: person.bloodType,
      alamat: person.address,
      rtRw: person.rtRw,
      kelurahanDesa: person.village,
      kecamatan: person.district,
      kabupatenKota: person.city,
      provinsi: person.province,
      agama: person.religion,
      statusPerkawinan: person.maritalStatus,
      pekerjaan: person.occupation,
      kewarganegaraan: person.citizenship,
      berlakuHingga: person.validUntil,
      sim: person.simType,
      keterangan: person.note,
      fotoKTPDataUrl: person.photoData || null,
      tataLetakFoto: person.photoLayout || null,
    })),
    keterangan: data.disclaimer,
  }, null, 2)}\n`;
}

export function downloadCollectiveBlob(blob, filename) {
  downloadBlob(blob, filename);
}

export function exportCollectiveCsv(data) {
  downloadCollectiveBlob(new Blob([buildCollectiveCsv(data)], { type: CSV_MIME }), `${data.fileBase}.csv`);
}

export function exportCollectiveJson(data) {
  downloadCollectiveBlob(new Blob([buildCollectiveJson(data)], { type: JSON_MIME }), `${data.fileBase}.json`);
}

export async function createCollectiveXlsxBlob(data) {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nawa Editor — dibuat di perangkat pengguna';
  workbook.subject = 'Rekap SIM kolektif dengan lampiran foto KTP';
  workbook.title = data.title;
  workbook.created = new Date(data.createdAt);
  workbook.modified = new Date(data.createdAt);

  const rosterSheet = workbook.addWorksheet('Rekap Kolektif', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const rosterColumns = [
    { header: 'No', key: 'no', width: 7 },
    { header: 'NAMA', key: 'name', width: 28 },
    ...(data.includeNIK ? [{ header: 'NIK', key: 'nik', width: 20, style: { numFmt: '@' } }] : []),
    { header: 'SIM', key: 'simType', width: 15 },
    { header: 'KETERANGAN', key: 'note', width: 22 },
    { header: 'FOTO KTP', key: 'photo', width: 25 },
  ];
  rosterSheet.columns = rosterColumns;
  rosterSheet.getRow(1).height = 24;
  styleHeader(rosterSheet.getRow(1));

  const photoColumnIndex = rosterColumns.findIndex((column) => column.key === 'photo');
  data.people.forEach((person, index) => {
    const values = {
      no: index + 1,
      name: person.name,
      simType: person.simType,
      note: person.note,
      photo: person.photoData ? '' : 'Tidak dilampirkan',
    };
    if (data.includeNIK) values.nik = person.nik;
    const row = rosterSheet.addRow(values);
    row.height = 62;
    row.alignment = { vertical: 'middle', wrapText: true };
    row.eachCell({ includeEmpty: true }, (cell) => styleBodyCell(cell));

    if (person.photoData) {
      const parsed = parseDataUrl(person.photoData);
      const imageId = workbook.addImage({ base64: parsed.base64, extension: parsed.extension });
      rosterSheet.addImage(imageId, {
        tl: { col: photoColumnIndex, row: index + 1 },
        br: { col: photoColumnIndex + 1, row: index + 2 },
        editAs: 'oneCell',
      });
    }
  });
  if (data.people.length) {
    rosterSheet.autoFilter = { from: 'A1', to: `${columnLetter(rosterColumns.length)}${data.people.length + 1}` };
  }
  rosterSheet.getColumn(1).alignment = { horizontal: 'center', vertical: 'middle' };

  const detailsSheet = workbook.addWorksheet('Data KTP', { views: [{ state: 'frozen', ySplit: 1 }] });
  const detailsColumns = [
    { header: 'No', key: 'no', width: 7 },
    ...KTP_EXPORT_FIELDS.map(([key, label]) => ({
      header: label,
      key,
      width: key === 'address' ? 34 : key === 'nik' ? 20 : 20,
      ...(key === 'nik' ? { style: { numFmt: '@' } } : {}),
    })),
    { header: 'SIM', key: 'simType', width: 16 },
    { header: 'Keterangan', key: 'note', width: 24 },
    { header: 'Foto KTP', key: 'photo', width: 24 },
  ];
  detailsSheet.columns = detailsColumns;
  detailsSheet.getRow(1).height = 24;
  styleHeader(detailsSheet.getRow(1));
  data.people.forEach((person, index) => {
    const rowValues = { no: index + 1, ...person, photo: person.photoData ? `Terlampir pada Rekap Kolektif, baris ${index + 1}` : '' };
    delete rowValues.photoData;
    const row = detailsSheet.addRow(rowValues);
    row.eachCell({ includeEmpty: true }, (cell) => styleBodyCell(cell));
    row.alignment = { vertical: 'top', wrapText: true };
  });
  detailsSheet.getColumn('nik').numFmt = '@';
  detailsSheet.autoFilter = data.people.length
    ? { from: 'A1', to: `${columnLetter(detailsColumns.length)}${data.people.length + 1}` }
    : undefined;

  const summarySheet = workbook.addWorksheet('Ringkasan');
  summarySheet.addRow([data.title]);
  summarySheet.mergeCells('A1:B1');
  summarySheet.getRow(1).font = { bold: true, size: 15, color: { argb: 'FF0F172A' } };
  summarySheet.addRow(['Jumlah pemohon', data.people.length]);
  summarySheet.addRow(['Dibuat pada', data.createdAt]);
  summarySheet.addRow([]);
  summarySheet.addRow(['Golongan SIM', 'Jumlah']);
  styleHeader(summarySheet.getRow(5));
  countBy(data.people, (person) => person.simType || 'Belum diisi').forEach(([label, count]) => summarySheet.addRow([label, count]));
  summarySheet.addRow([]);
  summarySheet.addRow(['Keterangan', data.disclaimer]);
  summarySheet.getColumn(1).width = 28;
  summarySheet.getColumn(2).width = 86;
  summarySheet.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  summarySheet.getRow(summarySheet.rowCount).height = 44;

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME });
}

export async function exportCollectiveXlsx(data) {
  const fname = `${data.fileBase}.xlsx`;
  return runDownloadTask('Menyiapkan rekap SIM kolektif (Excel)…', async () => {
    const blob = await createCollectiveXlsxBlob(data);
    downloadCollectiveBlob(blob, fname);
  }, fname);
}

export async function createCollectiveDocxBlob(data) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    ImageRun,
    Paragraph,
    Packer,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import('docx');

  const contentWidth = 10666;
  const widths = data.includeNIK ? [430, 2050, 1450, 1120, 1510, 4106] : [430, 2450, 1250, 1660, 4876];
  const headers = ['No', 'NAMA', ...(data.includeNIK ? ['NIK'] : []), 'SIM', 'KETERANGAN', 'FOTO KTP'];
  const border = { style: BorderStyle.SINGLE, size: 6, color: '374151' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (children, width, isHeader = false) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    margins: { top: 90, bottom: 90, left: 85, right: 85 },
    verticalAlign: VerticalAlign.CENTER,
    ...(isHeader ? { shading: { type: ShadingType.CLEAR, fill: '1F2937', color: '1F2937' } } : {}),
    children: [new Paragraph({
      alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: Array.isArray(children) ? children : [new TextRun({ text: String(children ?? ''), bold: isHeader, color: isHeader ? 'FFFFFF' : '111827', size: isHeader ? 17 : 16 })],
    })],
  });

  const tableRows = [new TableRow({
    tableHeader: true,
    children: headers.map((header, index) => cell([new TextRun({ text: header, bold: true, color: 'FFFFFF', size: 17 })], widths[index], true)),
  })];
  data.people.forEach((person, index) => {
    const values = [String(index + 1), person.name || '—'];
    if (data.includeNIK) values.push(person.nik || '—');
    values.push(person.simType || '—', person.note || '—');
    const rowCells = values.map((value, columnIndex) => cell(value, widths[columnIndex]));
    const photoIndex = values.length;
    if (person.photoData) {
      const { bytes, extension } = parseDataUrl(person.photoData);
      rowCells.push(cell([new ImageRun({
        data: bytes,
        type: extension === 'png' ? 'png' : 'jpg',
        transformation: { width: 145, height: 90 },
        altText: { title: `Foto KTP baris ${index + 1}`, description: 'Foto KTP yang dilampirkan untuk baris roster ini', name: `foto-ktp-${index + 1}` },
      })], widths[photoIndex]));
    } else {
      rowCells.push(cell('Tidak dilampirkan', widths[photoIndex]));
    }
    tableRows.push(new TableRow({ cantSplit: true, children: rowCells }));
  });

  const document = new Document({
    creator: 'Nawa Editor — dibuat di perangkat pengguna',
    title: data.title,
    subject: 'Rekap SIM kolektif dengan lampiran foto KTP',
    description: data.disclaimer,
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 620, right: 620, bottom: 620, left: 620 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [new TextRun({ text: data.title, bold: true, size: 25, color: '111827' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 220 },
          children: [new TextRun({ text: data.disclaimer, size: 14, color: '4B5563' })],
        }),
        new Table({
          rows: tableRows,
          width: { size: contentWidth, type: WidthType.DXA },
          columnWidths: widths,
          margins: { top: 90, bottom: 90, left: 85, right: 85 },
          borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(document);
  return new Blob([blob], { type: DOCX_MIME });
}

export async function exportCollectiveDocx(data) {
  const fname = `${data.fileBase}.docx`;
  return runDownloadTask('Menyiapkan rekap SIM kolektif (Word)…', async () => {
    const blob = await createCollectiveDocxBlob(data);
    downloadCollectiveBlob(blob, fname);
  }, fname);
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:image\/(jpeg|jpg|png);base64,([\s\S]+)$/i);
  if (!match) throw new Error('Foto KTP harus berupa gambar JPEG atau PNG.');
  const extension = match[1].toLowerCase() === 'png' ? 'png' : 'jpeg';
  const base64 = match[2];
  const bytes = typeof atob === 'function'
    ? Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    : new Uint8Array(Buffer.from(base64, 'base64'));
  return { base64, bytes, extension };
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF111827' } },
      bottom: { style: 'thin', color: { argb: 'FF111827' } },
      left: { style: 'thin', color: { argb: 'FF111827' } },
      right: { style: 'thin', color: { argb: 'FF111827' } },
    };
  });
}

function styleBodyCell(cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };
  cell.alignment = { vertical: 'middle', wrapText: true };
}

function countBy(people, selector) {
  const counts = new Map();
  for (const person of people) {
    const value = selector(person);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right, 'id'));
}

function columnLetter(number) {
  let value = number;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}
