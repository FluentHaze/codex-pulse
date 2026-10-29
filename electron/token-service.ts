import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TokenCall } from './token-worker.js';
import type { DailyStats, TokenCatalog, TokenSession, LiveTokens } from './types.js';

export class TokenService {
  private worker?: Worker;
  private sequence = 0;
  private stopped = false;
  private requests = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  private shared = new Map<string, Promise<unknown>>();
  constructor(private root: () => string) {}
  private call<T>(request: TokenCall): Promise<T> {
    if (this.stopped) return Promise.reject(new Error('本机统计服务已停止'));
    const root = this.root();
    const key = JSON.stringify([root, request.method, request.value]);
    const existing = this.shared.get(key);
    if (existing) return existing as Promise<T>;
    if (!this.worker) {
      const source = fileURLToPath(new URL('./token-worker.js', import.meta.url));
      const unpacked = source.replace(/\.asar([/\\])/, '.asar.unpacked$1');
      const worker = new Worker(existsSync(unpacked) ? unpacked : source);
      this.worker = worker;
      worker.unref();
      worker.on('message', (message: { id: number; value?: unknown; error?: string }) => {
        const pending = this.requests.get(message.id);
        if (!pending) return;
        this.requests.delete(message.id);
        if (message.error) pending.reject(new Error(message.error));
        else pending.resolve(message.value);
      });
      const failed = () => {
        if (this.worker !== worker) return;
        this.worker = undefined;
        for (const pending of this.requests.values())
          pending.reject(new Error('本机统计服务已中断，请刷新重试'));
        this.requests.clear();
        this.shared.clear();
      };
      worker.on('error', failed);
      worker.on('exit', failed);
    }
    const id = ++this.sequence;
    const work = new Promise<T>((resolve, reject) => {
      this.requests.set(id, { resolve: (value) => resolve(value as T), reject });
      this.worker!.postMessage({ ...request, id, root });
    }).finally(() => {
      if (this.shared.get(key) === work) this.shared.delete(key);
    });
    this.shared.set(key, work);
    return work;
  }
  list(force = false) {
    return this.call<TokenCatalog>({ method: 'list', value: force });
  }
  read(id: string) {
    return this.call<TokenSession>({ method: 'read', value: id });
  }
  scopeUsage(ids: string[]) {
    return this.call<DailyStats>({ method: 'scopeUsage', value: ids });
  }
  today(force = false) {
    return this.call<DailyStats>({ method: 'today', value: force });
  }
  live(id: string) {
    return this.call<LiveTokens>({ method: 'live', value: id });
  }
  stop() {
    this.stopped = true;
    for (const pending of this.requests.values()) pending.reject(new Error('本机统计服务已停止'));
    this.requests.clear();
    this.shared.clear();
    const worker = this.worker;
    this.worker = undefined;
    if (worker) void worker.terminate();
  }
}
