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
  assert.equal(parsed.aplikasi, 'Nawa Editor');
  assert.equal(parsed.jenis, 'contoh');
  assert.equal(parsed.jumlah, 1);

  const merged = store.importBackup(backup, [{ id: 'a', nama: 'Lama' }, { id: 'z', nama: 'Zara' }]);
  assert.equal(merged.added, 0);
  assert.equal(merged.updated, 1);
  assert.deepEqual(merged.items.map((item) => item.nama), ['Budi', 'Zara']);

  assert.throws(() => store.importBackup('bukan json'), /bukan JSON/);
  assert.throws(() => store.importBackup(JSON.stringify({ aplikasi: 'Lain' })), /bukan cadangan/);
  assert.throws(() => store.importBackup(JSON.stringify({ aplikasi: 'Nawa Editor', jenis: 'lain', versi: 1, items: [] })), /fitur lain/);
  assert.throws(() => store.importBackup(JSON.stringify({ aplikasi: 'Nawa Editor', jenis: 'contoh', versi: 9, items: [] })), /lebih baru/);
});

test('legacy "Nawa Vandrell" backups remain importable after the rebrand', () => {
  const store = collection();
  const legacy = JSON.stringify({
    aplikasi: 'Nawa Vandrell',
    jenis: 'contoh',
    versi: 1,
    items: [{ id: 'lama', nama: 'Lama' }],
  });
  const result = store.importBackup(legacy, [], 'ganti');
  assert.deepEqual(result.items, [{ id: 'lama', nama: 'Lama' }]);
  assert.equal(result.added, 1);
  assert.throws(
    () => store.importBackup(JSON.stringify({ aplikasi: 'Aplikasi Lain', jenis: 'contoh', versi: 1, items: [] })),
    /bukan cadangan/,
  );
});

test('import in replace mode drops invalid items and counts them', () => {
  const store = collection();
  const payload = JSON.stringify({
    aplikasi: 'Nawa Editor',
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

test('clear also removes the feature\'s auxiliary keys but nothing else', () => {
  const storage = memoryStorage();
  const store = createLocalCollection({
    name: 'contoh',
    sanitize,
    storage,
    auxKeys: ['nawa:v1:contoh-notif', 'nawa:v1:contoh-timer'],
  });
  store.save([{ id: 'a', nama: 'x' }]);
  storage.setItem('nawa:v1:contoh-notif', '{"2026-10-09":["a"]}');
  storage.setItem('nawa:v1:contoh-timer', '{"running":true}');
  storage.setItem('nawa:v1:lainnya', 'tetap');
  storage.setItem('catatan-lain', 'tetap');
  store.clear();
  assert.equal(storage.map.has('nawa:v1:contoh'), false);
  assert.equal(storage.map.has('nawa:v1:contoh-notif'), false);
  assert.equal(storage.map.has('nawa:v1:contoh-timer'), false);
  assert.equal(storage.map.get('nawa:v1:lainnya'), 'tetap');
  assert.equal(storage.map.get('catatan-lain'), 'tetap');
});

test('auxiliary keys must live under the app prefix and use safe characters', () => {
  const base = { name: 'contoh', sanitize, storage: memoryStorage() };
  for (const bad of ['contoh-notif', 'nawa:v2:contoh', 'nawa:v1:', 'nawa:v1:../../x', 'nawa:v1:A B', 42]) {
    assert.throws(
      () => createLocalCollection({ ...base, auxKeys: [bad] }),
      (error) => error instanceof LocalDataError && error.code === 'bad-aux-key',
      `kunci ${String(bad)} seharusnya ditolak`,
    );
  }
  assert.throws(() => createLocalCollection({ ...base, auxKeys: 'nawa:v1:contoh-notif' }), LocalDataError);
  assert.doesNotThrow(() => createLocalCollection({ ...base, auxKeys: ['nawa:v1:contoh-notif'] }));
});
