/**
 * 以统一异步迭代器读取普通或 Zstandard 压缩的 rollout 文件，并限制解压后大小。
 */
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { StringDecoder } from 'node:string_decoder';
import { createZstdDecompress } from 'node:zlib';

// Use one owned pipeline and explicitly close it when only the header is read.
export async function* rolloutLines(path: string, size?: number) {
  const source = createReadStream(path, size === undefined ? {} : { end: Math.max(0, size - 1) });
  const decompressor = path.endsWith('.zst') ? createZstdDecompress() : undefined;
  const input = decompressor ?? source;
  // Observe rejection immediately: early iterator return intentionally destroys the pipe.
  if (decompressor) void pipeline(source, decompressor).catch(() => undefined);
  const decoder = new StringDecoder('utf8');
  let bytes = 0,
    pending = '';
  try {
    for await (const chunk of input.iterator({ destroyOnReturn: false })) {
      bytes += chunk.length;
      if (bytes > 256 * 1024 * 1024) throw new Error('解压后的聊天记录超过 256 MB，暂不支持读取');
      pending += decoder.write(chunk);
      let start = 0,
        end: number;
      while ((end = pending.indexOf('\n', start)) !== -1) {
        yield pending.slice(start, end).replace(/\r$/, '');
        start = end + 1;
      }
      pending = pending.slice(start);
    }
    pending += decoder.end();
    if (pending) yield pending.replace(/\r$/, '');
  } finally {
    input.destroy();
    source.destroy();
  }
}
export async function rolloutHeader(path: string) {
  for await (const line of rolloutLines(path)) return line;
  return '';
}
