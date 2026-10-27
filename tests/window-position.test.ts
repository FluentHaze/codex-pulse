import { sidePanelBounds } from '../electron/window-position.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureAnchor, anchoredBounds } from '../electron/window-position.js';

test('bottom-right gaps survive repeated compact/standard mode changes', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 };
  const compact = { x: 1644, y: 976, width: 252, height: 40 };
  const anchor = captureAnchor(compact, area);
  for (let index = 0; index < 100; index++) {
    assert.deepEqual(anchoredBounds(anchor, { width: 320, height: 270 }, area), {
      x: 1576,
      y: 746,
      width: 320,
      height: 270,
    });
    assert.deepEqual(anchoredBounds(anchor, compact, area), compact);
  }
});
test('top-left placement and negative monitor coordinates retain their edge offsets', () => {
  const area = { x: -1920, y: 40, width: 1920, height: 1040 };
  const topLeft = { x: -1896, y: 64, width: 252, height: 40 };
  assert.deepEqual(
    anchoredBounds(captureAnchor(topLeft, area), { width: 320, height: 270 }, area),
    { x: -1896, y: 64, width: 320, height: 270 },
  );
  const bottomRight = { x: -272, y: 1010, width: 252, height: 40 };
  assert.deepEqual(
    anchoredBounds(captureAnchor(bottomRight, area), { width: 320, height: 270 }, area),
    { x: -340, y: 780, width: 320, height: 270 },
  );
});
test('clamping a large mode does not replace the original anchor or cause drift on restoration', () => {
  const area = { x: 0, y: 0, width: 400, height: 300 };
  const compact = { x: 150, y: 120, width: 100, height: 40 };
  const anchor = captureAnchor(compact, area);
  assert.deepEqual(anchoredBounds(anchor, { width: 380, height: 280 }, area), {
    x: 20,
    y: 20,
    width: 380,
    height: 280,
  });
  assert.deepEqual(anchoredBounds(anchor, compact, area), compact);
});

test('hover panels choose the free side without moving the rail and remain inside the work area', () => {
  const area = { x: -1920, y: 0, width: 1920, height: 1080 };
  const leftRail = { x: -1920, y: 10, width: 68, height: 212 };
  const rightRail = { x: -68, y: 900, width: 68, height: 140 };
  assert.deepEqual(sidePanelBounds(leftRail, area), { x: -1842, y: 0, width: 320, height: 310 });
  assert.deepEqual(sidePanelBounds(rightRail, area), { x: -398, y: 770, width: 320, height: 310 });
  assert.equal(leftRail.x, -1920);
});
