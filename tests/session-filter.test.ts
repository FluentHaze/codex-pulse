import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterSessions } from '../src/session-filter.js';

const now = new Date(2026, 9, 22, 12);
const sessions = [
  {
    id: 'one',
    title: '修复 Login 登录',
    project: 'D:/project/AAA',
    updatedAt: new Date(2026, 9, 22, 1).getTime(),
  },
  {
    id: 'two',
    title: '界面 [review]',
    project: 'D:/project/BBB',
    updatedAt: new Date(2026, 9, 16, 23).getTime(),
  },
  { id: 'three', title: '旧聊天', updatedAt: new Date(2026, 8, 1).getTime() },
];
test('title and project search is case-insensitive literal matching, combined with exact project selection', () => {
  assert.deepEqual(
    filterSessions(sessions, '  LOGIN ', '*', 'all', now).map((item) => item.id),
    ['one'],
  );
  assert.equal(filterSessions(sessions, '[review]', '*', 'all', now)[0].id, 'two');
  assert.equal(filterSessions(sessions, 'aaa', 'D:/project/BBB', 'all', now).length, 0);
  assert.equal(filterSessions(sessions, '', '', 'all', now)[0].id, 'three');
});
test('date filtering uses local calendar days and keeps source order unchanged', () => {
  assert.deepEqual(
    filterSessions(sessions, '', '*', 'today', now).map((item) => item.id),
    ['one'],
  );
  assert.deepEqual(
    filterSessions(sessions, '', '*', '7d', now).map((item) => item.id),
    ['one', 'two'],
  );
  assert.equal(filterSessions(sessions, '', '*', '30d', now).length, 2);
  assert.equal(sessions.length, 3);
});
