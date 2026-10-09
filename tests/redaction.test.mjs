import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSensitive, redactText } from '../lib/redaction.mjs';

const SAMPLE = `Nama: Budi Santoso
NIK: 3174010101900001
NPWP 12.345.678.9-012.345 atau 123456789012345
Hubungi 0812-3456-7890 atau +62 813 1111 2222
Email: budi.santoso@contoh.co.id
Tanggal 2026-10-09, tahun 2026, nominal 150000.
Rekening BCA 1234567890`;

test('detects NIK, NPWP, phone, and email in a realistic note', () => {
  const found = detectSensitive(SAMPLE, ['nik', 'npwp', 'telepon', 'email']);
  const byType = Object.fromEntries(['nik', 'npwp', 'telepon', 'email'].map((t) => [t, found.filter((f) => f.type === t).map((f) => f.value)]));
  assert.deepEqual(byType.nik, ['3174010101900001']);
  assert.deepEqual(byType.npwp, ['12.345.678.9-012.345', '123456789012345']);
  assert.deepEqual(byType.telepon, ['0812-3456-7890', '+62 813 1111 2222']);
  assert.deepEqual(byType.email, ['budi.santoso@contoh.co.id']);
});

test('ordinary numbers, years, and dates are not flagged', () => {
  const found = detectSensitive('Tahun 2026, tanggal 2026-10-09, nominal 150000, jam 09.30, harga 12.500', ['nik', 'npwp', 'telepon', 'email', 'rekening']);
  assert.deepEqual(found, []);
});

test('bank account numbers are only flagged when the user asks for them', () => {
  assert.equal(detectSensitive('Rek 1234567890').length, 0);
  assert.equal(detectSensitive('Rek 1234567890', ['rekening']).length, 1);
});

test('overlapping matches are resolved by priority: a NIK is not also reported as an account number', () => {
  const found = detectSensitive('3174010101900001', ['nik', 'rekening']);
  assert.equal(found.length, 1);
  assert.equal(found[0].type, 'nik');
});

test('redaction styles hide the value and keep the last four digits when asked', () => {
  const label = redactText('NIK 3174010101900001 selesai', { style: 'label' });
  assert.equal(label.output, 'NIK [NIK disensor] selesai');
  assert.equal(label.count, 1);
  assert.equal(redactText('NIK 3174010101900001', { style: 'bintang' }).output, 'NIK ****************');
  assert.equal(redactText('NIK 3174010101900001', { style: 'akhir4' }).output, 'NIK ************0001');
  assert.equal(redactText('kirim ke 0812-3456-7890', { style: 'akhir4' }).output, 'kirim ke **********7890');
});

test('redacting the full sample removes every selected kind and keeps the rest of the text', () => {
  const result = redactText(SAMPLE, { types: ['nik', 'npwp', 'telepon', 'email'], style: 'label' });
  assert.doesNotMatch(result.output, /3174010101900001|0812-3456-7890|budi\.santoso@/);
  assert.match(result.output, /Tanggal 2026-10-09, tahun 2026, nominal 150000\./);
  assert.match(result.output, /Rekening BCA 1234567890/, 'rekening tidak dipilih, jadi tetap');
  assert.equal(result.byType.nik, 1);
  assert.equal(result.byType.npwp, 2);
});

test('running the redaction again on the output finds nothing new', () => {
  const first = redactText(SAMPLE, { style: 'label' });
  const second = redactText(first.output, { style: 'label' });
  assert.equal(second.count, 0);
});
