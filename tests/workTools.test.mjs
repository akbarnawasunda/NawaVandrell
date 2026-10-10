import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStudentAverage, createGradebook, createInventoryItem, createMeeting, createShiftPlan, createTask,
  generateShiftAssignments, inventoryCsv, meetingMinutesText, recordStockMovement, sanitizeGradebook,
  sanitizeInventoryItem, sanitizeMeeting, sanitizeShiftPlan, sanitizeTask, shiftCsv, summarizeGradebook,
  summarizeInventory, summarizeTasks, tasksCsv,
} from '../lib/workTools.mjs';

test('work tasks are sanitized and summarized by deadline and status', () => {
  const base = createTask(new Date('2026-04-10T00:00:00Z'));
  const tasks = [
    sanitizeTask({ ...base, title: ' Arsipkan laporan ', due: '2026-04-09' }),
    sanitizeTask({ ...base, id: 't2', title: 'Rapat', due: '2026-04-10', status: 'doing' }),
    sanitizeTask({ ...base, id: 't3', title: 'Selesai', due: '2026-04-01', status: 'done' }),
  ];
  assert.deepEqual(summarizeTasks(tasks, '2026-04-10'), { total: 3, open: 2, done: 1, overdue: 1, dueToday: 1 });
  assert.match(tasksCsv(tasks), /Arsipkan laporan/);
  assert.equal(sanitizeTask({ ...base, title: 'Tugas', due: '2026-02-30' }).due, '');
});

test('meeting notes keep action owners and due dates in print and CSV data', () => {
  const meeting = sanitizeMeeting({ ...createMeeting(new Date('2026-04-10T00:00:00Z')), id: 'm1', title: 'Evaluasi', actions: [{ id: 'a1', text: 'Kirim laporan', owner: 'Dewi', due: '2026-04-15', done: false }] });
  assert.match(meetingMinutesText(meeting), /Kirim laporan — PIC: Dewi — Tenggat: 2026-04-15/);
  assert.equal(meeting.actions[0].owner, 'Dewi');
  assert.equal(sanitizeMeeting({ ...meeting, start: '25:40' }).start, '');
});

test('shift generator rotates fairly and avoids assigning one person twice per day when possible', () => {
  const names = ['Ani', 'Budi', 'Cici'];
  const roster = generateShiftAssignments(names);
  assert.equal(roster.length, 7);
  assert.deepEqual(new Set(roster[0]).size, 3);
  const counts = Object.fromEntries(names.map((name) => [name, roster.flat().filter((assigned) => assigned === name).length]));
  assert.ok(Math.max(...Object.values(counts)) - Math.min(...Object.values(counts)) <= 1);
  const plan = sanitizeShiftPlan({ ...createShiftPlan(), id: 's1', employees: names, assignments: roster });
  assert.equal(shiftCsv(plan).split('\r\n').length, 9);
});

test('inventory movements cannot produce negative stock and summaries flag reorder items', () => {
  const item = sanitizeInventoryItem({ ...createInventoryItem(), id: 'i1', name: 'Kertas', quantity: 3, minQuantity: 2, unitCost: 1000 });
  assert.equal(recordStockMovement(item, -1, 'Dipakai').quantity, 2);
  assert.throws(() => recordStockMovement(item, -4), /melebihi/);
  assert.deepEqual(summarizeInventory([item]), { items: 1, low: 0, units: 3, value: 3000 });
  assert.match(inventoryCsv([item]), /Kertas/);
});

test('gradebook calculates a normalized weighted average and handles missing scores', () => {
  const book = sanitizeGradebook({ ...createGradebook(), id: 'g1', passingScore: 70, assessments: [{ id: 'a', name: 'UTS', weight: 40 }, { id: 'b', name: 'UAS', weight: 60 }], students: [{ id: 's1', name: 'Nia', scores: { a: 80, b: 90 } }, { id: 's2', name: 'Rudi', scores: { a: null, b: null } }] });
  assert.equal(calculateStudentAverage(book.students[0], book.assessments), 86);
  assert.equal(calculateStudentAverage(book.students[1], book.assessments), null);
  assert.equal(calculateStudentAverage({ scores: { a: 80, b: null } }, book.assessments), null, 'nilai akhir belum lengkap sebelum semua asesmen berbobot diisi');
  assert.deepEqual(summarizeGradebook(book), { students: 2, scored: 1, average: 86, passing: 1, needsSupport: 0 });
});
