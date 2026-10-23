import { spawn } from 'node:child_process';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const explicitOutput = args.some(arg => /^--config\.directories\.output(?:=|$)/.test(arg) || /^-c\.directories\.output(?:=|$)/.test(arg));
let output;
if (!explicitOutput) {
  const release = join(project, 'release');
  await mkdir(release, { recursive: true });
  // Keep previous runs intact: a running app or another process may still lock app.asar.
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  output = await mkdtemp(join(release, `build-${stamp}-`));
}

const command = [require.resolve('electron-builder/cli.js'), '--win', 'portable', ...args];
if (output) {
  command.push(`--config.directories.output=${output}`);
  console.log(`本次打包目录：${output}`);
}
const child = spawn(process.execPath, command, { cwd: project, stdio: 'inherit' });
child.on('error', error => { console.error(`无法启动打包工具：${error.message}`); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  process.exitCode = code ?? 1;
  if (code === 0 && output) console.log(`打包完成，EXE 位于：${output}`);
  else if (output) console.error(`打包未完成，诊断文件保留在：${output}${signal ? `（${signal}）` : ''}`);
});
