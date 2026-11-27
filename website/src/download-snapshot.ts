import { assetDownloadUrl } from './scripts/downloads';

// Update only from a published GitHub release's Assets list. Keep a last-known-good
// entry per target so builds and first paint never depend on the releases API.
type DownloadKey =
  | 'mac-arm64-dmg'
  | 'mac-arm64-zip'
  | 'mac-x64-dmg'
  | 'mac-x64-zip'
  | 'win-x64-setup'
  | 'win-x64-portable';
const bundledAssets: Partial<Record<DownloadKey, { tag: string; name: string }>> = {
  'mac-arm64-dmg': { tag: 'v0.1.41', name: 'Codex-Pulse-0.1.41-mac-arm64.dmg' },
  'mac-arm64-zip': { tag: 'v0.1.41', name: 'Codex-Pulse-0.1.41-mac-arm64.zip' },
  'mac-x64-dmg': { tag: 'v0.1.41', name: 'Codex-Pulse-0.1.41-mac-x64.dmg' },
  'mac-x64-zip': { tag: 'v0.1.41', name: 'Codex-Pulse-0.1.41-mac-x64.zip' },
  'win-x64-setup': { tag: 'v0.1.41', name: 'Codex-Pulse-Setup-0.1.41-x64.exe' },
  'win-x64-portable': { tag: 'v0.1.41', name: 'Codex-Pulse-0.1.41-win-x64.exe' },
};

export function bundledDownload(key: DownloadKey) {
  const asset = bundledAssets[key];
  if (!asset) return null;
  const { tag, name } = asset;
  const url = assetDownloadUrl(
    key,
    tag,
    name,
    `https://github.com/FluentHaze/codex-pulse/releases/download/${tag}/${encodeURIComponent(name)}`,
  );
  return url ? { tag, url } : null;
}
