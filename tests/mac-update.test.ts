import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MacUpdateDownload, newerMacVersion, selectMacAsset } from '../electron/mac-update';

const bytes = Buffer.from('fixture DMG contents');
const sha512 = createHash('sha512').update(bytes).digest('base64');
const manifest = (arch = 'arm64') => ({ version: '0.1.28', tag: 'v0.1.28', files: [{ url: `Codex-Pulse-0.1.28-mac-${arch}.dmg`, sha512, size: bytes.length }] });
async function temp(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'pulse-mac-update-'));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('Mac updates accept only newer stable versions and the exact architecture, release tag and digest', () => {
  assert.equal(newerMacVersion('0.1.28', '0.1.27'), true);
  for (const version of ['0.1.27', '0.1.26', '0.1.28-beta.1', '../0.1.28', '0.01.28']) assert.equal(newerMacVersion(version, '0.1.27'), false);
  assert.equal(selectMacAsset(manifest(), 'arm64', '0.1.27').url, 'https://github.com/FluentHaze/codex-pulse/releases/download/v0.1.28/Codex-Pulse-0.1.28-mac-arm64.dmg');
  assert.throws(() => selectMacAsset(manifest('x64'), 'arm64', '0.1.27'));
  assert.throws(() => selectMacAsset({ ...manifest(), tag: '../latest' }, 'arm64', '0.1.27'));
  for (const url of ['https://evil.test/Codex-Pulse-0.1.28-mac-arm64.dmg', '../Codex-Pulse-0.1.28-mac-arm64.dmg', 'Codex-Pulse-0.1.28-mac-arm64.zip']) {
    assert.throws(() => selectMacAsset({ ...manifest(), files: [{ url, sha512 }] }, 'arm64', '0.1.27'));
  }
  assert.throws(() => selectMacAsset({ ...manifest(), files: [{ ...manifest().files[0], sha512: 'bad' }] }, 'arm64', '0.1.27'));
});

test('downloads are shared, verified, cached across restarts and rechecked before opening', async () => temp(async root => {
  let calls = 0;
  const progress: number[] = [];
  const fetcher: typeof fetch = async () => { calls++; return new Response(bytes, { headers: { 'content-length': String(bytes.length) } }); };
  const service = new MacUpdateDownload(root, 'arm64', '0.1.27', fetcher, value => progress.push(value));
  const first = service.download(manifest()), second = service.download(manifest());
  assert.equal(first, second);
  assert.deepEqual(await Promise.all([first, second]), ['0.1.28', '0.1.28']);
  assert.equal(calls, 1);
  assert.equal(progress.at(-1), 100);
  assert.deepEqual(await readFile(await service.installerPath()), bytes);
  const restored = new MacUpdateDownload(root, 'arm64', '0.1.27', fetcher, () => {});
  assert.equal(await restored.restore(), '0.1.28');
  await restored.download(manifest()); assert.equal(calls, 1);
  const updated = new MacUpdateDownload(root, 'arm64', '0.1.28', fetcher, () => {});
  assert.equal(await updated.restore(), undefined);
  await writeFile(join(root, 'update.dmg'), 'tampered');
  await assert.rejects(() => restored.installerPath());
  assert.equal(await new MacUpdateDownload(root, 'arm64', '0.1.27', fetcher, () => {}).restore(), undefined);
}));

test('failed and truncated downloads cannot be installed, remove partial files and can retry', async () => temp(async root => {
  let fail = true;
  const fetcher: typeof fetch = async () => new Response(fail ? Buffer.from('wrong') : bytes);
  const service = new MacUpdateDownload(root, 'arm64', '0.1.27', fetcher, () => {});
  await assert.rejects(() => service.download(manifest()));
  await assert.rejects(() => service.installerPath());
  await assert.rejects(() => readFile(join(root, 'download.part')));
  fail = false;
  await service.download(manifest());
  assert.ok(await service.installerPath());
}));

test('same-size corruption fails SHA-512 validation and manifests without a size still verify bytes', async () => temp(async root => {
  let corrupt = true;
  const info = { ...manifest(), files: [{ url: manifest().files[0].url, sha512 }] };
  const service = new MacUpdateDownload(root, 'arm64', '0.1.27', async () => new Response(corrupt ? Buffer.alloc(bytes.length) : bytes), () => {});
  await assert.rejects(() => service.download(info), /integrity/);
  await assert.rejects(() => service.installerPath());
  corrupt = false;
  await service.download(info);
  assert.deepEqual(await readFile(await service.installerPath()), bytes);
}));

test('GitHub asset redirects are allowed, external hosts and insecure redirects are rejected', async () => temp(async root => {
  for (const target of ['http://release-assets.githubusercontent.com/file', 'https://evil.test/file', 'file:///tmp/file']) {
    let calls = 0;
    const service = new MacUpdateDownload(root, 'arm64', '0.1.27', async () => { calls++; return new Response(null, { status: 302, headers: { location: target } }); }, () => {});
    await assert.rejects(() => service.download(manifest())); assert.equal(calls, 1);
  }
  let calls = 0;
  const service = new MacUpdateDownload(root, 'arm64', '0.1.27', async () => ++calls === 1 ? new Response(null, { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/file' } }) : new Response(bytes), () => {});
  await service.download(manifest()); assert.equal(calls, 2);
}));

test('quit cancellation interrupts an in-flight Mac download', async () => temp(async root => {
  const service = new MacUpdateDownload(root, 'arm64', '0.1.27', async (_input, init) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) reject(new Error('aborted'));
      else signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  }, () => {});
  const pending = service.download(manifest()); service.cancel();
  await assert.rejects(pending);
  await assert.rejects(() => service.installerPath());
}));


test('transient transport failures retry, while integrity failures are not retried', async () => temp(async root => {
  let calls = 0;
  const service = new MacUpdateDownload(root, 'arm64', '0.1.27', async () => {
    if (++calls < 3) throw new Error('net::ERR_CONNECTION_CLOSED');
    return new Response(bytes);
  }, () => {});
  assert.equal(await service.download(manifest()), '0.1.28');
  assert.equal(calls, 3);
  let invalidCalls = 0;
  const invalid = new MacUpdateDownload(join(root, 'invalid'), 'arm64', '0.1.27', async () => {
    invalidCalls++; return new Response(Buffer.alloc(bytes.length));
  }, () => {});
  await assert.rejects(invalid.download(manifest()), /integrity/);
  assert.equal(invalidCalls, 1);
}));
