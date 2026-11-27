import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assetDownloadUrl,
  detectDownloadPlatform,
  downloadRules,
  findReleaseDownload,
  releaseDownloadUrl,
  releaseVersion,
} from '../website/src/scripts/downloads';
import { bundledDownload } from '../website/src/download-snapshot';

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

test('first render has verified package links for all desktop targets', () => {
  for (const [key, name] of Object.entries({
    'mac-arm64-dmg': 'Codex-Pulse-0.1.41-mac-arm64.dmg',
    'mac-arm64-zip': 'Codex-Pulse-0.1.41-mac-arm64.zip',
    'mac-x64-dmg': 'Codex-Pulse-0.1.41-mac-x64.dmg',
    'mac-x64-zip': 'Codex-Pulse-0.1.41-mac-x64.zip',
    'win-x64-setup': 'Codex-Pulse-Setup-0.1.41-x64.exe',
    'win-x64-portable': 'Codex-Pulse-0.1.41-win-x64.exe',
  }) as [Parameters<typeof bundledDownload>[0], string][]) {
    assert.deepEqual(bundledDownload(key), {
      tag: 'v0.1.41',
      url: 'https://github.com/FluentHaze/codex-pulse/releases/download/v0.1.41/' + name,
    });
  }
});

test('runtime updates cannot relabel assets from another tag or select an unfinished upload', () => {
  const name = 'Codex-Pulse-Setup-0.1.42-x64.exe';
  const url = 'https://github.com/FluentHaze/codex-pulse/releases/download/v0.1.42/' + name;
  assert.equal(assetDownloadUrl('win-x64-setup', 'v0.1.42', name, url), url);
  assert.equal(assetDownloadUrl('win-x64-setup', 'v0.1.41', name, url), null);
  assert.equal(assetDownloadUrl('win-x64-portable', 'v0.1.42', name, url), null);
  assert.equal(assetDownloadUrl('win-x64-setup', 'v0.1.42', name, url + '?x=1'), null);
  assert.equal(releaseVersion('v0.1.42-beta'), null);
  assert.equal(
    findReleaseDownload('win-x64-setup', {
      tag_name: 'v0.1.42',
      draft: false,
      prerelease: false,
      assets: [{ name, browser_download_url: url, state: 'new' }],
    }),
    null,
  );
});

test('an explicit GitHub Latest rollback can replace the bundled version', () => {
  const name = 'Codex-Pulse-Setup-0.1.40-x64.exe';
  const url = 'https://github.com/FluentHaze/codex-pulse/releases/download/v0.1.40/' + name;
  const rollback = {
    tag_name: 'v0.1.40',
    draft: false,
    prerelease: false,
    assets: [{ name, browser_download_url: url, state: 'uploaded' }],
  };
  assert.equal(bundledDownload('win-x64-setup')?.tag, 'v0.1.41');
  assert.deepEqual(findReleaseDownload('win-x64-setup', rollback), { tag: 'v0.1.40', url });
  assert.equal(findReleaseDownload('win-x64-setup', { ...rollback, draft: true }), null);
  assert.equal(findReleaseDownload('win-x64-setup', { ...rollback, prerelease: true }), null);
  assert.equal(findReleaseDownload('mac-x64-dmg', rollback), null);
});
