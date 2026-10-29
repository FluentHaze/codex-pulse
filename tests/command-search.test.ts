import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCommands } from '../src/command-search';

const commands = [
  { id: 'github', label: 'GitHub', hint: '快速操作', keywords: ['star', '仓库', '开源'] },
  { id: 'interval', label: '刷新周期', hint: '偏好设置', keywords: ['自动刷新', '分钟'] },
  { id: 'click-through', label: '鼠标穿透', hint: '偏好设置', keywords: ['悬浮窗'] },
];

test('command search supports labels, aliases, IDs, case and full-width input', () => {
  for (const query of ['star', 'ＳＴＡＲ', 'GitHub', '开源', '仓库']) {
    assert.deepEqual(searchCommands(commands, query), [commands[0]]);
  }
  assert.deepEqual(searchCommands(commands, '自动刷新'), [commands[1]]);
  assert.deepEqual(searchCommands(commands, 'click-through'), [commands[2]]);
});

test('multiple search terms may match separate fields and preserve command order', () => {
  assert.deepEqual(searchCommands(commands, '  悬浮窗   穿透  '), [commands[2]]);
  assert.deepEqual(searchCommands(commands, '偏好 分钟'), [commands[1]]);
  assert.deepEqual(searchCommands(commands, 'github 分钟'), []);
  assert.deepEqual(searchCommands(commands, '   '), commands);
});
