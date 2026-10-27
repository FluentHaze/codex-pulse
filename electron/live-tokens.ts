/**
 * 增量跟踪当前会话的完整 JSONL 行；文件替换或截断后重建解析状态。
 */
import { open } from 'node:fs/promises';
import { TokenParser } from './token-parser.js';
import { rolloutLines } from './rollout-reader.js';
import type { LiveTokens, LocalSession } from './types.js';

// Tail complete JSONL lines, retaining only counters and turn metadata.
export class LiveTokenReader {
  private path = '';
  private offset = 0;
  private birth = 0;
  private modified = 0;
  private pending = Buffer.alloc(0);
  private skipping = false;
  private parser = new TokenParser(false);
  async read(path: string, session: LocalSession): Promise<LiveTokens> {
    const file = await open(path, 'r');
    try {
      const info = await file.stat();
      if (info.size > 256 * 1024 * 1024) throw new Error('该记录超过 256 MB，暂不支持实时跟踪');
      if (path.endsWith('.zst')) {
        if (path !== this.path || info.mtimeMs !== this.modified || info.size !== this.offset) {
          const parser = new TokenParser(false);
          for await (const line of rolloutLines(path, info.size)) parser.push(line);
          this.parser = parser;
          this.path = path;
          this.offset = info.size;
          this.modified = info.mtimeMs;
          this.birth = info.birthtimeMs;
        }
        const turn = this.parser.turns.at(-1);
        return {
          sessionId: session.id,
          title: session.title,
          turnId: turn?.id ?? null,
          turnNumber: turn?.number ?? null,
          tokens: turn?.tokens ? { ...turn.tokens } : null,
          status: !turn ? 'waiting' : turn.status === 'running' ? 'unknown' : turn.status,
          complete: turn?.complete ?? false,
          updatedAt: Date.now(),
          error: null,
        };
      }
      if (
        path !== this.path ||
        info.birthtimeMs !== this.birth ||
        info.size < this.offset ||
        (info.size === this.offset && info.mtimeMs !== this.modified)
      ) {
        this.path = path;
        this.offset = 0;
        this.pending = Buffer.alloc(0);
        this.skipping = false;
        this.parser = new TokenParser(false);
        this.birth = info.birthtimeMs;
      }
      let budget = 8 * 1024 * 1024;
      while (this.offset < info.size && budget > 0) {
        const buffer = Buffer.alloc(Math.min(1024 * 1024, info.size - this.offset, budget));
        const { bytesRead } = await file.read(buffer, 0, buffer.length, this.offset);
        if (!bytesRead) break;
        this.offset += bytesRead;
        budget -= bytesRead;
        const data = Buffer.concat([this.pending, buffer.subarray(0, bytesRead)]);
        let start = 0;
        let end: number;
        while ((end = data.indexOf(10, start)) !== -1) {
          if (!this.skipping && end - start <= 2 * 1024 * 1024)
            this.parser.push(data.subarray(start, end).toString('utf8'));
          this.skipping = false;
          start = end + 1;
        }
        this.pending = data.subarray(start);
        if (this.pending.length > 2 * 1024 * 1024) {
          this.pending = Buffer.alloc(0);
          this.skipping = true;
        }
      }
      this.modified = info.mtimeMs;
      const turn = this.parser.turns.at(-1);
      const caughtUp = this.offset >= info.size;
      const status =
        !caughtUp || !turn
          ? 'waiting'
          : turn.status === 'running'
            ? Date.now() - info.mtimeMs > 120_000
              ? 'unknown'
              : 'collecting'
            : turn.status;
      return {
        sessionId: session.id,
        title: session.title,
        turnId: caughtUp ? (turn?.id ?? null) : null,
        turnNumber: caughtUp ? (turn?.number ?? null) : null,
        tokens: caughtUp ? (turn?.tokens ? { ...turn.tokens } : null) : null,
        status,
        complete: caughtUp && (turn?.complete ?? false),
        updatedAt: Date.now(),
        error: null,
      };
    } finally {
      await file.close();
    }
  }
}
