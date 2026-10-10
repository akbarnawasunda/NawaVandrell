/**
 * Kontrak Workbench v1 (papan tugas, notulen & tindak lanjut, roster 7 hari,
 * rekap nilai berbobot, inventaris dengan mutasi stok). Setiap angka dihitung manual.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../lib/workTools.mjs';

test('rekap nilai: rata-rata berbobot 30/30/40 untuk nilai 80/90/70 = 79; nilai kosong tidak dihitung', () => {
  const assessments = [
    { id: 'a', name: 'UH', weight: 30 },
    { id: 'b', name: 'UTS', weight: 30 },
    { id: 'c', name: 'UAS', weight: 40 },
  ];
  assert.equal(W.calculateStudentAverage({ scores: { a: 80, b: 90, c: 70 } }, assessments), 79);
  assert.equal(W.calculateStudentAverage({ scores: { a: 80, b: null, c: 70 } }, assessments), null);
  const book = W.sanitizeGradebook({
    id: 'k1', className: 'X', subject: 'IPA', passingScore: 75, assessments,
    students: [
      { id: 's1', name: 'Rina', scores: { a: 80, b: 90, c: 70 } },
      { id: 's2', name: 'Budi', scores: { a: 80, b: null, c: 70 } },
    ],
  });
  const summary = W.summarizeGradebook(book);
  assert.equal(summary.students, 2);
  assert.equal(summary.scored, 1);
  assert.equal(summary.average, 79);
  assert.equal(summary.passing, 1);
});

test('inventaris: mutasi keluar/masuk mengikuti stok, stok negatif ditolak, batas minimum memicu peringatan tepat di batas', () => {
  let item = W.sanitizeInventoryItem({ id: 'i1', name: 'Kertas A4', sku: 'K-1', quantity: 10, minQuantity: 8, unitCost: 50000, movements: [] });
  item = W.recordStockMovement(item, -4, 'keluar ke div A');
  assert.equal(item.quantity, 6);
  assert.throws(() => W.recordStockMovement(item, -7, 'berlebih'), /melebihi/);
  item = W.recordStockMovement(item, 5, 'masuk');
  assert.equal(item.quantity, 11);
  assert.equal(W.summarizeInventory([item]).low, 0);
  item = W.recordStockMovement(item, -3, '');
  assert.equal(item.quantity, 8);
  assert.equal(W.summarizeInventory([item]).low, 1);
  assert.equal(W.summarizeInventory([item]).value, 400000);
  assert.equal(item.movements.length, 3);
});

test('roster 7 hari: 7 hari x 3 shift, tanpa orang ganda dalam satu hari, beban merata untuk 3 orang', () => {
  const plan = W.generateShiftAssignments(['Ani', 'Budi', 'Cici'], W.DEFAULT_SHIFTS, 7);
  assert.equal(plan.length, 7);
  assert.ok(plan.every((day) => day.length === 3));
  assert.ok(plan.every((day) => new Set(day).size === day.length));
  const counts = {};
  plan.flat().forEach((name) => { counts[name] = (counts[name] || 0) + 1; });
  assert.deepEqual(Object.values(counts).sort(), [7, 7, 7]);
});

test('notulen & tindak lanjut: butir tindak lanjut ikut ke teks notulen dan CSV; papan tugas menghitung terlambat', () => {
  const meeting = W.sanitizeMeeting({
    ...W.createMeeting(new Date('2026-10-10')), title: 'Rapat',
    actions: [{ id: 't1', text: 'Siapkan laporan', owner: 'Ani', due: '2026-10-15', done: false }],
  });
  assert.match(W.meetingMinutesText(meeting), /Siapkan laporan/);
  assert.match(W.meetingActionsCsv(meeting), /Siapkan laporan/);
  const base = W.createTask(new Date('2026-10-10'));
  const tasks = [
    W.sanitizeTask({ ...base, title: 'A', due: '2026-10-09', status: 'todo' }),
    W.sanitizeTask({ ...base, id: 'task-2', title: 'B', due: '2026-10-20', status: 'done' }),
  ].filter(Boolean);
  const summary = W.summarizeTasks(tasks, '2026-10-10');
  assert.equal(summary.total, 2);
  assert.equal(summary.open, 1);
  assert.equal(summary.done, 1);
  assert.equal(summary.overdue, 1);
});
