import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectCodex } from '../electron/codex.js';

test('Codex selection rejects directories and missing files, and detects executables from PATH', () => {
  const root = mkdtempSync(join(tmpdir(), 'pulse-codex-'));
  const previous = process.env.PATH;
  try {
    const binary = join(root, process.platform === 'win32' ? 'codex.exe' : 'codex');
    writeFileSync(binary, 'fixture');
    chmodSync(binary, 0o755);
    process.env.PATH = root;
    assert.equal(detectCodex(), binary);
    assert.equal(detectCodex(binary), binary);
    assert.throws(() => detectCodex(root), /不存在或不可执行/);
    assert.throws(() => detectCodex(join(root, 'missing')), /不存在或不可执行/);
    if (process.platform !== 'win32') {
      chmodSync(binary, 0o644);
      assert.throws(() => detectCodex(binary), /不可执行/);
    }
  } finally {
    if (previous === undefined) delete process.env.PATH; else process.env.PATH = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
