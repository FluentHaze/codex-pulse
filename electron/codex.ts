import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, readdirSync, accessSync, statSync, constants } from 'node:fs';
import { join, delimiter } from 'node:path';
import { homedir } from 'node:os';

export class RpcError extends Error { constructor(message: string, public code?: number) { super(message); } }
export function detectCodex(custom = ''): string {
  const windows = process.platform === 'win32';
  const executable = windows ? 'codex.exe' : 'codex';
  const usable = (path: string) => {
    try { accessSync(path, windows ? constants.F_OK : constants.X_OK); return statSync(path).isFile() && (!windows || path.toLowerCase().endsWith('.exe')); }
    catch { return false; }
  };
  if (custom) { if (!usable(custom)) throw new Error(`选择的 ${executable} 不存在或不可执行`); return custom; }
  const candidates = (process.env.PATH ?? '').split(delimiter).filter(Boolean).map(p => join(p, executable));
  const root = join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'OpenAI', 'Codex', 'bin');
  if (windows && existsSync(root)) candidates.push(...readdirSync(root).reverse().map(p => join(root, p, executable)));
  if (process.platform === 'darwin') candidates.push(
    '/opt/homebrew/bin/codex', '/usr/local/bin/codex',
    join(homedir(), '.local/bin/codex'),
    '/Applications/Codex.app/Contents/Resources/codex',
    join(homedir(), 'Applications/Codex.app/Contents/Resources/codex')
  );
  const found = candidates.find(usable);
  if (!found) throw new Error(`未找到 Codex，请在设置中选择 ${executable}`);
  return found;
}
export class CodexClient {
  private child?: ChildProcessWithoutNullStreams;
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  onAccountChanged?: () => void;
  async start(executable: string) {
    this.stop();
    const child = spawn(executable, ['app-server'], { windowsHide: true, stdio: 'pipe' });
    this.child = child;
    child.stderr.resume(); // Never persist server output: it can contain private account information.
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      let message: { id?: number; method?: string; error?: { message: string; code?: number }; result?: unknown };
      try { message = JSON.parse(line); } catch { return; }
      if (message.id !== undefined && this.pending.has(message.id)) {
        const request = this.pending.get(message.id)!; clearTimeout(request.timer); this.pending.delete(message.id);
        if (message.error) request.reject(new RpcError(message.error.message, message.error.code)); else request.resolve(message.result);
      } else if (message.method === 'account/updated' || message.method === 'account/login/completed') this.onAccountChanged?.();
      else if (message.id !== undefined && message.method) child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Unsupported client request' } }) + '\n');
    });
    const fail = () => { if (this.child === child) { this.child = undefined; this.rejectAll(new Error('Codex 服务已断开，请重试')); } lines.close(); };
    child.on('error', fail); child.on('exit', fail);
    await this.request('initialize', { clientInfo: { name: 'codex_pulse', title: 'Codex Pulse', version: '0.1.0' } });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  }
  get alive() { return !!this.child && this.child.exitCode === null && !this.child.killed; }
  request<T>(method: string, params?: unknown): Promise<T> {
    if (!this.alive) return Promise.reject(new Error('Codex 服务未连接'));
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('请求超时，请检查网络后重试')); }, 20_000);
      this.pending.set(id, { resolve: value => resolve(value as T), reject, timer });
      this.child!.stdin.write(JSON.stringify({ id, method, ...(params === undefined ? {} : { params }) }) + '\n', error => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(new Error('Codex 通信失败')); }
      });
    });
  }
  private rejectAll(error: Error) { for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); } this.pending.clear(); }
  stop() { const child = this.child; this.child = undefined; this.rejectAll(new Error('连接已重置')); child?.kill(); }
}
