import { useLanguage } from './use-language';
import { t, getLanguage } from '../electron/i18n';
import { memo } from 'react';
import type { TokenCounts } from '../electron/types';
import { useTodayUsage } from './use-today-usage';
import { HourlyChart } from './HourlyUsage';
const format = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString(getLanguage());
export const TodayUsage = memo(function TodayUsage({ sessionPath }: {
    sessionPath: string;
}) {
    useLanguage();
    const { stats, busy, error, refresh } = useTodayUsage(sessionPath);
    const metrics: {
        key: keyof TokenCounts;
        label: string;
    }[] = [{ key: 'input', label: t("输入 Token") }, { key: 'output', label: t("输出 Token") }, { key: 'cachedInput', label: t("缓存输入") }, { key: 'reasoning', label: t("推理 Token") }];
    return <section className="today-usage" aria-label={t("今日用量统计")}><div className="daily-toolbar"><span>{stats ? `${stats.date} / ${stats.timeZone}` : t("按本机时区的自然日统计")}</span><button disabled={busy} onClick={refresh}>{busy ? t("正在汇总…") : t("刷新统计")}</button></div>
    {error && <div className="alert" role="alert">{t(error ?? '')}</div>}
    <section className="daily-total"><span>{t("今日已记录用量")}</span><strong data-testid="daily-total">{format(stats?.tokens.total)}<small>Token</small></strong><p>{stats ? t("{0} 轮有统计的对话，{1} 条用量事件", [stats.turnCount, stats.recordCount]) : t("正在读取本地记录…")}</p></section>
    <div className="daily-metrics">{metrics.map(metric => <section key={metric.key}><span>{metric.label}</span><strong>{format(stats?.tokens[metric.key])}</strong></section>)}</div>
    <HourlyChart stats={stats} busy={busy} error={t(error ?? '')} refresh={refresh}/>
    <p className="note">{t("缓存输入包含在输入中，推理包含在输出中，不重复相加。跨午夜的对话按用量事件发生时间分别计入当天。")}</p>
    {stats?.warnings.map(warning => <p className="token-warning" key={t(warning ?? '')}>{t(warning ?? '')}</p>)}
    <footer className="daily-footer"><p>{t("本机已记录用量，非账号账单；不按当前登录账号筛选。内部审核及子会话不计入，继承或复制的相同用量事件按轮次、时间和累计计数去重。")}</p><span>{t("{0}。页面打开时每 30 秒更新。", [stats ? t("已读取 {0} 个文件 · 去重 {1} 条 · {2} 更新", [stats.scannedFiles, stats.duplicateRecords, new Date(stats.updatedAt).toLocaleTimeString(getLanguage(), { hour12: false })]) : t("没有统计时不会估算用量")])}</span></footer>
  </section>;
});
