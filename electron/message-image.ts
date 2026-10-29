import { open } from 'node:fs/promises';
import { messageContent } from './message-content.js';

/** Allow only images explicitly referenced in the requested conversation. */
export async function readMessageImage(path: string, texts: string[]) {
  if (!texts.some((text) => messageContent(text, true).images.includes(path)))
    throw new Error('图片不属于当前聊天');
  const file = await open(path, 'r');
  try {
    const limit = 12 * 1024 * 1024;
    const info = await file.stat();
    if (!info.isFile() || info.size > limit) throw new Error('图片超过 12 MB 或无法读取');
    const buffer = Buffer.alloc(info.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    const data = buffer.subarray(0, offset);
    const mime = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? 'image/png'
      : data[0] === 255 && data[1] === 216 && data[2] === 255
        ? 'image/jpeg'
        : /^GIF8[79]a/.test(data.toString('ascii', 0, 6))
          ? 'image/gif'
          : data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP'
            ? 'image/webp'
            : data.toString('ascii', 0, 2) === 'BM'
              ? 'image/bmp'
              : null;
    if (!mime) throw new Error('不支持的图片格式');
    return `data:${mime};base64,${data.toString('base64')}`;
  } finally {
    await file.close();
  }
}
