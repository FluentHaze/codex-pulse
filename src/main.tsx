import { SettingsNavigation } from './SettingsNavigation';
import { Select } from './Select';
/**
 * 桌面详情页入口：消费 preload 状态并组织导航、偏好设置和各业务页面。
 * CSS 按基础布局、功能组件、主题覆盖的顺序加载，调整导入顺序会影响最终样式。
 */
import { useLanguage } from './use-language';
import { t, getLanguage, setLanguage, languages } from '../electron/i18n';
import { menuBarOptions } from '../electron/menu-bar';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  quotaWindows,
  type State,
  type Settings,
  type TokenCatalog,
  type TokenSession,
  type DailyStats,
} from '../electron/types';
import { AppUpdate } from './AppUpdate';
import { ExternalLinkIcon, GitHubIcon, StarGuide } from './StarGuide';
import { avatarDataUrl } from './avatar';
import './star-guide.css';
import type { UpdateState } from '../electron/types';
import { DesktopChrome } from './DesktopChrome';
import { BrandIcon } from './BrandIcon';
import { ResetTracker } from './ResetTracker';
import type { ResetData } from '../electron/reset-data';
import { TokenDetails } from './TokenDetails';
import { RecentSessions } from './RecentSessions';
import { TodayUsage } from './TodayUsage';
import './shell.css';
import './style.css';
import './floating.css';
import './hourly.css';
import { Quota } from './Quota';
import { Floating } from './Floating';
import { HourlyUsage } from './HourlyUsage';
import { CommandPalette, type Command } from './CommandPalette';
import './commands.css';
import './radar-theme.css';
import './localization.css';
import './pulse-design.css';
interface Bridge {
  platform: string;
  getUpdate(): Promise<UpdateState>;
  update(action: 'check' | 'download' | 'install' | 'manual'): Promise<void>;
  subscribeUpdate(callback: (state: UpdateState) => void): () => void;
  windowMenus(): Promise<string[]>;
  windowMenu(label: string, x: number, y: number): Promise<void>;
  getState(): Promise<State>;
  claimStarGuide(): Promise<boolean>;
  resetData(): Promise<ResetData>;
  resetSource(url: string): Promise<void>;
  scopeUsage(ids: string[]): Promise<DailyStats>;
  tokenCatalog(force?: boolean): Promise<TokenCatalog>;
  tokenSession(id: string): Promise<TokenSession>;
  todayUsage(force?: boolean): Promise<DailyStats>;
  refresh(): Promise<void>;
  settings(patch: Partial<Settings>): Promise<void>;
  action(action: string): Promise<void>;
  peek(expanded: boolean): Promise<void>;
  peekSize(height: number): Promise<void>;
  drag(phase: 'start' | 'move' | 'end', x: number, y: number): void;
  subscribe(callback: (state: State) => void): () => void;
}
declare global {
  interface Window {
    pulse?: Bridge;
  }
}
const api = window.pulse;
type IconName =
  | 'pulse'
  | 'overview'
  | 'settings'
  | 'refresh'
  | 'clock'
  | 'shield'
  | 'account'
  | 'more'
  | 'expand'
  | 'collapse'
  | 'theme'
  | 'search'
  | 'moon'
  | 'calendar'
  | 'chart'
  | 'document';
function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 4.5 4.5" />
      </>
    ),
    theme: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
      </>
    ),
    moon: (
      <path
        d="M20.5 14a8.5 8.5 0 0 1-10.5-10.5A8.5 8.5 0 1 0 20.5 14Z"
        fill="currentColor"
        stroke="none"
      />
    ),
    expand: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M3 9h18M15 9v11" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18m-12 4h2m3 0h2" />
      </>
    ),
    chart: <path d="M5 20V12m7 8V4m7 16V9" />,
    document: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6M8 13h8m-8 4h5" />
      </>
    ),
    collapse: <path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5" />,
    pulse: <path d="M3 12h4l3-7 4 14 3-7h4" />,
    overview: (
      <>
        <rect x="4" y="4" width="6" height="16" rx="1.5" />
        <rect x="14" y="4" width="6" height="10" rx="1.5" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" />
        <circle cx="16" cy="17" r="3" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 8a8 8 0 1 0 .2 7M20 3v5h-5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    account: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 21v-3a7 7 0 0 1 14 0v3" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
  };
  return (
    <svg
      className={`icon ${className}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function App() {
  useLanguage();
  const [state, setState] = useState<State>();
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState('overview');
  const [tokenSession, setTokenSession] = useState('');
  // 展示正在运行的版本，而非下载目标版本；只有重启到新应用后版本号才改变。
  const [appVersion, setAppVersion] = useState<string>();
  useEffect(() => {
    let alive = true;
    void api
      ?.getUpdate()
      .then((value) => {
        if (alive) setAppVersion(value.currentVersion);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    if (state?.locale) setLanguage(state.locale);
  }, [state?.locale]);
  useEffect(() => {
    document.documentElement.lang = getLanguage();
    document.title = 'Codex Pulse';
  });
  const [commandOpen, setCommandOpen] = useState(false),
    [toast, setToast] = useState<{
      id: number;
      text: string;
    }>();
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 2400);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const disableTabNavigation = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', disableTabNavigation, true);
    window.addEventListener('keydown', shortcut);
    return () => {
      window.removeEventListener('keydown', disableTabNavigation, true);
      window.removeEventListener('keydown', shortcut);
    };
  }, []);
  const [systemDark, setSystemDark] = useState(
    () => matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const navigate = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (['overview', 'resets', 'tokens', 'today', 'settings'].includes(next)) setTab(next);
    };
    window.addEventListener('pulse-navigate', navigate);
    const initial = new URLSearchParams(location.search).get('tab');
    if (initial && ['overview', 'resets', 'tokens', 'today', 'settings'].includes(initial))
      setTab(initial);
    return () => window.removeEventListener('pulse-navigate', navigate);
  }, []);
  useEffect(() => {
    const online = () => {
      void api?.action('online');
    };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, []);
  useEffect(() => {
    if (!api) return;
    let mounted = true;
    const unsubscribe = api.subscribe((value) => {
      if (mounted) setState(value);
    });
    void api
      .getState()
      .then((value) => {
        if (mounted) setState(value);
      })
      .catch(() => setLocalError('无法连接应用后台'));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, []);
  const run = (work: Promise<unknown> | undefined) => {
    void work?.catch(() => setLocalError('操作失败，请重试'));
  };
  const action = (name: string) => run(api?.action(name));
  const setting = (patch: Partial<Settings>) => {
    if (!api) return;
    void api
      .settings(patch)
      .then(() => {
        setLocalError('');
        setToast({ id: Date.now(), text: patch.theme ? '已更新外观偏好' : '设置已自动保存' });
      })
      .catch(() => setLocalError('设置保存失败，请重试'));
  };
  if (!api)
    return (
      <div className="unavailable">
        <h1>Codex Pulse</h1>
        <p>{t('请通过 Electron 桌面应用启动，以读取本机 Codex 额度。')}</p>
        <code>npm start</code>
      </div>
    );
  if (!state) return <div className="unavailable">{t('正在连接后台…{0}', [localError])}</div>;
  const view = new URLSearchParams(location.search).get('view');
  const live = state.live;
  const liveCount = live?.tokens?.total;
  const liveLabel =
    live?.status === 'completed'
      ? t('上轮')
      : live?.status === 'interrupted'
        ? t('中断')
        : t('本轮');
  const liveText =
    liveCount == null
      ? '—'
      : liveCount >= 1000000
        ? `${+(liveCount / 1000000).toFixed(1)}M`
        : liveCount >= 1000
          ? `${+(liveCount / 1000).toFixed(1)}K`
          : liveCount.toString();
  const liveTitle = t('{0}：{1}\n{2}{3}\n输入 {4} / 输出 {5}\n{6}', [
    state.settings.watchedSessionId ? t('固定跟踪') : t('自动跟随本机最近更新的聊天'),
    (live?.titleKey ? t(live.titleKey) : live?.title) ?? t('等待本机记录'),
    live?.turnNumber ? t('第 {0} 轮 · ', [live.turnNumber]) : '',
    liveCount == null
      ? t('暂无统计')
      : `${liveCount.toLocaleString()} Token${live?.complete ? '' : t('（统计不完整）')}`,
    live?.tokens?.input?.toLocaleString() ?? '—',
    live?.tokens?.output?.toLocaleString() ?? '—',
    (live?.error ? t(live.error) : null) ?? t('随本地用量事件更新，不按当前登录账号筛选'),
  ]);
  const stale = !!state.updatedAt && now - state.updatedAt > state.settings.interval * 120000;
  const status = stale ? t('数据过期') : state.refreshing ? t('正在刷新') : state.status;
  const age = state.updatedAt ? now - state.updatedAt : null;
  const updated =
    age === null
      ? t('尚未成功更新')
      : age < 60000
        ? t('刚刚更新')
        : t('{0}分钟前更新', [Math.floor(age / 60000)]);
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && systemDark);
  const used = state.settings.quotaDisplay === 'used';
  if (view === 'float' || view === 'peek')
    return <Floating state={state} now={now} dark={dark} popup={view === 'peek'} />;
  const navigate = (next: string) => {
    setTab(next);
    requestAnimationFrame(() => document.querySelector<HTMLHeadingElement>('main h1')?.focus());
  };
  const openSetting = (label: string) => {
    navigate('settings');
    requestAnimationFrame(() => {
      const row = Array.from(document.querySelectorAll<HTMLElement>('.setting-row')).find(
        (element) => element.querySelector('b')?.textContent === label,
      );
      row?.scrollIntoView({ block: 'center' });
      row?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
    });
  };
  const commands: Command[] = [
    ...[
      { id: 'overview', label: t('额度概览'), keywords: ['quota', '余额', '剩余额度', '已用额度'] },
      {
        id: 'resets',
        label: t('重置雷达'),
        keywords: ['reset', '重置时间', '重置日历', '全局重置'],
      },
      {
        id: 'today',
        label: t('今日用量'),
        keywords: ['usage', '消耗', '统计', '小时', '每日用量'],
      },
      {
        id: 'tokens',
        label: t('Token 明细'),
        keywords: ['聊天', '会话', '跟踪', '目录', 'session', 'token'],
      },
      { id: 'settings', label: t('偏好设置'), keywords: ['preferences', '配置', '选项'] },
    ].map((item) => ({ ...item, hint: t('跳转页面'), run: () => navigate(item.id) })),
    {
      id: 'refresh',
      label: t('刷新额度'),
      keywords: ['refresh', '手动刷新', '更新额度'],
      hint: state.refreshing ? t('当前正在刷新') : t('读取最新的账号额度'),
      run: () => {
        if (!state.refreshing) run(api.refresh());
      },
    },
    ...(api.platform !== 'darwin'
      ? [
          {
            id: 'float',
            label: t('显示悬浮窗'),
            hint: t('回到桌面侧边栏'),
            run: () => action('show'),
          },
        ]
      : []),
    ...(['dark', 'light', 'system'] as const).map((theme) => ({
      id: theme,
      label: { dark: t('深色主题'), light: t('浅色主题'), system: t('跟随系统主题') }[theme],
      hint: t('外观偏好'),
      keywords: [
        'theme',
        '主题',
        '外观',
        ...(theme === 'dark'
          ? ['夜间', '黑色']
          : theme === 'light'
            ? ['白天', '白色']
            : ['自动主题']),
      ],
      run: () => setting({ theme }),
    })),
    ...[
      {
        id: 'language',
        label: t('显示语言'),
        keywords: ['language', '中文', '英文', 'English', '日本語', '한국어', '繁體'],
      },
      {
        id: 'interval',
        label: t('刷新周期'),
        keywords: ['interval', '自动刷新', '刷新频率', '定时', '分钟'],
      },
      {
        id: 'low-alerts',
        label: t('低额度通知'),
        keywords: ['notification', '提醒', '额度不足', '告警'],
      },
      {
        id: 'recovery-alerts',
        label: t('额度恢复通知'),
        keywords: ['notification', '提醒', '重置通知', '恢复提醒'],
      },
      {
        id: 'startup',
        label: t('开机启动'),
        keywords: ['startup', '自启动', '自动启动', '开机运行'],
      },
      {
        id: 'show-on-launch',
        label: api.platform === 'darwin' ? t('显示桌面悬浮窗') : t('启动时显示'),
        keywords: ['悬浮窗', '启动显示', 'float'],
      },
      {
        id: 'always-on-top',
        label: t('窗口置顶'),
        keywords: ['top', '悬浮窗', '最前', '始终可见'],
      },
      { id: 'locked', label: t('锁定位置'), keywords: ['lock', '悬浮窗', '拖动', '固定位置'] },
      {
        id: 'click-through',
        label: t('鼠标穿透'),
        keywords: ['click through', '悬浮窗', '点击穿透'],
      },
      { id: 'opacity', label: t('不透明度'), keywords: ['opacity', '透明度', '悬浮窗'] },
      ...(api.platform === 'darwin'
        ? [
            {
              id: 'menu-bar-display',
              label: t('显示内容'),
              keywords: ['Mac', '菜单栏', 'menu bar', '百分比', '图标'],
            },
            {
              id: 'menu-bar-hover',
              label: t('移入显示悬浮窗'),
              keywords: ['Mac', '菜单栏', 'hover', '悬停'],
            },
          ]
        : []),
    ].map((item) => ({
      ...item,
      hint: t('偏好设置'),
      run: () => openSetting(item.label),
    })),
    {
      id: 'app-update',
      label: t('版本更新'),
      hint: t('偏好设置'),
      keywords: ['update', '升级', '版本号', '检查更新', '下载更新', '重启更新'],
      run: () => {
        navigate('settings');
        requestAnimationFrame(() => {
          document.querySelector('.app-update')?.scrollIntoView({ block: 'center' });
          document.querySelector<HTMLElement>('.app-update button')?.focus({ preventScroll: true });
        });
      },
    },
    ...[
      {
        id: 'github',
        label: 'GitHub',
        keywords: ['star', '开源', '源码', '项目', '仓库', '支持', '反馈'],
        action: 'github',
      },
      {
        id: 'login',
        label: t('登录账号 ↗'),
        keywords: ['login', '登录', '账号', '账户', '连接', '认证'],
        action: 'login',
      },
      {
        id: 'choose-codex',
        label: t('选择 Codex 可执行文件'),
        keywords: ['路径', '连接', 'exe', 'codexPath'],
        action: 'choose',
      },
      {
        id: 'install-codex',
        label: t('安装指引 ↗'),
        keywords: ['install', '安装', '下载', 'Codex'],
        action: 'install',
      },
    ].map((item) => ({ ...item, hint: t('快速操作'), run: () => action(item.action) })),
    {
      id: 'detect-codex',
      label: t('恢复自动检测'),
      hint: t('Codex 连接'),
      keywords: ['自动检测', '路径', 'codexPath'],
      run: () => setting({ codexPath: '' }),
    },
  ];
  const toggle = (key: keyof Settings, label: string, help: string) => (
    <label className="setting-row">
      <span>
        <b>{label}</b>
        <small>{help}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={Boolean(state.settings[key])}
        onChange={(e) => setting({ [key]: e.target.checked })}
      />
    </label>
  );
  return (
    <div className={`app ${dark ? 'dark' : 'light'}`}>
      {api.platform === 'win32' && <DesktopChrome />}
      <header className="app-toolbar">
        <div className="logo">
          <span className="logo-mark">
            <BrandIcon />
          </span>
          <b>
            Codex Pulse<small>{t('额度监控 / 重置追踪')}</small>
          </b>
        </div>
        <div className="nav-caption">{t('监控面板')}</div>
        <nav aria-label={t('主导航')}>
          {(
            [
              { id: 'overview', label: t('额度概览'), icon: 'overview' },
              { id: 'resets', label: t('重置雷达'), icon: 'calendar' },
              { id: 'today', label: t('今日用量'), icon: 'chart' },
              { id: 'tokens', label: t('Token 明细'), icon: 'document' },
              { id: 'settings', label: t('偏好设置'), icon: 'settings' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-current={tab === item.id ? 'page' : undefined}
              title={item.label}
              aria-label={item.label}
              className={tab === item.id ? 'selected' : ''}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-account" aria-label={t('当前账号')}>
            <span className="account-avatar">
              {state.account ? (
                <img src={avatarDataUrl(state.account)} alt="" width="32" height="32" />
              ) : (
                <Icon name="account" />
              )}
              <i
                className={state.error ? 'connection-dot offline' : 'connection-dot'}
                aria-hidden="true"
              />
            </span>
            <span className="sidebar-account-label">
              <b title={state.account ?? undefined}>{state.account ?? t('尚未连接')}</b>
              <small>{state.plan ?? 'ChatGPT'}</small>
            </span>
          </div>
          <div className="sidebar-meta">
            <span className="local-label">
              <Icon name="shield" />
              {t('本机额度监控')}
            </span>
            <AppUpdate
              compact
              currentVersion={appVersion}
              onOpen={() => {
                navigate('settings');
                requestAnimationFrame(() =>
                  document.getElementById('settings-updates')?.scrollIntoView({ block: 'start' }),
                );
              }}
            />
          </div>
        </div>
      </header>
      <div className="workspace">
        <div className="workspace-bar">
          <button
            className="command-trigger"
            onClick={() => setCommandOpen(true)}
            aria-haspopup="dialog"
            aria-label={t('搜索操作')}
            title={`${t('搜索页面或操作…')} · Ctrl / ⌘ K`}
            aria-expanded={commandOpen}
          >
            <Icon name="search" />
          </button>
          <div>
            {tab === 'overview' && (
              <div className="segmented" aria-label={t('额度显示方式')}>
                <button
                  aria-pressed={!used}
                  className={!used ? 'active' : ''}
                  onClick={() => setting({ quotaDisplay: 'remaining' })}
                >
                  {t('剩余')}
                </button>
                <button
                  aria-pressed={used}
                  className={used ? 'active' : ''}
                  onClick={() => setting({ quotaDisplay: 'used' })}
                >
                  {t('已用')}
                </button>
              </div>
            )}
            {tab !== 'tokens' && tab !== 'today' && tab !== 'resets' && (
              <button
                className="toolbar-refresh"
                title={t('立即刷新')}
                aria-label={t('立即刷新')}
                disabled={state.refreshing}
                onClick={() => run(api.refresh())}
              >
                <Icon name="refresh" className={state.refreshing ? 'refreshing' : ''} />
                <span>{state.refreshing ? t('刷新中…') : t('刷新')}</span>
              </button>
            )}
            <button
              type="button"
              className="theme-toggle"
              role="switch"
              aria-label={t('深色主题')}
              aria-checked={dark}
              title={dark ? t('浅色主题') : t('深色主题')}
              onClick={() => setting({ theme: dark ? 'light' : 'dark' })}
            >
              <span className="theme-toggle-thumb" aria-hidden="true" />
              <Icon name="theme" />
              <Icon name="moon" />
            </button>
            {api.platform !== 'darwin' && (
              <button
                className="toolbar-floating"
                aria-label={t('显示悬浮窗')}
                title={t('显示悬浮窗')}
                onClick={() => action('show')}
              >
                <Icon name="expand" />
                <span>{t('显示悬浮窗')}</span>
              </button>
            )}
          </div>
        </div>
        <main className={`page-${tab}${tab === 'resets' ? ' reset-page' : ''}`}>
          <div className="page-heading">
            <div>
              <h1 tabIndex={-1}>
                {tab === 'overview'
                  ? t('额度概览')
                  : tab === 'resets'
                    ? t('重置日历')
                    : tab === 'tokens'
                      ? t('Token 明细')
                      : tab === 'today'
                        ? t('今日用量')
                        : t('偏好设置')}
              </h1>
              <p>
                {tab === 'overview'
                  ? t('查看你的 Codex 可用额度与重置时间')
                  : tab === 'resets'
                    ? t('全局重置预测、历史日历与个人额度窗口')
                    : tab === 'tokens'
                      ? t('查看每轮对话实际记录的 Token 用量')
                      : tab === 'today'
                        ? t('本机今天已记录的 Token 消耗')
                        : t('管理监控频率、通知和桌面显示')}
              </p>
            </div>
          </div>
          {(state.error || localError) && (
            <div role="alert" className="alert">
              <span>{t(localError || state.error || '')}</span>
              {state.error && <button onClick={() => setTab('settings')}>{t('检查连接')}</button>}
              {localError && (
                <button aria-label={t('关闭操作提示')} onClick={() => setLocalError('')}>
                  {t('关闭')}
                </button>
              )}
            </div>
          )}
          {tab === 'overview' ? (
            <>
              <div className="overview-primary">
                <div className="overview-quotas">
                  {state.buckets.length ? (
                    state.buckets.map((bucket) => {
                      const bucketWindows = quotaWindows(bucket);
                      return (
                        <section className="bucket" key={bucket.limitId}>
                          <div className="bucket-heading" hidden={state.buckets.length === 1}>
                            <h2>
                              {bucket.limitName ??
                                (bucket.limitId === 'codex' ? t('Codex 额度') : bucket.limitId)}
                            </h2>
                            <span title={t('仅展示服务端返回的窗口，未返回不代表无限额度')}>
                              {bucketWindows.length === 1
                                ? t('服务端返回 1 个额度窗口')
                                : t('账号共享额度')}
                            </span>
                          </div>
                          {bucketWindows.length ? (
                            <div
                              className={`quota-grid ${bucketWindows.length === 1 ? 'single-window' : ''}`}
                            >
                              {bucketWindows.map((window, index) => (
                                <Quota key={index} quota={window} now={now} used={used} />
                              ))}
                            </div>
                          ) : (
                            <p className="no-quota-note">
                              {t('服务端未返回额度窗口，暂无法确认额度；这不代表无限额度。')}
                            </p>
                          )}
                        </section>
                      );
                    })
                  ) : (
                    <section className="empty">
                      <Icon name="overview" />
                      <h2>{state.refreshing ? t('正在获取额度') : t('尚无额度数据')}</h2>
                      <p>
                        {(state.error ? t(state.error) : null) ??
                          t('连接已登录的 Codex，即可查看你的额度。')}
                      </p>
                      <button onClick={() => action('login')}>{t('登录 Codex')}</button>
                      <button onClick={() => setTab('settings')}>{t('检查路径设置')}</button>
                    </section>
                  )}
                </div>
                <button className="session-card" title={liveTitle} onClick={() => setTab('tokens')}>
                  <span className="session-icon">
                    <Icon name="pulse" />
                  </span>
                  <span className="session-card-heading">{liveLabel} Token</span>
                  <span className="session-count">
                    <strong>{liveText}</strong>
                    <small>{liveLabel} Token</small>
                  </span>
                  <span className="session-copy">
                    <small>
                      {state.settings.watchedSessionId ? t('固定跟踪的聊天') : t('最近的本机聊天')}
                    </small>
                    <b>
                      {(live?.titleKey ? t(live.titleKey) : live?.title) ?? t('等待本机聊天记录')}
                    </b>
                    <span>
                      {(live?.error ? t(live.error) : null) ??
                        (live?.status === 'completed'
                          ? t('本轮已完成')
                          : liveCount == null
                            ? t('等待用量事件')
                            : t('本机已记录用量'))}
                    </span>
                  </span>
                  <span className="session-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
              </div>
              <div className="overview-secondary">
                <HourlyUsage sessionPath={state.settings.sessionPath} />
                <RecentSessions
                  sessionPath={state.settings.sessionPath}
                  onSelect={(id) => {
                    setTokenSession(id);
                    navigate('tokens');
                  }}
                />
              </div>
              <button className="reset-entry" onClick={() => navigate('resets')}>
                <Icon name="clock" />
                <span>
                  <b>{t('重置日历')}</b>
                  <small>{t('查看 24 / 48 小时预测与重置日历')}</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
              <section className="connection">
                <div>
                  <Icon name="refresh" />
                  {updated}
                </div>
                <span>{t('每 {0} 分钟自动刷新', [state.settings.interval])}</span>
              </section>
              <footer className="overview-note">
                <Icon name="shield" />
                <p>
                  {t('额度与 Token 用量均在本机读取。')}
                  <span>{t('额度由整个账号共享，重置以服务端确认为准。')}</span>
                </p>
              </footer>
            </>
          ) : tab === 'resets' ? (
            <ResetTracker
              now={now}
              buckets={state.buckets}
              settings={state.settings}
              onSettings={setting}
            />
          ) : tab === 'today' ? (
            <TodayUsage sessionPath={state.settings.sessionPath} />
          ) : tab === 'tokens' ? (
            <TokenDetails
              sessionPath={state.settings.sessionPath}
              watchedSessionId={state.settings.watchedSessionId}
              initialSessionId={tokenSession}
            />
          ) : (
            <div className="settings-layout">
              <SettingsNavigation
                categories={[
                  { id: 'settings-monitoring', label: t('监控与提醒') },
                  { id: 'settings-desktop', label: t('悬浮窗') },
                  { id: 'settings-appearance', label: t('外观与语言') },
                  { id: 'settings-connection', label: t('Codex 连接') },
                  { id: 'settings-updates', label: t('版本更新') },
                  { id: 'settings-about', label: t('关于 Codex Pulse') },
                ]}
              />
              <div className="settings-sections">
                <section id="settings-monitoring" className="settings-card settings-category">
                  <h2>{t('监控与提醒')}</h2>
                  <label className="setting-row">
                    <span>
                      <b>{t('刷新周期')}</b>
                      <small>{t('按设定频率自动更新额度')}</small>
                    </span>
                    <Select
                      aria-label={t('刷新周期')}
                      value={state.settings.interval}
                      onValueChange={(value) => setting({ interval: Number(value) })}
                    >
                      {Array.from(new Set([1, 3, 5, 10, 15, 30, 60, state.settings.interval]))
                        .sort((a, b) => a - b)
                        .map((value) => (
                          <option key={value} value={value}>
                            {t('{0} 分钟', [value])}
                          </option>
                        ))}
                    </Select>
                  </label>
                  {toggle('lowAlerts', t('低额度通知'), t('跨过 20%、10% 和 0% 时提醒'))}
                  {toggle('recoveryAlerts', t('额度恢复通知'), t('此前耗尽，并确认恢复时提醒'))}
                  {toggle(
                    'globalResetAlerts',
                    t('全局重置通知'),
                    t('确认新全局重置时提醒，不重复推送历史公告'),
                  )}
                  {toggle('resetReminder', t('窗口到期提醒'), t('个人窗口提前 15 分钟提醒'))}
                </section>
                <section id="settings-desktop" className="settings-card settings-category">
                  <h2>{t('悬浮窗')}</h2>
                  {toggle('startup', t('开机启动'), t('登录系统后在后台运行'))}
                  {toggle(
                    'showOnLaunch',
                    api.platform === 'darwin' ? t('显示桌面悬浮窗') : t('启动时显示'),
                    api.platform === 'darwin'
                      ? t('立即生效，下次启动时保留此选择')
                      : t('关闭详情窗口后仍在后台监控'),
                  )}
                  {toggle('alwaysOnTop', t('窗口置顶'), t('让额度始终可见'))}
                  {toggle('locked', t('锁定位置'), t('避免误拖动'))}
                  {toggle('clickThrough', t('鼠标穿透'), t('开启后请从系统托盘右键菜单恢复'))}
                  <label className="setting-row">
                    <span>
                      <b>{t('不透明度')}</b>
                      <small>{Math.round(state.settings.opacity * 100)}%</small>
                    </span>
                    <input
                      aria-label={t('不透明度')}
                      type="range"
                      min="0.65"
                      max="1"
                      step="0.05"
                      value={state.settings.opacity}
                      onChange={(e) => setting({ opacity: Number(e.target.value) })}
                    />
                  </label>
                </section>
                {api.platform === 'darwin' && (
                  <section className="settings-card">
                    <h2>{t('Mac 菜单栏')}</h2>
                    <label className="setting-row">
                      <span>
                        <b>{t('显示内容')}</b>
                        <small>{t('默认显示主要额度窗口的剩余百分比')}</small>
                      </span>
                      <Select
                        aria-label={t('显示内容')}
                        value={state.settings.menuBarDisplay}
                        onValueChange={(value) =>
                          setting({ menuBarDisplay: value as Settings['menuBarDisplay'] })
                        }
                      >
                        {menuBarOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(option.label)}
                          </option>
                        ))}
                      </Select>
                    </label>
                    {toggle(
                      'menuBarHover',
                      t('移入显示悬浮窗'),
                      t('鼠标移入顶部菜单栏图标时查看额度和 Token'),
                    )}
                  </section>
                )}
                <section id="settings-appearance" className="settings-card settings-category">
                  <h2>{t('外观与语言')}</h2>
                  <label className="setting-row">
                    <span>
                      <b>{t('显示语言')}</b>
                      <small>{t('立即生效，默认跟随系统语言')}</small>
                    </span>
                    <Select
                      aria-label={t('显示语言')}
                      value={state.settings.language ?? 'system'}
                      onValueChange={(value) =>
                        setting({ language: value as Settings['language'] })
                      }
                    >
                      <option value="system">{t('跟随系统')}</option>
                      {languages.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="setting-row">
                    <b>{t('主题')}</b>
                    <Select
                      aria-label={t('主题')}
                      value={state.settings.theme}
                      onValueChange={(value) => setting({ theme: value as Settings['theme'] })}
                    >
                      <option value="system">{t('跟随系统')}</option>
                      <option value="dark">{t('深色')}</option>
                      <option value="light">{t('浅色')}</option>
                    </Select>
                  </label>
                </section>
                <section
                  id="settings-connection"
                  className="settings-card settings-category settings-secondary"
                >
                  <h2>{t('Codex 连接')}</h2>
                  <p className="path">
                    {state.settings.codexPath ||
                      state.executable ||
                      t('自动检测本机 Codex 可执行文件')}
                  </p>
                  <div className="actions">
                    <button onClick={() => action('choose')}>{t('选择 Codex 可执行文件')}</button>
                    <button onClick={() => setting({ codexPath: '' })}>{t('恢复自动检测')}</button>
                    <button onClick={() => action('login')}>{t('登录账号 ↗')}</button>
                    <button onClick={() => action('install')}>{t('安装指引 ↗')}</button>
                  </div>
                  <p className="note">
                    {t('不复制或保存登录 Token，仅通过本机 app-server 读取账号额度。')}
                  </p>
                </section>
                <div id="settings-updates" className="settings-category settings-secondary">
                  <AppUpdate />
                </div>
                <section
                  id="settings-about"
                  className="settings-card about-card settings-category settings-secondary"
                >
                  <h2>{t('关于 Codex Pulse')}</h2>
                  <div className="setting-row">
                    <span>
                      <b>Codex Pulse{appVersion ? ` · v${appVersion}` : ''}</b>
                      <small>{t('额度与 Token 用量均在本机读取。')}</small>
                    </span>
                    <button className="about-github" onClick={() => action('github')}>
                      <GitHubIcon />
                      GitHub
                      <ExternalLinkIcon />
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      </div>
      <CommandPalette open={commandOpen} close={() => setCommandOpen(false)} commands={commands} />
      <StarGuide />
      {toast && (
        <div className="save-toast" role="status">
          <span aria-hidden="true">✓</span>
          {t(toast.text)}
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
