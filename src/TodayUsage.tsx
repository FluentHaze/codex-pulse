/** 今日统计先展示缓存，后台更新；缓存与推理作为输入输出的子集呈现。 */
import { useLanguage } from './use-language';
import { t, getLanguage } from '../electron/i18n';
import { memo } from 'react';
import { useTodayUsage } from './use-today-usage';
import { HourlyChart } from './HourlyUsage';
const format = (value: number | null | undefined) =>
  value == null
    ? '—'
    : value >= 1000000
      ? `${+(value / 1000000).toFixed(1)}M`
      : value >= 1000
        ? `${+(value / 1000).toFixed(1)}K`
        : value.toLocaleString(getLanguage());
const ratio = (part: number | null | undefined, whole: number | null | undefined) =>
  part == null || whole == null || whole <= 0 || part > whole ? null : (part / whole) * 100;
export const TodayUsage = memo(function TodayUsage({ sessionPath }: { sessionPath: string }) {
  useLanguage();
  const { stats, busy, error, refresh } = useTodayUsage(sessionPath);
  const tokens = stats?.tokens;
  const inputShare = ratio(
    tokens?.input,
    tokens?.input == null || tokens?.output == null ? null : tokens.input + tokens.output,
  );
  const outputShare = inputShare === null ? null : 100 - inputShare;
  const shares = [
    { label: t('输入'), value: inputShare, tone: 'input' },
    { label: t('输出'), value: outputShare, tone: 'output' },
    {
      label: t('输入中的缓存占比'),
      value: ratio(tokens?.cachedInput, tokens?.input),
      tone: 'input subset',
    },
    {
      label: t('输出中的推理占比'),
      value: ratio(tokens?.reasoning, tokens?.output),
      tone: 'output subset',
    },
  ];
  return (
    <section className="today-usage" aria-label={t('今日用量统计')}>
      <div className="daily-toolbar">
        <span>{stats ? `${stats.date} · ${stats.timeZone}` : t('按本机时区的自然日统计')}</span>
        <span className="background-status" role="status">
          {busy ? t('正在后台更新，可继续查看已有记录') : ''}
        </span>
        <button disabled={busy} onClick={refresh}>
          {busy ? t('正在汇总…') : t('刷新统计')}
        </button>
      </div>
      {error && (
        <div className="alert" role="alert">
          {t(error)}
        </div>
      )}
      <div className="daily-overview">
        <section className="daily-total">
          <span>{t('今日已记录用量')}</span>
          <strong data-testid="daily-total" title={tokens?.total?.toLocaleString(getLanguage())}>
            {format(tokens?.total)}
            <small>Token</small>
          </strong>
          <p>
            {stats
              ? t('{0} 轮有统计的对话，{1} 条用量事件', [stats.turnCount, stats.recordCount])
              : t('正在读取本地记录…')}
          </p>
        </section>
        <section className="daily-input">
          <span>{t('输入 Token')}</span>
          <strong>{format(tokens?.input)}</strong>
          <p>{t('其中缓存输入 {0}', [format(tokens?.cachedInput)])}</p>
        </section>
        <section className="daily-output">
          <span>{t('输出 Token')}</span>
          <strong>{format(tokens?.output)}</strong>
          <p>{t('其中推理 {0}', [format(tokens?.reasoning)])}</p>
        </section>
      </div>
      <div className="daily-analysis">
        <HourlyChart stats={stats} busy={busy} error={t(error)} refresh={refresh} />
        <section className="usage-composition">
          <h2>{t('用量构成')}</h2>
          {shares.map((share) => (
            <div className={`composition-row ${share.tone}`} key={share.label}>
              <div>
                <span>{share.label}</span>
                <b>{share.value === null ? '—' : `${share.value.toFixed(1)}%`}</b>
              </div>
              <div className="composition-meter" aria-hidden="true">
                <i style={{ width: `${share.value ?? 0}%` }} />
              </div>
            </div>
          ))}
          <p>{t('缓存输入已含在输入中，推理已含在输出中。')}</p>
        </section>
      </div>
      <details className="usage-explanation">
        <summary>{t('统计范围与去重说明')}</summary>
        <p>
          {t(
            '缓存输入包含在输入中，推理包含在输出中，不重复相加。跨午夜的对话按用量事件发生时间分别计入当天。',
          )}
        </p>
        <p>
          {t(
            '本机已记录用量，非账号账单；不按当前登录账号筛选。内部审核及子会话不计入，继承或复制的相同用量事件按轮次、时间和累计计数去重。',
          )}
        </p>
        {stats?.warnings.map((warning) => (
          <p className="token-warning" key={warning}>
            {t(warning)}
          </p>
        ))}
      </details>
      {!!stats?.warnings.length && (
        <p className="token-warning" role="status">
          {t('部分记录不完整，仅展示已确认用量')}
        </p>
      )}
      <footer className="daily-footer">
        <span>
          {t('{0}。页面打开时每 30 秒更新。', [
            stats
              ? t('已读取 {0} 个文件 · 去重 {1} 条 · {2} 更新', [
                  stats.scannedFiles,
                  stats.duplicateRecords,
                  new Date(stats.updatedAt).toLocaleTimeString(getLanguage(), { hour12: false }),
                ])
              : t('没有统计时不会估算用量'),
          ])}
        </span>
      </footer>
    </section>
  );
});
