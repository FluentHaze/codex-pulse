import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarDataUrl } from '../src/avatar';

const svg = (account: string) => decodeURIComponent(avatarDataUrl(account).split(',')[1]);

test('avatar uses the first email character without including the address', () => {
  const image = svg('ff***@163.com');
  assert.match(image, />F<\/text>/);
  assert.ok(!image.includes('@163.com'));
  assert.equal(avatarDataUrl('ff***@163.com'), avatarDataUrl('ff***@163.com'));
});

test('avatar preserves Unicode graphemes, handles empty labels and escapes SVG text', () => {
  assert.match(svg('  张三'), />张<\/text>/);
  assert.match(svg('👩‍💻user'), />👩‍💻<\/text>/);
  assert.match(svg('   '), />\?<\/text>/);
  assert.match(svg('<script>'), />&lt;<\/text>/);
  assert.match(svg('&test'), />&amp;<\/text>/);
});
