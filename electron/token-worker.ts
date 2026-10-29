/** 文件扫描与 JSON 解析在工作线程中执行，避免阻塞窗口、托盘和额度轮询。 */
import { parentPort } from 'node:worker_threads';
import { TokenStore } from './token-store.js';
type Arguments = {
  list: boolean;
  today: boolean;
  read: string;
  live: string;
  scopeUsage: string[];
};
export type TokenCall = {
  [M in keyof Arguments]: { method: M; value: Arguments[M] };
}[keyof Arguments];
export type TokenRequest = TokenCall & { id: number; root: string };
const stores = new Map<string, TokenStore>();
parentPort?.on('message', async (request: TokenRequest) => {
  let store = stores.get(request.root);
  if (!store) {
    store = new TokenStore(() => request.root);
    if (stores.size >= 2) stores.delete(stores.keys().next().value!);
    stores.set(request.root, store);
  }
  try {
    const value = await (request.method === 'list'
      ? store.list(request.value)
      : request.method === 'today'
        ? store.today(request.value)
        : request.method === 'read'
          ? store.read(request.value)
          : request.method === 'live'
            ? store.live(request.value)
            : store.scopeUsage(request.value));
    parentPort?.postMessage({ id: request.id, value });
  } catch (error) {
    parentPort?.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : '无法读取本机用量',
    });
  }
});
