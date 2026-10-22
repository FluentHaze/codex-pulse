import type { QuotaWindow } from '../electron/types';
import { remaining } from '../electron/types';

export function duration(window: QuotaWindow) {
  const mins = window.windowDurationMins;
  return mins == null ? '额度窗口' : mins === 10080 ? '每周' : mins >= 1440 ? `${+(mins / 1440).toFixed(1)}天` : mins >= 60 ? `${+(mins / 60).toFixed(1)}小时` : `${mins}分钟`;
}
export function resetText(time: number | null, now: number) {
  if (!time) return '重置时间暂不可用';
  const delta = time * 1000 - now;
  if (delta <= 0) return '等待刷新确认重置';
  const mins = Math.ceil(delta / 60000), days = Math.floor(mins / 1440), hours = Math.floor(mins % 1440 / 60);
  return `${days ? `${days}天 ` : ''}${hours ? `${hours}小时 ` : ''}${mins % 60}分钟后重置`;
}
export function QuotaRing({ quota, used = false, mini = false }: { quota: QuotaWindow; used?: boolean; mini?: boolean }) {
  const left = remaining(quota), value = left === null ? null : used ? 100 - left : left;
  const tone = left === null ? 'muted' : left <= 10 ? 'danger' : left <= 20 ? 'warning' : 'good';
  return <span className={`quota-ring ${tone} ${mini ? 'mini' : ''}`} role="meter" aria-label={`${duration(quota)}${used ? '已用' : '剩余'}额度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-valuetext={value === null ? '暂无数据' : `${+value.toFixed(1)}%`}>
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="ring-track" cx="50" cy="50" r="42"/><circle className="ring-value" cx="50" cy="50" r="42" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - (value ?? 0)}/></svg>
    {!mini && <span className="ring-number">{value === null ? '—' : +value.toFixed(1)}{value !== null && <small>%</small>}<em>{used ? '已用' : '剩余'}</em></span>}
  </span>;
}
export function Quota({ quota, now, used = false }: { quota: QuotaWindow; now: number; used?: boolean }) {
  const left = remaining(quota), value = left === null ? null : used ? 100 - left : left;
  const tone = left === null ? 'muted' : left <= 10 ? 'danger' : left <= 20 ? 'warning' : 'good';
  return <div className={`quota ${tone}`}>
    <div className="quota-label"><span>{duration(quota)}窗口</span><span className="quota-condition"><i/>{left === null ? '暂无数据' : left === 0 ? '已耗尽' : left <= 20 ? '额度偏低' : '额度充足'}</span></div>
    <div className="quota-visual"><QuotaRing quota={quota} used={used}/><div className="quota-summary"><span>下次重置</span><strong>{resetText(quota.resetsAt, now).replace('后重置', '')}</strong><time dateTime={quota.resetsAt ? new Date(quota.resetsAt * 1000).toISOString() : undefined}>{quota.resetsAt ? new Date(quota.resetsAt * 1000).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '等待服务端返回时间'}</time></div></div>
    <div className="quota-footer"><span>{used ? '已用比例' : '可用比例'}</span><div className="capacity" aria-hidden="true"><i className={value !== null && value > 0 ? 'filled' : ''} style={{ width: `${value ?? 0}%` }}/></div><span>{value === null ? '—' : `${+value.toFixed(1)}%`}</span></div>
  </div>;
}
