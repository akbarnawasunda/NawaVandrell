import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutine, dueReminders, nextReminder, progressOn, sanitizeRoutine, streakOf, toggleStep } from '../lib/routines.mjs';

const TODAY = '2026-10-09'; // Jumat

function routineWithSteps(extra = {}) {
  const r = createRoutine('Pagi');
  return sanitizeRoutine({
    ...r,
    langkah: [{ id: 's1', teks: 'Minum air' }, { id: 's2', teks: 'Olahraga 10 menit' }],
    ...extra,
  });
}

test('toggling steps updates progress and is reversible', () => {
  let r = routineWithSteps();
  r = toggleStep(r, TODAY, 's1', TODAY);
  assert.equal(progressOn(r, TODAY).selesai, 1);
  assert.equal(progressOn(r, TODAY).persen, 50);
  r = toggleStep(r, TODAY, 's2', TODAY);
  assert.equal(progressOn(r, TODAY).lengkap, true);
  r = toggleStep(r, TODAY, 's1', TODAY);
  assert.equal(progressOn(r, TODAY).selesai, 1);
});

test('streak counts consecutive complete days and skips days that are not scheduled', () => {
  const weekdays = [1, 2, 3, 4, 5]; // Senin–Jumat
  let r = routineWithSteps({ hari: weekdays });
  // Jumat 9 Okt, Kamis 8 Okt, Rabu 7 Okt lengkap; Selasa 6 Okt terlewat
  for (const date of ['2026-10-09', '2026-10-08', '2026-10-07']) {
    r = toggleStep(r, date, 's1', TODAY);
    r = toggleStep(r, date, 's2', TODAY);
  }
  assert.equal(streakOf(r, TODAY), 3);
  // Sabtu 10 Okt tidak dijadwalkan: hitungan tetap 3 dari Jumat
  assert.equal(streakOf(r, '2026-10-10'), 3);
});

test('today incomplete does not break yesterday’s streak yet', () => {
  let r = routineWithSteps();
  r = toggleStep(r, '2026-10-08', 's1', TODAY);
  r = toggleStep(r, '2026-10-08', 's2', TODAY);
  assert.equal(streakOf(r, TODAY), 1);
});

test('checks for dates older than 120 days are pruned and unknown steps are dropped', () => {
  const r = sanitizeRoutine({
    id: 'x',
    nama: 'Tes',
    langkah: [{ id: 's1', teks: 'A' }],
    checks: { '2020-01-01': ['s1'], [TODAY]: ['s1', 'hilang'] },
  });
  assert.equal(r.checks['2020-01-01'], undefined);
  assert.deepEqual(r.checks[TODAY], ['s1']);
});

test('reminders are computed for the next scheduled day in the future', () => {
  const r = routineWithSteps({ waktu: '07:30', hari: [1, 2, 3, 4, 5] });
  const at = nextReminder(r, new Date(2026, 9, 9, 8, 0)); // Jumat 08.00, sudah lewat
  assert.equal(at.getDay(), 1, 'berikutnya Senin');
  assert.equal(at.getHours(), 7);
  assert.equal(at.getMinutes(), 30);
  assert.equal(nextReminder(sanitizeRoutine({ ...r, waktu: '' })), null);
});

test('due reminders fire once per day inside a two-minute window and not when already complete', () => {
  const r = routineWithSteps({ waktu: '07:30' });
  const now = new Date(2026, 9, 9, 7, 31);
  assert.equal(dueReminders([r], now, {}).length, 1);
  assert.equal(dueReminders([r], now, { [TODAY]: [r.id] }).length, 0, 'sudah diingatkan hari ini');
  assert.equal(dueReminders([r], new Date(2026, 9, 9, 8, 5), {}).length, 0, 'di luar jendela 2 menit');
  const done = toggleStep(toggleStep(r, TODAY, 's1', TODAY), TODAY, 's2', TODAY);
  assert.equal(dueReminders([done], now, {}).length, 0, 'tidak perlu diingatkan bila sudah lengkap');
});
