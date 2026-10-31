/** Prepare a verified bundle before quitting; a separate process replaces it after exit. */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const exec = promisify(execFile);
const bundleId = 'com.codexpulse.desktop';
const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export function macInstallTarget(executable: string): string {
  const bundle = dirname(dirname(dirname(executable)));
  if (!bundle.endsWith('.app') || basename(dirname(executable)) !== 'MacOS')
    throw new Error('Invalid application location');
  // A mounted installer or App Translocation is never an installation destination.
  return bundle.startsWith('/Volumes/') || bundle.includes('/AppTranslocation/')
    ? '/Applications/Codex Pulse.app'
    : bundle;
}

async function validateBundle(path: string, version?: string, arch?: string) {
  if (!(await lstat(path)).isDirectory()) throw new Error('Invalid app bundle');
  const plist = join(path, 'Contents', 'Info.plist');
  const field = async (key: string) =>
    (await exec('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist])).stdout.trim();
  if ((await field('CFBundleIdentifier')) !== bundleId) throw new Error('Unexpected app identity');
  if (version && (await field('CFBundleShortVersionString')) !== version)
    throw new Error('Unexpected app version');
  if (arch) {
    const executable = await field('CFBundleExecutable');
    if (!executable || basename(executable) !== executable)
      throw new Error('Invalid app executable');
    // file ships with macOS; lipo is an Xcode/Command Line Tools shim.
    const result = await exec('/usr/bin/file', ['-b', join(path, 'Contents', 'MacOS', executable)]);
    const cpu = arch === 'x64' ? 'x86_64' : 'arm64';
    if (!result.stdout.includes('Mach-O') || !new RegExp(`\\b${cpu}\\b`).test(result.stdout))
      throw new Error('Unexpected app architecture');
  }
  await exec('/usr/bin/codesign', ['--verify', '--deep', '--strict', path]);
}

/** Copy beside the destination, then rename with a rollback guard on the same filesystem. */
export function macReplacementScript(
  payload: string,
  destination: string,
  signals?: string,
): string {
  return `#!/bin/sh
set -eu
payload=${quote(payload)}
destination=${quote(destination)}
parent=${quote(dirname(destination))}
committed=0
stage=
backup=
cleanup() {
  if [ "$committed" -eq 0 ] && [ -n "$backup" ] && [ -d "$backup" ]; then
    # A failed rename must leave the previous app recoverable, even if rollback fails.
    if [ -e "$destination" ]; then /bin/rm -rf "$destination" || return; fi
    /bin/mv "$backup" "$destination" || return
  fi
  if [ -n "$stage" ]; then /bin/rm -rf "$stage"; fi
  ${signals ? `: > ${quote(join(signals, 'replacement-done'))}` : ''}
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
${signals ? `: > ${quote(join(signals, 'replacement-started'))}` : ''}
[ ! -L "$destination" ] || exit 1
if [ -e "$destination" ]; then
  [ -d "$destination" ] || exit 1
  [ "$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$destination/Contents/Info.plist")" = ${quote(bundleId)} ] || exit 1
fi
stage=$(/usr/bin/mktemp -d "$parent/.codex-pulse-update.XXXXXX")
next="$stage/next.app"
backup="$stage/previous.app"
/usr/bin/ditto "$payload" "$next"
/usr/bin/codesign --verify --deep --strict "$next"
[ ! -L "$destination" ] || exit 1
if [ -e "$destination" ]; then /bin/mv "$destination" "$backup"; fi
/bin/mv "$next" "$destination"
${
  signals
    ? `: > ${quote(join(signals, 'installed'))}
count=0
while [ ! -f ${quote(join(signals, 'launch-ok'))} ]; do
  [ ! -f ${quote(join(signals, 'launch-failed'))} ] || exit 1
  count=$((count + 1))
  [ "$count" -le 60 ] || exit 1
  /bin/sleep 1
done`
    : ''
}
committed=1
`;
}

export interface PreparedMacInstall {
  start(parentPid: number): Promise<void>;
  dispose(): Promise<void>;
}

export async function prepareMacInstall(options: {
  dmg: string;
  destination: string;
  version: string;
  arch: string;
  temp: string;
  failureTitle: string;
  failureMessage: string;
}): Promise<PreparedMacInstall> {
  const { destination } = options;
  if (!['arm64', 'x64'].includes(options.arch) || !/^\d+\.\d+\.\d+$/.test(options.version))
    throw new Error('Invalid update metadata');
  if (!resolve(destination).endsWith('.app') || destination !== resolve(destination))
    throw new Error('Invalid installation target');
  // Resolve parents once and reject symlink destinations rather than overwriting their referents.
  if ((await realpath(dirname(destination))) !== dirname(destination))
    throw new Error('Installation parent is a symlink');
  const existing = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  if (existing) await validateBundle(destination);
  const root = await mkdtemp(join(options.temp, 'codex-pulse-install-'));
  await chmod(root, 0o700);
  const mount = join(root, 'volume');
  const payload = join(root, 'payload.app');
  let mounted = false;
  try {
    await mkdir(mount);
    await exec(
      '/usr/bin/hdiutil',
      ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, options.dmg],
      { timeout: 60_000 },
    );
    mounted = true;
    await exec('/usr/bin/ditto', [join(mount, 'Codex Pulse.app'), payload], { timeout: 120_000 });
    await validateBundle(payload, options.version, options.arch);
    await exec('/usr/bin/hdiutil', ['detach', mount], { timeout: 30_000 });
    mounted = false;
    const replace = join(root, 'replace.sh');
    await writeFile(replace, macReplacementScript(payload, destination, root), { mode: 0o600 });
    await writeFile(
      join(root, 'authorize.scpt'),
      'on run argv\n  do shell script (item 1 of argv) with administrator privileges\nend run\n',
      { mode: 0o600 },
    );
    await writeFile(
      join(root, 'error.scpt'),
      'on run argv\n  display alert (item 1 of argv) message (item 2 of argv)\nend run\n',
      { mode: 0o600 },
    );
    let writable = true;
    try {
      await access(dirname(destination), constants.W_OK);
    } catch {
      writable = false;
    }
    return {
      dispose: () => rm(root, { recursive: true, force: true }),
      async start(parentPid) {
        if (!Number.isSafeInteger(parentPid) || parentPid <= 1)
          throw new Error('Invalid parent PID');
        const helper = join(root, 'install.sh');
        const ready = join(root, 'ready');
        await writeFile(
          helper,
          macInstallHelperScript({
            root,
            destination,
            parentPid,
            writable,
            failureTitle: options.failureTitle,
            failureMessage: options.failureMessage,
          }),
          { mode: 0o600 },
        );
        const child = spawn('/bin/sh', [helper], { detached: true, stdio: 'ignore' });
        let failed = false;
        child.on('error', () => {
          failed = true;
        });
        child.on('exit', () => {
          failed = true;
        });
        child.unref();
        for (let attempt = 0; attempt < 50; attempt++) {
          if (failed) throw new Error('Installer helper failed to start');
          try {
            await readFile(ready);
            return;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
          await delay(100);
        }
        child.kill();
        throw new Error('Installer helper did not become ready');
      },
    };
  } catch (error) {
    if (mounted) {
      await exec('/usr/bin/hdiutil', ['detach', mount], { timeout: 30_000 })
        .then(() => {
          mounted = false;
        })
        .catch(() => {});
    }
    // Never recursively clean a volume that could not be unmounted.
    if (!mounted) await rm(root, { recursive: true, force: true });
    throw error;
  }
}

/** The replacement process retains its backup until this ordinary-user helper opens the new app. */
export function macInstallHelperScript(options: {
  root: string;
  destination: string;
  parentPid: number;
  writable: boolean;
  failureTitle: string;
  failureMessage: string;
}): string {
  const { root, destination, parentPid, writable } = options;
  const replace = join(root, 'replace.sh');
  return `#!/bin/sh
set -eu
job=
cleanup() {
  if [ -n "$job" ]; then
    : > ${quote(join(root, 'launch-failed'))}
    count=0
    # An authorized subprocess may outlive osascript; retain recovery files until it finishes.
    while /bin/kill -0 "$job" 2>/dev/null || { [ -f ${quote(join(root, 'replacement-started'))} ] && [ ! -f ${quote(join(root, 'replacement-done'))} ]; }; do
      count=$((count + 1))
      [ "$count" -le 75 ] || return
      /bin/sleep 1
    done
    wait "$job" 2>/dev/null || true
  fi
  /bin/rm -rf ${quote(root)}
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
fail() {
  /usr/bin/open ${quote(destination)} >/dev/null 2>&1 || true
  /usr/bin/osascript ${quote(join(root, 'error.scpt'))} ${quote(options.failureTitle)} ${quote(options.failureMessage)} || true
  exit 1
}
: > ${quote(join(root, 'ready'))}
count=0
while /bin/kill -0 ${parentPid} 2>/dev/null; do
  count=$((count + 1))
  [ "$count" -le 120 ] || fail
  /bin/sleep 1
done
${writable ? `/bin/sh ${quote(replace)}` : `/usr/bin/osascript ${quote(join(root, 'authorize.scpt'))} ${quote(`/bin/sh ${quote(replace)}`)}`} &
job=$!
count=0
while [ ! -f ${quote(join(root, 'installed'))} ]; do
  if ! /bin/kill -0 "$job" 2>/dev/null; then wait "$job" || true; fail; fi
  count=$((count + 1))
  if [ "$count" -gt 180 ]; then /bin/kill "$job" 2>/dev/null || true; wait "$job" || true; fail; fi
  /bin/sleep 1
done
if /usr/bin/open ${quote(destination)}; then
  : > ${quote(join(root, 'launch-ok'))}
else
  : > ${quote(join(root, 'launch-failed'))}
fi
# The replacement process commits or rolls back before cleanup and recovery launch.
wait "$job" || fail
`;
}
