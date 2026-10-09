import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCollectiveCsv,
  buildCollectiveJson,
  createCollectiveDocxBlob,
  createCollectiveExportData,
  createCollectiveXlsxBlob,
} from '../lib/collectiveSimExports.mjs';

const TINY_KTP_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADAQAAAACcj5NrAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QAAd2KE6QAAAAHdElNRQfqCggOAiWHoznFAAAADElEQVQI12P4wACEAAh2AtHUhx4MAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI2LTEwLTA4VDE0OjAyOjM3KzAwOjAwenL6ywAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNi0xMC0wOFQxNDowMjozNyswMDowMAsvQncAAAAASUVORK5CYII=';

function sampleRoster() {
  return [
    {
      name: 'Contoh Peserta',
      nik: '0000000000000000',
      placeOfBirth: 'Bandung',
      birthDate: '01-01-1990',
      gender: 'LAKI-LAKI',
      bloodType: 'O',
      address: 'Jalan Contoh',
      rtRw: '001/002',
      village: 'Sukamaju',
      district: 'Coblong',
      city: 'Bandung',
      province: 'Jawa Barat',
      religion: 'Islam',
      maritalStatus: 'BELUM KAWIN',
      occupation: 'Karyawan',
      citizenship: 'WNI',
      validUntil: 'SEUMUR HIDUP',
      simType: 'SIM C',
      note: 'BIKIN BARU',
      photoData: TINY_KTP_IMAGE,
      photoLayout: { fit: 'contain', zoom: 1.4, positionX: 0, positionY: 1 },
    },
    {
      name: '=HYPERLINK("https://example.invalid")',
      nik: '',
      simType: 'SIM A',
      note: 'PERPANJANGAN',
      photoData: '',
    },
  ];
}

test('collective CSV and JSON contain editable KTP data and photo references safely', () => {
  const data = createCollectiveExportData(sampleRoster());
  const csv = buildCollectiveCsv(data);
  const json = JSON.parse(buildCollectiveJson(data));

  assert.match(data.title, /DATA PEMBUATAN SIM KOLEKTIF - 2 ORANG/);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"'=/, 'CSV formula-like values are prefixed to prevent spreadsheet formula execution');
  assert.match(csv, /"FOTO KTP"/);
  assert.match(csv, /0000000000000000/);
  assert.equal(json.daftarPemohon[0].nik, '0000000000000000');
  assert.equal(json.daftarPemohon[0].fotoKTPDataUrl, TINY_KTP_IMAGE);
  assert.deepEqual(json.daftarPemohon[0].tataLetakFoto, { fit: 'contain', zoom: 1.4, positionX: 0, positionY: 1 });
  assert.equal(json.daftarPemohon[1].fotoKTPDataUrl, null);
  assert.match(json.keterangan, /bukan SIM/i);
});

test('creates an Excel workbook with roster photos, detailed KTP sheet, and summary', async () => {
  const data = createCollectiveExportData(sampleRoster(), { includeNIK: true });
  const blob = await createCollectiveXlsxBlob(data);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await blob.arrayBuffer()));
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Rekap Kolektif', 'Data KTP', 'Ringkasan']);
  assert.equal(workbook.getWorksheet('Rekap Kolektif').getImages().length, 1);
  assert.equal(workbook.getWorksheet('Rekap Kolektif').getCell('C1').value, 'NIK');
  assert.equal(workbook.getWorksheet('Data KTP').getCell('C2').value, '0000000000000000');
  assert.equal(workbook.getWorksheet('Ringkasan').getCell('B2').value, 2);
});

test('creates a DOCX roster with table headings and the KTP image embedded', async () => {
  const data = createCollectiveExportData(sampleRoster());
  const blob = await createCollectiveDocxBlob(data);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK');
  assert.ok(bytes.length > 1000);

  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default || JSZipModule;
  const archive = await JSZip.loadAsync(bytes);
  const documentXml = await archive.file('word/document.xml').async('string');
  const media = Object.keys(archive.files).filter((filename) => /^word\/media\/[^/]+\.(?:png|jpe?g)$/i.test(filename));
  assert.match(documentXml, /FOTO KTP/);
  assert.match(documentXml, /NAMA/);
  assert.equal(media.length, 1);
});
