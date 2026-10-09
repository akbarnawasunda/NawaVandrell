import test from 'node:test';
import assert from 'node:assert/strict';
import { extractKtpFields } from '../lib/ktpOcr.mjs';

test('extracts common KTP fields when values share a line with their labels', () => {
  const result = extractKtpFields(`
    PROVINSI JAWA BARAT
    KABUPATEN BANDUNG
    NIK : 3174010101900001
    NAMA : BUDI SANTOSO
    TEMPAT/TGL LAHIR : BANDUNG, 01-01-1990
    JENIS KELAMIN : LAKI-LAKI GOL. DARAH : O
    ALAMAT : JL. MELATI NO. 12 RT/RW : 001/002
    KEL/DESA : SUKAMAJU
    KECAMATAN : COBLONG
    AGAMA : ISLAM
    STATUS PERKAWINAN : BELUM KAWIN
    PEKERJAAN : KARYAWAN SWASTA
    KEWARGANEGARAAN : WNI
    BERLAKU HINGGA : SEUMUR HIDUP
  `);

  assert.deepEqual(result, {
    nik: '3174010101900001',
    name: 'BUDI SANTOSO',
    placeOfBirth: 'BANDUNG',
    birthDate: '01-01-1990',
    gender: 'LAKI-LAKI',
    bloodType: 'O',
    address: 'JL. MELATI NO. 12',
    rtRw: '001/002',
    village: 'SUKAMAJU',
    district: 'COBLONG',
    city: 'BANDUNG',
    province: 'JAWA BARAT',
    religion: 'ISLAM',
    maritalStatus: 'BELUM KAWIN',
    occupation: 'KARYAWAN SWASTA',
    citizenship: 'WNI',
    validUntil: 'SEUMUR HIDUP',
  });
});

test('reads fields on the line after their labels and tolerates common OCR digit confusion', () => {
  const result = extractKtpFields(`
    NIK
    3174 0101 0190 0001
    NAMA
    SITI AMINAH
    TEMPAT TGL LAHIR
    BANDUNG 12/10/1994
    JENIS KELAMIN : PEREMPUAN
    GOL. DARAH : AB
    RT/RW : 002/003
  `);

  assert.equal(result.nik, '3174010101900001');
  assert.equal(result.name, 'SITI AMINAH');
  assert.equal(result.placeOfBirth, 'BANDUNG');
  assert.equal(result.birthDate, '12-10-1994');
  assert.equal(result.gender, 'PEREMPUAN');
  assert.equal(result.bloodType, 'AB');
  assert.equal(result.rtRw, '002/003');
});

test('finds fields when a scan joins neighboring KTP columns into the same OCR line', () => {
  const result = extractKtpFields(`
    RT/RW : 001/002 KEL/DESA : SUKAMAJU
    KECAMATAN : COBLONG AGAMA : ISLAM
    PEKERJAAN : KARYAWAN SWASTA KEWARGANEGARAAN : WNI
  `);

  assert.equal(result.rtRw, '001/002');
  assert.equal(result.village, 'SUKAMAJU');
  assert.equal(result.district, 'COBLONG');
  assert.equal(result.religion, 'ISLAM');
  assert.equal(result.occupation, 'KARYAWAN SWASTA');
  assert.equal(result.citizenship, 'WNI');
});

test('returns empty strings for a blank or unrelated scan', () => {
  const result = extractKtpFields('Foto buram, tidak ada teks yang bisa dikenali.');
  assert.equal(result.nik, '');
  assert.equal(result.name, '');
  assert.equal(result.occupation, '');
  assert.equal(result.province, '');
});

test('recovers common OCR label errors and Indonesian month-name birth dates', () => {
  const result = extractKtpFields(`
    N1K : 3174 0101 0190 0001
    N4MA LENGKAP : NUR AINI
    TEMPAT/TGL LAHIR : BANDUNG, 3 JANUARI 1992
    JENIS KELAMIN : PEREMPUAN
  `);

  assert.equal(result.nik, '3174010101900001');
  assert.equal(result.name, 'NUR AINI');
  assert.equal(result.placeOfBirth, 'BANDUNG');
  assert.equal(result.birthDate, '03-01-1992');
});

test('ranks and merges multiple OCR passes without dropping fields seen in only one pass', async () => {
  const { mergeKtpCandidates, scoreKtpFields } = await import('../lib/ktpOcr.mjs');
  const merged = mergeKtpCandidates([
    { text: 'NIK: 3174010101900001\nNAMA: BUDI SANTOSO', confidence: 72 },
    { text: 'ALAMAT: JALAN MELATI RT/RW: 001/002\nTEMPAT/TGL LAHIR: BANDUNG 01-01-1990', confidence: 58 },
  ]);

  assert.equal(merged.fields.nik, '3174010101900001');
  assert.equal(merged.fields.name, 'BUDI SANTOSO');
  assert.equal(merged.fields.address, 'JALAN MELATI');
  assert.equal(merged.fields.rtRw, '001/002');
  assert.equal(merged.fieldsFound >= 5, true);
  assert.equal(scoreKtpFields(merged.fields, 72) > 40, true);
});
