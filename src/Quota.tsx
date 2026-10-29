/**
 * 额度窗口的显示组件：在已用与剩余视角间转换，并按服务端重置时间计算倒计时。
 */
import { useLanguage } from './use-language';
import { t, getLanguage } from '../electron/i18n';
import type { QuotaWindow } from '../electron/types';
import { remaining } from '../electron/types';
export function duration(window: QuotaWindow) {
  const mins = window.windowDurationMins;
  return mins == null
    ? t('额度窗口')
    : mins === 10080
      ? t('每周')
      : mins >= 1440
        ? t('{0}天', [+(mins / 1440).toFixed(1)])
        : mins >= 60
          ? t('{0}小时', [+(mins / 60).toFixed(1)])
          : t('{0}分钟', [mins]);
}
export function resetText(time: number | null, now: number, countdownOnly = false) {
  if (!time) return t('重置时间暂不可用');
  const delta = time * 1000 - now;
  if (delta <= 0) return t('等待刷新确认重置');
  const mins = Math.ceil(delta / 60000),
    days = Math.floor(mins / 1440),
    hours = Math.floor((mins % 1440) / 60);
  const text = t('{0}{1}{2}分钟后重置', [
    days ? t('{0}天 ', [days]) : '',
    hours ? t('{0}小时 ', [hours]) : '',
    mins % 60,
  ]);
  return countdownOnly ? text.replace(t('后重置'), '').trim() : text;
}
export function QuotaRing({
  quota,
  used = false,
  mini = false,
}: {
  quota: QuotaWindow;
  used?: boolean;
  mini?: boolean;
}) {
  useLanguage();
  const left = remaining(quota),
    value = left === null ? null : used ? 100 - left : left;
  const tone = left === null ? 'muted' : left <= 10 ? 'danger' : left <= 20 ? 'warning' : 'good';
  return (
    <span
      className={`quota-ring ${tone} ${left === 0 ? 'exhausted' : ''} ${mini ? 'mini' : ''}`}
      role="meter"
      aria-label={t('{0}{1}额度', [duration(quota), used ? t('已用') : t('剩余')])}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? t('暂无数据') : `${+value.toFixed(1)}%`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring-track" cx="50" cy="50" r="42" />
        <circle
          className="ring-value"
          cx="50"
          cy="50"
          r="42"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - (value ?? 0)}
        />
      </svg>
      {!mini && (
        <span className="ring-number">
          {value === null ? '—' : +value.toFixed(1)}
          {value !== null && <small>%</small>}
          <em>{used ? t('已用') : t('剩余')}</em>
        </span>
      )}
    </span>
  );
}
export function Quota({
  quota,
  now,
  used = false,
}: {
  quota: QuotaWindow;
  now: number;
  used?: boolean;
}) {
  useLanguage();
  const left = remaining(quota),
    value = left === null ? null : used ? 100 - left : left;
  const tone = left === null ? 'muted' : left <= 10 ? 'danger' : left <= 20 ? 'warning' : 'good';
  return (
    <div className={`quota ${tone} ${left === 0 ? 'exhausted' : ''}`}>
      <div className="quota-label">
        <span>{t('{0}窗口', [duration(quota)])}</span>
        <span className="quota-condition">
          <i />
          {left === null
            ? t('暂无数据')
            : left === 0
              ? t('已耗尽')
              : left <= 20
                ? t('额度偏低')
                : t('额度充足')}
        </span>
      </div>
      <div className="quota-visual">
        <div className="quota-amount">
          <strong>{value === null ? '—' : `${+value.toFixed(1)}%`}</strong>
          <span>{used ? t('已用') : t('剩余')}</span>
        </div>
        <QuotaRing quota={quota} used={used} />
      </div>
      <div className="quota-summary">
        <span>{t('下次重置')}</span>
        <strong>{resetText(quota.resetsAt, now, true)}</strong>
        <time dateTime={quota.resetsAt ? new Date(quota.resetsAt * 1000).toISOString() : undefined}>
          {quota.resetsAt
            ? new Date(quota.resetsAt * 1000).toLocaleString(getLanguage(), {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })
            : t('等待服务端返回时间')}
        </time>
      </div>
    </div>
  );
}
