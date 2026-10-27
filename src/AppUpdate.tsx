import { useEffect, useRef, useState } from 'react';
import type { UpdateState } from '../electron/types';
import { t } from '../electron/i18n';

export function AppUpdate({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<UpdateState>();
  const [error, setError] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const api = window.pulse;
    if (!api) return;
    let alive = true, received = false;
    const unsubscribe = api.subscribeUpdate(value => { received = true; if (alive) setState(value); });
    void api.getUpdate().then(value => { if (alive && !received) setState(value); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; mounted.current = false; unsubscribe(); };
  }, []);
  const run = (action: 'check' | 'download' | 'install' | 'manual') => {
    setError(false);
    void window.pulse?.update(action).catch(() => { if (mounted.current) setError(true); });
  };
  const status = state?.status;
  const dmg = state?.installMode === 'dmg';
  const busy = !state || status === 'checking' || status === 'downloading';
  const message = status === 'manual' ? '当前版本请前往下载页面安装更新' : status === 'checking' ? '正在检查新版本…' : status === 'available' ? '发现新版本，可下载更新' : status === 'downloading' ? '正在下载更新…' : status === 'downloaded' ? (dmg ? '安装包已就绪，点击打开后手动替换应用' : '更新已就绪，重启后生效') : status === 'latest' ? '当前已是最新版本' : (dmg ? '发现新版后自动后台下载，点击安装更新' : '发现新版后自动后台下载，点击重启更新');
  if (compact) {
    if (!error && !['downloading', 'downloaded', 'error'].includes(status ?? '')) return null;
    const label = error || status === 'error' ? t('更新失败，点击重试') : status === 'downloaded' ? (dmg ? t('安装更新') : t('重启更新')) : t('后台下载中…');
    return <div className="sidebar-update" role="status"><button disabled={status === 'downloading'} title={`${label}${state?.version ? ` · v${state.version}` : ''}`} aria-label={label} onClick={() => run(status === 'downloaded' ? 'install' : 'check')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" /></svg>
      <span><b>{label}</b><small>{state?.version ? `v${state.version}` : ''}{status === 'downloading' ? ` · ${Math.floor(state?.percent ?? 0)}%` : ''}</small></span>
    </button>{status === 'downloading' && <progress aria-label={t('更新下载进度')} max={100} value={state?.percent ?? 0} />}</div>;
  }
  return <section className="settings-card app-update"><h2>{t('版本更新')}</h2>
    <div className="setting-row"><span><b>Codex Pulse{state && ` · v${state.currentVersion}`}</b><small role="status">{t(message)}{state?.version && ` · v${state.version}`}</small></span>
      <button disabled={busy} onClick={() => run(status === 'available' ? 'download' : status === 'downloaded' ? 'install' : status === 'manual' ? 'manual' : 'check')}>
        {t(status === 'available' ? '下载更新' : status === 'downloaded' ? (dmg ? '安装更新' : '重启并安装') : status === 'manual' ? '下载最新版 ↗' : status === 'checking' ? '检查中…' : status === 'downloading' ? '下载中…' : '检查更新')}
      </button>
    </div>
    {status === 'downloading' && <progress aria-label={t('更新下载进度')} max={100} value={state?.percent ?? 0} style={{ width: '100%' }} />}
    {(error || status === 'error') && <p className="note" role="alert">{t('更新失败，请检查网络或前往下载页面')} <button onClick={() => run('manual')}>{t('下载最新版 ↗')}</button></p>}
    {status === 'downloaded' && <p className="note">{dmg ? t('打开 DMG 后，请退出 Pulse，将新版拖入「应用程序」并确认替换，再打开新版。系统需要授权时按提示操作，你的设置会保留。') : t('重启会暂时中断监控，你的设置会保留。')}</p>}
  </section>;
}
