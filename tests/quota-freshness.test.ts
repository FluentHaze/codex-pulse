import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, quotaIsStale } from '../electron/types';

test('quota freshness uses two configured intervals and requires a successful result', () => {
  const settings = { ...defaults, interval: 3 };
  const updatedAt = 1_000_000;
  assert.equal(quotaIsStale({ settings, updatedAt: null }, updatedAt + 1_000_000), false);
  assert.equal(quotaIsStale({ settings, updatedAt }, updatedAt + 360_000), false);
  assert.equal(quotaIsStale({ settings, updatedAt }, updatedAt + 360_001), true);
  assert.equal(
    quotaIsStale({ settings: { ...settings, interval: 10 }, updatedAt }, updatedAt + 360_001),
    false,
  );
});
