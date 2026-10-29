import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveSessionFollower } from '../electron/live-follow.js';
import type { LiveTokens } from '../electron/types.js';

const live = (id: string, status: LiveTokens['status'], turnId = 'turn'): LiveTokens => ({
  sessionId: id,
  turnStartedAt: new Date().toISOString(),
  title: id,
  turnId,
  turnNumber: 1,
  tokens: null,
  status,
  complete: status === 'completed',
  updatedAt: Date.now(),
  error: null,
});
test('auto follow ignores reordered completed records and keeps reading the current running turn', async () => {
  const follower = new LiveSessionFollower();
  const values = new Map([
    ['a', live('a', 'collecting')],
    ['b', live('b', 'completed')],
  ]);
  let stamp = Date.now();
  const catalog = (ids: string[]) => ids.map((id) => ({ id, title: id, updatedAt: stamp }));
  const read = async (id: string) => values.get(id)!;
  assert.equal((await follower.read(catalog(['a', 'b']), read))?.sessionId, 'a');
  stamp++;
  assert.equal((await follower.read(catalog(['b', 'a']), read))?.sessionId, 'a');
  values.set('b', live('b', 'collecting', 'new'));
  stamp++;
  assert.equal((await follower.read(catalog(['b', 'a']), read))?.sessionId, 'a');
  values.set('a', live('a', 'completed'));
  assert.equal((await follower.read(catalog(['b', 'a']), read))?.sessionId, 'b');
  values.set('b', live('b', 'completed', 'new'));
  stamp++;
  assert.equal((await follower.read(catalog(['a', 'b']), read))?.sessionId, 'b');
});
test('a candidate that finishes before the current turn does not take over', async () => {
  const follower = new LiveSessionFollower();
  const sessions = ['a', 'b'].map((id) => ({ id, title: id, updatedAt: Date.now() }));
  const values = new Map([
    ['a', live('a', 'collecting')],
    ['b', live('b', 'collecting')],
  ]);
  const read = async (id: string) => values.get(id)!;
  await follower.read(sessions, read);
  values.set('a', live('a', 'completed'));
  values.set('b', live('b', 'completed'));
  assert.equal((await follower.read(sessions, read))?.sessionId, 'a');
});

test('touching an old unfinished turn does not count as a newly started conversation', async () => {
  const follower = new LiveSessionFollower();
  const values = new Map([
    ['a', live('a', 'completed')],
    ['b', { ...live('b', 'unknown'), turnStartedAt: '2020-01-01T00:00:00Z' }],
  ]);
  let stamp = Date.now();
  const catalog = () => ['a', 'b'].map((id) => ({ id, title: id, updatedAt: stamp }));
  const read = async (id: string) => values.get(id)!;
  await follower.read(catalog(), read);
  stamp++;
  values.set('b', { ...values.get('b')!, status: 'collecting' });
  assert.equal((await follower.read(catalog(), read))?.sessionId, 'a');
  // A newly discovered old turn must not take over either.
  values.set('c', { ...live('c', 'collecting'), turnStartedAt: '2020-01-01T00:00:00Z' });
  assert.equal(
    (await follower.read([...catalog(), { id: 'c', title: 'c', updatedAt: ++stamp }], read))
      ?.sessionId,
    'a',
  );
});
