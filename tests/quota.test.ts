import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remaining, bucketsFrom, severity, quotaWindows, floatingSize } from '../electron/types.js';
test('missing percentages remain unavailable and values clamp to range', () => {
  assert.equal(remaining(null), null);
  assert.equal(remaining({ usedPercent: null, windowDurationMins: null, resetsAt: null }), null);
  assert.equal(remaining({ usedPercent: 120, windowDurationMins: 300, resetsAt: null }), 0);
  assert.equal(remaining({ usedPercent: -10, windowDurationMins: 300, resetsAt: null }), 100);
});
test('multiple buckets take priority, legacy field remains supported', () => {
  assert.deepEqual(
    bucketsFrom({
      rateLimits: { limitId: 'old' },
      rateLimitsByLimitId: { codex: { limitId: 'codex' }, other: { limitId: 'other' } },
    }).map((b) => b.limitId),
    ['codex', 'other'],
  );
  assert.equal(bucketsFrom({ rateLimits: { limitId: 'old' } })[0].limitId, 'old');
  assert.deepEqual(bucketsFrom({}), []);
});
test('thresholds include exact boundaries and select most severe level', () => {
  assert.equal(severity(21), null);
  assert.equal(severity(20), 20);
  assert.equal(severity(10), 10);
  assert.equal(severity(0), 0);
});
test('absent secondary windows are omitted; an existing window with missing data is preserved', () => {
  const primary = { usedPercent: 5, windowDurationMins: 300, resetsAt: null };
  assert.deepEqual(quotaWindows({ limitId: 'codex', primary, secondary: null }), [primary]);
  assert.deepEqual(quotaWindows({ limitId: 'codex', primary: null, secondary: null }), []);
  assert.equal(
    quotaWindows({ limitId: 'codex', primary: { ...primary, usedPercent: null } }).length,
    1,
  );
  assert.equal(
    quotaWindows({
      limitId: 'codex',
      primary,
      secondary: { ...primary, windowDurationMins: 10080 },
    }).length,
    2,
  );
});
test('vertical rail stays narrow and fits all returned quota windows', () => {
  assert.deepEqual(floatingSize(2), { width: 68, height: 212 });
  assert.deepEqual(floatingSize(1), { width: 68, height: 140 });
  assert.deepEqual(floatingSize(0), { width: 68, height: 140 });
});
