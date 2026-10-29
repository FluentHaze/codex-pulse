/**
 * 展示已记录的每小时用量，并支持鼠标和键盘查看桶明细；未来时段与缺失统计分别显示。
 */
import { useLanguage } from './use-language';
import { t, getLanguage } from '../electron/i18n';
import { useRef, useState } from 'react';
import type { DailyStats } from '../electron/types';
import { useTodayUsage } from './use-today-usage';
const compact = (value: number) =>
  value >= 1e6
    ? `${+(value / 1e6).toFixed(1)}M`
    : value >= 1000
      ? `${+(value / 1000).toFixed(1)}K`
      : `${value}`;
export function HourlyChart({
  stats,
  busy,
  error,
  refresh,
}: {
  stats?: DailyStats;
  busy: boolean;
  error: string;
  refresh(): void;
}) {
  useLanguage();
  const [selected, setSelected] = useState<number | null>(null);
  const [keyboardHour, setKeyboardHour] = useState(new Date().getHours());
  const chart = useRef<HTMLDivElement>(null);
  const modality = useRef<'pointer' | 'keyboard'>('pointer');
  const hours = stats?.hourly ?? [],
    yesterday = stats?.yesterday?.hourly ?? [],
    max = Math.max(
      1,
      ...hours.map((hour) => hour.total ?? 0),
      ...yesterday.map((hour) => hour.total ?? 0),
    );
  const yesterdayPath = yesterday.reduce((path, bucket, index) => {
    if (bucket.total == null) return path;
    const connected = index > 0 && yesterday[index - 1]?.total != null;
    return `${path} ${connected ? 'L' : 'M'}${(index + 0.5) * 100},${(1 - bucket.total / max) * 1000}`;
  }, '');
  const currentHour = new Date().getHours();
  const active = selected === null ? undefined : hours[selected];
  const previousActive = selected === null ? undefined : yesterday[selected];
  const description = !stats
    ? error || t('正在读取本机记录…')
    : `${stats.date} · ${stats.timeZone}`;
  return (
    <section className="hourly-card" aria-label={t('每小时 Token 消耗')}>
      <header>
        <div>
          <h2>{t('每小时 Token 消耗')}</h2>
          <p aria-live="polite">{description}</p>
        </div>
        <button disabled={busy} onClick={refresh}>
          {busy ? t('读取中…') : t('刷新')}
        </button>
      </header>
      {error && stats && (
        <p className="token-warning" role="alert">
          {t('{0}，保留上次统计', [error])}
        </p>
      )}
      <div className="hourly-total">
        <strong>
          {stats?.tokens.total == null ? '—' : `${compact(stats.tokens.total)} Token`}
        </strong>
        <span>{t('今日已记录用量')}</span>
        <small>{t('悬停柱形查看明细')}</small>
      </div>
      <div className="hourly-plot">
        <div className="chart-scale" aria-hidden="true">
          <small className="chart-unit">Token</small>
          <span>{compact(max)}</span>
          <span>{compact(max / 2)}</span>
          <span>0</span>
        </div>
        <div ref={chart} className="hourly-bars" role="group" aria-label={t('今日 0 至 23 时用量')}>
          {!!yesterday.length && (
            <svg
              className="yesterday-line"
              viewBox="0 0 2400 1000"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={yesterdayPath} vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          {previousActive?.total != null && (
            <span
              className="yesterday-active-point"
              aria-hidden="true"
              style={{
                left: `${((previousActive.hour + 0.5) / 24) * 100}%`,
                top: `calc((100% - 23px) * ${1 - previousActive.total / max})`,
              }}
            />
          )}
          {active && (
            <div
              className="chart-tooltip"
              role="status"
              style={{ left: `${Math.max(15, Math.min(85, ((active.hour + 0.5) / 24) * 100))}%` }}
            >
              <span>
                {String(active.hour).padStart(2, '0')}:00–{String(active.hour).padStart(2, '0')}:59
              </span>
              <small className="tooltip-today-label">{t('今天')}</small>
              <strong>
                {active.total === null
                  ? t('统计缺失')
                  : active.hour > currentHour && !active.records
                    ? t('尚未到来')
                    : `${compact(active.total)} Token`}
              </strong>
              <small>{t('{0} 条用量记录', [active.records])}</small>
              {active.input != null && active.output != null && (
                <small>
                  {t('输入 {0} · 输出 {1}', [
                    `${compact(active.input)} Token`,
                    `${compact(active.output)} Token`,
                  ])}
                </small>
              )}
              <div className="tooltip-yesterday">
                <small>{t('昨日')}</small>
                <strong>
                  {previousActive?.total == null
                    ? t('暂无统计')
                    : `${compact(previousActive.total)} Token`}
                </strong>
                {previousActive?.input != null && previousActive.output != null && (
                  <small>
                    {t('输入 {0} · 输出 {1}', [
                      `${compact(previousActive.input)} Token`,
                      `${compact(previousActive.output)} Token`,
                    ])}
                  </small>
                )}
              </div>
              {active.hour <= currentHour &&
                active.total != null &&
                previousActive?.total != null &&
                previousActive.total > 0 && (
                  <small className="hourly-change">
                    {t('较昨日同小时 {0}', [
                      `${active.total >= previousActive.total ? '+' : ''}${((active.total / previousActive.total - 1) * 100).toFixed(1)}%`,
                    ])}
                  </small>
                )}
            </div>
          )}
          {Array.from({ length: 24 }, (_, hour) => {
            const bucket = hours[hour],
              previousBucket = yesterday[hour],
              future = hour > currentHour && !bucket?.records,
              missing = !bucket || bucket.total === null;
            const label = `${String(hour).padStart(2, '0')}:00，${missing ? t('暂无统计') : future ? t('尚未到来') : t('{0} Token，{1} 条记录', [bucket.total!.toLocaleString(), bucket.records])}`;
            return (
              <button
                key={hour}
                className={`hour-bar ${hour === currentHour ? 'current' : ''} ${future ? 'future' : ''} ${selected === hour ? 'active' : ''}`}
                tabIndex={keyboardHour === hour ? 0 : -1}
                aria-label={`${label}；${t('昨日')}：${previousBucket?.total == null ? t('暂无统计') : `${previousBucket.total.toLocaleString(getLanguage())} Token`}`}
                onFocus={() => {
                  setKeyboardHour(hour);
                  setSelected(hour);
                }}
                onBlur={(event) => {
                  if (!chart.current?.contains(event.relatedTarget)) {
                    modality.current = 'pointer';
                    setSelected(null);
                  }
                }}
                onPointerEnter={() => {
                  if (modality.current === 'pointer') setSelected(hour);
                }}
                onPointerMove={(event) => {
                  if (event.movementX || event.movementY) {
                    modality.current = 'pointer';
                    setSelected(hour);
                  }
                }}
                onPointerLeave={(event) => {
                  if (
                    modality.current === 'pointer' &&
                    document.activeElement !== event.currentTarget
                  )
                    setSelected(null);
                }}
                onClick={() => {
                  modality.current = 'pointer';
                  setSelected(hour);
                }}
                onKeyDown={(event) => {
                  modality.current = 'keyboard';
                  const next =
                    event.key === 'ArrowRight'
                      ? (hour + 1) % 24
                      : event.key === 'ArrowLeft'
                        ? (hour + 23) % 24
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? 23
                            : null;
                  if (next !== null) {
                    event.preventDefault();
                    setKeyboardHour(next);
                    chart.current?.querySelectorAll<HTMLButtonElement>('.hour-bar')[next]?.focus();
                  }
                  if (event.key === 'Escape') setSelected(null);
                }}
              >
                <span className="bar-column comparison-columns">
                  <i
                    className="hour-stack"
                    style={{
                      height: `${missing || future ? 0 : Math.max(bucket.total! > 0 ? 2 : 0, (bucket.total! / max) * 100)}%`,
                    }}
                  ></i>
                </span>
                <span className="bar-label" aria-hidden="true">
                  {hour % 3 === 0 || hour === 23 ? String(hour).padStart(2, '0') : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <footer>
        <span>
          <i />
          {t('今天')}
          <i className="legend-yesterday" />
          {t('昨日')}
        </span>
        <span>
          {!stats
            ? error
              ? t('读取失败，请重试')
              : t('加载中')
            : !hours.length
              ? t('此记录没有小时统计')
              : !stats.recordCount
                ? t('今天尚无可统计的用量事件')
                : stats.warnings.length || stats.yesterday?.warnings.length
                  ? t('部分记录不完整，仅展示已确认用量')
                  : t('按用量事件发生时间统计，每 30 秒更新')}
        </span>
      </footer>
    </section>
  );
}
export function HourlyUsage({ sessionPath }: { sessionPath: string }) {
  useLanguage();
  const usage = useTodayUsage(sessionPath);
  return <HourlyChart {...usage} />;
}
