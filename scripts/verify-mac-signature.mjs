/**
 * 打包后的签名完整性门禁；校验失败立即停止，避免分发被篡改或签名不完整的应用。
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Validate the completed bundle before electron-builder creates DMG/ZIP files.
export default function verifyMacSignature(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
    stdio: 'inherit',
  });
  console.log('Mac 应用签名完整性校验通过（本地签名不代表 Apple 公证）。');
}
