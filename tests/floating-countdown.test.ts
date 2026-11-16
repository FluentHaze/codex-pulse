import test from 'node:test';
import assert from 'node:assert/strict';
import { floatingSize, type QuotaWindow } from '../electron/types';

test('floating rail reserves one countdown row per exhausted window without treating missing usage as zero', () => {
  const quota: QuotaWindow = { usedPercent: 50, windowDurationMins: 300, resetsAt: 1_800_000_000 };
  const exhausted = { ...quota, usedPercent: 100 };
  assert.deepEqual(floatingSize([]), { width: 68, height: 140 });
  assert.deepEqual(floatingSize([quota, quota]), { width: 68, height: 212 });
  assert.deepEqual(floatingSize([exhausted, quota]), { width: 68, height: 228 });
  assert.deepEqual(floatingSize([exhausted, exhausted]), { width: 68, height: 244 });
  assert.deepEqual(floatingSize([{ ...quota, usedPercent: null }]), { width: 68, height: 140 });
  assert.deepEqual(floatingSize([{ ...exhausted, resetsAt: null }]), { width: 68, height: 156 });
});
