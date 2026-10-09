export const SIM_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DATABASE_NAME = 'nawa-vandrell-local-drafts';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drafts';
const DRAFT_KEY = 'sim-collective-current';
const MAX_DRAFT_PEOPLE = 100;

export function createSimDraftRecord(payload, now = Date.now()) {
  if (!payload || !Array.isArray(payload.roster) || payload.roster.length > MAX_DRAFT_PEOPLE) {
    throw new TypeError('Draft SIM tidak valid.');
  }
  const roster = payload.roster.map((person) => {
    if (!person || typeof person !== 'object') throw new TypeError('Baris draft tidak valid.');
    const copy = { ...person };
    // Both fields are initially the same compressed image; store it once when possible.
    if (copy.photoData && copy.photoOriginalData === copy.photoData) copy.photoOriginalData = '';
    return copy;
  });
  return {
    version: 1,
    savedAt: now,
    expiresAt: now + SIM_DRAFT_TTL_MS,
    roster,
    defaultSimType: String(payload.defaultSimType || 'SIM C').slice(0, 40),
    defaultNote: String(payload.defaultNote || '').slice(0, 120),
    ocrMode: payload.ocrMode === 'cepat' ? 'cepat' : 'cermat',
    includeNIK: Boolean(payload.includeNIK),
    largeText: Boolean(payload.largeText),
  };
}

export function isSimDraftRecord(value, now = Date.now()) {
  return Boolean(
    value
    && value.version === 1
    && Array.isArray(value.roster)
    && value.roster.length <= MAX_DRAFT_PEOPLE
    && Number.isFinite(value.savedAt)
    && Number.isFinite(value.expiresAt)
    && value.expiresAt > now
    && value.expiresAt - value.savedAt <= SIM_DRAFT_TTL_MS
  );
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Penyimpanan lokal tidak tersedia di browser ini.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Penyimpanan lokal gagal dibuka.'));
    request.onblocked = () => reject(new Error('Tutup tab Nawa Editor lain untuk membuka penyimpanan lokal.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Penyimpanan lokal gagal dibaca.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('Perubahan draf dibatalkan.'));
    transaction.onerror = () => reject(transaction.error || new Error('Penyimpanan lokal gagal ditulis.'));
  });
}

export async function loadSimDraft(now = Date.now()) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(DRAFT_KEY));
    if (record == null) return null;
    if (!isSimDraftRecord(record, now)) {
      await deleteSimDraft();
      return null;
    }
    return record;
  } finally {
    database.close();
  }
}

export async function saveSimDraft(payload, now = Date.now()) {
  const record = createSimDraftRecord(payload, now);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record, DRAFT_KEY);
    await transactionDone(transaction);
    return record;
  } finally {
    database.close();
  }
}

export async function deleteSimDraft() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(DRAFT_KEY);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
