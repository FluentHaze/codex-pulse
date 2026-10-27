/**
 * Mac 更新安装包的选择、下载、校验与恢复。
 * 只有版本、架构、可信跳转地址、大小和 SHA-512 全部通过后才允许打开 DMG。
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const releaseBase = 'https://github.com/FluentHaze/codex-pulse/releases/download/';
const maxSize = 2 * 1024 ** 3;
interface MacAsset {
  version: string;
  url: string;
  sha512: string;
  size?: number;
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const versionParts = (version: unknown) =>
  typeof version === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
    ? version.split('.').map(Number)
    : null;
export function newerMacVersion(candidate: unknown, current: string): boolean {
  const next = versionParts(candidate),
    previous = versionParts(current);
  if (!next || !previous || [...next, ...previous].some((part) => !Number.isSafeInteger(part)))
    return false;
  for (let i = 0; i < 3; i++) if (next[i] !== previous[i]) return next[i] > previous[i];
  return false;
}

/** Use only this project's stable release, exact version and architecture, and a SHA-512 manifest entry. */
export function selectMacAsset(info: unknown, arch: string, current: string): MacAsset {
  const value = object(info);
  if (!['arm64', 'x64'].includes(arch) || !newerMacVersion(value.version, current))
    throw new Error('Invalid update version');
  const version = value.version as string;
  const tag = value.tag;
  if (tag !== version && tag !== `v${version}`) throw new Error('Invalid release tag');
  const files = Array.isArray(value.files) ? value.files : [];
  const asset = files.map(object).find((file) => {
    try {
      return (
        typeof file.url === 'string' &&
        decodeURIComponent(file.url).replace(/ /g, '-') === `Codex-Pulse-${version}-mac-${arch}.dmg`
      );
    } catch {
      return false;
    }
  });
  if (
    !asset ||
    typeof asset.sha512 !== 'string' ||
    !/^[A-Za-z0-9+/]{86}==$/.test(asset.sha512) ||
    Buffer.from(asset.sha512, 'base64').length !== 64
  )
    throw new Error('Missing verified DMG');
  if (
    asset.size !== undefined &&
    (typeof asset.size !== 'number' ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0 ||
      asset.size > maxSize)
  )
    throw new Error('Invalid update size');
  return {
    version,
    sha512: asset.sha512,
    size: asset.size as number | undefined,
    url: `${releaseBase}${encodeURIComponent(tag as string)}/Codex-Pulse-${version}-mac-${arch}.dmg`,
  };
}

function trustedDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.href.startsWith(releaseBase) ||
        [
          'release-assets.githubusercontent.com',
          'objects.githubusercontent.com',
          'github-releases.githubusercontent.com',
        ].includes(url.hostname))
    );
  } catch {
    return false;
  }
}

export class MacUpdateDownload {
  private active: Promise<string> | undefined;
  private controller = new AbortController();
  private asset: MacAsset | undefined;
  constructor(
    private root: string,
    private arch: string,
    private current: string,
    private fetcher: typeof fetch,
    private progress: (percent: number) => void,
  ) {}
  cancel() {
    this.controller.abort();
  }
  private get path() {
    return join(this.root, 'update.dmg');
  }
  private async verified(path: string, asset: MacAsset): Promise<boolean> {
    try {
      const stat = await lstat(path);
      if (
        !stat.isFile() ||
        stat.size <= 0 ||
        stat.size > maxSize ||
        (asset.size !== undefined && stat.size !== asset.size)
      )
        return false;
      const hash = createHash('sha512');
      for await (const chunk of createReadStream(path, { signal: this.controller.signal }))
        hash.update(chunk);
      return hash.digest('base64') === asset.sha512;
    } catch {
      return false;
    }
  }
  async restore(): Promise<string | undefined> {
    try {
      const value = object(JSON.parse(await readFile(join(this.root, 'ready.json'), 'utf8')));
      const asset = selectMacAsset(value, this.arch, this.current);
      if (!(await this.verified(this.path, asset))) return undefined;
      this.asset = asset;
      return asset.version;
    } catch {
      return undefined;
    }
  }
  download(info: unknown): Promise<string> {
    if (this.active) return this.active;
    this.active = this.downloadWithRetry(info).finally(() => {
      this.active = undefined;
    });
    return this.active;
  }
  private async downloadWithRetry(info: unknown): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.performDownload(info);
      } catch (error) {
        // Restart only transient transport failures; never retry invalid manifests or hashes.
        const transient =
          error instanceof Error &&
          /net::ERR_(CONNECTION_CLOSED|CONNECTION_RESET|CONNECTION_ABORTED|TIMED_OUT|NETWORK_CHANGED)|fetch failed/.test(
            error.message,
          );
        if (!transient || attempt >= 2 || this.controller.signal.aborted) throw error;
        await delay(500 * (attempt + 1), undefined, { signal: this.controller.signal });
      }
    }
  }
  private async performDownload(info: unknown): Promise<string> {
    const asset = selectMacAsset(info, this.arch, this.current);
    if (await this.verified(this.path, asset)) {
      this.asset = asset;
      return asset.version;
    }
    await mkdir(this.root, { recursive: true });
    const partial = join(this.root, 'download.part');
    const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(15 * 60_000)]);
    try {
      let url = asset.url,
        response: Response | undefined;
      for (let redirects = 0; redirects <= 5; redirects++) {
        if (!trustedDownloadUrl(url)) throw new Error('Untrusted download URL');
        response = await this.fetcher(url, { redirect: 'manual', signal });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirects === 5) throw new Error('Invalid download redirect');
        url = new URL(location, url).href;
      }
      if (!response?.ok || !response.body) throw new Error('Download failed');
      const contentLength = Number(response.headers.get('content-length')) || undefined;
      if (
        contentLength !== undefined &&
        (!Number.isSafeInteger(contentLength) ||
          contentLength < 1 ||
          contentLength > maxSize ||
          (asset.size !== undefined && contentLength !== asset.size))
      )
        throw new Error('Invalid content length');
      const expected = asset.size ?? contentLength;
      const file = await open(partial, 'w');
      const reader = response.body.getReader();
      const hash = createHash('sha512');
      let received = 0,
        lastPercent = -1;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > maxSize || (expected !== undefined && received > expected))
            throw new Error('Oversized update');
          hash.update(value);
          let offset = 0;
          while (offset < value.byteLength) {
            const { bytesWritten } = await file.write(value, offset, value.byteLength - offset);
            if (!bytesWritten) throw new Error('Update write failed');
            offset += bytesWritten;
          }
          const percent = expected ? Math.min(99, Math.floor((received / expected) * 100)) : 0;
          if (percent !== lastPercent) {
            lastPercent = percent;
            this.progress(percent);
          }
        }
        if (
          !received ||
          (expected !== undefined && received !== expected) ||
          hash.digest('base64') !== asset.sha512
        )
          throw new Error('Update integrity check failed');
      } finally {
        await reader.cancel().catch(() => {});
        await file.close();
      }
      await rename(partial, this.path);
      // Store the validated manifest subset; restore rechecks version, architecture and file hash.
      const original = object(info);
      await writeFile(
        join(this.root, 'ready.json.tmp'),
        JSON.stringify({
          version: asset.version,
          tag: original.tag,
          files: [
            {
              url: decodeURIComponent(asset.url.split('/').at(-1)!),
              sha512: asset.sha512,
              size: asset.size,
            },
          ],
        }),
      );
      await rename(join(this.root, 'ready.json.tmp'), join(this.root, 'ready.json'));
      this.asset = asset;
      this.progress(100);
      return asset.version;
    } finally {
      await rm(partial, { force: true });
    }
  }
  async installerPath(): Promise<string> {
    if (!this.asset || !(await this.verified(this.path, this.asset)))
      throw new Error('Downloaded installer is missing or invalid');
    return this.path;
  }
}
