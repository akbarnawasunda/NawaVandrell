/**
 * lib/localData.mjs — penyimpanan lokal (localStorage) untuk fitur Nawa Editor.
 *
 * Prinsip local-first:
 *  - Data hanya disimpan di browser pengguna. Tidak ada akun dan tidak ada pengiriman ke server.
 *  - Setiap koleksi punya cadangan JSON (ekspor), impor (dengan validasi), dan hapus.
 *  - Data yang rusak tidak ditimpa diam-diam; pengguna diberi tahu dan bisa mengekspor/menghapusnya.
 *
 * Bentuk tersimpan: { v: versi, updatedAt: ISO, items: [...] }
 * Bentuk cadangan : { aplikasi, jenis, versi, dibuatPada, jumlah, items: [...] }
 */

export const LOCAL_KEY_PREFIX = 'nawa:v1:';
export const APP_NAME = 'Nawa Editor';
// Nama aplikasi sebelum berganti brand; cadangan lama tetap bisa diimpor.
export const LEGACY_APP_NAMES = ['Nawa Vandrell'];

/** Penyimpanan default: localStorage bila tersedia (browser), null di Node tanpa storage. */
function defaultStorage() {
  try {
    if (typeof globalThis.localStorage !== 'undefined') return globalThis.localStorage;
  } catch {
    /* akses localStorage bisa ditolak oleh browser (mode privat tertentu) */
  }
  return null;
}

export class LocalDataError extends Error {
  constructor(message, code = 'local-data') {
    super(message);
    this.name = 'LocalDataError';
    this.code = code;
  }
}

/**
 * Membuat koleksi data lokal.
 * @param {object} options
 * @param {string} options.name        nama unik koleksi (huruf kecil, angka, tanda minus)
 * @param {number} [options.version=1] versi skema penyimpanan
 * @param {(item:any)=>any|null} options.sanitize  mengembalikan item bersih atau null bila tidak valid
 * @param {number} [options.maxItems=500]
 * @param {string[]} [options.auxKeys=[]] kunci tambahan milik fitur yang sama (mis. penanda pengingat),
 *   harus diawali `nawa:v1:`; ikut dihapus saat koleksi dihapus. Bukan bagian dari ekspor.
 * @param {object|null} [options.storage] penyimpanan kustom (untuk tes)
 */
export function createLocalCollection({
  name,
  version = 1,
  sanitize,
  maxItems = 500,
  auxKeys = [],
  storage,
} = {}) {
  if (!/^[a-z0-9-]{2,40}$/.test(String(name || ''))) {
    throw new LocalDataError('Nama koleksi lokal tidak valid.', 'bad-name');
  }
  if (typeof sanitize !== 'function') {
    throw new LocalDataError('Fungsi sanitize wajib diberikan.', 'bad-sanitize');
  }
  if (!Array.isArray(auxKeys) || auxKeys.some((k) => typeof k !== 'string' || !/^nawa:v1:[a-z0-9-]{2,60}$/.test(k))) {
    throw new LocalDataError('Kunci penyimpanan tambahan tidak valid.', 'bad-aux-key');
  }
  const key = `${LOCAL_KEY_PREFIX}${name}`;
  const getStorage = () => storage ?? defaultStorage();

  function sanitizeAll(list) {
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(list) ? list : []) {
      let clean = null;
      try {
        clean = sanitize(raw);
      } catch {
        clean = null;
      }
      if (!clean || typeof clean.id !== 'string' || !clean.id || seen.has(clean.id)) continue;
      seen.add(clean.id);
      out.push(clean);
      if (out.length >= maxItems) break;
    }
    return out;
  }

  /** Membaca koleksi. corrupt=true bila isi tersimpan tidak bisa dibaca. */
  function load() {
    const store = getStorage();
    if (!store) return { items: [], updatedAt: '', available: false, corrupt: false };
    let raw = null;
    try {
      raw = store.getItem(key);
    } catch {
      return { items: [], updatedAt: '', available: false, corrupt: false };
    }
    if (raw == null) return { items: [], updatedAt: '', available: true, corrupt: false };
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
        return { items: [], updatedAt: '', available: true, corrupt: true };
      }
      return {
        items: sanitizeAll(parsed.items),
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
        available: true,
        corrupt: false,
      };
    } catch {
      return { items: [], updatedAt: '', available: true, corrupt: true };
    }
  }

  /** Menyimpan seluruh daftar. Item tidak valid dibuang. Melempar LocalDataError bila penuh. */
  function save(items, now = new Date()) {
    const store = getStorage();
    if (!store) throw new LocalDataError('Penyimpanan lokal tidak tersedia di browser ini.', 'no-storage');
    const clean = sanitizeAll(items);
    const payload = JSON.stringify({ v: version, updatedAt: now.toISOString(), items: clean });
    try {
      store.setItem(key, payload);
    } catch (error) {
      const quota = error && (error.name === 'QuotaExceededError' || error.code === 22);
      throw new LocalDataError(
        quota
          ? 'Penyimpanan browser penuh. Ekspor cadangan lalu hapus data yang tidak dipakai.'
          : 'Data belum tersimpan. Coba lagi atau ekspor cadangan.',
        quota ? 'quota' : 'write',
      );
    }
    return clean;
  }

  /** Menghapus seluruh koleksi beserta kunci tambahannya dari perangkat ini. */
  function clear() {
    const store = getStorage();
    if (!store) return;
    for (const k of [key, ...auxKeys]) {
      try {
        store.removeItem(k);
      } catch {
        /* penyimpanan ditolak: tidak ada yang bisa dihapus */
      }
    }
  }

  /** Membuat teks cadangan JSON dari koleksi saat ini. */
  function exportBackup(items, now = new Date()) {
    const clean = sanitizeAll(items);
    return `${JSON.stringify({
      aplikasi: APP_NAME,
      jenis: name,
      versi: version,
      dibuatPada: now.toISOString(),
      jumlah: clean.length,
      items: clean,
    }, null, 2)}\n`;
  }

  /**
   * Membaca teks cadangan. mode 'gabung' menambah/menimpa item dengan id sama;
   * mode 'ganti' menggantikan seluruh isi koleksi.
   * @returns {{items:any[], added:number, updated:number, skipped:number}}
   */
  function importBackup(text, current = [], mode = 'gabung') {
    let parsed = null;
    try {
      parsed = JSON.parse(String(text || ''));
    } catch {
      throw new LocalDataError('File cadangan bukan JSON yang valid.', 'parse');
    }
    const knownApps = [APP_NAME, ...LEGACY_APP_NAMES];
    if (!parsed || typeof parsed !== 'object' || !knownApps.includes(parsed.aplikasi)) {
      throw new LocalDataError(`File ini bukan cadangan ${APP_NAME}.`, 'app');
    }
    if (parsed.jenis !== name) {
      throw new LocalDataError('Cadangan ini untuk fitur lain. Buka fitur yang sesuai untuk mengimpornya.', 'type');
    }
    if (!Number.isInteger(parsed.versi) || parsed.versi > version) {
      throw new LocalDataError('Versi cadangan lebih baru dari aplikasi ini.', 'version');
    }
    if (!Array.isArray(parsed.items)) {
      throw new LocalDataError('Isi cadangan tidak lengkap.', 'shape');
    }
    const incoming = sanitizeAll(parsed.items);
    const skipped = parsed.items.length - incoming.length;
    if (mode === 'ganti') {
      return { items: incoming, added: incoming.length, updated: 0, skipped };
    }
    const byId = new Map(sanitizeAll(current).map((item) => [item.id, item]));
    let added = 0;
    let updated = 0;
    for (const item of incoming) {
      if (byId.has(item.id)) updated += 1;
      else added += 1;
      byId.set(item.id, item);
    }
    return { items: [...byId.values()].slice(0, maxItems), added, updated, skipped };
  }

  return { key, load, save, clear, exportBackup, importBackup, sanitizeAll };
}

/** Helper ID acak yang aman untuk browser maupun Node. */
export function newId(prefix = 'id') {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return `${prefix}-${random}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
