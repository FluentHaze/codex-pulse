/**
 * 为 Mac 安装盘生成系统设置快捷入口，仅影响 DMG 资源，不修改系统安全配置。
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// A location file opens System Settings without running another unsigned app.
export default async function prepareMacDmg(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const directory = join(context.packager.projectDir, 'release', '.dmg-assets');
  await mkdir(directory, { recursive: true });
  const shortcut = join(directory, '打开隐私与安全性.inetloc');
  const settingsApp = [
    '/System/Applications/System Settings.app',
    '/System/Applications/System Preferences.app',
  ].find(existsSync);
  if (!settingsApp) throw new Error('找不到系统设置应用，无法生成 DMG 安装指引入口');
  await writeFile(
    shortcut,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>URL</key><string>x-apple.systempreferences:com.apple.preference.security</string></dict></plist>
`,
    'utf8',
  );

  // Use AppKit directly: no Finder/System Events automation permission is needed.
  // dmgbuild copies this resource fork and Finder metadata using ditto.
  execFileSync(
    '/usr/bin/osascript',
    [
      '-l',
      'JavaScript',
      '-e',
      `
ObjC.import('AppKit');
function run(args) {
  const workspace = $.NSWorkspace.sharedWorkspace;
  const icon = workspace.iconForFile(args[1]);
  if (!workspace.setIconForFileOptions(icon, args[0], 0)) {
    throw new Error('无法设置安装指引入口图标');
  }
  const url = $.NSURL.fileURLWithPath(args[0]);
  if (!url.setResourceValueForKeyError($.NSNumber.numberWithBool(true), $.NSURLHasHiddenExtensionKey, null)) {
    throw new Error('无法隐藏安装指引入口扩展名');
  }
}
`,
      shortcut,
      settingsApp,
    ],
    { stdio: 'inherit' },
  );
  console.log('Prepared Privacy & Security shortcut for the Mac DMG');
}
