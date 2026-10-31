import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, renameSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthChangeDetector } from '../electron/auth-change.js';

test('detects external login, replacement, logout and login after logout once stable', () => {
  const root = mkdtempSync(join(tmpdir(), 'pulse-auth-'));
  const path = join(root, 'auth.json');
  try {
    const detector = new AuthChangeDetector(path);
    assert.equal(detector.changed(), false);
    const changed = () => {
      assert.equal(detector.changed(), false);
      assert.equal(detector.changed(), true);
      assert.equal(detector.changed(), false);
    };
    writeFileSync(path, 'account A');
    changed();
    writeFileSync(join(root, 'next'), 'account B');
    renameSync(join(root, 'next'), path);
    changed();
    writeFileSync(path, 'account C with a different size');
    changed();
    unlinkSync(path);
    changed();
    writeFileSync(path, 'account D');
    changed();
    // An intermediate missing file does not trigger a spurious logout.
    unlinkSync(path);
    assert.equal(detector.changed(), false);
    writeFileSync(path, 'account E');
    changed();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
