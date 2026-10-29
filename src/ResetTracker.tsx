/**
 * 展示外部重置预测和公告日历；请求失败时保留旧数据并显式标注过期状态。
 */
import { useLanguage } from './use-language';
import { t, getLanguage } from '../electron/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResetData } from '../electron/reset-data';
import { AnnouncementText, SourceCredit, ResetInsights, PersonalReset } from './ResetPanels';
import type { Bucket, Settings } from '../electron/types';
import { quotaWindows } from '../electron/types';
import { duration } from './Quota';
import { dayKey, eventsByDay, monthDays } from './reset-calendar';
import './reset.css';
function stamp(value: string | number | null) {
  return value === null
    ? t('暂无记录')
    : new Date(value).toLocaleString(getLanguage(), {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
}
function since(value: string | null, now: number) {
  if (!value) return t('等待记录');
  const hours = Math.max(0, (now - Date.parse(value)) / 3600000);
  return hours < 1
    ? t('不到 1 小时')
    : hours < 48
      ? t('{0} 小时', [Math.floor(hours)])
      : t('{0} 天 {1} 小时', [Math.floor(hours / 24), Math.floor(hours % 24)]);
}
export function ResetTracker({
  now,
  buckets,
  settings,
  onSettings,
}: {
  now: number;
  buckets: Bucket[];
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
}) {
  const language = useLanguage();
  const [data, setData] = useState<ResetData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const [filter, setFilter] = useState<'all' | 'reset'>('all');
  const [tab, setTab] = useState<'calendar' | 'feed' | 'rhythm'>('calendar');
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    try {
      if (!window.pulse) throw new Error('No bridge');
      const next = await window.pulse.resetData();
      if (id === request.current) {
        setData(next);
        setError('');
      }
    } catch {
      if (id === request.current) setError('无法连接预测服务，请稍后重试');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [language]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 300000);
    return () => {
      request.current++;
      clearInterval(timer);
    };
  }, [load]);
  const open = (url: string) => {
    void window.pulse?.resetSource(url).catch(() => {
      setError('无法打开来源链接，请重试');
    });
  };
  const forecast = data?.forecast;
  const forecastOld =
    !!forecast &&
    (!!data?.forecastError ||
      data.forecastFetchedAt === null ||
      now - data.forecastFetchedAt > 600000 ||
      !forecast.updatedAt ||
      now - Date.parse(forecast.updatedAt) > 600000);
  const timelineOld =
    !!data?.timelineFetchedAt && (!!data.timelineError || now - data.timelineFetchedAt > 600000);
  const history = data?.events ?? [],
    visible = history.filter((event) => filter === 'all' || event.announced);
  const days = eventsByDay(visible),
    selectedEvents = days.get(selected) ?? [];
  const personal = buckets.flatMap((bucket) =>
    quotaWindows(bucket).flatMap((window) =>
      window.resetsAt && window.resetsAt * 1000 > now
        ? [
            {
              at: window.resetsAt * 1000,
              label: t('{0} {1}窗口', [bucket.limitName ?? bucket.limitId, duration(window)]),
            },
          ]
        : [],
    ),
  );
  const selectedPersonal = personal.filter((event) => dayKey(new Date(event.at)) === selected);
  const confirmedDays = new Set(
    history
      .filter(
        (event) =>
          event.announced &&
          new Date(event.at).getFullYear() === month.getFullYear() &&
          new Date(event.at).getMonth() === month.getMonth(),
      )
      .map((event) => dayKey(new Date(event.at))),
  ).size;
  const move = (amount: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    setMonth(next);
    setSelected(dayKey(next));
  };
  const today = () => {
    const date = new Date(now);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelected(dayKey(date));
  };
  const tabs = [
    { id: 'calendar', label: t('重置日历') },
    { id: 'feed', label: t('公告动态') },
    { id: 'rhythm', label: t('历史重置节奏') },
  ] as const;
  return (
    <div className="reset-tracker">
      <div className="reset-overview">
        <section className="forecast-panel" aria-labelledby="forecast-heading" aria-busy={loading}>
          <div className="reset-section-heading">
            <h2 id="forecast-heading">{t('全球重置预测')}</h2>
            <button disabled={loading} onClick={() => void load()}>
              {loading ? t('同步中…') : t('刷新预测')}
            </button>
          </div>
          <div className="forecast-metrics">
            <div className="forecast-last">
              <span>{t('距最近一次全局重置')}</span>
              <strong>{since(forecast?.lastResetAt ?? null, now)}</strong>
              <small>{stamp(forecast?.lastResetAt ?? null)}</small>
            </div>
            {(
              [
                [t('未来 24 小时'), forecast?.probability24h],
                [t('未来 48 小时'), forecast?.probability48h],
              ] as const
            ).map(([label, probability]) => (
              <div
                className={`forecast-odds ${(probability ?? 0) >= 70 ? 'high' : (probability ?? 0) >= 40 ? 'medium' : 'low'}`}
                key={label}
              >
                <span>{label}</span>
                <strong>
                  {probability == null ? '—' : probability}
                  <small>{probability == null ? '' : '%'}</small>
                </strong>
                <div className="forecast-meter" aria-hidden="true">
                  <i style={{ width: `${probability ?? 0}%` }} />
                </div>
              </div>
            ))}
            <PersonalReset
              variant="summary"
              now={now}
              buckets={buckets}
              settings={settings}
              onSettings={onSettings}
            />
          </div>
          <div className="forecast-footnote">
            <span>
              {t('实验性预测 · 置信度：')}
              {({ low: t('低'), medium: t('中'), high: t('高') } as Record<string, string>)[
                forecast?.confidence ?? ''
              ] ?? t('未知')}
              {t('{0} · 不代表重置承诺', [forecastOld ? t(' · 数据可能过期') : ''])}
            </span>
            {!forecast?.signal && (
              <span>{forecastOld || !forecast ? t('公告信号待同步') : t('暂无新公告信号')}</span>
            )}
          </div>
          {forecast?.signal && (
            <details className="reset-signal">
              <summary>{t('公告信号{0}', [forecastOld ? t(' · 数据可能过期') : ''])}</summary>
              <AnnouncementText original={forecast.signal.summary} translated={null} locale="en" />
              {forecast.signal.url && (
                <button onClick={() => open(forecast.signal!.url!)}>{t('查看公告原文 ↗')}</button>
              )}
            </details>
          )}
        </section>
      </div>
      {(error || data?.forecastError) && (
        <p className="reset-error" role="status">
          {t(error || data?.forecastError || '')}
          {forecastOld ? t(' · 保留上次数据供参考') : ''}
        </p>
      )}
      <section className="reset-workspace">
        <div className="reset-workspace-heading">
          <div className="reset-tabs" role="tablist" aria-label={t('重置记录视图')}>
            {tabs.map((item, index) => (
              <button
                key={item.id}
                id={`reset-tab-${item.id}`}
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`reset-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'ArrowRight'
                      ? (index + 1) % tabs.length
                      : event.key === 'ArrowLeft'
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? tabs.length - 1
                            : null;
                  if (next === null) return;
                  event.preventDefault();
                  setTab(tabs[next].id);
                  document.getElementById(`reset-tab-${tabs[next].id}`)?.focus();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <PersonalReset
            variant="actions"
            now={now}
            buckets={buckets}
            settings={settings}
            onSettings={onSettings}
          />
        </div>
        <section
          className="reset-calendar reset-tab-panel"
          role="tabpanel"
          id="reset-panel-calendar"
          aria-labelledby="reset-tab-calendar"
          hidden={tab !== 'calendar'}
          tabIndex={0}
        >
          <div className="calendar-toolbar">
            <div className="month-navigation">
              <button aria-label={t('上个月')} onClick={() => move(-1)}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="m12 5-5 5 5 5" />
                </svg>
              </button>
              <h3>{t('{0} 年 {1} 月', [month.getFullYear(), month.getMonth() + 1])}</h3>
              <button aria-label={t('下个月')} onClick={() => move(1)}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="m8 5 5 5-5 5" />
                </svg>
              </button>
              <button onClick={today}>{t('今天')}</button>
            </div>
            <div className="segmented" aria-label={t('日历记录筛选')}>
              <button
                aria-pressed={filter === 'all'}
                className={filter === 'all' ? 'active' : ''}
                onClick={() => setFilter('all')}
              >
                {t('全部记录')}
              </button>
              <button
                aria-pressed={filter === 'reset'}
                className={filter === 'reset' ? 'active' : ''}
                onClick={() => setFilter('reset')}
              >
                {t('仅已确认重置')}
              </button>
            </div>
          </div>
          <div className="calendar-layout">
            <div className="calendar-grid-card">
              <div className="calendar-week" aria-hidden="true">
                {[t('一'), t('二'), t('三'), t('四'), t('五'), t('六'), t('日')].map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div
                className="calendar-days"
                role="group"
                aria-label={t('{0}年{1}月日期', [month.getFullYear(), month.getMonth() + 1])}
              >
                {monthDays(month).map((date, index) => {
                  if (!date) {
                    const offset =
                      (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
                    const adjacent = new Date(
                      month.getFullYear(),
                      month.getMonth(),
                      index - offset + 1,
                    );
                    return (
                      <span className="calendar-blank" key={`blank-${index}`} aria-hidden="true">
                        {String(adjacent.getDate()).padStart(2, '0')}
                      </span>
                    );
                  }
                  const key = dayKey(date),
                    entries = days.get(key) ?? [],
                    reset = entries.some((event) => event.announced),
                    announcement = entries.some((event) => !event.announced),
                    own = personal.some((event) => dayKey(new Date(event.at)) === key);
                  return (
                    <button
                      key={key}
                      className={`calendar-day ${reset ? 'has-reset' : ''} ${announcement ? 'has-announcement' : ''} ${own ? 'has-personal' : ''} ${selected === key ? 'chosen' : ''} ${key === dayKey(new Date(now)) ? 'is-today' : ''}`}
                      aria-label={`${key}${reset ? t('，已确认重置') : ''}${announcement ? t('，公告记录') : ''}${own ? t('，个人窗口到期') : ''}`}
                      aria-pressed={selected === key}
                      aria-current={key === dayKey(new Date(now)) ? 'date' : undefined}
                      onClick={() => setSelected(key)}
                    >
                      <span>{date.getDate()}</span>
                      <span className="calendar-markers">
                        {reset && <i className="reset-dot" />}
                        {announcement && <i className="announcement-dot" />}
                        {own && <i className="personal-dot" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="calendar-legend">
                <span>
                  <i className="reset-dot" />
                  {t('已确认重置')}
                </span>
                <span>
                  <i className="announcement-dot" />
                  {t('公告 / 其他记录')}
                </span>
                <span>
                  <i className="personal-dot" />
                  {t('个人窗口到期')}
                </span>
              </div>
              <p className="calendar-timezone">
                {t('按本机时区 {0} 显示公告记录时间；无记录不代表未重置。', [
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                ])}
              </p>
            </div>
            <aside className="calendar-detail" aria-live="polite">
              <h3>{selected.replaceAll('-', ' / ')}</h3>
              <p>
                {loading && !data
                  ? t('正在读取历史记录…')
                  : timelineOld
                    ? t('历史数据可能过期')
                    : t('当日记录')}
              </p>
              {!selectedEvents.length && !selectedPersonal.length && (
                <div className="calendar-empty">
                  <span aria-hidden="true">—</span>
                  <p>
                    {data?.timelineError
                      ? t('历史记录加载失败，请刷新重试')
                      : t('这一天暂无匹配记录')}
                  </p>
                  <small>{t('选择有标记的日期查看详情')}</small>
                </div>
              )}
              {selectedPersonal.map((event, index) => (
                <article className="calendar-event personal-event" key={`own-${index}`}>
                  <span>{t('个人窗口到期 · {0}', [stamp(event.at)])}</span>
                  <p>{event.label}</p>
                  <small>{t('以服务端刷新确认为准')}</small>
                </article>
              ))}
              {selectedEvents.map((event) => (
                <article
                  className={`calendar-event ${event.announced ? 'confirmed-event' : ''}`}
                  key={event.id}
                >
                  <span>
                    {event.announced
                      ? t('已确认全局重置')
                      : event.group === 'reset'
                        ? t('公告 · 待确认')
                        : t('其他额度事件')}
                    {' · '}
                    {stamp(event.at)}
                  </span>
                  <AnnouncementText
                    original={event.summary}
                    translated={event.localizedSummary}
                    locale={data!.locale}
                  />
                  {event.url && <button onClick={() => open(event.url!)}>{t('查看来源 ↗')}</button>}
                </article>
              ))}
            </aside>
          </div>
          <div className="calendar-summary">
            <span className="calendar-total">
              {data?.timelineFetchedAt
                ? t('本月记录 {0} 个重置日{1}', [
                    confirmedDays,
                    timelineOld ? t(' · 数据可能过期') : '',
                  ])
                : t('历史记录待同步')}
            </span>
            <span>{t('个人窗口标记不属于全局重置；储备重置与其他事件不计入重置日。')}</span>
          </div>
        </section>

        <ResetInsights data={data} now={now} loading={loading} tab={tab} open={open} />
      </section>
      <footer className="reset-attribution">
        <SourceCredit open={open} />
        <span>
          {forecast?.updatedAt ? t('模型更新于 {0}', [stamp(forecast.updatedAt)]) : t('等待记录')}
          {' · '}
          {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </span>
      </footer>
    </div>
  );
}
