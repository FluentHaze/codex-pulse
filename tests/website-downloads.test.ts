import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDownloadPlatform,
  downloadRules,
  releaseDownloadUrl,
} from '../website/src/scripts/downloads';

test('download platform prefers OS hints and never recommends Mac for Windows or mobile clients', () => {
  assert.equal(detectDownloadPlatform('Windows', 'Mozilla/5.0'), 'windows');
  assert.equal(
    detectDownloadPlatform('Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    'windows',
  );
  assert.equal(detectDownloadPlatform('', 'Mozilla/5.0 (Windows NT 10.0)'), 'windows');
  assert.equal(detectDownloadPlatform('macOS', 'Mozilla/5.0'), 'mac');
  assert.equal(detectDownloadPlatform('MacIntel', 'Mozilla/5.0 (Macintosh)'), 'mac');
  assert.equal(
    detectDownloadPlatform('MacIntel', 'Mozilla/5.0 (iPad; CPU OS like Mac OS X)'),
    'unknown',
  );
  assert.equal(detectDownloadPlatform('Linux', 'Mozilla/5.0 (Linux; Android 15)'), 'unknown');
  assert.equal(
    detectDownloadPlatform('Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64)'),
    'unknown',
  );
});

test('Windows Setup and portable assets remain distinct, including GitHub-normalized file names', () => {
  for (const name of [
    'Codex Pulse-Setup-0.1.27-x64.exe',
    'Codex-Pulse-Setup-0.1.27-x64.exe',
    'Codex.Pulse-Setup-0.1.27-x64.exe',
  ]) {
    assert.equal(downloadRules['win-x64-setup'].test(name), true);
    assert.equal(downloadRules['win-x64-portable'].test(name), false);
  }
  assert.equal(downloadRules['win-x64-setup'].test('Codex-Pulse-0.1.27-win-x64.exe'), false);
  assert.equal(downloadRules['win-x64-portable'].test('Codex-Pulse-0.1.27-win-x64.exe'), true);
  assert.equal(downloadRules['win-x64-setup'].test('Codex-Pulse-Setup-0.1.27-arm64.exe'), false);
  assert.equal(
    downloadRules['win-x64-setup'].test('Codex-Pulse-Setup-0.1.27-x64.exe.blockmap'),
    false,
  );
  assert.equal(downloadRules['mac-arm64-dmg'].test('Codex-Pulse-0.1.27-mac-arm64.dmg'), true);
});

test('malformed or foreign release URLs cannot replace download links', () => {
  const url =
    'https://github.com/FluentHaze/codex-pulse/releases/download/v0.1.27/Codex-Pulse-Setup-0.1.27-x64.exe';
  assert.equal(releaseDownloadUrl(url), url);
  for (const invalid of [
    'invalid',
    null,
    'javascript:alert(1)',
    url.replace('https:', 'http:'),
    url.replace('github.com', 'evil.test'),
    url.replace('/FluentHaze/', '/someone/'),
    url.replace('github.com', 'user:password@github.com'),
  ])
    assert.equal(releaseDownloadUrl(invalid), null);
});
