/**
 * 按本机自然日归集用量样本。未知计数保留为 null，避免把缺失数据当作零。
 */
import type { TokenCounts, UsageSample, DailyStats, HourlyUsage } from './types.js';

export function localDayRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // 按下一天的本地零点取边界，兼容夏令时造成的非 24 小时自然日。
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { start: start.getTime(), end: end.getTime(), date };
}

export class DailyAccumulator {
  private keys = new Set<string>();
  private turns = new Set<string>();
  private tokens: TokenCounts = { input: 0, cachedInput: 0, output: 0, reasoning: 0, total: 0 };
  private records = 0;
  private duplicates = 0;
  private hourly: HourlyUsage[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    total: 0,
    records: 0,
  }));
  readonly warnings = new Set<string>();
  constructor(readonly range: ReturnType<typeof localDayRange>) {}
  add(sample: UsageSample, source: string, index: number) {
    if (!sample.timestamp && this.range.start !== -Infinity) {
      this.warnings.add('部分用量没有有效时间，无法归入今天，未计入合计');
      return;
    }
    const time = sample.timestamp ? Date.parse(sample.timestamp) : 0;
    if (!Number.isFinite(time)) {
      this.warnings.add('部分用量时间无效，未计入统计');
      return;
    }
    if (time < this.range.start || time >= this.range.end) return;
    // 可靠事件可跨文件去重；旧格式只能在当前源内识别，不能误删相似用量。
    const key = sample.dedupable ? sample.key : `${source}:${index}`;
    if (this.keys.has(key)) {
      this.duplicates++;
      return;
    }
    this.keys.add(key);
    this.records++;
    if (sample.timestamp && Number.isFinite(time) && this.range.start !== -Infinity) {
      const bucket = this.hourly[new Date(time).getHours()];
      bucket.records++;
      bucket.total =
        bucket.total === null || sample.tokens.total === null
          ? null
          : bucket.total + sample.tokens.total;
    }
    this.turns.add(sample.dedupable ? sample.turnId : `${source}:${sample.turnId}`);
    if (!sample.dedupable) this.warnings.add('部分旧记录没有稳定轮次标识，跨文件去重可能不完整');
    if (!sample.complete) this.warnings.add('部分轮次统计不完整，合计仅包含已确认用量');
    for (const field of Object.keys(this.tokens) as (keyof TokenCounts)[])
      this.tokens[field] =
        this.tokens[field] === null || sample.tokens[field] === null
          ? null
          : this.tokens[field]! + sample.tokens[field]!;
  }
  result(scannedFiles: number, skippedFiles: number): DailyStats {
    if (skippedFiles) this.warnings.add(`${skippedFiles} 个文件未能完整读取，今日合计可能不完整`);
    return {
      date: this.range.date,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      tokens: { ...this.tokens },
      hourly:
        this.range.start === -Infinity ? undefined : this.hourly.map((bucket) => ({ ...bucket })),
      turnCount: this.turns.size,
      recordCount: this.records,
      duplicateRecords: this.duplicates,
      scannedFiles,
      skippedFiles,
      warnings: [...this.warnings],
      updatedAt: Date.now(),
    };
  }
}
