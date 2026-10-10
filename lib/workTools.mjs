import { csvLine, isValidIsoDate, safeSpreadsheetText, todayIso } from './format.mjs';
import { newId } from './localData.mjs';

const text = (value, max = 160) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const multiline = (value, max = 8000) => String(value ?? '').replace(/\r/g, '').split('\n').map((line) => line.trimEnd()).join('\n').trim().slice(0, max);
const safeCount = (value, max = 1_000_000) => Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));

export const TASK_STATUS = [
  { value: 'todo', label: 'Belum dikerjakan' },
  { value: 'doing', label: 'Sedang dikerjakan' },
  { value: 'done', label: 'Selesai' },
];
export const TASK_PRIORITY = [
  { value: 'high', label: 'Penting' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Jika sempat' },
];

export function createTask(now = new Date()) {
  return { id: newId('tugas'), title: '', area: 'Umum', priority: 'normal', due: todayIso(now), status: 'todo', notes: '', createdAt: now.toISOString() };
}
export function sanitizeTask(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id || !text(raw.title, 180)) return null;
  return {
    id: raw.id.slice(0, 80), title: text(raw.title, 180), area: text(raw.area, 60) || 'Umum',
    priority: ['high', 'normal', 'low'].includes(raw.priority) ? raw.priority : 'normal',
    due: isValidIsoDate(raw.due) ? raw.due : '', status: ['todo', 'doing', 'done'].includes(raw.status) ? raw.status : 'todo',
    notes: multiline(raw.notes, 1000), createdAt: typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 40) : '',
  };
}
export function summarizeTasks(tasks = [], today = todayIso()) {
  const valid = tasks.filter((item) => item && item.title);
  const open = valid.filter((item) => item.status !== 'done');
  return { total: valid.length, open: open.length, done: valid.length - open.length, overdue: open.filter((item) => item.due && item.due < today).length, dueToday: open.filter((item) => item.due === today).length };
}
export function tasksCsv(tasks = []) {
  const labels = Object.fromEntries(TASK_STATUS.map((item) => [item.value, item.label]));
  const priorities = Object.fromEntries(TASK_PRIORITY.map((item) => [item.value, item.label]));
  return `\uFEFF${[csvLine(['Tugas', 'Area', 'Prioritas', 'Tenggat', 'Status', 'Catatan']), ...tasks.map((item) => csvLine([safeSpreadsheetText(item.title), item.area, priorities[item.priority] || item.priority, item.due, labels[item.status] || item.status, safeSpreadsheetText(item.notes)]))].join('\r\n')}\r\n`;
}

export function createMeeting(now = new Date()) {
  return { id: newId('rapat'), title: '', date: todayIso(now), start: '', location: '', chair: '', attendees: '', agenda: '', notes: '', actions: [], createdAt: now.toISOString() };
}
export function sanitizeMeeting(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const actions = (Array.isArray(raw.actions) ? raw.actions : []).slice(0, 100).map((item) => ({
    id: typeof item?.id === 'string' && item.id ? item.id.slice(0, 80) : newId('aksi'),
    text: text(item?.text, 240), owner: text(item?.owner, 100), due: isValidIsoDate(item?.due) ? item.due : '', done: item?.done === true,
  })).filter((item) => item.text);
  return { id: raw.id.slice(0, 80), title: text(raw.title, 180), date: isValidIsoDate(raw.date) ? raw.date : '', start: /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.start) ? raw.start : '', location: text(raw.location, 140), chair: text(raw.chair, 100), attendees: text(raw.attendees, 1200), agenda: multiline(raw.agenda, 4000), notes: multiline(raw.notes, 8000), actions, createdAt: typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 40) : '' };
}
export function meetingMinutesText(meeting) {
  const lines = [meeting.title || 'Notulen rapat', `Tanggal: ${meeting.date || '-'}${meeting.start ? ` · ${meeting.start}` : ''}`, `Tempat: ${meeting.location || '-'}`, `Pimpinan: ${meeting.chair || '-'}`, `Peserta: ${meeting.attendees || '-'}`, '', 'AGENDA', meeting.agenda || '-', '', 'CATATAN RAPAT', meeting.notes || '-', '', 'TINDAK LANJUT', ...(meeting.actions || []).map((item, index) => `${index + 1}. [${item.done ? 'x' : ' '}] ${item.text}${item.owner ? ` — PIC: ${item.owner}` : ''}${item.due ? ` — Tenggat: ${item.due}` : ''}`)];
  return lines.join('\n');
}
export function meetingActionsCsv(meeting) {
  return `\uFEFF${[csvLine(['Rapat', 'Tanggal rapat', 'Tindak lanjut', 'Penanggung jawab', 'Tenggat', 'Status']), ...(meeting.actions || []).map((item) => csvLine([safeSpreadsheetText(meeting.title), meeting.date, safeSpreadsheetText(item.text), item.owner, item.due, item.done ? 'Selesai' : 'Belum selesai']))].join('\r\n')}\r\n`;
}

export const DEFAULT_SHIFTS = [
  { id: 'pagi', label: 'Pagi', time: '07.00–15.00' },
  { id: 'sore', label: 'Sore', time: '15.00–23.00' },
  { id: 'malam', label: 'Malam', time: '23.00–07.00' },
];
export function addIsoDays(iso, amount) {
  if (!isValidIsoDate(iso)) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
export function generateShiftAssignments(employees, shifts = DEFAULT_SHIFTS, days = 7) {
  const staff = [...new Set((employees || []).map((name) => text(name, 80)).filter(Boolean))];
  const slots = Math.min(5, Math.max(1, (shifts || []).length));
  if (!staff.length) return Array.from({ length: days }, () => Array(slots).fill(''));
  let cursor = 0;
  return Array.from({ length: days }, () => {
    const used = new Set();
    return Array.from({ length: slots }, () => {
      let chosen = -1;
      for (let offset = 0; offset < staff.length; offset += 1) {
        const index = (cursor + offset) % staff.length;
        if (!used.has(staff[index])) { chosen = index; break; }
      }
      if (chosen < 0) chosen = cursor % staff.length;
      cursor = (chosen + 1) % staff.length;
      used.add(staff[chosen]);
      return staff[chosen];
    });
  });
}
export function createShiftPlan(now = new Date()) {
  return { id: newId('shift'), name: 'Jadwal tim', weekStart: todayIso(now), employees: [], shifts: DEFAULT_SHIFTS.map((shift) => ({ ...shift })), assignments: Array.from({ length: 7 }, () => DEFAULT_SHIFTS.map(() => '')), createdAt: now.toISOString() };
}
export function sanitizeShiftPlan(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const cleanedShifts = (Array.isArray(raw.shifts) ? raw.shifts : DEFAULT_SHIFTS).slice(0, 5).map((item, index) => ({ id: text(item?.id, 40) || `shift-${index + 1}`, label: text(item?.label, 40) || `Shift ${index + 1}`, time: text(item?.time, 32) }));
  const shifts = cleanedShifts.length ? cleanedShifts : DEFAULT_SHIFTS.map((shift) => ({ ...shift }));
  const employees = [...new Set((Array.isArray(raw.employees) ? raw.employees : []).slice(0, 100).map((name) => text(name, 80)).filter(Boolean))];
  const assignments = Array.from({ length: 7 }, (_, day) => Array.from({ length: shifts.length }, (_, shift) => {
    const name = text(raw.assignments?.[day]?.[shift], 80);
    return employees.includes(name) ? name : '';
  }));
  return { id: raw.id.slice(0, 80), name: text(raw.name, 100) || 'Jadwal tim', weekStart: isValidIsoDate(raw.weekStart) ? raw.weekStart : todayIso(), employees, shifts, assignments, createdAt: typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 40) : '' };
}
export function shiftCsv(plan) {
  const rows = [csvLine(['Tanggal', ...plan.shifts.map((shift) => `${shift.label} (${shift.time})`)]), ...plan.assignments.map((names, day) => csvLine([addIsoDays(plan.weekStart, day), ...names]))];
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

export function createInventoryItem() {
  return { id: newId('barang'), sku: '', name: '', category: 'Umum', unit: 'pcs', quantity: 0, minQuantity: 0, unitCost: 0, movements: [] };
}
export function sanitizeInventoryItem(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id || !text(raw.name, 140)) return null;
  const movements = (Array.isArray(raw.movements) ? raw.movements : []).slice(-100).map((item) => ({ id: typeof item?.id === 'string' ? item.id.slice(0, 80) : newId('mutasi'), date: isValidIsoDate(item?.date) ? item.date : todayIso(), delta: Math.max(-1000000, Math.min(1000000, Math.trunc(Number(item?.delta) || 0))), note: text(item?.note, 160) })).filter((item) => item.delta !== 0);
  return { id: raw.id.slice(0, 80), sku: text(raw.sku, 50), name: text(raw.name, 140), category: text(raw.category, 60) || 'Umum', unit: text(raw.unit, 20) || 'pcs', quantity: safeCount(raw.quantity), minQuantity: safeCount(raw.minQuantity), unitCost: safeCount(raw.unitCost, 1_000_000_000), movements };
}
export function recordStockMovement(item, delta, note = '', date = todayIso()) {
  const amount = Math.trunc(Number(delta) || 0);
  if (!amount) throw new Error('Masukkan jumlah stok yang lebih dari nol.');
  if (item.quantity + amount < 0) throw new Error('Stok keluar melebihi jumlah yang tersedia.');
  if (item.quantity + amount > 1_000_000) throw new Error('Batas stok 1.000.000 unit per barang.');
  const movement = { id: newId('mutasi'), date: isValidIsoDate(date) ? date : todayIso(), delta: amount, note: text(note, 160) };
  return sanitizeInventoryItem({ ...item, quantity: item.quantity + amount, movements: [...item.movements, movement] });
}
export function summarizeInventory(items = []) {
  const valid = items.filter((item) => item.name);
  return { items: valid.length, low: valid.filter((item) => item.minQuantity > 0 && item.quantity <= item.minQuantity).length, units: valid.reduce((sum, item) => sum + item.quantity, 0), value: valid.reduce((sum, item) => sum + item.quantity * item.unitCost, 0) };
}
export function inventoryCsv(items = []) {
  const rows = [csvLine(['Kode', 'Nama barang', 'Kategori', 'Jumlah', 'Satuan', 'Batas minimum', 'Harga satuan', 'Nilai stok']), ...items.map((item) => csvLine([item.sku, safeSpreadsheetText(item.name), item.category, item.quantity, item.unit, item.minQuantity, item.unitCost, item.quantity * item.unitCost]))];
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

export function createGradebook(now = new Date()) {
  return { id: newId('kelas'), className: '', subject: '', passingScore: 75, assessments: [{ id: newId('asesmen'), name: 'Tugas 1', weight: 100 }], students: [], createdAt: now.toISOString() };
}
export function sanitizeGradebook(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const assessments = (Array.isArray(raw.assessments) ? raw.assessments : []).slice(0, 20).map((item, index) => ({ id: typeof item?.id === 'string' && item.id ? item.id.slice(0, 80) : newId('asesmen'), name: text(item?.name, 80) || `Penilaian ${index + 1}`, weight: Math.min(100, safeCount(item?.weight, 100)) }));
  const students = (Array.isArray(raw.students) ? raw.students : []).slice(0, 500).map((item) => {
    const scores = {};
    for (const assessment of assessments) { const value = item?.scores?.[assessment.id]; scores[assessment.id] = value === '' || value == null || !Number.isFinite(Number(value)) ? null : Math.max(0, Math.min(100, Number(value))); }
    return { id: typeof item?.id === 'string' && item.id ? item.id.slice(0, 80) : newId('murid'), name: text(item?.name, 120), scores };
  }).filter((item) => item.name);
  return { id: raw.id.slice(0, 80), className: text(raw.className, 80), subject: text(raw.subject, 80), passingScore: Math.min(100, safeCount(raw.passingScore ?? 75, 100)), assessments, students, createdAt: typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 40) : '' };
}
export function calculateStudentAverage(student, assessments) {
  const weighted = assessments.filter((assessment) => Number(assessment.weight) > 0);
  if (!weighted.length || weighted.some((assessment) => student.scores?.[assessment.id] == null || !Number.isFinite(Number(student.scores[assessment.id])))) return null;
  const weight = weighted.reduce((sum, assessment) => sum + Number(assessment.weight), 0);
  return weighted.reduce((sum, assessment) => sum + Number(student.scores[assessment.id]) * Number(assessment.weight), 0) / weight;
}
export function summarizeGradebook(book) {
  const averages = book.students.map((student) => calculateStudentAverage(student, book.assessments)).filter((value) => value != null);
  const passing = averages.filter((value) => value >= book.passingScore).length;
  return { students: book.students.length, scored: averages.length, average: averages.length ? averages.reduce((sum, value) => sum + value, 0) / averages.length : null, passing, needsSupport: averages.length - passing };
}
export function gradebookCsv(book) {
  const rows = [csvLine(['Nama', ...book.assessments.map((item) => `${item.name} (${item.weight}%)`), 'Nilai akhir', 'Keterangan']), ...book.students.map((student) => { const average = calculateStudentAverage(student, book.assessments); return csvLine([safeSpreadsheetText(student.name), ...book.assessments.map((item) => student.scores[item.id] ?? ''), average == null ? '' : average.toFixed(2), average == null ? 'Belum lengkap' : average >= book.passingScore ? 'Tuntas' : 'Perlu tindak lanjut']); })];
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}
