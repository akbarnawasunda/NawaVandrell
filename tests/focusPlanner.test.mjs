import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudyPlan,
  focusMinutesLastDays,
  focusMinutesOn,
  nextAfter,
  normalizeSettings,
  pause,
  remainingMs,
  resume,
  sanitizeSession,
  startPhase,
} from '../lib/focusPlanner.mjs';

test('timer keeps accurate remaining time across pause and resume', () => {
  const t0 = 1_000_000;
  let state = startPhase({ phase: 'fokus', settings: { fokusMenit: 25 }, now: t0 });
  assert.equal(remainingMs(state, t0), 25 * 60_000);
  assert.equal(remainingMs(state, t0 + 60_000), 24 * 60_000);
  state = pause(state, t0 + 60_000);
  assert.equal(remainingMs(state, t0 + 999_999), 24 * 60_000, 'paused time does not run down');
  state = resume(state, t0 + 500_000);
  assert.equal(remainingMs(state, t0 + 500_000), 24 * 60_000);
  assert.equal(remainingMs(state, t0 + 500_000 + 24 * 60_000), 0);
});

test('every fourth focus block is followed by a long break', () => {
  const settings = normalizeSettings({ siklusPanjangSetelah: 4 });
  let state = { phase: 'fokus', cycle: 0, settings };
  const sequence = [];
  for (let i = 0; i < 8; i += 1) {
    const next = nextAfter(state);
    sequence.push(next.phase);
    state = { ...state, phase: next.phase === 'fokus' ? 'fokus' : 'fokus', cycle: next.cycle };
    if (next.phase !== 'fokus') state = { ...state, phase: 'fokus' };
  }
  assert.deepEqual(sequence.slice(0, 4), ['istirahat', 'istirahat', 'istirahat', 'istirahat-panjang']);
  assert.equal(nextAfter({ phase: 'istirahat', cycle: 2, settings }).phase, 'fokus');
});

test('settings are clamped to safe ranges', () => {
  const s = normalizeSettings({ fokusMenit: 999, istirahatMenit: -4, siklusPanjangSetelah: 0 });
  assert.equal(s.fokusMenit, 180);
  assert.equal(s.istirahatMenit, 1);
  assert.equal(s.siklusPanjangSetelah, 1);
});

test('session log totals by day and over the last week', () => {
  const log = [
    { id: 'a', tanggal: '2026-10-09', menit: 25 },
    { id: 'b', tanggal: '2026-10-09', menit: 50 },
    { id: 'c', tanggal: '2026-10-03', menit: 25 },
    { id: 'd', tanggal: '2026-09-30', menit: 100 },
  ];
  assert.equal(focusMinutesOn(log, '2026-10-09'), 75);
  assert.equal(focusMinutesLastDays(log, '2026-10-09', 7), 100);
  assert.equal(sanitizeSession({ id: 'x', tanggal: '2026-02-31', menit: 25 }), null);
  assert.equal(sanitizeSession({ id: 'x', tanggal: '2026-10-09', menit: 9999 }).menit, 600);
});

test('study plan spreads topics over chosen weekdays and splits long topics across days', () => {
  // 2026-10-05 adalah Senin; belajar Senin, Rabu, Jumat, 60 menit per hari
  const plan = buildStudyPlan({
    topics: [{ nama: 'Aljabar', menit: 150 }, { nama: 'Geometri', menit: 60 }],
    mulai: '2026-10-05',
    hariBelajar: [1, 3, 5],
    menitPerHari: 60,
  });
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.totalMenit, 210);
  assert.deepEqual(plan.rows.map((row) => [row.tanggal, row.topik, row.menit]), [
    ['2026-10-05', 'Aljabar', 60],
    ['2026-10-07', 'Aljabar', 60],
    ['2026-10-09', 'Aljabar', 30],
    ['2026-10-09', 'Geometri', 30],
    ['2026-10-12', 'Geometri', 30],
  ]);
  assert.equal(plan.selesai, '2026-10-12');
  assert.equal(plan.hariDipakai, 4);
});

test('study plan explains missing inputs in Indonesian', () => {
  const plan = buildStudyPlan({ topics: [], mulai: 'besok', hariBelajar: [], menitPerHari: 5 });
  assert.equal(plan.errors.length, 4);
  assert.ok(plan.errors.some((text) => /minimal satu topik/.test(text)));
});
