import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { quotaWindows, type State, type Settings, type TokenCatalog, type TokenSession, type DailyStats } from '../electron/types';
import { TokenDetails } from './TokenDetails';
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

interface Bridge { getState(): Promise<State>; scopeUsage(ids: string[]): Promise<DailyStats>; tokenCatalog(force?: boolean): Promise<TokenCatalog>; tokenSession(id: string): Promise<TokenSession>; todayUsage(force?: boolean): Promise<DailyStats>; refresh(): Promise<void>; settings(patch: Partial<Settings>): Promise<void>; action(action: string): Promise<void>; peek(expanded: boolean): Promise<void>; drag(phase: 'start' | 'move' | 'end', x: number, y: number): void; subscribe(callback: (state: State) => void): () => void }
declare global { interface Window { pulse?: Bridge } }
const api = window.pulse;
type IconName = 'pulse' | 'overview' | 'settings' | 'refresh' | 'clock' | 'shield' | 'account' | 'more' | 'expand' | 'collapse' | 'theme';
function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    theme: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></>,
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>,
    collapse: <path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5"/>,
    pulse: <path d="M3 12h4l3-7 4 14 3-7h4"/>,
    overview: <><rect x="4" y="4" width="6" height="16" rx="1.5"/><rect x="14" y="4" width="6" height="10" rx="1.5"/></>,
    settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></>,
    refresh: <><path d="M20 8a8 8 0 1 0 .2 7M20 3v5h-5"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>,
    shield: <><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
    account: <><circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>
  };
  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function App() {
  const [state, setState] = useState<State>(); const [now, setNow] = useState(Date.now()); const [tab, setTab] = useState('overview'); const [localError, setLocalError] = useState('');
  const [commandOpen, setCommandOpen] = useState(false), [toast, setToast] = useState<{ id: number; text: string }>();
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(undefined), 2400); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(value => !value); } }; window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut); }, []);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const change = () => setSystemDark(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  useEffect(() => { const navigate = (event: Event) => { const next = (event as CustomEvent<string>).detail; if (['overview', 'tokens', 'today', 'settings'].includes(next)) setTab(next); }; window.addEventListener('pulse-navigate', navigate); const initial = new URLSearchParams(location.search).get('tab'); if (initial && ['overview', 'tokens', 'today', 'settings'].includes(initial)) setTab(initial); return () => window.removeEventListener('pulse-navigate', navigate); }, []);
  useEffect(() => { const online = () => { void api?.action('online'); }; window.addEventListener('online', online); return () => window.removeEventListener('online', online); }, []);
  useEffect(() => { if (!api) return; let mounted = true; const unsubscribe = api.subscribe(value => { if (mounted) setState(value); }); void api.getState().then(value => { if (mounted) setState(value); }).catch(() => setLocalError('无法连接应用后台')); const timer = setInterval(() => setNow(Date.now()), 1000); return () => { mounted = false; unsubscribe(); clearInterval(timer); }; }, []);
  const run = (work: Promise<unknown> | undefined) => { void work?.catch(() => setLocalError('操作失败，请重试')); };
  const action = (name: string) => run(api?.action(name));
  const setting = (patch: Partial<Settings>) => { if (!api) return; void api.settings(patch).then(() => { setLocalError(''); setToast({ id: Date.now(), text: patch.theme ? '已更新外观偏好' : '设置已自动保存' }); }).catch(() => setLocalError('设置保存失败，请重试')); };
  if (!api) return <div className="unavailable"><h1>Codex Pulse</h1><p>请通过 Electron 桌面应用启动，以读取本机 Codex 额度。</p><code>npm start</code></div>;
  if (!state) return <div className="unavailable">正在连接后台…{localError}</div>;
  const view = new URLSearchParams(location.search).get('view');
  const live = state.live;
  const liveCount = live?.tokens?.total;
  const liveLabel = live?.status === 'completed' ? '上轮' : live?.status === 'interrupted' ? '中断' : '本轮';
  const liveText = liveCount == null ? '—' : liveCount >= 1_000_000 ? `${+(liveCount / 1_000_000).toFixed(1)}m` : liveCount >= 1000 ? `${+(liveCount / 1000).toFixed(1)}k` : liveCount.toString();
  const liveTitle = `${state.settings.watchedSessionId ? '固定跟踪' : '自动跟随本机最近更新的聊天'}：${live?.title ?? '等待本机记录'}\n${live?.turnNumber ? `第 ${live.turnNumber} 轮 · ` : ''}${liveCount == null ? '暂无统计' : `${liveCount.toLocaleString()} Token${live?.complete ? '' : '（统计不完整）'}`}\n输入 ${live?.tokens?.input?.toLocaleString() ?? '—'} / 输出 ${live?.tokens?.output?.toLocaleString() ?? '—'}\n${live?.error ?? '随本地用量事件更新，不按当前登录账号筛选'}`;
  const stale = !!state.updatedAt && now - state.updatedAt > state.settings.interval * 120_000;
  const status = stale ? '数据过期' : state.refreshing ? '正在刷新' : state.status;
  const age = state.updatedAt ? now - state.updatedAt : null;
  const updated = age === null ? '尚未成功更新' : age < 60000 ? '刚刚更新' : `${Math.floor(age / 60000)}分钟前更新`;
  const dark = state.settings.theme === 'dark' || state.settings.theme === 'system' && systemDark;
  const used = state.settings.quotaDisplay === 'used';
  if (view === 'float' || view === 'peek') return <Floating state={state} now={now} dark={dark} popup={view === 'peek'}/>;
  const navigate = (next: string) => { setTab(next); requestAnimationFrame(() => document.querySelector<HTMLHeadingElement>('main h1')?.focus()); };
  const commands: Command[] = [
    ...([{ id: 'overview', label: '额度概览' }, { id: 'today', label: '今日用量' }, { id: 'tokens', label: 'Token 明细' }, { id: 'settings', label: '偏好设置' }]).map(item => ({ ...item, hint: '跳转页面', run: () => navigate(item.id) })),
    { id: 'refresh', label: '刷新额度', hint: state.refreshing ? '当前正在刷新' : '读取最新的账号额度', run: () => { if (!state.refreshing) run(api.refresh()); } },
    { id: 'float', label: '显示悬浮窗', hint: '回到桌面侧边栏', run: () => action('show') },
    ...(['dark', 'light', 'system'] as const).map(theme => ({ id: theme, label: { dark: '深色主题', light: '浅色主题', system: '跟随系统主题' }[theme], hint: '外观偏好', run: () => setting({ theme }) }))
  ];
  const toggle = (key: keyof Settings, label: string, help: string) => <label className="setting-row"><span><b>{label}</b><small>{help}</small></span><input type="checkbox" checked={Boolean(state.settings[key])} onChange={e => setting({ [key]: e.target.checked })}/></label>;
  return <div className={`app ${dark ? 'dark' : 'light'}`}><header className="app-toolbar"><div className="logo"><span className="logo-mark"><Icon name="pulse"/></span><b>Codex Pulse<small>你的编程用量伴侣</small></b></div><div className="nav-caption">监控面板</div><nav aria-label="主导航">{([{ id: 'overview', label: '额度概览', icon: 'overview' }, { id: 'today', label: '今日用量', icon: 'clock' }, { id: 'tokens', label: 'Token 明细', icon: 'pulse' }, { id: 'settings', label: '偏好设置', icon: 'settings' }] as const).map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} className={tab === item.id ? 'selected' : ''} onClick={() => setTab(item.id)}><Icon name={item.icon}/>{item.label}</button>)}</nav><div className="sidebar-bottom"><span className="local-label"><Icon name="shield"/>仅在本机读取</span><div className="sidebar-account"><span className="account-avatar"><Icon name="account"/></span><div><b>{state.account ?? '尚未连接'}</b><small>{state.plan ?? 'ChatGPT 账号'}</small></div><span className={state.error ? 'connection-dot offline' : 'connection-dot'}/></div></div></header>
    <div className="workspace"><div className="workspace-bar"><button className="command-trigger" onClick={() => setCommandOpen(true)} aria-haspopup="dialog"><Icon name="more"/><span>快速操作</span><kbd>⌘ / Ctrl K</kbd></button><div><button aria-label={dark ? '切换浅色主题' : '切换深色主题'} title={dark ? '切换浅色主题' : '切换深色主题'} onClick={() => setting({ theme: dark ? 'light' : 'dark' })}><Icon name="theme"/>{dark ? '浅色' : '深色'}</button><button onClick={() => action('show')}><Icon name="expand"/>显示悬浮窗</button></div></div>
    <main><div className="page-heading"><div><h1 tabIndex={-1}>{tab === 'overview' ? '额度概览' : tab === 'tokens' ? 'Token 明细' : tab === 'today' ? '今日用量' : '偏好设置'}</h1><p>{tab === 'overview' ? '查看你的 Codex 可用额度与重置时间' : tab === 'tokens' ? '查看每轮对话实际记录的 Token 用量' : tab === 'today' ? '本机今天已记录的 Token 消耗' : '管理监控频率、通知和桌面显示'}</p></div>{tab !== 'tokens' && tab !== 'today' && <button className="primary" disabled={state.refreshing} onClick={() => run(api.refresh())}><Icon name="refresh" className={state.refreshing ? 'refreshing' : ''}/>{state.refreshing ? '刷新中…' : '立即刷新'}</button>}</div>
    {(state.error || localError) && <div role="alert" className="alert"><span>{localError || state.error}</span>{state.error && <button onClick={() => setTab('settings')}>检查连接</button>}{localError && <button aria-label="关闭操作提示" onClick={() => setLocalError('')}>关闭</button>}</div>}
    {tab === 'overview' ? <><div className="overview-controls"><section className="account-strip" aria-label="当前账号"><span className="provider-mark"><Icon name="pulse"/></span><div><b>Codex <span className="plan-badge">{state.plan ? state.plan.charAt(0).toUpperCase() + state.plan.slice(1) : 'ChatGPT'}</span></b><small>{state.account ?? '等待连接账号'}</small></div><span className={`status ${state.error || stale ? 'warning' : ''}`} title={updated}><i/>{status}</span></section><div className="segmented" aria-label="额度显示方式"><button aria-pressed={!used} className={!used ? 'active' : ''} onClick={() => setting({ quotaDisplay: 'remaining' })}>剩余</button><button aria-pressed={used} className={used ? 'active' : ''} onClick={() => setting({ quotaDisplay: 'used' })}>已用</button></div></div>
      {state.buckets.length ? state.buckets.map(bucket => { const bucketWindows = quotaWindows(bucket); return <section className="bucket" key={bucket.limitId}><div className="bucket-heading"><h2>{bucket.limitName ?? (bucket.limitId === 'codex' ? 'Codex 额度' : bucket.limitId)}</h2><span title="仅展示服务端返回的窗口，未返回不代表无限额度">{bucketWindows.length === 1 ? '服务端返回 1 个额度窗口' : '账号共享额度'}</span></div>{bucketWindows.length ? <div className={`quota-grid ${bucketWindows.length === 1 ? 'single-window' : ''}`}>{bucketWindows.map((window, index) => <Quota key={index} quota={window} now={now} used={used}/>)}</div> : <p className="no-quota-note">服务端未返回额度窗口，暂无法确认额度；这不代表无限额度。</p>}</section>; }) : <section className="empty"><Icon name="overview"/><h2>{state.refreshing ? '正在获取额度' : '尚无额度数据'}</h2><p>{state.error ?? '连接已登录的 Codex，即可查看你的额度。'}</p><button onClick={() => action('login')}>登录 Codex</button><button onClick={() => setTab('settings')}>检查路径设置</button></section>}
      <button className="session-card" title={liveTitle} onClick={() => setTab('tokens')}><span className="session-icon"><Icon name="pulse"/></span><span className="session-copy"><small>{state.settings.watchedSessionId ? '固定跟踪的聊天' : '最近的本机聊天'}</small><b>{live?.title ?? '等待本机聊天记录'}</b><span>{live?.error ?? (live?.status === 'completed' ? '本轮已完成' : liveCount == null ? '等待用量事件' : '本机已记录用量')}</span></span><span className="session-count"><strong>{liveText}</strong><small>{liveLabel} Token</small></span><span className="session-chevron" aria-hidden="true">›</span></button>
      <HourlyUsage sessionPath={state.settings.sessionPath}/>
      <div className="overview-shortcuts"><button onClick={() => setTab('today')}><Icon name="clock"/><span><b>今日用量</b><small>查看今天记录的 Token</small></span><span aria-hidden="true">↗</span></button><button onClick={() => setTab('settings')}><Icon name="settings"/><span><b>按你的习惯</b><small>调整浮动栏与提醒</small></span><span aria-hidden="true">↗</span></button></div>
      <section className="connection"><div><Icon name="refresh"/>{updated}</div><span>每 {state.settings.interval} 分钟自动刷新</span></section><footer className="overview-note"><Icon name="shield"/><p>额度与 Token 用量均在本机读取。<span>额度由整个账号共享，重置以服务端确认为准。</span></p></footer>
    </> : tab === 'today' ? <TodayUsage sessionPath={state.settings.sessionPath}/> : tab === 'tokens' ? <TokenDetails sessionPath={state.settings.sessionPath} watchedSessionId={state.settings.watchedSessionId}/> : <><section className="settings-card"><h2>监控与提醒</h2><label className="setting-row"><span><b>刷新周期</b><small>按设定频率自动更新额度</small></span><select value={state.settings.interval} onChange={e => setting({ interval: Number(e.target.value) })}>{Array.from(new Set([1, 3, 5, 10, 15, 30, 60, state.settings.interval])).sort((a,b) => a-b).map(value => <option key={value} value={value}>{value} 分钟</option>)}</select></label>{toggle('lowAlerts', '低额度通知', '跨过 20%、10% 和 0% 时提醒')}{toggle('recoveryAlerts', '额度恢复通知', '此前耗尽，并确认恢复时提醒')}{toggle('startup', '开机启动', '登录系统后在后台运行')}</section>
      <section className="settings-card"><h2>悬浮窗</h2>{toggle('showOnLaunch', '启动时显示', '关闭详情窗口后仍在后台监控')}{toggle('alwaysOnTop', '窗口置顶', '让额度始终可见')}{toggle('locked', '锁定位置', '避免误拖动')}{toggle('clickThrough', '鼠标穿透', '开启后请从系统托盘右键菜单恢复')}<label className="setting-row"><span><b>不透明度</b><small>{Math.round(state.settings.opacity * 100)}%</small></span><input aria-label="不透明度" type="range" min="0.65" max="1" step="0.05" value={state.settings.opacity} onChange={e => setting({ opacity: Number(e.target.value) })}/></label><label className="setting-row"><b>主题</b><select value={state.settings.theme} onChange={e => setting({ theme: e.target.value as Settings['theme'] })}><option value="system">跟随系统</option><option value="dark">深色</option><option value="light">浅色</option></select></label></section>
      <section className="settings-card"><h2>Codex 连接</h2><p className="path">{state.settings.codexPath || state.executable || '自动检测本机 Codex 可执行文件'}</p><div className="actions"><button onClick={() => action('choose')}>选择 Codex 可执行文件</button><button onClick={() => setting({ codexPath: '' })}>恢复自动检测</button><button onClick={() => action('login')}>登录账号 ↗</button><button onClick={() => action('install')}>安装指引 ↗</button></div><p className="note">不复制或保存登录 Token，仅通过本机 app-server 读取账号额度。</p></section></>}
    </main></div><CommandPalette open={commandOpen} close={() => setCommandOpen(false)} commands={commands}/>{toast && <div className="save-toast" role="status"><span aria-hidden="true">✓</span>{toast.text}</div>}</div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);


