import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimDraftRecord, isSimDraftRecord, SIM_DRAFT_TTL_MS } from '../lib/simDraftStore.mjs';

test('local SIM drafts keep editable fields and expire after seven days', () => {
  const now = 1_800_000_000_000;
  const image = 'data:image/webp;base64,compressed-photo';
  const draft = createSimDraftRecord({
    roster: [{ id: 'person-1', name: 'Nama contoh', nik: '1234567890123456', photoData: image, photoOriginalData: image }],
    defaultSimType: 'SIM A',
    defaultNote: 'PERPANJANGAN',
    ocrMode: 'cepat',
    includeNIK: true,
    largeText: true,
  }, now);

  assert.equal(draft.savedAt, now);
  assert.equal(draft.expiresAt, now + SIM_DRAFT_TTL_MS);
  assert.equal(draft.roster[0].name, 'Nama contoh');
  assert.equal(draft.roster[0].nik, '1234567890123456');
  assert.equal(draft.roster[0].photoOriginalData, '');
  assert.equal(draft.defaultSimType, 'SIM A');
  assert.equal(draft.defaultNote, 'PERPANJANGAN');
  assert.equal(draft.ocrMode, 'cepat');
  assert.equal(draft.includeNIK, true);
  assert.equal(draft.largeText, true);
  assert.equal(isSimDraftRecord(draft, now + SIM_DRAFT_TTL_MS - 1), true);
  assert.equal(isSimDraftRecord(draft, now + SIM_DRAFT_TTL_MS), false);
});

test('draft creation rejects malformed or oversized rosters', () => {
  assert.throws(() => createSimDraftRecord({ roster: 'invalid' }), /tidak valid/i);
  assert.throws(() => createSimDraftRecord({ roster: Array.from({ length: 101 }, () => ({})) }), /tidak valid/i);
  assert.equal(isSimDraftRecord({ version: 99, roster: [], savedAt: 1, expiresAt: 2 }, 1), false);
});
