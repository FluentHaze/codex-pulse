import test from 'node:test';
import assert from 'node:assert/strict';
import type { UpdateState } from '../electron/types';
import { hasUpdateNotice } from '../src/update-notice';

test('network failure without a confirmed update does not raise an update notice', () => {
  assert.equal(hasUpdateNotice(undefined), false);
  for (const status of ['idle', 'checking', 'latest', 'manual', 'error'] as const) {
    assert.equal(hasUpdateNotice({ currentVersion: '0.1.38', status }), false);
  }
});

test('confirmed updates retain attention during download, installation and failure', () => {
  for (const status of ['available', 'downloading', 'downloaded', 'installing', 'error'] as const) {
    const state: UpdateState = { currentVersion: '0.1.38', version: '0.1.39', status };
    assert.equal(hasUpdateNotice(state), true);
  }
  // A retry or successful check must not expose stale version information as a notice.
  for (const status of ['checking', 'latest'] as const) {
    assert.equal(hasUpdateNotice({ currentVersion: '0.1.38', version: '0.1.39', status }), false);
  }
});
