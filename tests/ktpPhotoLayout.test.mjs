import test from 'node:test';
import assert from 'node:assert/strict';
import { getPhotoPlacement, normalizePhotoLayout } from '../lib/ktpImageProcessing.mjs';

test('keeps the whole KTP visible by default and centers it inside the photo frame', () => {
  const placement = getPhotoPlacement(1000, 620, 400, 250, { fit: 'contain', zoom: 1, positionX: 0.5, positionY: 0.5 });
  assert.equal(placement.width, 400);
  assert.equal(placement.height, 248);
  assert.equal(placement.x, 0);
  assert.equal(placement.y, 1);
});

test('supports cover cropping and lets the user move the visible crop to a corner', () => {
  const centered = getPhotoPlacement(1000, 500, 400, 300, { fit: 'cover', zoom: 1, positionX: 0.5, positionY: 0.5 });
  const topLeft = getPhotoPlacement(1000, 500, 400, 300, { fit: 'cover', zoom: 1, positionX: 0, positionY: 0 });
  assert.equal(centered.width, 600);
  assert.equal(centered.height, 300);
  assert.equal(centered.x, -100);
  assert.equal(centered.y, 0);
  assert.equal(topLeft.x, 0);
});

test('clamps malformed zoom and alignment controls to safe bounds', () => {
  assert.deepEqual(normalizePhotoLayout({ fit: 'unknown', zoom: 9, positionX: -1, positionY: 2 }), {
    fit: 'contain', zoom: 2.5, positionX: 0, positionY: 1,
  });
});
