import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSimCsv,
  buildSimJson,
  createSimDocxBlob,
  createSimExportData,
  createSimXlsxBlob,
} from '../lib/simDocumentExports.mjs';

function sampleExportData() {
  return createSimExportData({
    form: {
      name: 'Budi Contoh',
      nik: '3174010101900001',
      placeOfBirth: 'Bandung',
      birthDate: '01-01-1990',
      gender: 'LAKI-LAKI',
      address: 'Jl. Melati, No. 12',
      rtRw: '001/002',
      city: 'Bandung',
      province: 'Jawa Barat',
      simType: 'SIM C',
      applicationType: 'Pembuatan baru',
      applicationDate: '2026-10-08',
      satpas: 'Bandung',
      notes: '=HYPERLINK("https://example.invalid")',
    },
    simLabel: 'SIM C — Sepeda motor',
    dateLabel: '8 Oktober 2026',
    checklist: ['Cocokkan data dengan KTP asli.', 'Konfirmasi syarat ke Satpas.'],
  });
}

test('builds CSV and JSON exports with all sections and neutralizes spreadsheet formulas', () => {
  const data = sampleExportData();
  const csv = buildSimCsv(data);
  const json = JSON.parse(buildSimJson(data));

  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /'=/);
  assert.match(csv, /Budi Contoh/);
  assert.match(csv, /Checklist/);
  assert.equal(json.identitasPemohon.NIK, '3174010101900001');
  assert.equal(json.permohonan['Golongan SIM yang dituju'], 'SIM C — Sepeda motor');
  assert.equal(json.checklistPersiapan.length, 2);
  assert.match(json.keterangan, /BUKAN SIM/);
});

test('creates a multi-sheet Excel workbook in XLSX format', async () => {
  const blob = await createSimXlsxBlob(sampleExportData());
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  const XLSXModule = await import('@e965/xlsx');
  const XLSX = XLSXModule.default || XLSXModule;
  const workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
  assert.deepEqual(workbook.SheetNames, ['Permohonan', 'Identitas', 'Alamat KTP', 'Checklist']);
  const identityRows = XLSX.utils.sheet_to_json(workbook.Sheets.Identitas, { header: 1 });
  assert.ok(identityRows.some((row) => row[0] === 'NIK' && row[1] === '3174010101900001'));
});

test('creates a DOCX document blob with the correct MIME type and ZIP signature', async () => {
  const blob = await createSimDocxBlob(sampleExportData());
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK');
  assert.ok(bytes.length > 1000);
});
