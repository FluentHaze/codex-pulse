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
    max = Math.max(1, ...hours.map((hour) => hour.total ?? 0));
  const currentHour = new Date().getHours();
  const recordedHours = hours.filter((hour) => hour.records > 0);
  const splitSupported =
    recordedHours.length > 0 &&
    recordedHours.every(
      (hour) =>
        hour.input != null &&
        hour.output != null &&
        hour.total != null &&
        hour.input + hour.output === hour.total,
    );
  const active = selected === null ? undefined : hours[selected];
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
        <strong>{stats?.tokens.total == null ? '—' : compact(stats.tokens.total)}</strong>
        <span>{t('今日已记录 Token')}</span>
        <small>{t('悬停柱形查看明细')}</small>
      </div>
      <div className="hourly-plot">
        <div className="chart-scale" aria-hidden="true">
          <span>{compact(max)}</span>
          <span>{compact(max / 2)}</span>
          <span>0</span>
        </div>
        <div ref={chart} className="hourly-bars" role="group" aria-label={t('今日 0 至 23 时用量')}>
          {active && (
            <div
              className="chart-tooltip"
              role="status"
              style={{ left: `${Math.max(15, Math.min(85, ((active.hour + 0.5) / 24) * 100))}%` }}
            >
              <span>
                {String(active.hour).padStart(2, '0')}:00–{String(active.hour).padStart(2, '0')}:59
              </span>
              <strong>
                {active.total === null
                  ? t('统计缺失')
                  : active.hour > currentHour && !active.records
                    ? t('尚未到来')
                    : `${active.total.toLocaleString()} Token`}
              </strong>
              <small>{t('{0} 条用量记录', [active.records])}</small>
              {active.input != null && active.output != null && (
                <small>
                  {t('输入 {0} · 输出 {1}', [compact(active.input), compact(active.output)])}
                </small>
              )}
            </div>
          )}
          {Array.from({ length: 24 }, (_, hour) => {
            const bucket = hours[hour],
              future = hour > currentHour && !bucket?.records,
              missing = !bucket || bucket.total === null;
            const label = `${String(hour).padStart(2, '0')}:00，${missing ? t('暂无统计') : future ? t('尚未到来') : t('{0} Token，{1} 条记录', [bucket.total!.toLocaleString(), bucket.records])}`;
            return (
              <button
                key={hour}
                className={`hour-bar ${hour === currentHour ? 'current' : ''} ${future ? 'future' : ''} ${selected === hour ? 'active' : ''}`}
                tabIndex={keyboardHour === hour ? 0 : -1}
                aria-label={label}
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
                <span className="bar-column">
                  <i
                    className="hour-stack"
                    style={{
                      height: `${missing || future ? 0 : Math.max(bucket.total! > 0 ? 2 : 0, (bucket.total! / max) * 100)}%`,
                    }}
                  >
                    {splitSupported &&
                      bucket?.input != null &&
                      bucket.output != null &&
                      bucket.total != null &&
                      bucket.total > 0 &&
                      bucket.input + bucket.output === bucket.total && (
                        <em
                          className="bar-output"
                          style={{ height: `${(bucket.output / bucket.total) * 100}%` }}
                        />
                      )}
                  </i>
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
          {splitSupported ? t('输入') : t('已记录 Token')}
          {splitSupported && (
            <>
              <i className="legend-output" />
              {t('输出')}
            </>
          )}
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
                : stats.warnings.length
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
