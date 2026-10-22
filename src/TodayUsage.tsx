import { memo, useEffect, useRef, useState } from 'react';
import type { DailyStats, TokenCounts } from '../electron/types';

const format = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('zh-CN');
export const TodayUsage = memo(function TodayUsage({ sessionPath }: { sessionPath: string }) {
  const [stats, setStats] = useState<DailyStats>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const busyRef = useRef(false);
  useEffect(() => {
    let current = true; busyRef.current = false; setStats(undefined); setError('');
    const read = async (force = false) => {
      if (busyRef.current) return; busyRef.current = true; setBusy(true);
      try { const next = await window.pulse!.todayUsage(force); if (current) { setStats(next); setError(''); } }
      catch { if (current) setError('今日统计读取失败，请检查会话目录后刷新'); }
      finally { if (current) { busyRef.current = false; setBusy(false); } }
    };
    void read(true); const timer = setInterval(() => { if (document.visibilityState === 'visible') void read(); }, 30000);
    return () => { current = false; clearInterval(timer); };
  }, [sessionPath, reload]);
  const metrics: { key: keyof TokenCounts; label: string }[] = [{ key: 'input', label: '输入 Token' }, { key: 'output', label: '输出 Token' }, { key: 'cachedInput', label: '缓存输入' }, { key: 'reasoning', label: '推理 Token' }];
  return <section className="today-usage" aria-label="今日用量统计"><div className="daily-toolbar"><span>{stats ? `${stats.date} / ${stats.timeZone}` : '按本机时区的自然日统计'}</span><button disabled={busy} onClick={() => setReload(value => value + 1)}>{busy ? '正在汇总…' : '刷新统计'}</button></div>
    {error && <div className="alert" role="alert">{error}</div>}
    <section className="daily-total"><span>今日已记录用量</span><strong data-testid="daily-total">{format(stats?.tokens.total)}<small>Token</small></strong><p>{stats ? `${stats.turnCount} 轮有统计的对话，${stats.recordCount} 条用量事件` : '正在读取本地记录…'}</p></section>
    <div className="daily-metrics">{metrics.map(metric => <section key={metric.key}><span>{metric.label}</span><strong>{format(stats?.tokens[metric.key])}</strong></section>)}</div>
    <p className="note">缓存输入包含在输入中，推理包含在输出中，不重复相加。跨午夜的对话按用量事件发生时间分别计入当天。</p>
    {stats?.warnings.map(warning => <p className="token-warning" key={warning}>{warning}</p>)}
    <footer className="daily-footer"><p>本机已记录用量，非账号账单；不按当前登录账号筛选。内部审核及子会话不计入，继承或复制的相同用量事件按轮次、时间和累计计数去重。</p><span>{stats ? `已读取 ${stats.scannedFiles} 个文件 · 去重 ${stats.duplicateRecords} 条 · ${new Date(stats.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })} 更新` : '没有统计时不会估算用量'}。页面打开时每 30 秒更新。</span></footer>
  </section>;
});
