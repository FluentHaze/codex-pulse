import { spawn } from 'node:child_process';
import { mkdir, open, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const target = process.argv[2] ?? 'all';
if (!['all', 'win', 'mac'].includes(target) || process.argv.length > 3) {
  console.error('用法：npm run pack（双平台） / npm run pack:win / npm run pack:mac');
  process.exit(1);
}
if ((target === 'all' || target === 'mac') && process.platform !== 'darwin') {
  console.error('macOS 应用必须在 Mac 上打包。请在 Mac 上运行 npm run pack，或仅运行 npm run pack:win。');
  process.exit(1);
}
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 16)) {
  console.error('打包需要 Node.js 22.16 或更新版本，请先切换 Node.js 版本。');
  process.exit(1);
}

function run(script, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: project, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolveRun() : reject(new Error(`命令失败（${signal ?? code}）：${args.join(' ')}`)));
  });
}

const release = join(project, 'release');
await mkdir(release, { recursive: true });
const lockPath = join(release, '.pack.lock');
let lock;
try {
  lock = await open(lockPath, 'wx');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.error('已有打包任务在运行。若上次任务被强制终止，请确认没有打包进程后删除 release/.pack.lock。');
  process.exit(1);
}
try {
  await lock.writeFile(String(process.pid));
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error('请通过 npm run pack / pack:win / pack:mac 启动打包。');
  // Compile first; both platforms then receive exactly the same release version.
  await run(npm, ['run', 'build']);
  await run(npm, ['version', 'patch', '--no-git-tag-version', '--ignore-scripts']);
  const platforms = target === 'all' ? ['win', 'mac'] : [target];
  const failed = [];
  for (const platform of platforms) {
    const output = join(release, platform);
    console.log(`\n正在打包 ${platform} → ${output}`);
    const args = platform === 'win' ? ['--win', 'nsis', 'portable', '--x64'] : ['--mac'];
    try {
      await run(require.resolve('electron-builder/cli.js'), [...args, '--publish', 'never', `--config.directories.output=${output}`]);
      console.log(`${platform} 打包完成：${output}`);
    } catch (error) {
      failed.push(platform);
      console.error(error.message);
    }
  }
  if (failed.length) throw new Error(`${failed.join('、')} 打包失败；已生成的产物和本次版本号保留。修复后重新打包会递增到下一版本。请先退出 release 中运行的应用，避免文件占用。`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await lock.close();
  await unlink(lockPath);
}
