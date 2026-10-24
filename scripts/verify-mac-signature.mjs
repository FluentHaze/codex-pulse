import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Validate the completed bundle before electron-builder creates DMG/ZIP files.
export default function verifyMacSignature(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { stdio: 'inherit' });
  console.log('Mac 应用签名完整性校验通过（本地签名不代表 Apple 公证）。');
}
