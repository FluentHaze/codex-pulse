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
  localizedSummary: string | null;
  url: string | null;
}
export interface ResetData {
  locale: ResetLocale;
  forecast: ResetForecast | null;
  events: ResetEvent[];
  forecastFetchedAt: number | null;
  timelineFetchedAt: number | null;
  forecastError: string | null;
  timelineError: string | null;
  feed: ResetFeed | null;
  status: ResetStatus | null;
  feedFetchedAt: number | null;
  statusFetchedAt: number | null;
  feedError: string | null;
  statusError: string | null;
}
export type ResetLocale = 'en' | 'zh' | 'ja';
export function resetLocale(language: unknown): ResetLocale {
  return language === 'zh-CN' || language === 'zh' ? 'zh' : language === 'ja' ? 'ja' : 'en';
}
export interface ResetPost {
  id: string;
  at: string;
  text: string;
  localizedText: string | null;
  url: string | null;
  category: 'reset' | 'signal' | 'banked' | 'other';
}
export interface ResetFeed {
  posts: ResetPost[];
  fetchedAt: string | null;
  stale: boolean;
}
export interface ResetStatus {
  state: 'operational' | 'degraded' | 'unknown';
  surfaces: { id: string; label: string; status: string }[];
  incidents: { id: string; name: string; at: string; resolved: boolean; url: string | null }[];
  checkedAt: string | null;
  stale: boolean;
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
      ['codex-reset.com', 'x.com', 'twitter.com', 'status.openai.com'].includes(url.hostname)
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
export function parseTimeline(value: unknown, locale: ResetLocale = 'en'): ResetEvent[] {
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
          localizedSummary:
            locale !== 'en' && data.locale === locale
              ? string(event.localized_summary)?.trim().slice(0, 3000) || null
              : null,
          url: resetSourceUrl(event.url),
        },
      ];
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function parseFeed(value: unknown, locale: ResetLocale = 'en'): ResetFeed {
  const data = object(value);
  if (!Array.isArray(data.tweets)) throw new Error('Invalid feed');
  const events = Array.isArray(data.events) ? parseTimeline(data, locale) : [];
  const seen = new Set<string>();
  const posts = data.tweets.flatMap((raw): ResetPost[] => {
    const row = object(raw),
      id = string(row.id),
      at = date(row.at),
      text = string(row.text);
    if (!id || !at || !text?.trim() || seen.has(id)) return [];
    seen.add(id);
    const event = events.find((item) => item.id === id);
    return [
      {
        id,
        at,
        text: text.slice(0, 6000),
        url: resetSourceUrl(row.url),
        localizedText:
          locale !== 'en' && data.locale === locale && row.translation_status === 'translated'
            ? string(row.localized_text)?.trim().slice(0, 6000) || null
            : null,
        category:
          event?.group === 'credits' || typeof row.banked_state === 'string'
            ? 'banked'
            : event?.announced
              ? 'reset'
              : event?.group === 'reset' || row.explicit_reset_claim === true
                ? 'signal'
                : 'other',
      },
    ];
  });
  // Observed grants and separate banked events do not always have a tweet row.
  for (const event of events) {
    if (seen.has(event.id)) continue;
    posts.push({
      id: event.id,
      at: event.at,
      text: event.summary,
      localizedText: event.localizedSummary,
      url: event.url,
      category:
        event.group === 'credits'
          ? 'banked'
          : event.announced
            ? 'reset'
            : event.group === 'reset'
              ? 'signal'
              : 'other',
    });
  }
  return {
    posts: posts.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 50),
    fetchedAt: date(data.fetched_at),
    stale: data.stale !== false,
  };
}

export function parseStatus(value: unknown): ResetStatus {
  const data = object(value),
    current = object(data.current);
  if (!Object.keys(current).length) throw new Error('Invalid status');
  const rows = Array.isArray(data.surfaces) ? data.surfaces : current.surfaces;
  const surfaces = (Array.isArray(rows) ? rows : []).flatMap((raw) => {
    const row = object(raw),
      id = string(row.id),
      label = string(row.label),
      status = string(row.status);
    return id && label && status
      ? [{ id: id.slice(0, 100), label: label.slice(0, 100), status }]
      : [];
  });
  const state =
    current.degraded === true ||
    surfaces.some((item) =>
      ['degraded_performance', 'partial_outage', 'major_outage', 'under_maintenance'].includes(
        item.status,
      ),
    )
      ? 'degraded'
      : current.degraded === false &&
          surfaces.length > 0 &&
          surfaces.every((item) => item.status === 'operational')
        ? 'operational'
        : 'unknown';
  const incidents = (Array.isArray(data.incidents) ? data.incidents : [])
    .flatMap((raw) => {
      const row = object(raw),
        id = string(row.id),
        name = string(row.name),
        at = date(row.started_at);
      return id && name && at
        ? [
            {
              id,
              name: name.slice(0, 1000),
              at,
              resolved: row.status === 'resolved',
              url: resetSourceUrl(row.source_url),
            },
          ]
        : [];
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 5);
  return {
    state,
    surfaces,
    incidents,
    checkedAt: date(data.checked_at),
    stale: data.stale !== false,
  };
}

/** Shared per-resource cache: language switches never reuse another language's text. */
export class ResetService {
  private cache = new Map<
    string,
    {
      value: unknown;
      fetchedAt: number | null;
      error: string | null;
      next: number;
      active?: Promise<void>;
    }
  >();
  constructor(
    private fetcher: typeof fetch,
    private now = Date.now,
  ) {}
  async read(language: unknown = 'en'): Promise<ResetData> {
    const locale = resetLocale(language);
    const resources = [
      { path: 'forecast', parse: parseForecast, error: '预测暂不可用，请稍后刷新' },
      {
        path: locale === 'en' ? 'timeline' : `timeline?locale=${locale}`,
        parse: (value: unknown) => parseTimeline(value, locale),
        error: '历史记录暂不可用，请稍后刷新',
      },
      {
        path: locale === 'en' ? 'feed' : `feed?locale=${locale}`,
        parse: (value: unknown) => parseFeed(value, locale),
        error: '公告暂不可用，请稍后刷新',
      },
    ];
    await Promise.all(resources.map((resource) => this.load(resource)));
    const [forecast, timeline, feed] = resources.map((resource) => this.cache.get(resource.path)!);
    return {
      locale,
      forecast: forecast.value as ResetForecast | null,
      events: (timeline.value as ResetEvent[] | null) ?? [],
      feed: feed.value as ResetFeed | null,
      status: null,
      forecastFetchedAt: forecast.fetchedAt,
      timelineFetchedAt: timeline.fetchedAt,
      feedFetchedAt: feed.fetchedAt,
      statusFetchedAt: null,
      forecastError: forecast.error,
      timelineError: timeline.error,
      feedError: feed.error,
      statusError: null,
    };
  }
  private async load(resource: {
    path: string;
    parse: (value: unknown) => unknown;
    error: string;
  }): Promise<void> {
    let entry = this.cache.get(resource.path);
    if (!entry) {
      entry = { value: null, fetchedAt: null, error: null, next: 0 };
      this.cache.set(resource.path, entry);
    }
    if (entry.active) return entry.active;
    if (this.now() < entry.next) return;
    const cached = entry;
    cached.next = this.now() + 60_000;
    cached.active = (async () => {
      try {
        const response = await this.fetcher(`https://codex-reset.com/api/${resource.path}`, {
          headers: { 'User-Agent': 'CodexPulse (+https://github.com/FluentHaze/codex-pulse)' },
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
            if (Number.isFinite(delay)) cached.next = this.now() + Math.max(60_000, delay);
          }
          throw new Error(`HTTP ${response.status}`);
        }
        cached.value = resource.parse(await response.json());
        cached.fetchedAt = this.now();
        cached.error = null;
      } catch {
        cached.error = resource.error;
      }
    })().finally(() => {
      cached.active = undefined;
    });
    return cached.active;
  }
}
