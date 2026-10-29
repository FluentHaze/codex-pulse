/** Run after npm run build. Uses generated fixtures only; never reads account history. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, appendFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { TokenService } from '../dist-electron/token-service.js';
const cache = resolve('.cache');
await mkdir(cache, { recursive: true });
const fixtures = await mkdtemp(join(cache, 'token-worker-'));
const empty = join(fixtures, 'empty');
await mkdir(empty);
let root = fixtures;
const service = new TokenService(() => root);
const file = join(fixtures, 'rollout-worker.jsonl');
const at = new Date().toISOString();
const row = (index) =>
  [
    JSON.stringify({
      type: 'event_msg',
      payload: { type: 'task_started', turn_id: `worker-${index}` },
    }),
    JSON.stringify({
      timestamp: at,
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: {
            input_tokens: index * 100,
            output_tokens: index * 10,
            total_tokens: index * 110,
            cached_input_tokens: 0,
            reasoning_output_tokens: 0,
          },
          last_token_usage: {
            input_tokens: 100,
            output_tokens: 10,
            total_tokens: 110,
            cached_input_tokens: 0,
            reasoning_output_tokens: 0,
          },
        },
      },
    }),
  ].join('\n');
await writeFile(
  file,
  JSON.stringify({ type: 'session_meta', payload: { id: 'worker-session', cwd: fixtures } }) +
    '\n' +
    Array.from({ length: 4000 }, (_, i) => row(i + 1)).join('\n') +
    '\n',
);
let beats = 0;
const heartbeat = setInterval(() => beats++, 5);
try {
  const first = service.list();
  assert.equal(first, service.list(), 'concurrent scans share one request');
  const catalog = await first;
  assert.equal(catalog.sessions.length, 1);
  const id = catalog.sessions[0].id;
  const before = beats;
  const [detail, scope, today] = await Promise.all([
    service.read(id),
    service.scopeUsage([id]),
    service.today(),
  ]);
  assert.equal(detail.id, id);
  assert.equal(detail.turns.length, 4000);
  assert.equal(scope.tokens.total, 440000);
  assert.equal(today.tokens.total, 440000);
  assert.ok(beats > before, 'main event loop remains responsive during parsing');
  assert.equal(
    today.hourly.reduce((sum, hour) => sum + hour.input, 0),
    400000,
  );
  assert.equal(
    today.hourly.reduce((sum, hour) => sum + hour.output, 0),
    40000,
  );
  await appendFile(file, row(4001) + '\n');
  assert.equal(
    (await service.scopeUsage([id])).tokens.total,
    440110,
    'modified files invalidate aggregation cache',
  );
  const oldRoot = service.read(id);
  root = empty;
  const next = await service.list();
  assert.equal(next.sessions.length, 0, 'directory switches cannot return the previous catalog');
  assert.equal((await oldRoot).id, id, 'in-flight requests retain their original root');
  await assert.rejects(service.read(id), /聊天记录已变更/);
  console.log(
    'PASS: real worker scan/read/today/scope, cache invalidation, source isolation, shared requests, main-thread responsiveness',
  );
} finally {
  clearInterval(heartbeat);
  service.stop();
}
await assert.rejects(service.list(), /已停止/);
