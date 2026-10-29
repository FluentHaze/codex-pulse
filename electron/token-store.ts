/**
 * 会话索引与读取缓存：将公开会话标识映射到本地文件，避免渲染进程传入任意路径。
 * 目录列表、正文和用量缓存分别管理；统计时仍扫描全部候选文件。
 */
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join, basename, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { TokenParser } from './token-parser.js';
import { rolloutLines, rolloutHeader } from './rollout-reader.js';
import { LiveTokenReader } from './live-tokens.js';
import { DailyAccumulator, localDayRange } from './daily-usage.js';
import { readProjectCatalog } from './project-catalog.js';
import type { TokenCatalog, TokenSession, UsageSample, DailyStats } from './types.js';

const MAX_FILE_SIZE = 256 * 1024 * 1024;
export function isInternalSession(meta: { source?: unknown; thread_source?: unknown }) {
  return (
    meta.thread_source === 'guardian_review' ||
    meta.source === 'subagent' ||
    !!(
      meta.source &&
      typeof meta.source === 'object' &&
      !Array.isArray(meta.source) &&
      'subagent' in meta.source
    )
  );
}
export class TokenStore {
  private catalog?: TokenCatalog;
  private catalogTime = 0;
  private files = new Map<string, string>();
  private cache = new Map<string, { stamp: string; data: TokenSession }>();
  private pendingCatalog?: Promise<TokenCatalog>;
  private pending = new Map<string, Promise<TokenSession>>();
  private liveReaders = new Map<string, LiveTokenReader>();
  private metadata = new Map<
    string,
    { birth: number; sessionId: string; fallback: string; internal: boolean; project: string }
  >();
  private candidates: { path: string; modified: number; birth: number; size: number }[] = [];
  private dailyCache?: { root: string; date: string; result: DailyStats };
  private dailyPending?: Promise<DailyStats>;
  private dailyPendingRoot = '';
  private usageCache = new Map<
    string,
    { stamp: string; samples: UsageSample[]; warnings: string[] }
  >();
  private scopeCache = new Map<
    string,
    { stamp: string; samples: UsageSample[]; warnings: string[] }
  >();
  private titleCache?: { path: string; stamp: string; values: Map<string, string> };
  constructor(private customPath: () => string) {}
  private root() {
    return resolve(
      this.customPath() || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'sessions'),
    );
  }
  list(force = false): Promise<TokenCatalog> {
    if (this.pendingCatalog) return this.pendingCatalog;
    if (!force && this.catalog?.root === this.root() && Date.now() - this.catalogTime < 30_000)
      return Promise.resolve(this.catalog);
    this.pendingCatalog = this.scan().finally(() => {
      this.pendingCatalog = undefined;
    });
    return this.pendingCatalog;
  }
  private async scan(): Promise<TokenCatalog> {
    const root = this.root();
    const projectCatalog = await readProjectCatalog(
      join(dirname(root), '.codex-global-state.json'),
    );
    const projectFields = (sessionId: string, cwd: string) => {
      const project = projectCatalog.match(sessionId, cwd);
      return { project: project ? `project:${project.id}` : cwd, projectName: project?.name, cwd };
    };
    const paths: { path: string; modified: number; birth: number; size: number }[] = [];
    let skipped = false;
    const walk = async (directory: string, depth: number) => {
      if (depth > 4) return;
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (directory === root) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
          throw new Error('无法读取会话目录，请检查目录权限');
        }
        skipped = true;
        return;
      }
      for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await walk(path, depth + 1);
        else if (
          entry.isFile() &&
          entry.name.startsWith('rollout-') &&
          (entry.name.endsWith('.jsonl') || entry.name.endsWith('.jsonl.zst'))
        ) {
          try {
            const info = await stat(path);
            paths.push({ path, modified: info.mtimeMs, birth: info.birthtimeMs, size: info.size });
          } catch {
            skipped = true;
          }
        }
      }
    };
    await walk(root, 0);
    // 同一份 rollout 同时存在压缩与原文件时只保留原文件，避免重复列出和统计。
    const rawPaths = new Set(
      paths.filter((item) => !item.path.endsWith('.zst')).map((item) => item.path),
    );
    for (let index = paths.length - 1; index >= 0; index--)
      if (paths[index].path.endsWith('.zst') && rawPaths.has(paths[index].path.slice(0, -4)))
        paths.splice(index, 1);
    paths.sort((a, b) => b.modified - a.modified);
    let titles = new Map<string, string>();
    try {
      const index = join(dirname(root), 'session_index.jsonl');
      const indexInfo = await stat(index);
      const stamp = `${indexInfo.mtimeMs}:${indexInfo.size}`;
      if (this.titleCache?.path === index && this.titleCache.stamp === stamp)
        titles = this.titleCache.values;
      else if (indexInfo.size < 16 * 1024 * 1024) {
        const lines = createInterface({ input: createReadStream(index), crlfDelay: Infinity });
        for await (const line of lines) {
          try {
            const value: unknown = JSON.parse(line);
            if (
              value &&
              typeof value === 'object' &&
              'id' in value &&
              'thread_name' in value &&
              typeof value.id === 'string' &&
              typeof value.thread_name === 'string'
            )
              titles.set(value.id, value.thread_name.slice(0, 160));
          } catch {
            /* Ignore incomplete index entries. */
          }
        }
        this.titleCache = { path: index, stamp, values: titles };
      }
    } catch {
      /* Titles are optional. */
    }
    const files = new Map<string, string>();
    const sessions = [];
    for (const candidate of paths) {
      const id = createHash('sha256')
        .update(candidate.path.replace(/\.zst$/, ''))
        .digest('hex')
        .slice(0, 24);
      let title = `Codex ${basename(candidate.path).slice(-18, -6)}`;
      const metadata = this.metadata.get(candidate.path);
      if (metadata?.birth === candidate.birth) {
        if (metadata.internal) continue;
        title = titles.get(metadata.sessionId) || metadata.fallback;
        files.set(id, candidate.path);
        sessions.push({
          id,
          title,
          updatedAt: candidate.modified,
          ...projectFields(metadata.sessionId, metadata.project),
        });
        continue;
      }
      let internal = false;
      let project = '';
      try {
        const firstLine = await rolloutHeader(candidate.path);
        const meta = JSON.parse(firstLine) as {
          type?: string;
          payload?: { id?: string; cwd?: string; source?: unknown; thread_source?: unknown };
        };
        if (meta.type === 'session_meta') {
          const sessionId = meta.payload?.id ?? '';
          project = typeof meta.payload?.cwd === 'string' ? meta.payload.cwd : '';
          const fallback = `${basename(project) || 'Codex'} · ${meta.payload?.id?.slice(-6) ?? id.slice(-6)}`;
          title = titles.get(sessionId) || fallback;
          internal = isInternalSession(meta.payload ?? {});
          this.metadata.set(candidate.path, {
            birth: candidate.birth,
            sessionId,
            fallback,
            internal,
            project,
          });
        }
      } catch {
        skipped = true;
      }
      if (internal) continue;
      files.set(id, candidate.path);
      sessions.push({
        id,
        title,
        updatedAt: candidate.modified,
        ...projectFields(this.metadata.get(candidate.path)?.sessionId ?? '', project),
      });
    }
    if (root !== this.root()) return this.scan();
    this.files = files;
    this.candidates = paths;
    this.catalog = {
      root,
      sessions,
      limited: skipped,
      projects: projectCatalog.projects.map((project) => ({
        id: `project:${project.id}`,
        name: project.name,
      })),
    };
    this.catalogTime = Date.now();
    for (const id of this.cache.keys()) if (!files.has(id)) this.cache.delete(id);
    const existingPaths = new Set(paths.map((item) => item.path));
    for (const path of this.liveReaders.keys())
      if (!existingPaths.has(path)) this.liveReaders.delete(path);
    for (const path of this.metadata.keys())
      if (!existingPaths.has(path)) this.metadata.delete(path);
    for (const path of this.scopeCache.keys())
      if (!existingPaths.has(path)) this.scopeCache.delete(path);
    return this.catalog;
  }
  read(id: string): Promise<TokenSession> {
    const running = this.pending.get(id);
    if (running) return running;
    const work = this.load(id).finally(() => this.pending.delete(id));
    this.pending.set(id, work);
    return work;
  }
  async scopeUsage(ids: string[]): Promise<DailyStats> {
    const root = this.root();
    await this.list();
    const accumulator = new DailyAccumulator({ start: -Infinity, end: Infinity, date: '全部历史' });
    let scanned = 0,
      skipped = 0;
    const selectedIds = [...new Set(ids)];
    const cachePaths = new Set(selectedIds.slice(0, 128).map((id) => this.files.get(id)));
    for (const id of selectedIds) {
      if (root !== this.root()) throw new Error('会话目录已切换，请刷新统计');
      const path = this.files.get(id);
      if (!path) throw new Error('聊天记录已变更，请刷新列表');
      try {
        const info = await stat(path);
        if (info.size > MAX_FILE_SIZE) {
          skipped++;
          continue;
        }
        const stamp = `${info.birthtimeMs}:${info.mtimeMs}:${info.size}`;
        let cached = this.scopeCache.get(path);
        if (!cached || cached.stamp !== stamp) {
          const samples: UsageSample[] = [];
          const parser = new TokenParser(false, (sample) => samples.push(sample));
          for await (const line of rolloutLines(path, info.size)) parser.push(line);
          cached = { stamp, samples, warnings: [...parser.warnings] };
          if (cachePaths.has(path)) {
            if (this.scopeCache.size >= 128)
              this.scopeCache.delete(this.scopeCache.keys().next().value!);
            this.scopeCache.set(path, cached);
          }
        }
        cached.samples.forEach((sample, index) => accumulator.add(sample, path, index));
        if (cached.warnings.length) accumulator.warnings.add('部分记录不完整，合计可能存在遗漏');
        scanned++;
      } catch {
        skipped++;
      }
    }
    if (root !== this.root()) throw new Error('会话目录已切换，请刷新统计');
    return accumulator.result(scanned, skipped);
  }
  async live(id: string) {
    const catalog = await this.list();
    const session = catalog.sessions.find((item) => item.id === id);
    const path = this.files.get(id);
    if (!session || !path)
      throw new Error('跟踪的聊天未找到或属于内部子会话，请重新选择聊天或恢复自动跟随');
    let reader = this.liveReaders.get(path);
    if (!reader) {
      reader = new LiveTokenReader();
      this.liveReaders.set(path, reader);
    }
    return reader.read(path, session);
  }
  today(force = false): Promise<DailyStats> {
    if (this.dailyPending)
      return this.dailyPendingRoot === this.root()
        ? this.dailyPending
        : this.dailyPending.catch(() => undefined).then(() => this.today(force));
    const range = localDayRange();
    if (
      !force &&
      this.dailyCache?.root === this.root() &&
      this.dailyCache.date === range.date &&
      Date.now() - this.dailyCache.result.updatedAt < 15000
    )
      return Promise.resolve(this.dailyCache.result);
    this.dailyPendingRoot = this.root();
    this.dailyPending = this.summarizeToday().finally(() => {
      this.dailyPending = undefined;
    });
    return this.dailyPending;
  }
  // 今日统计不依赖列表当前筛选；按全部候选记录聚合，再以事件时间归入自然日。
  private async summarizeToday(): Promise<DailyStats> {
    const root = this.root();
    const range = localDayRange();
    const previousDate = new Date(range.start);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousRange = localDayRange(previousDate);
    const previous = new DailyAccumulator(previousRange);
    const catalog = await this.list(true);
    if (catalog.root !== root) throw new Error('会话目录已切换，请刷新统计');
    const accumulator = new DailyAccumulator(range);
    const candidates = this.candidates.filter((item) => item.modified >= previousRange.start);
    let scanned = 0,
      skipped = 0;
    const cachePaths = new Set(candidates.slice(0, 128).map((item) => item.path));
    for (const candidate of candidates) {
      if (root !== this.root()) throw new Error('会话目录已切换，请刷新统计');
      try {
        let metadata = this.metadata.get(candidate.path);
        if (!metadata || metadata.birth !== candidate.birth) {
          const first = JSON.parse(await rolloutHeader(candidate.path)) as {
            type?: string;
            payload?: { source?: unknown; thread_source?: unknown };
          };
          if (first.type === 'session_meta' && isInternalSession(first.payload ?? {})) continue;
        } else if (metadata.internal) continue;
        if (candidate.size > MAX_FILE_SIZE) {
          skipped++;
          continue;
        }
        const stamp = `${range.date}:${candidate.birth}:${candidate.modified}:${candidate.size}`;
        let usage = this.usageCache.get(candidate.path);
        if (!usage || usage.stamp !== stamp) {
          const samples: UsageSample[] = [];
          const parser = new TokenParser(false, (sample) => {
            if (
              !sample.timestamp ||
              (Date.parse(sample.timestamp) >= previousRange.start &&
                Date.parse(sample.timestamp) < range.end)
            )
              samples.push(sample);
          });
          for await (const line of rolloutLines(candidate.path, candidate.size)) parser.push(line);
          usage = { stamp, samples, warnings: [...parser.warnings] };
          if (cachePaths.has(candidate.path)) this.usageCache.set(candidate.path, usage);
        }
        usage.samples.forEach((sample, index) => {
          accumulator.add(sample, candidate.path, index);
          previous.add(sample, candidate.path, index);
        });
        if (usage.warnings.length) {
          accumulator.warnings.add('部分文件存在缺失或损坏事件，今日合计可能不完整');
          previous.warnings.add('部分文件存在缺失或损坏事件，统计可能不完整');
        }
        scanned++;
      } catch {
        skipped++;
      }
    }
    for (const path of this.usageCache.keys())
      if (!cachePaths.has(path)) this.usageCache.delete(path);
    if (root !== this.root() || range.date !== localDayRange().date)
      throw new Error('日期或会话目录已变化，请刷新统计');
    const result = accumulator.result(scanned, skipped);
    result.yesterday = previous.result(scanned, skipped);
    if (catalog.limited) {
      result.warnings.push('无法访问的本地文件可能造成统计遗漏');
      result.yesterday.warnings.push('无法访问的本地文件可能造成统计遗漏');
    }
    this.dailyCache = { root, date: range.date, result };
    return result;
  }
  private async load(id: string): Promise<TokenSession> {
    await this.list();
    const path = this.files.get(id);
    if (!path) throw new Error('聊天记录已变更，请刷新聊天列表');
    const root = this.root();
    const info = await stat(path).catch(() => {
      throw new Error('无法读取聊天记录，请刷新列表或检查权限');
    });
    if (info.size > MAX_FILE_SIZE) throw new Error('该聊天记录超过 256 MB，暂不支持读取');
    const stamp = `${info.mtimeMs}:${info.size}`;
    const cached = this.cache.get(id);
    if (cached?.stamp === stamp) return { ...cached.data, updatedAt: Date.now() };
    const parser = new TokenParser();
    try {
      for await (const line of rolloutLines(path, info.size)) parser.push(line);
    } catch {
      throw new Error('聊天记录读取失败，请稍后重试');
    }
    if (root !== this.root()) throw new Error('会话目录已切换，请重新选择聊天');
    const data: TokenSession = { id, ...parser.finish(), updatedAt: Date.now() };
    // Keep only a handful of parsed conversations in memory. Never persist their contents.
    if (this.cache.size >= 8) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(id, { stamp, data });
    return data;
  }
}
