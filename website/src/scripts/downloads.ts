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
