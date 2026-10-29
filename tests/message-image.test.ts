import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { messageContent } from '../electron/message-content.js';
import { readMessageImage } from '../electron/message-image.js';

test('attachment wrappers become clean user text and unique local image references', () => {
  const text =
    '# Files mentioned by the user:\n\n## 截图.png: /tmp/截图.png\nImage attachment: true\n\n## My request:\n检查图片\n<image name="one" path="/tmp/截图.png">\n[图片附件]\n</image>';
  assert.deepEqual(messageContent(text, true), { text: '检查图片', images: ['/tmp/截图.png'] });
  assert.deepEqual(messageContent('![图](/tmp/a.png)\nhello'), {
    text: 'hello',
    images: ['/tmp/a.png'],
  });
  assert.deepEqual(messageContent('<image path="https://example.com/a.png">[图片附件]</image>'), {
    text: '',
    images: [],
  });
  assert.deepEqual(messageContent('![secret](/tmp/secret.txt)').images, []);
  assert.equal(messageContent('## My request:\nquoted', false).text, '## My request:\nquoted');
});

test('image loading allows referenced raster images and rejects unrelated files or disguised text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-images-'));
  try {
    const path = join(root, 'image.png');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    );
    await writeFile(path, png);
    const reference = `<image path="${path}">[图片附件]</image>`;
    assert.equal(
      await readMessageImage(path, [reference]),
      `data:image/png;base64,${png.toString('base64')}`,
    );
    await assert.rejects(readMessageImage(path, []), /不属于/);
    await writeFile(path, 'not an image');
    await assert.rejects(readMessageImage(path, [reference]), /不支持/);
    await rm(path);
    await assert.rejects(readMessageImage(path, [reference]), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
