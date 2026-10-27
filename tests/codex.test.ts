import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
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
    if (previous === undefined) delete process.env.PATH;
    else process.env.PATH = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test(
  'macOS detects the ChatGPT bundled CLI without a shell PATH',
  { skip: process.platform !== 'darwin' },
  () => {
    const root = mkdtempSync(join(tmpdir(), 'pulse-chatgpt-'));
    const previousPath = process.env.PATH;
    const previousHome = process.env.HOME;
    try {
      const binary = join(
        root,
        'Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex',
      );
      mkdirSync(dirname(binary), { recursive: true });
      writeFileSync(binary, '#!/bin/sh\n');
      chmodSync(binary, 0o755);
      process.env.PATH = '/usr/bin:/bin';
      process.env.HOME = root;
      // A system-wide installation may take precedence over this user installation.
      assert.ok(
        [
          '/opt/homebrew/bin/codex',
          '/usr/local/bin/codex',
          '/Applications/Codex.app/Contents/Resources/codex',
          '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex',
          binary,
        ].includes(detectCodex()),
      );
      assert.equal(detectCodex(binary), binary);
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      rmSync(root, { recursive: true, force: true });
    }
  },
);
