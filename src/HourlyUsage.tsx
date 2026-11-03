/** Shared, pannable usage chart for the overview and today's usage. */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLanguage } from './use-language';
import { t, getLanguage } from '../electron/i18n';
import type { DailyStats } from '../electron/types';
import { useTodayUsage } from './use-today-usage';
import {
  aggregateTimeline,
  minuteCapacity,
  bucketDate,
  bucketIndex,
  previousDay,
  splitPaths,
  type Period,
} from './usage-chart';
import './usage-chart.css';
import { UsageNavigator } from './UsageNavigator';
const compact = (value: number) =>
  value >= 1e6
    ? `${+(value / 1e6).toFixed(1)}M`
    : value >= 1000
      ? `${+(value / 1000).toFixed(1)}K`
      : `${+value.toFixed(1)}`;
const titles = { minute: '每分钟 Token 消耗', hour: '每小时 Token 消耗', day: '每日 Token 消耗' };
const labels = { minute: '分钟', hour: '小时', day: '按日' };
const initialCounts = { minute: 180, hour: 24, day: 15 };

function midnight(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
export function HourlyChart({
  stats,
  busy,
  error,
  refresh,
  allowDay = true,
  onPeriodChange,
}: {
  stats?: DailyStats;
  busy: boolean;
  error: string;
  refresh(): void;
  allowDay?: boolean;
  onPeriodChange?(period: Period): void;
}) {
  useLanguage();
  const [period, setPeriod] = useState<Period>('hour');
  const [minuteCount, setCount] = useState(180);
  const [position, setPosition] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(600);
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = plot.current;
    const preventScroll = (event: WheelEvent) => event.preventDefault();
    if (period === 'minute') element?.addEventListener('wheel', preventScroll, { passive: false });
    return () => element?.removeEventListener('wheel', preventScroll);
  }, [period]);
  const id = useId().replace(/:/g, '');
  const now = stats?.updatedAt ?? Date.now();
  const current = bucketIndex(now, period);
  const data = useMemo(() => aggregateTimeline(stats, period), [stats, period]);
  const tomorrow = new Date(midnight(now));
  tomorrow.setDate(tomorrow.getDate() + 1);
  const end = period === 'day' ? current : bucketIndex(tomorrow.getTime(), period) - 1;
  const lower = period === 'day' ? current - 14 : bucketIndex(midnight(now), period);
  const maxMinutes = Math.min(minuteCapacity(plotWidth), end - lower + 1);
  const count =
    period === 'minute'
      ? Math.min(minuteCount, maxMinutes)
      : period === 'day'
        ? 15
        : end - lower + 1;
  const upper = Math.max(lower, end - count + 1);
  const clamp = (value: number) => Math.max(lower, Math.min(upper, Math.round(value)));
  const start = period === 'minute' ? clamp(position ?? current - count + 1) : lower;
  const indices = Array.from({ length: count }, (_, i) => start + i);
  const hasStats = Boolean(
    stats && (period === 'day' ? stats.daily : stats.timeline || stats.hourly),
  );
  const today = indices.map((index) =>
    !hasStats || index > current || index < lower ? null : data.has(index) ? data.get(index)! : 0,
  );
  const previousIndices = indices.map((index) =>
    period === 'day' ? index - count : previousDay(index, period),
  );
  const previous = previousIndices.map((index) =>
    !hasStats || period === 'day' || !stats?.yesterday
      ? null
      : data.has(index)
        ? data.get(index)!
        : 0,
  );
  const rawMax = Math.max(
    1,
    ...today.map((value) => value ?? 0),
    ...previous.map((value) => value ?? 0),
  );
  const magnitude = 10 ** Math.floor(Math.log10(rawMax));
  const max = Math.ceil(rawMax / magnitude / 2) * magnitude * 2;
  const todayPaths = period === 'minute' ? [] : splitPaths(today, max),
    yesterdayPaths = period === 'minute' ? [] : splitPaths(previous, max);
  const plotPercent = (index: number) =>
    period === 'minute' ? ((index + 0.5) / count) * 100 : (index / (count - 1)) * 100;
  const format = (index: number, full = false) =>
    bucketDate(index, period).toLocaleString(
      getLanguage(),
      period === 'day'
        ? { month: '2-digit', day: '2-digit', ...(full ? { year: 'numeric' } : {}) }
        : {
            ...(full ? { month: '2-digit', day: '2-digit' } : {}),
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          },
    );
  const browsingToday =
    bucketIndex(bucketDate(start, period).getTime(), 'day') === bucketIndex(now, 'day');
  const previousLabel = period === 'day' ? t('上一周期') : browsingToday ? t('昨日') : t('前一天');
  const currentLabel = period === 'day' || !browsingToday ? t('当前周期') : t('今天');
  useEffect(() => {
    setSelected(null);
  }, [period, start, count]);
  const changePeriod = (next: Period) => {
    setPeriod(next);
    onPeriodChange?.(next);
    setCount(initialCounts[next]);
    setPosition(null);
  };
  const zoom = (factor: number, anchor = 0.5) => {
    if (period !== 'minute') return;
    const next = Math.max(8, Math.min(maxMinutes, Math.round(count * factor)));
    setCount(next);
    setPosition(Math.round(start + (count - next) * anchor));
  };
  const move = (amount: number) => {
    if (period !== 'minute') return;
    setPosition(clamp(start + amount));
    setSelected(null);
  };
  return (
    <section
      className={`hourly-card usage-chart ${period === 'minute' ? 'usage-minute-chart' : ''}`}
      aria-label={t(titles[period])}
    >
      <header>
        <div>
          <h2>{t(titles[period])}</h2>
          <p aria-live="polite">
            {stats ? `${stats.date} · ${stats.timeZone}` : error || t('正在读取本机记录…')}
          </p>
        </div>
        <div className="usage-chart-actions">
          <div className="usage-periods" role="group" aria-label={t('时间周期')}>
            {(['minute', 'hour', ...(allowDay ? ['day'] : [])] as Period[]).map((item) => (
              <button key={item} aria-pressed={period === item} onClick={() => changePeriod(item)}>
                {item === 'day' && getLanguage().startsWith('zh') ? '日' : t(labels[item])}
              </button>
            ))}
          </div>
          <button disabled={busy} onClick={refresh} aria-label={t('刷新')} title={t('刷新')}>
            {busy ? '…' : '↻'}
          </button>
        </div>
      </header>
      {error && stats && (
        <p className="token-warning" role="alert">
          {t('{0}，保留上次统计', [error])}
        </p>
      )}
      <div className="usage-summary">
        <div className="hourly-total">
          <strong>
            {stats?.tokens.total == null ? '—' : compact(stats.tokens.total)} <small>Token</small>
          </strong>
          <span>{t('今日已记录用量')}</span>
        </div>
        <div className="usage-legend">
          <span>
            <i className="usage-today-swatch" />
            {currentLabel}
          </span>
          {period !== 'day' && (
            <span>
              <i className="usage-yesterday-swatch" />
              {previousLabel}
            </span>
          )}
        </div>
      </div>
      <div className="usage-navigation">
        {period === 'minute' && (
          <button
            aria-label={t('向前查看')}
            disabled={!hasStats || start <= lower}
            onClick={() => move(-Math.max(1, Math.floor(count / 2)))}
          >
            ‹
          </button>
        )}
        {period === 'minute' && (
          <button
            aria-label={t('向后查看')}
            disabled={!hasStats || start >= upper}
            onClick={() => move(Math.max(1, Math.floor(count / 2)))}
          >
            ›
          </button>
        )}
        <span>
          {format(start, true)} – {format(start + count - 1, true)}
        </span>
        {period === 'minute' && (
          <>
            <button
              className="usage-latest"
              onClick={() => {
                setPosition(null);
                setCount(initialCounts[period]);
              }}
            >
              {t('回到最新')}
            </button>
            <button
              aria-label={t('缩小时间轴')}
              disabled={count >= maxMinutes}
              onClick={() => zoom(1.5)}
            >
              −
            </button>
            <button
              aria-label={t('放大时间轴')}
              disabled={count <= 8}
              onClick={() => zoom(1 / 1.5)}
            >
              +
            </button>
          </>
        )}
      </div>
      <div className="usage-plot-layout">
        <div className="usage-y-axis" aria-hidden="true">
          {[max, (max * 2) / 3, max / 3, 0].map((value, i) => (
            <span key={i}>{compact(value)}</span>
          ))}
        </div>
        <div className="usage-chart-body">
          <div
            ref={plot}
            className={`usage-canvas ${period === 'minute' ? 'usage-draggable' : ''}`}
            tabIndex={0}
            role="group"
            aria-label={t(titles[period])}
            onPointerDown={(event) => {
              if (period !== 'minute' || event.button !== 0 || !hasStats) return;
              drag.current = { x: event.clientX, start };
              event.currentTarget.setPointerCapture(event.pointerId);
              setSelected(null);
            }}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              if (drag.current) {
                setPosition(
                  clamp(
                    drag.current.start - ((event.clientX - drag.current.x) / rect.width) * count,
                  ),
                );
              } else
                setSelected(
                  Math.max(
                    0,
                    Math.min(
                      count - 1,
                      period === 'minute'
                        ? Math.floor(((event.clientX - rect.left) / rect.width) * count)
                        : Math.round(((event.clientX - rect.left) / rect.width) * (count - 1)),
                    ),
                  ),
                );
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
            onPointerLeave={() => {
              if (!drag.current) setSelected(null);
            }}
            onWheel={(event) => {
              if (period !== 'minute') return;
              const rect = event.currentTarget.getBoundingClientRect();
              if (Math.abs(event.deltaX) > Math.abs(event.deltaY))
                move(Math.sign(event.deltaX) * Math.max(1, Math.round(count / 12)));
              else
                zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15, (event.clientX - rect.left) / rect.width);
            }}
            onKeyDown={(event) => {
              if (
                ['ArrowLeft', 'ArrowRight', 'Home', 'End', '+', '-', 'Escape'].includes(event.key)
              )
                event.preventDefault();
              if (event.shiftKey && event.key === 'ArrowLeft') move(-Math.ceil(count / 4));
              else if (event.shiftKey && event.key === 'ArrowRight') move(Math.ceil(count / 4));
              else if (event.key === 'ArrowLeft') setSelected(Math.max(0, (selected ?? count) - 1));
              else if (event.key === 'ArrowRight')
                setSelected(Math.min(count - 1, (selected ?? -1) + 1));
              else if (event.key === 'Home') setSelected(0);
              else if (event.key === 'End') setSelected(count - 1);
              else if (event.key === '+') zoom(1 / 1.5);
              else if (event.key === '-') zoom(1.5);
              else if (event.key === 'Escape') setSelected(null);
            }}
            onBlur={() => setSelected(null)}
          >
            <svg viewBox="0 0 1000 240" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={`${id}-today`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--usage-blue)" stopOpacity=".16" />
                  <stop offset="100%" stopColor="var(--usage-blue)" stopOpacity=".015" />
                </linearGradient>
                <linearGradient id={`${id}-yesterday`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--usage-purple)" stopOpacity=".14" />
                  <stop offset="100%" stopColor="var(--usage-purple)" stopOpacity=".025" />
                </linearGradient>
              </defs>
              {period === 'minute' &&
                indices.map((_, i) => {
                  const slot = 1000 / count;
                  const width =
                    (Math.min(12, Math.max(3, (plotWidth / count) * 0.36)) * 1000) /
                    Math.max(1, plotWidth);
                  const gap = Math.min((2 * 1000) / Math.max(1, plotWidth), slot * 0.08);
                  const center = (i + 0.5) * slot;
                  return (
                    <g key={i} className={selected === i ? 'usage-column-selected' : undefined}>
                      {previous[i] !== null && previous[i]! > 0 && (
                        <rect
                          className="usage-minute-previous"
                          x={center - gap / 2 - width}
                          y={240 - (previous[i]! / max) * 220}
                          width={width}
                          height={(previous[i]! / max) * 220}
                          rx={Math.min(2, width / 2)}
                        />
                      )}
                      {today[i] !== null && today[i]! > 0 && (
                        <rect
                          className="usage-minute-current"
                          x={center + gap / 2}
                          y={240 - (today[i]! / max) * 220}
                          width={width}
                          height={(today[i]! / max) * 220}
                          rx={Math.min(2, width / 2)}
                        />
                      )}
                    </g>
                  );
                })}
              {yesterdayPaths.map((path, i) => (
                <path key={`ya${i}`} d={path.area} fill={`url(#${id}-yesterday)`} />
              ))}
              {todayPaths.map((path, i) => (
                <path key={`ta${i}`} d={path.area} fill={`url(#${id}-today)`} />
              ))}
              {yesterdayPaths.map((path, i) => (
                <path
                  key={`yl${i}`}
                  d={path.line}
                  className="usage-line usage-previous"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {todayPaths.map((path, i) => (
                <path
                  key={`tl${i}`}
                  d={path.line}
                  className="usage-line usage-current"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            {hasStats && period !== 'day' && current >= start && current < start + count && (
              <div
                className="usage-now"
                style={{ left: `${plotPercent(current - start)}%` }}
                aria-hidden="true"
              >
                <span>{t('现在')}</span>
              </div>
            )}
            {!hasStats && (
              <p className="usage-empty">
                {!stats ? (error ? t('读取失败，请重试') : t('加载中')) : t('暂无统计')}
              </p>
            )}
            {selected !== null && hasStats && (
              <>
                <div className="usage-crosshair" style={{ left: `${plotPercent(selected)}%` }} />
                <div
                  className="usage-tooltip"
                  role="status"
                  style={{ left: `${Math.max(19, Math.min(81, plotPercent(selected)))}%` }}
                >
                  <b>{format(start + selected, true)}</b>
                  <div>
                    <i className="usage-today-swatch" />
                    <span>{currentLabel}</span>
                    <strong>
                      {start + selected > current
                        ? t('尚未到来')
                        : today[selected] === null
                          ? t('统计缺失')
                          : compact(today[selected]!)}
                    </strong>
                  </div>
                  {period !== 'day' && (
                    <div>
                      <i className="usage-yesterday-swatch" />
                      <span>{previousLabel}</span>
                      <strong>
                        {previous[selected] === null ? t('暂无统计') : compact(previous[selected]!)}
                      </strong>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="usage-x-axis" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i}>{format(start + Math.round((i / 6) * (count - 1)))}</span>
            ))}
          </div>
        </div>
      </div>
      {period === 'minute' && hasStats && (
        <UsageNavigator
          stats={stats}
          start={start}
          count={count}
          lower={lower}
          end={end}
          maxCount={maxMinutes}
          onChange={(nextStart, nextCount) => {
            setCount(nextCount);
            setPosition(Math.max(lower, Math.min(end - nextCount + 1, Math.round(nextStart))));
            setSelected(null);
          }}
        />
      )}
      <footer>
        <span>
          {period === 'minute'
            ? t('仅限今日，左右拖动查看，滚轮缩放')
            : period === 'day'
              ? t('最近 15 天用量')
              : t('今日每小时用量')}
        </span>
        <span>
          {!stats
            ? error
              ? t('读取失败，请重试')
              : t('加载中')
            : stats.warnings.length || stats.yesterday?.warnings.length
              ? t('部分记录不完整，仅展示已确认用量')
              : t('按用量事件发生时间统计，每 30 秒更新')}
        </span>
      </footer>
    </section>
  );
}
export function HourlyUsage({ sessionPath }: { sessionPath: string }) {
  const usage = useTodayUsage(sessionPath);
  return (
    <HourlyChart {...usage} onPeriodChange={(period) => usage.setDays(period === 'day' ? 15 : 2)} />
  );
}
