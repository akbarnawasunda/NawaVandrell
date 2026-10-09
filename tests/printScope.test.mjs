import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('print rules of the new tools only apply while a Nawa document is printing', () => {
  const css = readFileSync(path.join(root, 'app/nv-tools.css'), 'utf8');
  const printBlock = css.slice(css.indexOf('@media print'));
  assert.ok(printBlock.length > 0);
  const unscoped = printBlock.split('\n').filter((line) => /^\s*(body|\.topbar|\.site-footer|\.toast-host|\.skip-link|\.nv-no-print|\*)/.test(line) && !line.includes('body.nv-printing'));
  assert.deepEqual(unscoped, [], 'aturan cetak global akan ikut menyembunyikan halaman lain (mis. Rekap SIM)');
});

test('document printing goes through the scoped helper', () => {
  const helper = readFileSync(path.join(root, 'lib/printDoc.mjs'), 'utf8');
  assert.match(helper, /classList\.add\('nv-printing'\)/);
  assert.match(helper, /afterprint/);
});

test('Logic Gate always awards two points and never depends on GATE_HINT or isPro', () => {
  const page = readFileSync(path.join(root, 'app/games/logic-gate/page.js'), 'utf8');
  assert.match(page, /const points = 2;/);
  assert.doesNotMatch(page, /GATE_HINT|isPro/);
});
