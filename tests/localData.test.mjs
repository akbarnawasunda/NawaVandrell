import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalCollection, LocalDataError } from '../lib/localData.mjs';

function memoryStorage({ quotaOnWrite = false } = {}) {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      if (quotaOnWrite) {
        const error = new Error('full');
        error.name = 'QuotaExceededError';
        throw error;
      }
      map.set(key, String(value));
    },
    removeItem: (key) => map.delete(key),
  };
}

const sanitize = (raw) => {
  if (!raw || typeof raw.id !== 'string' || typeof raw.nama !== 'string') return null;
  return { id: raw.id, nama: raw.nama.trim().slice(0, 40) };
};

function collection(storage = memoryStorage()) {
  return createLocalCollection({ name: 'contoh', version: 1, sanitize, storage });
}

test('local collection rejects unsafe names and missing sanitizers', () => {
  assert.throws(() => createLocalCollection({ name: 'Bad Name', sanitize }), LocalDataError);
  assert.throws(() => createLocalCollection({ name: 'contoh' }), LocalDataError);
});

test('save and load round-trip keeps only valid, unique items', () => {
  const storage = memoryStorage();
  const store = collection(storage);
  const saved = store.save([
    { id: 'a', nama: '  Budi  ' },
    { id: 'a', nama: 'duplikat' },
    { id: '', nama: 'tanpa id' },
    null,
    { id: 'b', nama: 'Siti' },
  ], new Date('2026-10-09T01:00:00Z'));

  assert.deepEqual(saved, [{ id: 'a', nama: 'Budi' }, { id: 'b', nama: 'Siti' }]);
  const loaded = store.load();
  assert.equal(loaded.corrupt, false);
  assert.equal(loaded.updatedAt, '2026-10-09T01:00:00.000Z');
  assert.deepEqual(loaded.items.map((item) => item.id), ['a', 'b']);
});

test('corrupt stored data is reported instead of silently overwritten', () => {
  const storage = memoryStorage();
  storage.setItem('nawa:v1:contoh', '{rusak');
  const loaded = collection(storage).load();
  assert.equal(loaded.corrupt, true);
  assert.deepEqual(loaded.items, []);
  assert.equal(storage.getItem('nawa:v1:contoh'), '{rusak', 'load must not modify the corrupt payload');
});

test('quota errors become friendly Indonesian messages', () => {
  const store = collection(memoryStorage({ quotaOnWrite: true }));
  assert.throws(
    () => store.save([{ id: 'a', nama: 'x' }]),
    (error) => error instanceof LocalDataError && error.code === 'quota' && /penuh/.test(error.message),
  );
});

test('backup export and import validate app, type, and version', () => {
  const store = collection();
  const backup = store.exportBackup([{ id: 'a', nama: 'Budi' }], new Date('2026-10-09T00:00:00Z'));
  const parsed = JSON.parse(backup);
  assert.equal(parsed.aplikasi, 'Nawa Vandrell');
  assert.equal(parsed.jenis, 'contoh');
  assert.equal(parsed.jumlah, 1);

  const merged = store.importBackup(backup, [{ id: 'a', nama: 'Lama' }, { id: 'z', nama: 'Zara' }]);
  assert.equal(merged.added, 0);
  assert.equal(merged.updated, 1);
  assert.deepEqual(merged.items.map((item) => item.nama), ['Budi', 'Zara']);

  assert.throws(() => store.importBackup('bukan json'), /bukan JSON/);
  assert.throws(() => store.importBackup(JSON.stringify({ aplikasi: 'Lain' })), /bukan cadangan/);
  assert.throws(() => store.importBackup(JSON.stringify({ aplikasi: 'Nawa Vandrell', jenis: 'lain', versi: 1, items: [] })), /fitur lain/);
  assert.throws(() => store.importBackup(JSON.stringify({ aplikasi: 'Nawa Vandrell', jenis: 'contoh', versi: 9, items: [] })), /lebih baru/);
});

test('import in replace mode drops invalid items and counts them', () => {
  const store = collection();
  const payload = JSON.stringify({
    aplikasi: 'Nawa Vandrell',
    jenis: 'contoh',
    versi: 1,
    items: [{ id: 'x', nama: 'Baru' }, { id: '', nama: 'rusak' }],
  });
  const result = store.importBackup(payload, [{ id: 'lama', nama: 'Hilang' }], 'ganti');
  assert.deepEqual(result.items, [{ id: 'x', nama: 'Baru' }]);
  assert.equal(result.skipped, 1);
});

test('clear removes the stored collection', () => {
  const storage = memoryStorage();
  const store = collection(storage);
  store.save([{ id: 'a', nama: 'x' }]);
  store.clear();
  assert.equal(store.load().items.length, 0);
  assert.equal(storage.map.size, 0);
});
