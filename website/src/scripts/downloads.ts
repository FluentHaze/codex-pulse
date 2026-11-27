/**
 * 官网的桌面平台识别与安装包匹配规则；只接受本项目 GitHub Release 的下载地址。
 */
export type DownloadPlatform = 'windows' | 'mac' | 'unknown';

export function detectDownloadPlatform(platform: string, userAgent: string): DownloadPlatform {
  // Mobile user agents can contain Mac OS X or Linux; neither is a desktop target.
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return 'unknown';
  if (/Windows|Win32|Win64/i.test(platform)) return 'windows';
  if (/macOS|MacIntel|MacPPC/i.test(platform)) return 'mac';
  if (/Windows/i.test(userAgent)) return 'windows';
  return /Macintosh|Mac OS X/i.test(userAgent) ? 'mac' : 'unknown';
}

export const downloadRules: Record<string, RegExp> = {
  'mac-arm64-dmg': /mac-arm64\.dmg$/i,
  'mac-arm64-zip': /mac-arm64\.zip$/i,
  'mac-x64-dmg': /mac-x64\.dmg$/i,
  'mac-x64-zip': /mac-x64\.zip$/i,
  'win-x64-setup': /^Codex[ .-]Pulse-Setup-\d+\.\d+\.\d+-x64\.exe$/i,
  'win-x64-portable': /win-x64\.exe$/i,
};

export function releaseDownloadUrl(value: unknown): string | null {
  try {
    if (typeof value !== 'string') return null;
    const url = new URL(value);
    return url.origin === 'https://github.com' &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith('/FluentHaze/codex-pulse/releases/download/')
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Official desktop package tags are stable vMAJOR.MINOR.PATCH versions. */
export function releaseVersion(value: unknown): string | null {
  return typeof value === 'string' && /^v\d+\.\d+\.\d+$/.test(value) ? value : null;
}

export function assetDownloadUrl(key: string, tag: string, name: unknown, value: unknown) {
  if (typeof name !== 'string' || !downloadRules[key]?.test(name) || !releaseVersion(tag)) {
    return null;
  }
  const url = releaseDownloadUrl(value);
  if (!url) return null;
  const asset = new URL(url);
  return !asset.search &&
    !asset.hash &&
    asset.pathname ===
      `/FluentHaze/codex-pulse/releases/download/${tag}/${encodeURIComponent(name)}`
    ? url
    : null;
}

interface PublicRelease {
  tag_name?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: { name?: unknown; browser_download_url?: unknown; state?: unknown }[];
}

/** GitHub Latest is authoritative even when a maintainer rolls it back. */
export function findReleaseDownload(key: string, item?: PublicRelease | null) {
  const tag = releaseVersion(item?.tag_name);
  if (!item || !tag || item.draft !== false || item.prerelease !== false) return null;
  if (!Array.isArray(item.assets)) return null;
  for (const asset of item.assets) {
    if (!asset || (asset.state !== undefined && asset.state !== 'uploaded')) continue;
    const url = assetDownloadUrl(key, tag, asset.name, asset.browser_download_url);
    if (url) return { tag, url };
  }
  return null;
}
