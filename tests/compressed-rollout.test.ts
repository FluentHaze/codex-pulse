import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { zstdCompressSync } from 'node:zlib';
import { TokenStore } from '../electron/token-store.js';
import { rolloutHeader, rolloutLines } from '../electron/rollout-reader.js';
test('early header reads and cancelled iteration close large streams without asynchronous errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-zstd-cancel-'));
  try {
    const header = JSON.stringify({
      type: 'session_meta',
      payload: { id: 'large', cwd: 'D:\\project' },
    });
    const text =
      header + '\n' + (JSON.stringify({ text: '中文正文'.repeat(1000) }) + '\n').repeat(800);
    const path = join(root, 'rollout-large.jsonl');
    await writeFile(path, text);
    await writeFile(path + '.zst', zstdCompressSync(text));
    for (let index = 0; index < 20; index++) {
      assert.equal(await rolloutHeader(path), header);
      assert.equal(await rolloutHeader(path + '.zst'), header);
      for await (const line of rolloutLines(path + '.zst')) {
        assert.equal(line, header);
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'pulse-zstd-cancel-')));
    await rm(root, { recursive: true, force: true });
  }
});
test('compressed history is listed, parsed, aggregated and tracked without counting raw/compressed copies twice', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-zstd-'));
  try {
    const text =
      [
        { type: 'session_meta', payload: { id: 'compressed', cwd: 'D:\\project' } },
        { type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn' } },
        {
          type: 'event_msg',
          timestamp: new Date().toISOString(),
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
              last_token_usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
            },
          },
        },
      ]
        .map((row) => JSON.stringify(row))
        .join('\n') + '\n';
    const path = join(root, 'rollout-one.jsonl');
    await writeFile(path + '.zst', zstdCompressSync(text));
    const store = new TokenStore(() => root);
    const catalog = await store.list(true);
    assert.equal(catalog.sessions.length, 1);
    const id = catalog.sessions[0].id;
    assert.equal((await store.read(id)).turns[0].tokens?.total, 12);
    assert.equal((await store.scopeUsage([id])).tokens.total, 12);
    assert.equal((await store.today(true)).tokens.total, 12);
    assert.equal((await store.live(id)).tokens?.total, 12);
    await writeFile(path, text);
    assert.equal((await store.list(true)).sessions.length, 1);
    assert.equal((await store.list()).sessions[0].id, id);
    await writeFile(join(root, 'rollout-broken.jsonl.zst'), 'broken');
    assert.equal((await store.list(true)).limited, true);
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'pulse-zstd-')));
    await rm(root, { recursive: true, force: true });
  }
});
