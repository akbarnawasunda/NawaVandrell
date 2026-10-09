import test from 'node:test';
import assert from 'node:assert/strict';
import { calcLoan, calcSavingsGoal, monthsToGoal } from '../lib/loanSavings.mjs';

test('anuitas: angsuran tetap mengikuti rumus P·r / (1 − (1+r)^−n)', () => {
  const result = calcLoan({ principal: 10_000_000, annualRatePct: 12, months: 12, method: 'anuitas' });
  const r = 0.01;
  const expected = (10_000_000 * r) / (1 - 1.01 ** -12);
  assert.equal(result.valid, true);
  assert.ok(Math.abs(result.monthly - expected) < 1e-6);
  assert.ok(Math.abs(result.totalBunga - (expected * 12 - 10_000_000)) < 1e-4);
  assert.equal(result.schedule.length, 12);
  assert.ok(Math.abs(result.schedule.at(-1).sisa) < 1e-4, 'sisa pokok harus nol di bulan terakhir');
});

test('anuitas dengan bunga 0% membagi pokok rata', () => {
  const result = calcLoan({ principal: 6_000_000, annualRatePct: 0, months: 12 });
  assert.equal(result.monthly, 500_000);
  assert.equal(result.totalBunga, 0);
});

test('flat: bunga total = pokok × bunga tahunan × tahun, dan angsuran = (pokok + bunga) ÷ bulan', () => {
  const result = calcLoan({ principal: 10_000_000, annualRatePct: 12, months: 12, method: 'flat' });
  assert.equal(result.totalBunga, 1_200_000);
  assert.ok(Math.abs(result.monthly - 11_200_000 / 12) < 1e-6);
  assert.equal(result.schedule[0].bunga, 100_000);
});

test('flat terlihat lebih murah tetapi bunga efektif lebih tinggi dari angka flat', () => {
  const flat = calcLoan({ principal: 10_000_000, annualRatePct: 12, months: 12, method: 'flat', schedule: false });
  const anuitas = calcLoan({ principal: 10_000_000, annualRatePct: 12, months: 12, method: 'anuitas', schedule: false });
  assert.ok(flat.effectiveAnnualPct > 12, 'bunga efektif flat harus di atas angka flat');
  assert.ok(Math.abs(anuitas.effectiveAnnualPct - 12) < 1e-9);
});

test('invalid loan inputs return Indonesian errors and no numbers', () => {
  const result = calcLoan({ principal: 0, months: 0 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((text) => /lebih dari nol/.test(text)));
  assert.ok(result.errors.some((text) => /minimal 1 bulan/.test(text)));
  assert.equal(calcLoan({ principal: 1_000_000, months: 400 }).valid, false);
});

test('savings goal: setoran tanpa bunga dan dengan bunga sesuai rumus anuitas tabungan', () => {
  const flat = calcSavingsGoal({ target: 12_000_000, saved: 0, months: 12, annualRatePct: 0 });
  assert.equal(flat.monthlyNeeded, 1_000_000);
  assert.equal(flat.bungaEstimasi, 0);

  const withInterest = calcSavingsGoal({ target: 12_000_000, saved: 2_000_000, months: 12, annualRatePct: 6 });
  const r = 0.005;
  const expected = (10_000_000 * r) / ((1 + r) ** 12 - 1);
  assert.ok(Math.abs(withInterest.monthlyNeeded - expected) < 1e-6);
  assert.ok(withInterest.bungaEstimasi > 0);
});

test('savings goal is already reached when saved amount covers the target', () => {
  const done = calcSavingsGoal({ target: 1_000_000, saved: 1_500_000, months: 6 });
  assert.equal(done.remaining, 0);
  assert.equal(done.monthlyNeeded, 0);
});

test('months needed to reach the goal rounds up and handles zero saving', () => {
  assert.equal(monthsToGoal({ target: 12_000_000, saved: 0, monthlySaving: 1_000_000 }), 12);
  assert.equal(monthsToGoal({ target: 12_000_000, saved: 0, monthlySaving: 1_100_000 }), 11);
  assert.equal(monthsToGoal({ target: 12_000_000, saved: 0, monthlySaving: 0 }), null);
  assert.equal(monthsToGoal({ target: 1000, saved: 1000, monthlySaving: 0 }), 0);
  // 24 juta dengan setoran 1 juta: tanpa bunga 24 bulan; dengan bunga 6% per tahun sekitar 23 bulan
  assert.equal(monthsToGoal({ target: 24_000_000, saved: 0, monthlySaving: 1_000_000 }), 24);
  const withRate = monthsToGoal({ target: 24_000_000, saved: 0, monthlySaving: 1_000_000, annualRatePct: 6 });
  assert.equal(withRate, 23, 'bunga mempercepat target');
});
