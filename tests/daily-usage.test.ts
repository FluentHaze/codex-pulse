import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TokenParser } from '../electron/token-parser.js';
import { TokenStore } from '../electron/token-store.js';
import { DailyAccumulator, localDayRange } from '../electron/daily-usage.js';
import type { UsageSample } from '../electron/types.js';

const usage = (input: number, output: number) => ({
  input_tokens: input,
  output_tokens: output,
  cached_input_tokens: 0,
  reasoning_output_tokens: 0,
  total_tokens: input + output,
});
const token = (
  input: number,
  output: number,
  time: number,
  lastInput = input,
  lastOutput = output,
) =>
  JSON.stringify({
    timestamp: new Date(time).toISOString(),
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        total_token_usage: usage(input, output),
        last_token_usage: usage(lastInput, lastOutput),
      },
    },
  });
const start = (id: string) =>
  JSON.stringify({ type: 'event_msg', payload: { type: 'task_started', turn_id: id } });
test('daily totals use event time across midnight, deduplicate copied history, and never add cache/reasoning twice', () => {
  const range = localDayRange(new Date(2026, 9, 22, 12));
  const acc = new DailyAccumulator(range);
  const samples: UsageSample[] = [];
  const parser = new TokenParser(false, (sample) => samples.push(sample));
  [
    start('turn-a'),
    token(100, 20, range.start - 1000),
    token(250, 50, range.start + 1000, 150, 30),
    token(300, 70, range.start + 2000, 50, 20),
    token(310, 71, range.end, 10, 1),
  ].forEach((line) => parser.push(line));
  samples.forEach((sample, index) => acc.add(sample, 'parent', index));
  samples.forEach((sample, index) => acc.add(sample, 'fork', index));
  const result = acc.result(2, 0);
  assert.equal(result.tokens.total, 250);
  assert.equal(result.tokens.input, 200);
  assert.equal(result.tokens.output, 50);
  assert.equal(result.turnCount, 1);
  assert.equal(result.recordCount, 2);
  assert.equal(result.duplicateRecords, 2);
  assert.equal(range.date, '2026-10-22');
  assert.equal(range.end, new Date(2026, 9, 23).getTime());
  assert.equal(result.hourly?.length, 24);
  assert.equal(result.hourly?.[0].total, 250);
  assert.equal(result.hourly?.[0].input, 200);
  assert.equal(result.hourly?.[0].output, 50);
  assert.equal(result.hourly?.[0].records, 2);
  assert.equal(
    result.hourly?.reduce((sum, hour) => sum + (hour.total ?? 0), 0),
    result.tokens.total,
  );
});

test('hourly buckets preserve missing counters and do not double count copied records', () => {
  const acc = new DailyAccumulator(localDayRange(new Date(2026, 9, 22)));
  const sample: UsageSample = {
    key: 'hourly-a',
    turnId: 'turn-hourly',
    timestamp: new Date(2026, 9, 22, 9, 30).toISOString(),
    tokens: { input: 10, output: 5, cachedInput: 0, reasoning: 0, total: 15 },
    complete: true,
    dedupable: true,
  };
  acc.add(sample, 'a', 0);
  acc.add(sample, 'fork', 0);
  acc.add(
    {
      ...sample,
      key: 'missing',
      timestamp: new Date(2026, 9, 22, 10).toISOString(),
      tokens: { ...sample.tokens, total: null },
    },
    'a',
    1,
  );
  acc.add({ ...sample, key: 'invalid', timestamp: 'invalid' }, 'a', 2);
  const result = acc.result(2, 0);
  assert.equal(result.hourly?.[9].total, 15);
  assert.equal(result.hourly?.[9].records, 1);
  assert.equal(result.hourly?.[10].total, null);
  assert.equal(result.hourly?.[11].total, 0);
  assert.equal(result.recordCount, 2);
  assert.equal(result.duplicateRecords, 1);
  assert.ok(result.warnings.some((warning) => warning.includes('时间无效')));
});
test('missing optional counts, uncertain deduplication and unknown timestamps are explicitly reported', () => {
  const range = localDayRange();
  const acc = new DailyAccumulator(range);
  const base: UsageSample = {
    key: 'sample',
    turnId: 'legacy-1',
    timestamp: new Date(range.start + 1).toISOString(),
    tokens: { input: 10, output: 2, cachedInput: null, reasoning: null, total: 12 },
    complete: false,
    dedupable: false,
  };
  acc.add(base, 'one', 0);
  acc.add(base, 'two', 0);
  acc.add({ ...base, timestamp: null }, 'one', 1);
  const result = acc.result(2, 1);
  assert.equal(result.tokens.total, 24);
  assert.equal(result.tokens.cachedInput, null);
  assert.equal(result.tokens.reasoning, null);
  assert.ok(result.warnings.length >= 3);
});
test('today scans beyond the chat-list cap, excludes internal sessions and deduplicates forked records', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-daily-'));
  try {
    const directory = join(root, 'sessions');
    await mkdir(directory);
    const time = Date.now();
    for (let index = 0; index < 201; index++) {
      const lines = [
        JSON.stringify({
          type: 'session_meta',
          payload: { id: `human-${index}`, cwd: 'project', source: 'vscode' },
        }),
        start(`turn-${index}`),
        token(1, 1, time),
      ];
      await writeFile(join(directory, `rollout-${index}.jsonl`), lines.join('\n') + '\n');
    }
    await writeFile(
      join(directory, 'rollout-fork.jsonl'),
      [
        JSON.stringify({
          type: 'session_meta',
          payload: { id: 'fork', parent_thread_id: 'human-0', source: 'vscode' },
        }),
        start('turn-0'),
        token(1, 1, time),
      ].join('\n') + '\n',
    );
    await writeFile(
      join(directory, 'rollout-guardian.jsonl'),
      [
        JSON.stringify({
          type: 'session_meta',
          payload: { id: 'internal', source: { subagent: { other: 'guardian' } } },
        }),
        start('guardian'),
        token(500, 500, time),
      ].join('\n') + '\n',
    );
    const store = new TokenStore(() => directory);
    assert.equal((await store.list()).sessions.length, 202);
    const project = await store.scopeUsage(
      (await store.list()).sessions.map((session) => session.id),
    );
    assert.equal(project.tokens.total, 402);
    assert.equal(project.duplicateRecords, 1);
    const result = await store.today(true);
    assert.equal(result.tokens.total, 402);
    assert.equal(result.turnCount, 201);
    assert.equal(result.duplicateRecords, 1);
    assert.equal(result.scannedFiles, 202);
    assert.equal((await store.today()).tokens.total, 402);
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'pulse-daily-')));
    await rm(root, { recursive: true, force: true });
  }
});
