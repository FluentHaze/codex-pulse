import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, appendFile, rm, utimes } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TokenParser } from '../electron/token-parser.js';
import { TokenStore, isInternalSession } from '../electron/token-store.js';

const event = (type: string, payload: object = {}) =>
  JSON.stringify({
    timestamp: '2026-10-22T02:00:00Z',
    type: 'event_msg',
    payload: { type, ...payload },
  });
const context = (id: string) =>
  JSON.stringify({ type: 'turn_context', payload: { turn_id: id, model: 'test-model' } });
const usage = (input: number, output: number, cached = 0, reasoning = 0) => ({
  input_tokens: input,
  output_tokens: output,
  cached_input_tokens: cached,
  reasoning_output_tokens: reasoning,
  total_tokens: input + output,
});
const token = (total: object, last?: object) =>
  event('token_count', { info: { total_token_usage: total, last_token_usage: last } });
test('internal sessions are recognized by source rather than titles or parent linkage', () => {
  assert.equal(isInternalSession({ source: { subagent: { other: 'guardian' } } }), true);
  assert.equal(isInternalSession({ source: { subagent: { thread_spawn: {} } } }), true);
  assert.equal(isInternalSession({ thread_source: 'guardian_review' }), true);
  assert.equal(isInternalSession({ source: 'subagent' }), true);
  assert.equal(isInternalSession({ source: 'vscode', thread_source: 'user' }), false);
  assert.equal(isInternalSession({}), false);
});
test('filters internal sessions before the 200-chat cap, preserves same-named human chats and blocks hidden live targets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-filter-'));
  try {
    const directory = join(root, 'sessions');
    await mkdir(directory);
    const userFile = join(directory, 'rollout-user.jsonl');
    await writeFile(
      userFile,
      JSON.stringify({
        type: 'session_meta',
        payload: {
          id: 'human',
          source: 'vscode',
          thread_source: 'user',
          parent_thread_id: 'fork-parent',
        },
      }) + '\n',
    );
    await utimes(userFile, new Date(1000), new Date(1000));
    await writeFile(
      join(root, 'session_index.jsonl'),
      JSON.stringify({ id: 'human', thread_name: 'Guardian review' }) + '\n',
    );
    for (let index = 0; index < 205; index++)
      await writeFile(
        join(directory, `rollout-internal-${index}.jsonl`),
        JSON.stringify({
          type: 'session_meta',
          payload: {
            id: `internal-${index}`,
            source: { subagent: { other: 'guardian' } },
            thread_source: 'guardian_review',
          },
        }) + '\n',
      );
    const store = new TokenStore(() => directory);
    const catalog = await store.list(true);
    assert.equal(catalog.sessions.length, 1);
    assert.equal(catalog.sessions[0].title, 'Guardian review');
    assert.equal(catalog.limited, false);
    assert.deepEqual(
      (await store.list(true)).sessions,
      catalog.sessions,
      'metadata-cache path must apply the same filter',
    );
    const hiddenId = createHash('sha256')
      .update(join(directory, 'rollout-internal-0.jsonl'))
      .digest('hex')
      .slice(0, 24);
    await assert.rejects(store.read(hiddenId));
    await assert.rejects(store.live(hiddenId), /内部子会话/);
    assert.equal((await store.live(catalog.sessions[0].id)).sessionId, catalog.sessions[0].id);
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'pulse-filter-')));
    await rm(root, { recursive: true, force: true });
  }
});
test('aggregates multiple requests per turn and ignores duplicate usage events across turns', () => {
  const parser = new TokenParser();
  [
    event('task_started', { turn_id: 'a' }),
    context('a'),
    token(usage(100, 20, 60, 5), usage(100, 20, 60, 5)),
    token(usage(100, 20, 60, 5), usage(100, 20, 60, 5)),
    token(usage(250, 50, 160, 15), usage(150, 30, 100, 10)),
    event('task_complete', { turn_id: 'a' }),
    event('task_started', { turn_id: 'b' }),
    context('b'),
    token(usage(250, 50, 160, 15)),
    token(usage(300, 60, 180, 18), usage(50, 10, 20, 3)),
    event('turn_aborted', { turn_id: 'b' }),
  ].forEach((line) => parser.push(line));
  const { turns } = parser.finish();
  assert.equal(turns.length, 2);
  assert.deepEqual(turns[0].tokens, {
    input: 250,
    output: 50,
    cachedInput: 160,
    reasoning: 15,
    total: 300,
  });
  assert.equal(turns[1].tokens?.total, 60);
  assert.equal(turns[1].status, 'interrupted');
  assert.equal(turns[0].status, 'completed');
});
test('uses last request only for initial inherited totals and never charges the inherited baseline', () => {
  const parser = new TokenParser();
  parser.push(context('fork-turn'));
  parser.push(token(usage(1100, 210, 600, 50), usage(100, 10, 60, 5)));
  assert.equal(parser.finish().turns[0].tokens?.total, 110);
});
test('missing usage stays unavailable, optional missing counters do not become zeros', () => {
  const parser = new TokenParser();
  parser.push(context('empty'));
  parser.push(event('token_count', { info: null }));
  parser.push(event('task_complete', { turn_id: 'empty' }));
  parser.push(context('partial'));
  parser.push(
    token(
      { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
      { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
    ),
  );
  const { turns } = parser.finish();
  assert.equal(turns[0].tokens, null);
  assert.equal(turns[1].tokens?.cachedInput, null);
  assert.equal(turns[1].tokens?.reasoning, null);
});
test('resets and missing initial baseline mark statistics incomplete instead of guessing', () => {
  const parser = new TokenParser();
  parser.push(context('a'));
  parser.push(token(usage(100, 20)));
  parser.push(token(usage(120, 25), usage(20, 5)));
  parser.push(token(usage(1, 1), usage(1, 1)));
  parser.push(token(usage(10, 3), usage(9, 2)));
  const result = parser.finish();
  assert.equal(result.turns[0].complete, false);
  assert.equal(result.turns[0].tokens?.total, 36);
  assert.ok(result.warnings.length);
});
test('legacy user marker merges with turn context; malformed records do not crash parsing', () => {
  const parser = new TokenParser();
  parser.push(event('user_message', { message: 'private content' }));
  parser.push(context('real-id'));
  parser.push(token(usage(5, 2), usage(5, 2)));
  parser.push('{"type":"token_count"');
  const result = parser.finish();
  assert.equal(result.turns.length, 1);
  assert.equal(result.turns[0].id, 'real-id');
  assert.equal(result.turns[0].complete, false);
  assert.equal(result.turns[0].messages[0].text, 'private content');
});
test('messages attach by explicit turn id, skip injected context and exclude non-message items', () => {
  const parser = new TokenParser();
  parser.push(context('a'));
  const message = (role: string, text: string, id: string, turnId = 'a', kinds?: string[]) =>
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        id,
        role,
        phase: 'final_answer',
        content: [{ type: role === 'assistant' ? 'output_text' : 'input_text', text }],
        internal_chat_message_metadata_passthrough: { turn_id: turnId, content_item_kinds: kinds },
      },
    });
  parser.push(message('developer', 'secret instructions', 'dev'));
  parser.push(
    message('user', 'environment only', 'env', 'a', ['environments.environment_context']),
  );
  parser.push(event('user_message', { message: 'fallback prompt' }));
  parser.push(message('user', '实际问题', 'user', 'a', ['user.text']));
  parser.push(message('assistant', '实际回答', 'answer'));
  parser.push(message('assistant', '实际回答', 'answer'));
  parser.push(context('b'));
  parser.push(message('assistant', '上一轮补充', 'late', 'a'));
  parser.push(
    JSON.stringify({
      type: 'response_item',
      payload: { type: 'reasoning', content: [{ type: 'output_text', text: 'hidden reasoning' }] },
    }),
  );
  const { turns } = parser.finish();
  assert.deepEqual(
    turns[0].messages.map((value) => value.text),
    ['实际问题', '实际回答', '上一轮补充'],
  );
  assert.equal(turns[1].messages.length, 0);
});
test('oversized text is explicitly truncated and images do not fetch remote content', () => {
  const parser = new TokenParser();
  parser.push(context('a'));
  parser.push(
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_image', image_url: 'https://example.com/private.png' },
          { type: 'input_text', text: 'x'.repeat(40000) },
        ],
      },
    }),
  );
  const message = parser.finish().turns[0].messages[0];
  assert.equal(message.text.length, 32000);
  assert.equal(message.truncated, true);
  assert.ok(message.text.startsWith('[图片附件]'));
  assert.ok(!message.text.includes('https://'));
});
test('unassigned usage becomes a baseline without being charged to the next turn', () => {
  const parser = new TokenParser();
  parser.push(token(usage(1000, 200), usage(100, 20)));
  parser.push(context('new'));
  parser.push(token(usage(1010, 202), usage(10, 2)));
  assert.equal(parser.finish().turns[0].tokens?.total, 12);
});
test('an explicitly recorded zero differs from missing statistics', () => {
  const parser = new TokenParser();
  parser.push(context('zero'));
  parser.push(token(usage(0, 0), usage(0, 0)));
  assert.equal(parser.finish().turns[0].tokens?.total, 0);
});
test('store supports titles, appended records, safe identifiers, empty directories and source changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-tokens-'));
  try {
    let directory = join(root, 'sessions');
    await mkdir(join(directory, '2026', '10', '22'), { recursive: true });
    const file = join(directory, '2026', '10', '22', 'rollout-example.jsonl');
    await writeFile(
      join(root, 'session_index.jsonl'),
      JSON.stringify({ id: 'chat-id', thread_name: '测试聊天' }) + '\n',
    );
    await writeFile(
      file,
      [
        JSON.stringify({ type: 'session_meta', payload: { id: 'chat-id', cwd: 'project' } }),
        context('a'),
        token(usage(10, 2), usage(10, 2)),
      ].join('\n') + '\n',
    );
    const store = new TokenStore(() => directory);
    const catalog = await store.list();
    assert.equal(catalog.sessions[0].title, '测试聊天');
    const id = catalog.sessions[0].id;
    assert.equal((await store.read(id)).turns[0].tokens?.total, 12);
    await appendFile(file, token(usage(20, 4), usage(10, 2)) + '\n');
    assert.equal((await store.read(id)).turns[0].tokens?.total, 24);
    await assert.rejects(store.read('../../auth.json'));
    directory = join(root, 'missing');
    assert.deepEqual((await store.list(true)).sessions, []);
    await assert.rejects(store.read(id));
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'pulse-tokens-')));
    await rm(root, { recursive: true, force: true });
  }
});
