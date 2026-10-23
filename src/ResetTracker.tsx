import { useEffect, useRef, useState } from 'react';
import type { ResetData } from '../electron/reset-data';
import type { Bucket } from '../electron/types';
import { quotaWindows } from '../electron/types';
import { duration } from './Quota';
import { dayKey, eventsByDay, monthDays } from './reset-calendar';
import './reset.css';

function stamp(value: string | number | null) {
  return value === null ? '暂无记录' : new Date(value).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
function since(value: string | null, now: number) {
  if (!value) return '等待记录';
  const hours = Math.max(0, (now - Date.parse(value)) / 3_600_000);
  return hours < 1 ? '不到 1 小时' : hours < 48 ? `${Math.floor(hours)} 小时` : `${Math.floor(hours / 24)} 天 ${Math.floor(hours % 24)} 小时`;
}
export function ResetTracker({ now, buckets }: { now: number; buckets: Bucket[] }) {
  const [data, setData] = useState<ResetData | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const [filter, setFilter] = useState<'all' | 'reset'>('all');
  const busy = useRef(false), alive = useRef(false);
  const load = async () => {
    if (busy.current || !window.pulse) return;
    busy.current = true; setLoading(true);
    try { const next = await window.pulse.resetData(); if (alive.current) { setData(next); setError(''); } }
    catch { if (alive.current) setError('无法连接预测服务，请稍后重试'); }
    finally { busy.current = false; if (alive.current) setLoading(false); }
  };
  useEffect(() => { alive.current = true; void load(); const timer = setInterval(() => void load(), 300_000); return () => { alive.current = false; clearInterval(timer); }; }, []);
  const open = (url: string) => { void window.pulse?.resetSource(url).catch(() => { if (alive.current) setError('无法打开来源链接，请重试'); }); };
  const forecast = data?.forecast;
  const forecastOld = !!forecast && (!!data?.forecastError || data.forecastFetchedAt === null || now - data.forecastFetchedAt > 600_000 || !forecast.updatedAt || now - Date.parse(forecast.updatedAt) > 600_000);
  const timelineOld = !!data?.timelineFetchedAt && (!!data.timelineError || now - data.timelineFetchedAt > 600_000);
  const history = data?.events ?? [], visible = history.filter(event => filter === 'all' || event.announced);
  const days = eventsByDay(visible), selectedEvents = days.get(selected) ?? [];
  const personal = buckets.flatMap(bucket => quotaWindows(bucket).flatMap(window => window.resetsAt && window.resetsAt * 1000 > now ? [{ at: window.resetsAt * 1000, label: `${bucket.limitName ?? bucket.limitId} ${duration(window)}窗口` }] : []));
  const selectedPersonal = personal.filter(event => dayKey(new Date(event.at)) === selected);
  const confirmedDays = new Set(history.filter(event => event.announced && new Date(event.at).getFullYear() === month.getFullYear() && new Date(event.at).getMonth() === month.getMonth()).map(event => dayKey(new Date(event.at)))).size;
  const move = (amount: number) => { const next = new Date(month.getFullYear(), month.getMonth() + amount, 1); setMonth(next); setSelected(dayKey(next)); };
  const today = () => { const date = new Date(now); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelected(dayKey(date)); };
  return <div className="reset-tracker">
    <section className="forecast-panel" aria-labelledby="forecast-heading" aria-busy={loading}>
      <div className="reset-section-heading"><div><span className="terminal-caption">全球重置雷达</span><h2 id="forecast-heading">下一次重置，会在什么时候？</h2></div><button disabled={loading} onClick={() => void load()}>{loading ? '同步中…' : '刷新预测'}</button></div>
      <p className="forecast-intro">追踪额外全局重置的可能性。你的个人额度窗口仍以账号返回时间为准。</p>
      {(error || data?.forecastError || data?.timelineError) && <p className="reset-error" role="status">{error || [data?.forecastError, data?.timelineError].filter(Boolean).join('；')}{forecastOld || timelineOld ? ' · 保留上次数据供参考' : ''}</p>}
      <div className="forecast-metrics">
        <div className="forecast-last"><span>距最近一次全局重置</span><strong>{since(forecast?.lastResetAt ?? null, now)}</strong><small>{stamp(forecast?.lastResetAt ?? null)}</small></div>
        {([['未来 24 小时', forecast?.probability24h], ['未来 48 小时', forecast?.probability48h]] as const).map(([label, probability]) => <div className="forecast-odds" key={label}><span>{label}</span><strong>{probability == null ? '—' : probability}<small>{probability == null ? '' : '%'}</small></strong><div className="forecast-meter" aria-hidden="true"><i style={{ width: `${probability ?? 0}%` }}/></div><small>历史模型概率</small></div>)}
      </div>
      {forecast?.signal && <div className="reset-signal"><span>公告信号{forecastOld ? ' · 数据可能过期' : ''}</span><p>{forecast.signal.summary}</p>{forecast.signal.url && <button onClick={() => open(forecast.signal!.url!)}>查看公告原文 ↗</button>}</div>}
      <footer className="reset-attribution"><span>实验性预测 · 置信度：{({ low: '低', medium: '中', high: '高' } as Record<string, string>)[forecast?.confidence ?? ''] ?? '未知'}{forecastOld ? ' · 数据可能过期' : ''} · 不代表重置承诺</span><span>数据：<a href="https://codex-reset.com/" onClick={event => { event.preventDefault(); open('https://codex-reset.com/'); }}>codex-reset.com ↗</a>{forecast?.updatedAt && <small>模型更新于 {stamp(forecast.updatedAt)}</small>}</span></footer>
    </section>
    <section className="reset-calendar" aria-labelledby="calendar-heading">
      <div className="reset-section-heading"><div><span className="terminal-caption">重置记录与个人窗口</span><h2 id="calendar-heading">重置日历</h2></div><span className="calendar-total">{data?.timelineFetchedAt ? `本月记录 ${confirmedDays} 个重置日${timelineOld ? ' · 数据可能过期' : ''}` : '历史记录待同步'}</span></div>
      <div className="calendar-toolbar"><div className="month-navigation"><button aria-label="上个月" onClick={() => move(-1)}>‹</button><h3>{month.getFullYear()} 年 {month.getMonth() + 1} 月</h3><button aria-label="下个月" onClick={() => move(1)}>›</button><button onClick={today}>今天</button></div><div className="segmented" aria-label="日历记录筛选"><button aria-pressed={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部记录</button><button aria-pressed={filter === 'reset'} className={filter === 'reset' ? 'active' : ''} onClick={() => setFilter('reset')}>仅已确认重置</button></div></div>
      <div className="calendar-layout"><div><div className="calendar-week" aria-hidden="true">{['一', '二', '三', '四', '五', '六', '日'].map(label => <span key={label}>{label}</span>)}</div><div className="calendar-days" role="group" aria-label={`${month.getFullYear()}年${month.getMonth() + 1}月日期`}>
        {monthDays(month).map((date, index) => { if (!date) return <span className="calendar-blank" key={`blank-${index}`}/>;
          const key = dayKey(date), entries = days.get(key) ?? [], reset = entries.some(event => event.announced), announcement = entries.some(event => !event.announced), own = personal.some(event => dayKey(new Date(event.at)) === key);
          return <button key={key} className={`calendar-day ${reset ? 'has-reset' : ''} ${selected === key ? 'chosen' : ''} ${key === dayKey(new Date(now)) ? 'is-today' : ''}`} aria-label={`${key}${reset ? '，已确认重置' : ''}${announcement ? '，公告记录' : ''}${own ? '，个人窗口到期' : ''}`} aria-pressed={selected === key} aria-current={key === dayKey(new Date(now)) ? 'date' : undefined} onClick={() => setSelected(key)}><span>{date.getDate()}</span><span className="calendar-markers">{reset && <i className="reset-dot"/>}{announcement && <i className="announcement-dot"/>}{own && <i className="personal-dot"/>}</span></button>;
        })}
      </div><div className="calendar-legend"><span><i className="reset-dot"/>已确认重置</span><span><i className="announcement-dot"/>公告 / 其他记录</span><span><i className="personal-dot"/>个人窗口到期</span></div><p className="calendar-timezone">按本机时区 {Intl.DateTimeFormat().resolvedOptions().timeZone} 显示公告记录时间；无记录不代表未重置。</p></div>
      <aside className="calendar-detail" aria-live="polite"><h3>{selected.replaceAll('-', ' / ')}</h3><p>{loading && !data ? '正在读取历史记录…' : timelineOld ? '历史数据可能过期' : '当日记录'}</p>
        {!selectedEvents.length && !selectedPersonal.length && <div className="calendar-empty"><span aria-hidden="true">—</span><p>{data?.timelineError ? '历史记录加载失败，请刷新重试' : '这一天暂无匹配记录'}</p><small>选择有标记的日期查看详情</small></div>}
        {selectedPersonal.map((event, index) => <article className="calendar-event personal-event" key={`own-${index}`}><span>个人窗口到期 · {stamp(event.at)}</span><p>{event.label}</p><small>以服务端刷新确认为准</small></article>)}
        {selectedEvents.map(event => <article className={`calendar-event ${event.announced ? 'confirmed-event' : ''}`} key={event.id}><span>{event.announced ? '已确认全局重置' : event.group === 'reset' ? '公告 · 待确认' : '其他额度事件'} · {stamp(event.at)}</span><p>{event.summary}</p>{event.url && <button onClick={() => open(event.url!)}>查看来源 ↗</button>}</article>)}
      </aside></div>
      <footer className="reset-attribution"><span>个人窗口标记不属于全局重置；储备重置与其他事件不计入重置日。</span><span>历史数据：<a href="https://codex-reset.com/timeline" onClick={event => { event.preventDefault(); open('https://codex-reset.com/timeline'); }}>codex-reset.com ↗</a>{data?.timelineFetchedAt && <small>获取于 {stamp(data.timelineFetchedAt)}</small>}</span></footer>
    </section>
  </div>;
}
