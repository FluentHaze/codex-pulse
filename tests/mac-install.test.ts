import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  macInstallHelperScript,
  macInstallTarget,
  macReplacementScript,
  prepareMacInstall,
} from '../electron/mac-install';

const exec = promisify(execFile);
const mac = { skip: process.platform !== 'darwin' };
async function temp(run: (root: string) => Promise<void>) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "pulse install ' fixture-")));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
async function bundle(path: string, version: string, id = 'com.codexpulse.desktop') {
  await mkdir(join(path, 'Contents', 'MacOS'), { recursive: true });
  await copyFile('/usr/bin/true', join(path, 'Contents', 'MacOS', 'PulseFixture'));
  await writeFile(
    join(path, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${id}</string>
<key>CFBundleExecutable</key><string>PulseFixture</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
</dict></plist>`,
  );
  await exec('/usr/bin/codesign', ['--force', '--sign', '-', path]);
}
const version = async (path: string) =>
  (
    await exec('/usr/bin/plutil', [
      '-extract',
      'CFBundleShortVersionString',
      'raw',
      '-o',
      '-',
      join(path, 'Contents', 'Info.plist'),
    ])
  ).stdout.trim();
async function replace(root: string, payload: string, target: string, fault = false) {
  const script = join(root, 'replace.sh');
  let text = macReplacementScript(payload, target);
  // Inject a filesystem failure exactly at activation to exercise the real rollback trap.
  if (fault) text = text.replace('/bin/mv "$next" "$destination"', '/usr/bin/false');
  await writeFile(script, text);
  await exec('/bin/sh', ['-n', script]);
  return exec('/bin/sh', [script]);
}

test('installation target avoids mounted images and App Translocation', () => {
  assert.equal(
    macInstallTarget('/Applications/Codex Pulse.app/Contents/MacOS/Codex Pulse'),
    '/Applications/Codex Pulse.app',
  );
  assert.equal(
    macInstallTarget('/Users/example/My Apps/Pulse.app/Contents/MacOS/Codex Pulse'),
    '/Users/example/My Apps/Pulse.app',
  );
  for (const path of [
    '/Volumes/Installer/Codex Pulse.app/Contents/MacOS/Codex Pulse',
    '/private/var/folders/x/AppTranslocation/y/d/Codex Pulse.app/Contents/MacOS/Codex Pulse',
  ])
    assert.equal(macInstallTarget(path), '/Applications/Codex Pulse.app');
  assert.throws(() => macInstallTarget('/usr/local/bin/node'));
});

test('real signed fixture replaces atomically and handles spaces and quotes in paths', mac, () =>
  temp(async (root) => {
    const payload = join(root, 'next.app'),
      target = join(root, "Pulse's App.app");
    await bundle(payload, '0.1.35');
    await bundle(target, '0.1.34');
    await replace(root, payload, target);
    assert.equal(await version(target), '0.1.35');
    await exec('/usr/bin/codesign', ['--verify', '--deep', '--strict', target]);
  }),
);

test('activation failure restores the previous app instead of deleting it', mac, () =>
  temp(async (root) => {
    const payload = join(root, 'next.app'),
      target = join(root, 'Pulse.app');
    await bundle(payload, '0.1.35');
    await bundle(target, '0.1.34');
    await assert.rejects(replace(root, payload, target, true));
    assert.equal(await version(target), '0.1.34');
  }),
);

test(
  'invalid bundles, symlink targets and unrelated apps cannot replace the installed app',
  mac,
  () =>
    temp(async (root) => {
      const payload = join(root, 'next.app'),
        target = join(root, 'Pulse.app');
      await bundle(payload, '0.1.35');
      await bundle(target, '0.1.34');
      await writeFile(join(payload, 'Contents', 'Info.plist'), 'tampered');
      await assert.rejects(replace(root, payload, target));
      assert.equal(await version(target), '0.1.34');
      const link = join(root, 'Link.app');
      await symlink(target, link);
      await assert.rejects(replace(root, payload, link));
      await bundle(target, '0.1.34', 'org.example.unrelated');
      await assert.rejects(replace(root, payload, target));
      assert.equal(await version(target), '0.1.34');
    }),
);

test(
  'DMG preparation validates version before quitting and leaves the current app untouched',
  mac,
  () =>
    temp(async (root) => {
      const source = join(root, 'source');
      const target = join(root, 'Pulse.app');
      await bundle(join(source, 'Codex Pulse.app'), '0.1.35');
      await bundle(target, '0.1.34');
      const dmg = join(root, 'fixture.dmg');
      await exec(
        '/usr/bin/hdiutil',
        ['create', '-srcfolder', source, '-format', 'UDZO', '-volname', 'PulseFixture', dmg],
        { timeout: 60_000 },
      );
      const options = {
        dmg,
        destination: target,
        version: '0.1.36',
        arch: 'x64',
        temp: root,
        failureTitle: 'Fixture',
        failureMessage: 'Fixture failed',
      };
      await assert.rejects(prepareMacInstall(options), /version/);
      assert.equal(await version(target), '0.1.34');
      const prepared = await prepareMacInstall({ ...options, version: '0.1.35' });
      assert.equal(await version(target), '0.1.34');
      await prepared.dispose();
      assert.ok(await readFile(dmg));
    }),
);

for (const launchFails of [false, true]) {
  test(
    `helper waits for exit and ${launchFails ? 'rolls back on launch failure' : 'opens the new app'}`,
    mac,
    () =>
      temp(async (root) => {
        const workspace = join(root, 'installer');
        await mkdir(workspace);
        const payload = join(root, 'next.app'),
          target = join(root, 'Pulse.app');
        await bundle(payload, '0.1.35');
        await bundle(target, '0.1.34');
        const fakeOpen = join(root, 'open-fixture');
        await writeFile(
          fakeOpen,
          `#!/bin/sh
version=$(/usr/bin/plutil -extract CFBundleShortVersionString raw -o - "$1/Contents/Info.plist")
echo "$version" >> "$0.calls"
${launchFails ? '[ "$version" != "0.1.35" ]' : 'exit 0'}
`,
        );
        await chmod(fakeOpen, 0o700);
        await writeFile(
          join(workspace, 'replace.sh'),
          macReplacementScript(payload, target, workspace),
        );
        const parent = spawn('/bin/sleep', ['20']);
        try {
          const script = macInstallHelperScript({
            root: workspace,
            destination: target,
            parentPid: parent.pid!,
            writable: true,
            failureTitle: 'Fixture',
            failureMessage: 'Fixture failed',
          })
            .replaceAll('/usr/bin/open', `"${fakeOpen}"`)
            .replaceAll('/usr/bin/osascript', '/usr/bin/true');
          const helper = join(workspace, 'helper.sh');
          await writeFile(helper, script);
          await exec('/bin/sh', ['-n', helper]);
          const completion = exec('/bin/sh', [helper], { timeout: 15_000 }).then(
            () => null,
            (error) => error,
          );
          for (let i = 0; i < 30; i++) {
            try {
              await readFile(join(workspace, 'ready'));
              break;
            } catch {}
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          assert.equal(await version(target), '0.1.34');
          await assert.rejects(readFile(fakeOpen + '.calls'));
          parent.kill();
          const error = await completion;
          assert.equal(Boolean(error), launchFails);
          assert.equal(await version(target), launchFails ? '0.1.34' : '0.1.35');
          assert.equal(
            (await readFile(fakeOpen + '.calls', 'utf8')).trim(),
            launchFails ? '0.1.35\n0.1.34' : '0.1.35',
          );
        } finally {
          parent.kill();
        }
      }),
  );
}

test(
  'interrupted replacement restores the old app and signals completion before cleanup',
  mac,
  () =>
    temp(async (root) => {
      const payload = join(root, 'next.app'),
        target = join(root, 'Pulse.app');
      await bundle(payload, '0.1.35');
      await bundle(target, '0.1.34');
      const script = join(root, 'interrupted.sh');
      await writeFile(script, macReplacementScript(payload, target, root));
      const running = exec('/bin/sh', [script], { timeout: 10_000 });
      const completion = running.then(
        () => null,
        (error) => error,
      );
      for (let i = 0; i < 100; i++) {
        try {
          await readFile(join(root, 'installed'));
          break;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(await version(target), '0.1.35');
      running.child.kill('SIGTERM');
      assert.ok(await completion);
      assert.equal(await version(target), '0.1.34');
      await readFile(join(root, 'replacement-done'));
    }),
);
