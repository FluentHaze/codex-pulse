import { useRef, useState } from 'react';
import { DismissBackdrop } from './DismissBackdrop';
import { t, getLanguage } from '../electron/i18n';
import type { ResetData } from '../electron/reset-data';
import { resetLocale } from '../electron/reset-data';
import type { Bucket, Settings } from '../electron/types';
import { quotaWindows, remaining } from '../electron/types';
import { duration, resetText } from './Quota';
import { resetIntervals, resetCalendarFile } from './reset-tools';
import { useLanguage } from './use-language';

const stamp = (at: string | number) =>
  new Date(at).toLocaleString(getLanguage(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
export function SourceCredit({ open }: { open: (url: string) => void }) {
  return (
    <span className="radar-credit">
      {t('数据：')}
      <a
        href="https://codex-reset.com/"
        onClick={(event) => {
          event.preventDefault();
          open('https://codex-reset.com/');
        }}
      >
        codex-reset.com ↗
      </a>
    </span>
  );
}
export function AnnouncementText({
  original,
  translated,
  locale,
}: {
  original: string;
  translated: string | null;
  locale: ResetData['locale'];
}) {
  const language = useLanguage();
  const text =
    locale === resetLocale(language) && (language === 'zh-CN' || language === 'ja')
      ? translated
      : null;
  return (
    <div className="announcement-text">
      <p lang={text ? locale : 'en'}>{text || original}</p>
      {text ? (
        <details>
          <summary>{t('来源译文 · 查看英文原文')}</summary>
          <p lang="en">{original}</p>
        </details>
      ) : language !== 'en' ? (
        <small>{t('暂无对应译文，显示英文原文')}</small>
      ) : null}
    </div>
  );
}
export function ResetInsights({
  data,
  now,
  loading,
  open,
  tab,
}: {
  data: ResetData | null;
  now: number;
  loading: boolean;
  tab: 'calendar' | 'feed' | 'rhythm';
  open: (url: string) => void;
}) {
  useLanguage();
  const [filter, setFilter] = useState<'all' | 'reset' | 'banked'>('all');
  const [page, setPage] = useState(0);
  const intervals = resetIntervals(data?.events ?? [], now);
  const sorted = intervals.map((item) => item.days).sort((a, b) => a - b);
  const median = sorted.length
    ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2
    : null;
  const max = Math.max(1, ...sorted);
  const posts = (data?.feed?.posts ?? []).filter(
    (post) =>
      filter === 'all' ||
      (filter === 'reset'
        ? post.category === 'reset' || post.category === 'signal'
        : post.category === 'banked'),
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(posts.length / 3) - 1));
  const feedOld =
    !!data?.feed &&
    (data.feed.stale ||
      !!data.feedError ||
      !data.feed.fetchedAt ||
      now - Date.parse(data.feed.fetchedAt) > 600000);
  const historyOld =
    !!data?.timelineError ||
    (data?.timelineFetchedAt != null && now - data.timelineFetchedAt > 600000);
  return (
    <>
      <section
        className="rhythm-card reset-tab-panel"
        role="tabpanel"
        id="reset-panel-rhythm"
        aria-labelledby="reset-tab-rhythm"
        hidden={tab !== 'rhythm'}
        tabIndex={0}
      >
        <div className="reset-section-heading">
          <h2 id="rhythm-heading">{t('历史重置节奏')}</h2>
          <span>{t('最近 {0} 个完整间隔', [intervals.length])}</span>
        </div>
        {historyOld && <p className="reset-error">{t('历史数据可能过期')}</p>}
        {intervals.length ? (
          <>
            <div className="rhythm-stats">
              <div>
                <span>{t('典型间隔')}</span>
                <strong>{t('{0} 天', [median!.toFixed(1)])}</strong>
              </div>
              <div>
                <span>{t('最长间隔')}</span>
                <strong>{t('{0} 天', [Math.max(...sorted).toFixed(1)])}</strong>
              </div>
            </div>
            <div className="rhythm-chart" role="list" aria-label={t('已确认重置间隔，单位为天')}>
              {intervals.map((item) => (
                <div
                  className="rhythm-column"
                  role="listitem"
                  key={item.at}
                  aria-label={t('{0}，间隔 {1} 天', [stamp(item.at), item.days.toFixed(1)])}
                >
                  <div className="rhythm-track" aria-hidden="true">
                    <span
                      className="rhythm-bar"
                      style={{ height: `${Math.max(2, (item.days / max) * 100)}%` }}
                    >
                      <b>{item.days.toFixed(1)}</b>
                    </span>
                  </div>
                  <small>
                    {new Date(item.at).toLocaleDateString(getLanguage(), {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </small>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="radar-empty">
            {loading ? t('正在读取历史记录…') : t('至少需要两次已确认重置才能计算间隔')}
          </p>
        )}
        <footer className="radar-card-footer">
          <span>{t('根据已确认记录计算，历史节奏不代表未来计划。')}</span>
        </footer>
      </section>
      <section
        className="feed-card reset-tab-panel"
        role="tabpanel"
        id="reset-panel-feed"
        aria-labelledby="reset-tab-feed"
        hidden={tab !== 'feed'}
        tabIndex={0}
        aria-busy={loading}
      >
        <div className="reset-section-heading">
          <h2 id="feed-heading">{t('公告动态')}</h2>
          <div className="segmented" aria-label={t('公告筛选')}>
            {(
              [
                ['all', t('全部')],
                ['reset', t('重置')],
                ['banked', t('储备')],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? 'active' : ''}
                onClick={() => {
                  setFilter(value);
                  setPage(0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {(data?.feedError || feedOld) && (
          <p className="reset-error" role="status">
            {data?.feedError ? t(data.feedError) : t('公告数据可能过期')}
          </p>
        )}
        <div className="radar-posts">
          {posts.slice(currentPage * 3, currentPage * 3 + 3).map((post) => (
            <article className="radar-post" key={post.id}>
              <span className={`radar-badge ${post.category}`}>
                {post.category === 'reset'
                  ? t('已确认重置')
                  : post.category === 'signal'
                    ? t('待确认信号')
                    : post.category === 'banked'
                      ? t('储备')
                      : t('动态')}
              </span>
              <div>
                <time dateTime={post.at}>{stamp(post.at)}</time>
                <AnnouncementText
                  original={post.text}
                  translated={post.localizedText}
                  locale={data!.locale}
                />
                {post.category === 'banked' && <small>{t('储备发放不代表额度已恢复')}</small>}
                {post.url && <button onClick={() => open(post.url!)}>{t('查看公告原文 ↗')}</button>}
              </div>
            </article>
          ))}
          {!posts.length && (
            <p className="radar-empty">{loading ? t('同步中…') : t('暂无匹配公告')}</p>
          )}
        </div>
        <footer className="radar-card-footer feed-pagination">
          <span>
            {t('第 {0} / {1} 页 · 共 {2} 条', [
              currentPage + 1,
              Math.max(1, Math.ceil(posts.length / 3)),
              posts.length,
            ])}
          </span>
          <div>
            <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
              {t('上一页')}
            </button>
            <button
              disabled={(currentPage + 1) * 3 >= posts.length}
              onClick={() => setPage(currentPage + 1)}
            >
              {t('下一页')}
            </button>
          </div>
        </footer>
      </section>
    </>
  );
}
export function PersonalReset({
  variant = 'summary',
  now,
  buckets,
  settings,
  onSettings,
}: {
  variant?: 'summary' | 'actions';
  now: number;
  buckets: Bucket[];
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
}) {
  useLanguage();
  const actions = useRef<HTMLDetailsElement>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const windows = buckets
    .flatMap((bucket) =>
      quotaWindows(bucket).map((window) => ({ window, name: bucket.limitName ?? bucket.limitId })),
    )
    .filter(({ window }) => window.resetsAt && window.resetsAt * 1000 > now)
    .sort((a, b) => a.window.resetsAt! - b.window.resetsAt!);
  const next = windows[0];
  const left = next ? remaining(next.window) : null;
  const exportCalendar = () => {
    if (!next) return;
    const contents = resetCalendarFile(
      next.window.resetsAt! * 1000,
      t('{0} {1}窗口', [next.name, duration(next.window)]),
      now,
    );
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/calendar;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'codex-pulse-reset.ics';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (variant === 'actions')
    return (
      <>
        {actionsOpen && (
          <DismissBackdrop
            close={() => {
              if (actions.current) actions.current.open = false;
              setActionsOpen(false);
            }}
          />
        )}
        <details
          ref={actions}
          onToggle={(event) => setActionsOpen(event.currentTarget.open)}
          className="reset-actions"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.open = false;
              event.currentTarget.querySelector('summary')?.focus();
            }
          }}
        >
          <summary>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="M18 8a6 6 0 0 0-12 0v4l-2 5h16l-2-5V8M10 21h4" />
            </svg>
            {t('提醒与导出')}
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="m6 8 4 4 4-4" />
            </svg>
          </summary>
          <div className="reset-actions-menu">
            <div className="radar-alert-options">
              <label>
                <input
                  type="checkbox"
                  checked={settings.resetReminder}
                  onChange={(event) => onSettings({ resetReminder: event.target.checked })}
                />
                {t('个人窗口提前 15 分钟提醒')}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.globalResetAlerts}
                  onChange={(event) => onSettings({ globalResetAlerts: event.target.checked })}
                />
                {t('已确认全局重置时提醒')}
              </label>
            </div>
            <button disabled={!next} onClick={exportCalendar}>
              {t('导出日历 ↗')}
            </button>
            <p className="radar-note">
              {t('提醒需要 Pulse 在后台运行；个人恢复以服务端刷新为准。')}
            </p>
          </div>
        </details>
      </>
    );
  return (
    <section className="personal-reset" aria-labelledby="personal-reset-heading">
      <div className="reset-section-heading">
        <h2 id="personal-reset-heading">{t('我的下次恢复')}</h2>
      </div>
      {next ? (
        <>
          <strong className="personal-countdown">
            {resetText(next.window.resetsAt, now, true)}
          </strong>
          <p>{t('{0} {1}窗口', [next.name, duration(next.window)])}</p>
          <small>{stamp(next.window.resetsAt! * 1000)}</small>
          <div className="personal-quota">
            <span>{t('剩余额度')}</span>
            <b>{left == null ? '—' : `${Math.round(left)}%`}</b>
          </div>
          <div
            className="forecast-meter"
            role="meter"
            aria-label={t('剩余额度')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={left ?? undefined}
            aria-valuetext={left === null ? t('暂无数据') : `${Math.round(left)}%`}
          >
            <i style={{ width: `${left ?? 0}%` }} />
          </div>
        </>
      ) : (
        <p className="radar-empty">{t('暂无即将恢复的个人额度窗口')}</p>
      )}
    </section>
  );
}
