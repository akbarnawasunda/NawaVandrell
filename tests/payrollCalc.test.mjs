import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYROLL_RULES,
  bpjsEmployeeShare,
  bpjsEmployerShare,
  calcMonthlyPayroll,
  calcOvertime,
  calcThr,
  pphTahunan,
  ptkpCode,
  ptkpFor,
  thrTaxImpact,
} from '../lib/payrollCalc.mjs';

// Angka contoh di tes ini dihitung manual dari aturan di PAYROLL_RULES (lihat komentar per kasus).

test('PTKP sesuai PMK 101/2016 untuk setiap status dan tanggungan (maks 3)', () => {
  assert.equal(ptkpFor('TK', 0), 54_000_000); // TK/0
  assert.equal(ptkpFor('TK', 1), 58_500_000); // TK/1
  assert.equal(ptkpFor('K', 0), 58_500_000); // K/0
  assert.equal(ptkpFor('K', 1), 63_000_000); // K/1
  assert.equal(ptkpFor('K', 3), 72_000_000); // K/3
  assert.equal(ptkpFor('TK', 5), 67_500_000, 'tanggungan di atas 3 dibatasi');
  assert.equal(ptkpCode('K', 2), 'K/2');
  assert.equal(ptkpCode('TK', 9), 'TK/3');
});

test('PPh Pasal 17 progresif per lapisan dihitung benar di batas-batasnya', () => {
  assert.equal(pphTahunan(0), 0);
  assert.equal(pphTahunan(60_000_000), 3_000_000); // 5%
  assert.equal(pphTahunan(1_200_000), 60_000); // 5%
  assert.equal(pphTahunan(250_000_000), 3_000_000 + 28_500_000); // 60 jt x 5% + 190 jt x 15%
  assert.equal(pphTahunan(291_469_000), 41_867_250); // + 41,469 jt x 25%
  assert.equal(pphTahunan(-5), 0);
});

test('BPJS: JHT 2% dan JP 1% (dengan batas) dipotong pekerja; JKes 1% dengan batas 12 juta', () => {
  assert.deepEqual(bpjsEmployeeShare(5_000_000), { jht: 100_000, jp: 50_000, jkes: 50_000 });
  // JP dibatasi 11.086.300 -> 1% = 110.863; JKes dibatasi 12 juta -> 1% = 120.000
  assert.deepEqual(bpjsEmployeeShare(30_000_000), { jht: 600_000, jp: 110_863, jkes: 120_000 });
  assert.deepEqual(bpjsEmployeeShare(5_000_000, { jht: false, jp: false, jkes: false }), { jht: 0, jp: 0, jkes: 0 });
  assert.equal(PAYROLL_RULES.bpjs.jpBatasUpah, 11_086_300);
});

test('iuran perusahaan: JHT 3,7%, JP 2% (dengan batas), JKes 4%, JKM 0,3%', () => {
  const employer = bpjsEmployerShare(5_000_000);
  assert.equal(employer.jht, 185_000);
  assert.equal(employer.jp, 100_000);
  assert.equal(employer.jkes, 200_000);
  assert.equal(employer.jkm, 15_000);
});

test('contoh 1: gaji 5 juta, TK/0, punya NPWP -> PKP 1,2 juta, PPh 5.000/bulan, take-home 4.795.000', () => {
  const result = calcMonthlyPayroll({ gajiPokok: 5_000_000, status: 'TK', tanggungan: 0, punyaNpwp: true });
  assert.equal(result.tahunan.biayaJabatan, 3_000_000);
  assert.equal(result.tahunan.iuranPengurang, 1_800_000);
  assert.equal(result.tahunan.pkp, 1_200_000);
  assert.equal(result.pphBulan, 5_000);
  assert.equal(result.takeHome, 4_795_000);
});

test('contoh 2: gaji 10 juta, TK/0, NPWP -> biaya jabatan dibatasi 6 juta, PPh 235.000/bulan, take-home 9.365.000', () => {
  const result = calcMonthlyPayroll({ gajiPokok: 10_000_000, status: 'TK', tanggungan: 0, punyaNpwp: true });
  assert.equal(result.tahunan.biayaJabatan, 6_000_000);
  assert.equal(result.tahunan.pkp, 56_400_000);
  assert.equal(result.pphBulan, 235_000);
  assert.equal(result.takeHome, 9_365_000);
});

test('contoh 3: sama dengan contoh 2 tetapi tanpa NPWP -> PPh naik 20% menjadi 282.000/bulan', () => {
  const result = calcMonthlyPayroll({ gajiPokok: 10_000_000, status: 'TK', tanggungan: 0, punyaNpwp: false });
  assert.equal(result.pphBulan, 282_000);
  assert.equal(result.takeHome, 9_318_000);
});

test('contoh 4: gaji 30 juta, TK/0, NPWP -> JP dibatasi, PKP dibulatkan ke ribuan, PPh 3.488.938/bulan', () => {
  const result = calcMonthlyPayroll({ gajiPokok: 30_000_000, status: 'TK', tanggungan: 0, punyaNpwp: true });
  assert.equal(result.iuranKaryawan.jp, 110_863);
  assert.equal(result.tahunan.pkp, 291_469_000);
  assert.equal(result.pphSetahun, 41_867_250);
  assert.equal(result.pphBulan, 3_488_938);
  assert.equal(result.takeHome, 25_680_199);
});

test('contoh 5: tanpa BPJS -> PPh hanya dari bruto, biaya jabatan, dan PTKP', () => {
  const result = calcMonthlyPayroll({ gajiPokok: 5_000_000, status: 'TK', tanggungan: 0, bpjs: { jht: false, jp: false, jkes: false } });
  assert.equal(result.tahunan.pkp, 3_000_000);
  assert.equal(result.pphBulan, 12_500);
  assert.equal(result.takeHome, 4_987_500);
});

test('tunjangan tidak tetap dan lembur masuk bruto dan PPh, tetapi tidak masuk dasar BPJS', () => {
  const base = calcMonthlyPayroll({ gajiPokok: 5_000_000 });
  const withExtras = calcMonthlyPayroll({ gajiPokok: 5_000_000, tunjanganTidakTetap: 1_000_000, lemburPerBulan: 500_000 });
  assert.equal(withExtras.upah, base.upah);
  assert.equal(withExtras.iuranKaryawan.jht, base.iuranKaryawan.jht);
  assert.equal(withExtras.bruto, 6_500_000);
  assert.ok(withExtras.pphBulan > base.pphBulan);
});

test('status K menambah PTKP sehingga PPh lebih kecil', () => {
  const single = calcMonthlyPayroll({ gajiPokok: 10_000_000, status: 'TK', tanggungan: 0 });
  const married = calcMonthlyPayroll({ gajiPokok: 10_000_000, status: 'K', tanggungan: 1 });
  assert.ok(married.pphBulan < single.pphBulan);
  assert.equal(married.ptkpKode, 'K/1');
});

test('THR: masa kerja 12 bulan = 1 bulan upah; kurang dari itu proporsional; di bawah 1 bulan nol', () => {
  assert.deepEqual(calcThr({ masaKerjaBulan: 12, upahSebulan: 5_000_000 }).thr, 5_000_000);
  assert.equal(calcThr({ masaKerjaBulan: 18, upahSebulan: 5_000_000 }).thr, 5_000_000);
  assert.equal(calcThr({ masaKerjaBulan: 6, upahSebulan: 5_000_000 }).thr, 2_500_000);
  assert.equal(calcThr({ masaKerjaBulan: 3, upahSebulan: 4_000_000 }).thr, 1_000_000);
  assert.equal(calcThr({ masaKerjaBulan: 0, upahSebulan: 4_000_000 }).thr, 0);
});

test('dampak PPh 21 THR dihitung sebagai selisih metode tahunan', () => {
  const monthly = calcMonthlyPayroll({ gajiPokok: 10_000_000 });
  const impact = thrTaxImpact({ monthly, thr: 10_000_000 });
  assert.ok(impact > 0);
  assert.equal(thrTaxImpact({ monthly, thr: 0 }), 0);
});

test('lembur hari kerja biasa: jam pertama 1,5x, jam berikutnya 2x, dibagi 173', () => {
  // upah sejam = 5.000.000 / 173 = 28.901,73 (ditampilkan 28.902); total = upah sejam x (1,5 + 2 + 2)
  const hourly = 5_000_000 / 173;
  const result = calcOvertime({ upahSebulan: 5_000_000, jenisHari: 'biasa', jam: 3 });
  assert.equal(result.upahSejam, Math.round(hourly));
  assert.equal(result.total, Math.round(hourly * 5.5));
  assert.deepEqual(result.detail.map((row) => row.pengali), [1.5, 2, 2]);
  assert.equal(result.warnings.length, 0);
});

test('lembur hari istirahat mengikuti tabel pengali PP 35/2021 untuk pekan 5 dan 6 hari', () => {
  const hourly = 5_000_000 / 173;
  // pekan 5 hari, 10 jam: 2x (8 jam) + 3x + 4x = 23 kali upah sejam
  assert.equal(calcOvertime({ upahSebulan: 5_000_000, jenisHari: 'istirahat-5', jam: 10 }).total, Math.round(hourly * 23));
  // pekan 6 hari, 9 jam: 2x (7 jam) + 3x + 4x = 21 kali upah sejam
  assert.equal(calcOvertime({ upahSebulan: 5_000_000, jenisHari: 'istirahat-6', jam: 9 }).total, Math.round(hourly * 21));
  // libur terpendek pekan 6 hari, 9 jam: 2x (5 jam) + 3x + 4x (3 jam) = 25 kali upah sejam
  assert.equal(calcOvertime({ upahSebulan: 5_000_000, jenisHari: 'libur-terpendek-6', jam: 9 }).total, Math.round(hourly * 25));
});

test('lembur di atas batas 4 jam per hari diberi peringatan, dan jam di luar tabel tidak dihitung diam-diam', () => {
  const weekday = calcOvertime({ upahSebulan: 5_000_000, jenisHari: 'biasa', jam: 5 });
  assert.ok(weekday.warnings.some((text) => /4 jam per hari/.test(text)));
  const holiday = calcOvertime({ upahSebulan: 5_000_000, jenisHari: 'istirahat-5', jam: 14 });
  assert.ok(holiday.warnings.some((text) => /2 jam di luar tabel/.test(text)));
});

test('rules are documented with sources and review date', () => {
  assert.equal(PAYROLL_RULES.diperiksaPada, '2026-10-09');
  assert.ok(PAYROLL_RULES.sumber.length >= 6);
  assert.ok(PAYROLL_RULES.sumber.every((item) => item.judul && item.tautan && item.dicek));
});
