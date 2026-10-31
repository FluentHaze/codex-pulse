/**
 * 同一份更新状态驱动侧栏提示和设置卡片；订阅先于首屏读取，避免旧快照覆盖新事件。
 */
import { useEffect, useRef, useState } from 'react';
import type { UpdateState } from '../electron/types';
import { t } from '../electron/i18n';

export function AppUpdate({
  compact = false,
  currentVersion,
  onOpen,
}: {
  compact?: boolean;
  currentVersion?: string;
  onOpen?: () => void;
}) {
  const [state, setState] = useState<UpdateState>();
  const [error, setError] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const api = window.pulse;
    if (!api) return;
    let alive = true,
      received = false;
    const unsubscribe = api.subscribeUpdate((value) => {
      received = true;
      if (alive) setState(value);
    });
    void api
      .getUpdate()
      .then((value) => {
        if (alive && !received) setState(value);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
      mounted.current = false;
      unsubscribe();
    };
  }, []);
  const run = (action: 'check' | 'download' | 'install' | 'manual') => {
    setError(false);
    void window.pulse?.update(action).catch(() => {
      if (mounted.current) setError(true);
    });
  };
  const status = state?.status;
  const dmg = state?.installMode === 'dmg';
  const busy = !state || ['checking', 'downloading', 'installing'].includes(status ?? '');
  const message =
    status === 'installing'
      ? '正在准备安装，完成后将自动重启…'
      : status === 'manual'
        ? '当前版本请前往下载页面安装更新'
        : status === 'checking'
          ? '正在检查新版本…'
          : status === 'available'
            ? '发现新版本，可下载更新'
            : status === 'downloading'
              ? '正在下载更新…'
              : status === 'downloaded'
                ? dmg
                  ? '安装包已就绪，点击后自动安装并重启'
                  : '更新已就绪，重启后生效'
                : status === 'latest'
                  ? '当前已是最新版本'
                  : dmg
                    ? '发现新版后自动后台下载，点击安装更新'
                    : '发现新版后自动后台下载，点击重启更新';
  if (compact) {
    const attention =
      error || ['available', 'downloading', 'downloaded', 'error'].includes(status ?? '');
    const label = error ? t('更新失败，点击重试') : t(message);
    return (
      <button
        className="sidebar-version"
        aria-label={`${t('版本更新')} · ${label}`}
        title={`${t('版本更新')} · ${label}${status === 'downloading' ? ` ${Math.floor(state?.percent ?? 0)}%` : ''}`}
        onClick={onOpen}
      >
        <span>v{state?.currentVersion ?? currentVersion ?? '—'}</span>
        {attention && (
          <i
            className={error || status === 'error' ? 'update-dot failed' : 'update-dot'}
            aria-hidden="true"
          />
        )}
        <span className="version-link">{t('版本更新')}</span>
      </button>
    );
  }
  return (
    <section className="settings-card app-update">
      <h2>{t('版本更新')}</h2>
      <div className="setting-row">
        <span>
          <b>Codex Pulse{state && ` · v${state.currentVersion}`}</b>
          <small role="status">
            {t(message)}
            {state?.version && ` · v${state.version}`}
          </small>
        </span>
        <button
          disabled={busy}
          onClick={() =>
            run(
              status === 'available'
                ? 'download'
                : status === 'downloaded'
                  ? 'install'
                  : status === 'manual'
                    ? 'manual'
                    : 'check',
            )
          }
        >
          {t(
            status === 'available'
              ? '下载更新'
              : status === 'downloaded'
                ? '重启并安装'
                : status === 'manual'
                  ? '下载最新版 ↗'
                  : status === 'installing'
                    ? '安装中…'
                    : status === 'checking'
                      ? '检查中…'
                      : status === 'downloading'
                        ? '下载中…'
                        : '检查更新',
          )}
        </button>
      </div>
      {status === 'downloading' && (
        <progress
          aria-label={t('更新下载进度')}
          max={100}
          value={state?.percent ?? 0}
          style={{ width: '100%' }}
        />
      )}
      {(error || status === 'error') && (
        <p className="note" role="alert">
          {t('更新失败，请检查网络或前往下载页面')}{' '}
          <button onClick={() => run('manual')}>{t('下载最新版 ↗')}</button>
        </p>
      )}
      {status === 'downloaded' && (
        <p className="note">
          {dmg
            ? t(
                '安装时会自动退出 Pulse、替换应用并重新打开。系统需要授权时按提示操作，你的设置会保留。',
              )
            : t('重启会暂时中断监控，你的设置会保留。')}
        </p>
      )}
    </section>
  );
}
