import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, appendFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LiveTokenReader } from '../electron/live-tokens.js';

const event = (type: string, payload: object = {}) =>
  JSON.stringify({ type: 'event_msg', payload: { type, ...payload } }) + '\n';
const token = (input: number, output: number, lastInput = input, lastOutput = output) =>
  event('token_count', {
    info: {
      total_token_usage: {
        input_tokens: input,
        output_tokens: output,
        total_tokens: input + output,
      },
      last_token_usage: {
        input_tokens: lastInput,
        output_tokens: lastOutput,
        total_tokens: lastInput + lastOutput,
      },
    },
  });
const session = { id: 'test', title: '测试聊天', updatedAt: 0 };
test('live tail updates counters, deduplicates unchanged events, clears on a new turn and detects completion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-live-'));
  try {
    const path = join(root, 'rollout-test.jsonl');
    const reader = new LiveTokenReader();
    await writeFile(path, event('task_started', { turn_id: 'a' }) + token(100, 20));
    assert.equal((await reader.read(path, session)).tokens?.total, 120);
    assert.equal((await reader.read(path, session)).tokens?.total, 120);
    await appendFile(path, token(100, 20));
    assert.equal((await reader.read(path, session)).tokens?.total, 120);
    await appendFile(path, token(200, 40, 100, 20));
    assert.equal((await reader.read(path, session)).tokens?.total, 240);
    await appendFile(path, event('task_complete', { turn_id: 'a' }));
    assert.equal((await reader.read(path, session)).status, 'completed');
    await appendFile(path, event('task_started', { turn_id: 'b' }));
    const next = await reader.read(path, session);
    assert.equal(next.tokens, null);
    assert.equal(next.turnId, 'b');
    await appendFile(path, token(250, 50, 50, 10));
    assert.equal((await reader.read(path, session)).tokens?.total, 60);
    await appendFile(path, event('turn_aborted', { turn_id: 'b' }));
    assert.equal((await reader.read(path, session)).status, 'interrupted');
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'pulse-live-')));
    await rm(root, { recursive: true, force: true });
  }
});
test('partial UTF-8 lines are deferred; truncation and switching sources reset counters and no message bodies are retained', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-live-'));
  try {
    const path = join(root, 'a.jsonl');
    const other = join(root, 'b.jsonl');
    const reader = new LiveTokenReader();
    const start = Buffer.from(event('task_started', { turn_id: '中文轮次' }));
    const split = start.indexOf(Buffer.from('中文')) + 1;
    await writeFile(path, start.subarray(0, split));
    assert.equal((await reader.read(path, session)).turnId, null);
    await appendFile(path, start.subarray(split));
    await appendFile(path, token(10, 2));
    const first = await reader.read(path, session);
    assert.equal(first.turnId, '中文轮次');
    assert.equal(first.tokens?.total, 12);
    await appendFile(
      path,
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: '正文不应进入实时状态' }],
        },
      }) + '\n',
    );
    assert.ok(!JSON.stringify(await reader.read(path, session)).includes('正文不应进入实时状态'));
    await writeFile(path, event('task_started', { turn_id: 'new' }) + token(1, 1));
    assert.equal((await reader.read(path, session)).tokens?.total, 2);
    await writeFile(other, event('task_started', { turn_id: 'other' }) + token(40, 4));
    const second = await reader.read(other, { ...session, id: 'other' });
    assert.equal(second.tokens?.total, 44);
    assert.equal(second.sessionId, 'other');
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'pulse-live-')));
    await rm(root, { recursive: true, force: true });
  }
});
