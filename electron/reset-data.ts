/**
 * 重置预测的外部数据边界：校验结构、日期和来源链接，并共享缓存与请求节流。
 */
export interface ResetForecast {
  probability24h: number | null;
  probability48h: number | null;
  confidence: string | null;
  lastResetAt: string | null;
  updatedAt: string | null;
  signal: { summary: string; url: string | null } | null;
}
export interface ResetEvent {
  id: string;
  at: string;
  group: string;
  announced: boolean;
  summary: string;
  url: string | null;
}
export interface ResetData {
  forecast: ResetForecast | null;
  events: ResetEvent[];
  forecastFetchedAt: number | null;
  timelineFetchedAt: number | null;
  forecastError: string | null;
  timelineError: string | null;
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const string = (value: unknown) => (typeof value === 'string' ? value : null);
const date = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
const percent = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
export function resetSourceUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      ['codex-reset.com', 'x.com', 'twitter.com'].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function parseForecast(value: unknown): ResetForecast {
  const data = object(value),
    probabilities = object(data.probabilities),
    signal = object(data.official_signal);
  if (!Object.keys(probabilities).length) throw new Error('预测数据格式异常');
  return {
    probability24h: percent(probabilities.rounded_24h),
    probability48h: percent(probabilities.rounded_48h),
    confidence: string(data.confidence),
    lastResetAt: date(data.last_reset_at),
    updatedAt: date(data.updated_at),
    signal:
      typeof signal.summary === 'string' && signal.summary.trim()
        ? { summary: signal.summary.slice(0, 2000), url: resetSourceUrl(signal.url) }
        : null,
  };
}
export function parseTimeline(value: unknown): ResetEvent[] {
  const data = object(value);
  if (!Array.isArray(data.events)) throw new Error('日历数据格式异常');
  const seen = new Set<string>();
  return data.events
    .flatMap((raw): ResetEvent[] => {
      const event = object(raw),
        at = date(event.announced_at),
        id = string(event.id),
        summary = string(event.summary),
        group = string(event.group);
      if (!at || !id || !summary || !group || seen.has(id)) return [];
      seen.add(id);
      return [
        {
          id,
          at,
          group,
          announced: group === 'reset' && event.announcement_state === 'announced',
          summary: summary.slice(0, 3000),
          url: resetSourceUrl(event.url),
        },
      ];
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** A single cache shared by all windows; failed endpoints retain their last good copy. */
export class ResetService {
  private data: ResetData = {
    forecast: null,
    events: [],
    forecastFetchedAt: null,
    timelineFetchedAt: null,
    forecastError: null,
    timelineError: null,
  };
  private nextAttempt = { forecast: 0, timeline: 0 };
  private active: Promise<ResetData> | null = null;
  constructor(
    private fetcher: typeof fetch,
    private now = Date.now,
  ) {}
  read(): Promise<ResetData> {
    if (this.active) return this.active;
    this.active = this.load().finally(() => {
      this.active = null;
    });
    return this.active;
  }
  private async load(): Promise<ResetData> {
    await Promise.all(
      (['forecast', 'timeline'] as const).map(async (endpoint) => {
        if (this.now() < this.nextAttempt[endpoint]) return;
        this.nextAttempt[endpoint] = this.now() + 60_000;
        try {
          const response = await this.fetcher(`https://codex-reset.com/api/${endpoint}`, {
            headers: {
              'User-Agent': 'CodexPulse/0.1.10 (+https://github.com/liuhui9/codex-pulse)',
            },
            signal: AbortSignal.timeout(15_000),
          });
          if (!response.ok) {
            if (response.status === 429) {
              const retry = response.headers.get('Retry-After');
              const delay =
                retry && /^\d+$/.test(retry)
                  ? Number(retry) * 1000
                  : retry
                    ? Date.parse(retry) - this.now()
                    : 60_000;
              if (Number.isFinite(delay))
                this.nextAttempt[endpoint] = this.now() + Math.max(60_000, delay);
            }
            throw new Error(`HTTP ${response.status}`);
          }
          const value: unknown = await response.json();
          if (endpoint === 'forecast') {
            this.data.forecast = parseForecast(value);
            this.data.forecastFetchedAt = this.now();
            this.data.forecastError = null;
          } else {
            this.data.events = parseTimeline(value);
            this.data.timelineFetchedAt = this.now();
            this.data.timelineError = null;
          }
        } catch {
          if (endpoint === 'forecast') this.data.forecastError = '预测暂不可用，请稍后刷新';
          else this.data.timelineError = '历史记录暂不可用，请稍后刷新';
        }
      }),
    );
    return { ...this.data, events: [...this.data.events] };
  }
}
