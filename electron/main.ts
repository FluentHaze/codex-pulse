import { menuBarTitle, menuBarOptions } from './menu-bar.js';
import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, Notification, screen, powerMonitor, dialog, shell, nativeTheme, net } from 'electron';
import { ResetService, resetSourceUrl } from './reset-data.js';
import { readFileSync, writeFileSync, existsSync, renameSync, appendFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { CodexClient, detectCodex, RpcError } from './codex.js';
import { TokenStore } from './token-store.js';
import { captureAnchor, anchoredBounds, sidePanelBounds, type WindowAnchor } from './window-position.js';
import { defaults, bucketsFrom, remaining, severity, quotaWindows, floatingSize, type State, type Settings, type Account, type Limits } from './types.js';

const isMac = process.platform === 'darwin';
const platformDefaults: Settings = { ...defaults, showOnLaunch: !isMac };
// Windows GPU rasterization can leave diagonal seams across large solid surfaces.
if (process.platform === 'win32') app.commandLine.appendSwitch('disable-gpu-rasterization');
const here = dirname(fileURLToPath(import.meta.url));
let floating: BrowserWindow | undefined, details: BrowserWindow | undefined, peekWindow: BrowserWindow | undefined, tray: Tray;
let quitting = false, generation = 0, failures = 0, timer: ReturnType<typeof setTimeout> | undefined, active: Promise<void> | undefined;
let resetChecks = new Set<number>();
let paused = false;
const client = new CodexClient();
const resetService = new ResetService((input, init) => net.fetch(input instanceof URL ? input.href : input, init));
let identity: string | null = null;
let notices: Record<string, number> = {};
let position: { x: number; y: number } | undefined;
let resizeAnchor: { displayId: number; anchor: WindowAnchor } | undefined;
let resizing = false;
let peekTimer: ReturnType<typeof setTimeout> | undefined;
let peekReady = false;
let peekSource: 'float' | 'tray' = 'float';
let drag: { x: number; y: number; windowX: number; windowY: number } | undefined;
let state: State = { settings: { ...platformDefaults }, account: null, plan: null, buckets: [], updatedAt: null, refreshing: false, status: '正在连接 Codex', error: null, executable: null, live: null };
const tokenStore = new TokenStore(() => state.settings.sessionPath);
let liveBusy = false, liveScanAt = 0, liveSource = '';
let liveTimer: ReturnType<typeof setInterval> | undefined;
async function refreshLive() {
  if (liveBusy || quitting) return;
  liveBusy = true;
  const source = `${state.settings.sessionPath}|${state.settings.watchedSessionId}`;
  try {
    const rescan = source !== liveSource || Date.now() - liveScanAt > 3000;
    const catalog = await tokenStore.list(rescan);
    if (rescan) { liveScanAt = Date.now(); liveSource = source; }
    const id = state.settings.watchedSessionId || catalog.sessions[0]?.id;
    const live = id ? await tokenStore.live(id) : { sessionId: null, title: '未找到本机聊天', turnId: null, turnNumber: null, tokens: null, status: 'waiting' as const, complete: false, updatedAt: Date.now(), error: null };
    if (source === `${state.settings.sessionPath}|${state.settings.watchedSessionId}` && !quitting) { state.live = live; publish(); }
  } catch (error) {
    if (source === `${state.settings.sessionPath}|${state.settings.watchedSessionId}` && !quitting) {
      state.live = { sessionId: state.settings.watchedSessionId || null, title: '本机 Token 跟踪', turnId: null, turnNumber: null, tokens: null, status: 'error', complete: false, updatedAt: Date.now(), error: error instanceof Error && /跟踪的聊天|256 MB/.test(error.message) ? error.message : '无法读取本机用量，请检查会话目录或重新选择聊天' }; publish();
    }
  } finally { liveBusy = false; }
}
const storage = () => join(app.getPath('userData'), 'pulse.json');
function save() {
  const path = storage();
  try { writeFileSync(path + '.tmp', JSON.stringify({ macMenuBarDefaultApplied: isMac, settings: state.settings, position, identity, account: state.account, plan: state.plan, buckets: state.buckets, updatedAt: state.updatedAt, notices })); renameSync(path + '.tmp', path); }
  catch { log('storage-write-failed'); }
}
function log(event: string) { try { const path = join(app.getPath('userData'), 'diagnostic.log'); if (existsSync(path) && statSync(path).size > 256_000) writeFileSync(path, ''); appendFileSync(path, `${new Date().toISOString()} ${event}\n`); } catch { /* Storage may be read-only. */ } }
function publish() {
  for (const win of [floating, details, peekWindow]) if (win && !win.isDestroyed()) win.webContents.send('state', state);
  if (tray && isMac) tray.setTitle(menuBarTitle(state), { fontType: 'monospacedDigit' });
  if (tray) { const main = state.buckets.find(b => b.limitId === 'codex') ?? state.buckets[0]; const windows = quotaWindows(main); tray.setToolTip(`Codex Pulse · ${windows.length ? windows.map(w => remaining(w) === null ? '暂不可用' : `${remaining(w)}%`).join(' / ') : '暂无额度窗口'}\n${state.status}`); }
}
function announce(body: string) { if (Notification.isSupported()) new Notification({ title: 'Codex Pulse', body }).show(); }
function alerts() {
  const messages: string[] = [];
  for (const bucket of state.buckets) for (const slot of ['primary', 'secondary'] as const) {
    const window = bucket[slot], value = remaining(window); if (value === null) continue;
    const base = `${identity}:${bucket.limitId}:${slot}`;
    const exhausted = `${base}:exhausted`;
    if (value > 0 && notices[exhausted]) { if (state.settings.recoveryAlerts) messages.push(`${bucket.limitName ?? bucket.limitId} 额度已恢复`); delete notices[exhausted]; }
    const level = severity(value);
    if (level !== null) {
      const key = `${base}:${window?.resetsAt ?? 'unknown'}:${level}`;
      if (!notices[key] && state.settings.lowAlerts) messages.push(`${bucket.limitName ?? bucket.limitId} ${slot === 'primary' ? '主要' : '次要'}窗口剩余 ${Math.round(value)}%`);
      for (const threshold of [20, 10, 0]) if (threshold >= level) notices[`${base}:${window?.resetsAt ?? 'unknown'}:${threshold}`] = Date.now();
      if (value === 0) notices[exhausted] = Date.now();
    }
  }
  if (messages.length) announce(messages.join('\n'));
  notices = Object.fromEntries(Object.entries(notices).filter(([key, date]) => key.endsWith(':exhausted') || Date.now() - date < 90 * 86400_000));
}
function schedule(delay: number) { clearTimeout(timer); if (!quitting && !paused) timer = setTimeout(() => void refresh(), delay); }
function refresh(): Promise<void> {
  if (active) return active;
  paused = false;
  active = performRefresh().finally(() => { active = undefined; }); return active;
}
async function performRefresh() {
  clearTimeout(timer); const epoch = generation;
  state.refreshing = true; publish();
  try {
    if (!client.alive) { state.executable = detectCodex(state.settings.codexPath); await client.start(state.executable); }
    const { account } = await client.request<{ account: Account | null }>('account/read', { refreshToken: false });
    if (epoch !== generation) return;
    if (!account || account.type !== 'chatgpt') { identity = null; state.account = null; state.buckets = []; state.updatedAt = null; throw new RpcError('请使用 Codex 的 ChatGPT 账号登录', 401); }
    const key = createHash('sha256').update(`${account.id ?? ''}:${account.email ?? ''}:${account.type}`).digest('hex');
    if (identity !== key) { identity = key; state.buckets = []; state.updatedAt = null; publish(); }
    state.account = account.email?.replace(/^(.{1,2})[^@]*(@.*)$/, '$1***$2') ?? 'ChatGPT 账号'; state.plan = account.planType ?? null;
    const result = await client.request<Limits>('account/rateLimits/read');
    const verification = await client.request<{ account: Account | null }>('account/read', { refreshToken: false });
    const current = verification.account;
    if (epoch !== generation) return;
    if (!current || createHash('sha256').update(`${current.id ?? ''}:${current.email ?? ''}:${current.type}`).digest('hex') !== key) { invalidate(); schedule(500); return; }
    state.buckets = bucketsFrom(result); state.updatedAt = Date.now(); state.status = '已连接'; state.error = null; failures = 0; delete notices.auth; applyWindow();
    alerts(); save(); schedule(state.settings.interval * 60_000);
  } catch (error) {
    if (epoch !== generation) return;
    failures++; log(`refresh-failed-${error instanceof RpcError ? error.code : 'transport'}`);
    const message = error instanceof Error ? error.message : '查询失败';
    const auth = error instanceof RpcError && (error.code === 401 || /unauthorized|authentication|log.?in|auth token/i.test(message));
    const incompatible = error instanceof RpcError && [-32601, -32602].includes(error.code ?? 0);
    paused = auth || incompatible || (!client.alive && failures > 6);
    state.status = auth ? '请重新登录' : incompatible ? '协议不兼容' : '更新失败';
    state.error = auth ? '请在详情页登录 Codex，然后重新刷新' : incompatible ? '请更新 Codex，当前版本不支持额度查询' : /未找到|选择的|超时|服务/.test(message) ? message : '读取额度失败，请检查 Codex 登录和网络后重试';
    if (auth && !notices['auth']) { announce(state.error); notices.auth = Date.now(); save(); }
    if (!auth && !incompatible && (client.alive || failures <= 6)) { if (!client.alive) client.stop(); schedule([30_000, 60_000, 120_000][failures - 1] ?? state.settings.interval * 60_000); }
    if (failures === 6) announce('额度监控持续失败，请打开详情检查连接');
  } finally { if (epoch === generation) { state.refreshing = false; publish(); } }
}
function invalidate() { generation++; paused = false; identity = null; state.account = null; state.plan = null; state.buckets = []; state.updatedAt = null; state.refreshing = false; resetChecks.clear(); save(); publish(); }
function clampWindow() {
  if (!floating || resizing) return; const bounds = floating.getBounds(); const area = screen.getDisplayMatching(bounds).workArea;
  const x = Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - bounds.width)));
  const y = Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - bounds.height)));
  if (bounds.x !== x || bounds.y !== y) floating.setPosition(x, y);
}
function applyWindow() {
  if (!floating) return;
  const main = state.buckets.find(bucket => bucket.limitId === 'codex') ?? state.buckets[0];
  const size = floatingSize(quotaWindows(main).length);
  floating.setAlwaysOnTop(state.settings.alwaysOnTop); floating.setMovable(!state.settings.locked);
  floating.setIgnoreMouseEvents(state.settings.clickThrough, { forward: true }); floating.setOpacity(state.settings.opacity);
  const bounds = floating.getBounds();
  if (bounds.width !== size.width || bounds.height !== size.height) {
    const display = screen.getDisplayMatching(bounds);
    if (!resizeAnchor || resizeAnchor.displayId !== display.id) resizeAnchor = { displayId: display.id, anchor: captureAnchor(bounds, display.workArea) };
    const target = anchoredBounds(resizeAnchor.anchor, size, display.workArea);
    resizing = true;
    try { floating.setResizable(true); floating.setBounds(target); floating.setResizable(false); }
    finally { resizing = false; }
  }
  clampWindow();
  const current = floating.getBounds(); position = { x: current.x, y: current.y };
}
// Match .desktop-chrome's --sidebar background and --ink in radar-theme.css.
function windowColors() { return nativeTheme.shouldUseDarkColors ? { color: '#242426', symbolColor: '#f5f5f7', height: 32 } : { color: '#ececf0', symbolColor: '#1d1d1f', height: 32 }; }
function updateWindowColors() {
  if (!details || details.isDestroyed()) return;
  details.setBackgroundColor(windowColors().color);
  if (process.platform === 'win32') details.setTitleBarOverlay(windowColors());
}
function createWindow(kind: 'float' | 'details' | 'peek', tab = 'overview') {
  const main = state.buckets.find(bucket => bucket.limitId === 'codex') ?? state.buckets[0]; const size = floatingSize(quotaWindows(main).length);
  const small = kind !== 'details';
  const win = new BrowserWindow({ icon: join(here, '../assets/app.png'), width: kind === 'float' ? size.width : kind === 'peek' ? 320 : 1020, height: kind === 'float' ? size.height : kind === 'peek' ? 310 : 860, minWidth: small ? 40 : 700, minHeight: small ? 40 : 550, ...(small ? { acceptFirstMouse: true, frame: false, resizable: false, skipTaskbar: true, transparent: true, hasShadow: false, ...(kind === 'float' ? position : { focusable: false }) } : process.platform === 'win32' ? { titleBarStyle: 'hidden', titleBarOverlay: windowColors() } : {}), show: false, backgroundColor: small ? '#00000000' : windowColors().color, webPreferences: { preload: join(here, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  if (!small && process.platform === 'win32') win.setMenuBarVisibility(false);
  void win.loadFile(join(here, '../dist/index.html'), { query: { view: kind, tab } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); win.webContents.on('will-navigate', event => event.preventDefault());
  if (kind === 'float') { floating = win; applyWindow(); win.on('moved', () => { if (!floating || resizing) return; clampWindow(); const { x, y } = floating.getBounds(); position = { x, y }; save(); }); win.once('ready-to-show', () => { if (state.settings.showOnLaunch) win.showInactive(); }); }
  else if (kind === 'peek') { peekWindow = win; win.once('ready-to-show', () => { peekReady = true; }); }
  else { details = win; win.once('ready-to-show', () => win.show()); win.on('closed', () => { details = undefined; }); }
  return win;
}
function hidePeek() { clearTimeout(peekTimer); peekWindow?.hide(); peekSource = 'float'; }
function showTrayPeek() {
  clearTimeout(peekTimer);
  if (!isMac || !state.settings.menuBarHover || !peekReady || !peekWindow) return;
  peekSource = 'tray';
  const bounds = tray.getBounds(), area = screen.getDisplayMatching(bounds).workArea;
  const width = 320, height = 310;
  peekWindow.setBounds({ width, height, x: Math.round(Math.max(area.x, Math.min(bounds.x + bounds.width / 2 - width / 2, area.x + area.width - width))), y: Math.round(Math.max(area.y, Math.min(bounds.y + bounds.height + 6, area.y + area.height - height))) });
  peekWindow.setAlwaysOnTop(true, 'pop-up-menu');
  peekWindow.showInactive();
}
function showPeek() {
  peekSource = 'float';
  clearTimeout(peekTimer);
  if (!floating?.isVisible() || !peekWindow || !peekReady || drag || state.settings.clickThrough) return;
  const bounds = floating.getBounds(), area = screen.getDisplayMatching(bounds).workArea;
  peekWindow.setBounds(sidePanelBounds(bounds, area));
  peekWindow.setAlwaysOnTop(state.settings.alwaysOnTop);
  peekWindow.showInactive();
}
function openDetails(tab = 'overview') { hidePeek(); if (details) { details.webContents.send('navigate', tab); details.show(); details.focus(); } else createWindow('details', tab); }
function toggleFloat() { if (floating?.isVisible()) floating.hide(); else floating?.showInactive(); }
function menu() {
  return Menu.buildFromTemplate([{ label: '立即刷新', enabled: !state.refreshing, click: () => void refresh() }, { label: '打开详情与设置', click: () => openDetails() }, { type: 'separator' }, ...(isMac ? [{ label: '菜单栏显示', submenu: menuBarOptions.map(option => ({ label: option.label, type: 'radio' as const, checked: state.settings.menuBarDisplay === option.value, click: () => updateSettings({ menuBarDisplay: option.value }) })) }, { label: '移入菜单栏显示悬浮窗', type: 'checkbox' as const, checked: state.settings.menuBarHover, click: () => updateSettings({ menuBarHover: !state.settings.menuBarHover }) }, { type: 'separator' as const }] : []), ...(['alwaysOnTop', 'locked', 'clickThrough'] as const).map((key, i) => ({ label: ['窗口置顶', '锁定位置', '鼠标穿透（从托盘恢复）'][i], type: 'checkbox' as const, checked: state.settings[key], click: () => updateSettings({ [key]: !state.settings[key] }) })), { type: 'separator' }, ...(!isMac ? [{ label: floating?.isVisible() ? '隐藏悬浮窗' : '显示悬浮窗', click: toggleFloat }] : []), { label: '退出应用', click: () => app.quit() }]);
}
function updateSettings(patch: Partial<Settings>) {
  const previous = state.settings; const next = { ...previous };
  for (const key of ['startup', 'showOnLaunch', 'alwaysOnTop', 'locked', 'clickThrough', 'lowAlerts', 'recoveryAlerts', 'menuBarHover'] as const) if (typeof patch[key] === 'boolean') next[key] = patch[key];
  if (typeof patch.interval === 'number' && Number.isFinite(patch.interval)) next.interval = Math.max(1, Math.min(60, Math.round(patch.interval)));
  if (typeof patch.opacity === 'number' && Number.isFinite(patch.opacity)) next.opacity = Math.max(.65, Math.min(1, patch.opacity));
  if (menuBarOptions.some(option => option.value === patch.menuBarDisplay)) next.menuBarDisplay = patch.menuBarDisplay!;
  if (patch.menuBarHover === false && peekSource === 'tray') hidePeek();
  if (patch.quotaDisplay === 'remaining' || patch.quotaDisplay === 'used') next.quotaDisplay = patch.quotaDisplay;
  if (patch.theme && ['system', 'dark', 'light'].includes(patch.theme)) next.theme = patch.theme;
  if (typeof patch.codexPath === 'string') next.codexPath = patch.codexPath;
  if (typeof patch.sessionPath === 'string') next.sessionPath = patch.sessionPath;
  if (typeof patch.watchedSessionId === 'string' && (patch.watchedSessionId === '' || /^[a-f0-9]{24}$/.test(patch.watchedSessionId))) next.watchedSessionId = patch.watchedSessionId;
  if (previous.sessionPath !== next.sessionPath) next.watchedSessionId = '';
  if (next.clickThrough && !previous.clickThrough) announce('鼠标穿透已开启，可右键系统托盘关闭');
  if (next.clickThrough) hidePeek();
  state.settings = next; nativeTheme.themeSource = next.theme;
  updateWindowColors();
  if (previous.sessionPath !== next.sessionPath || previous.watchedSessionId !== next.watchedSessionId) { state.live = null; liveScanAt = 0; void refreshLive(); }
  if (previous.startup !== next.startup) app.setLoginItemSettings(isMac ? { openAtLogin: next.startup } : { openAtLogin: next.startup, path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] });
  if (isMac && previous.showOnLaunch !== next.showOnLaunch) { if (next.showOnLaunch) floating?.showInactive(); else floating?.hide(); }
  applyWindow(); save(); publish();
  if (previous.codexPath !== next.codexPath) { invalidate(); client.stop(); void (active ?? Promise.resolve()).then(() => refresh()); } else if (previous.interval !== next.interval) schedule(next.interval * 60_000);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => openDetails());
  app.whenReady().then(() => {
    if (isMac && app.isPackaged && !app.isInApplicationsFolder()) {
      try {
        const moved = app.moveToApplicationsFolder({
          conflictHandler: conflict => conflict === 'existsAndRunning' || dialog.showMessageBoxSync({
            type: 'question', buttons: ['替换并启动', '暂不安装'], defaultId: 0, cancelId: 1,
            title: '安装 Codex Pulse', message: '应用程序中已有 Codex Pulse，是否替换为当前版本？',
            detail: '你的设置和本机记录会保留。'
          }) === 0
        });
        // Electron quits this copy and relaunches the installed application.
        if (moved) return;
      } catch {
        log('install-to-applications-failed');
        void dialog.showMessageBox({ type: 'warning', title: '安装 Codex Pulse', message: '暂时无法移入应用程序', detail: '本次仍可正常使用，也可以退出后将 Codex Pulse 拖入「应用程序」文件夹。' });
      }
    }
    app.setAppUserModelId('com.codexpulse.desktop');
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' as const }, { type: 'separator' as const }, { role: 'services' as const }, { type: 'separator' as const }, { role: 'hide' as const }, { role: 'hideOthers' as const }, { role: 'unhide' as const }, { type: 'separator' as const }, { role: 'quit' as const }] }] : []),
      { label: '文件', submenu: [{ label: '刷新额度', accelerator: 'CmdOrCtrl+R', click: () => void refresh() }, { label: '打开详情与设置', click: () => openDetails() }, { type: 'separator' }, { label: '关闭窗口', role: 'close' }, { label: '退出应用', click: () => app.quit() }] },
      { label: '编辑', submenu: [{ label: '撤销', role: 'undo' }, { label: '重做', role: 'redo' }, { type: 'separator' }, { label: '剪切', role: 'cut' }, { label: '复制', role: 'copy' }, { label: '粘贴', role: 'paste' }, { label: '全选', role: 'selectAll' }] },
      { label: '视图', submenu: [{ label: '放大', role: 'zoomIn' }, { label: '缩小', role: 'zoomOut' }, { label: '实际大小', role: 'resetZoom' }, { type: 'separator' }, { label: '全屏', role: 'togglefullscreen' }] },
      { label: '窗口', submenu: [{ label: '最小化', role: 'minimize' }, { label: '最大化 / 还原', role: 'zoom' }, { label: '关闭窗口', role: 'close' }, { type: 'separator' }, ...(!isMac ? [{ label: '显示 / 隐藏悬浮窗', click: toggleFloat }] : [])] },
      { label: '帮助', submenu: [{ label: '关于 Codex Pulse', click: () => { void dialog.showMessageBox({ type: 'info', title: '关于 Codex Pulse', message: 'Codex Pulse', detail: `版本 ${app.getVersion()}\n本地 Codex 额度监控 · 数据仅保存在本机` }); } }] }
    ]));
    try { const data = JSON.parse(readFileSync(storage(), 'utf8')); state = { ...state, account: data.account ?? null, plan: data.plan ?? null, buckets: Array.isArray(data.buckets) ? data.buckets : [], updatedAt: data.updatedAt ?? null }; identity = data.identity ?? null; notices = data.notices ?? {}; position = data.position; updateSettings({ ...platformDefaults, ...data.settings, ...(isMac && !data.macMenuBarDefaultApplied ? { showOnLaunch: false } : {}) }); } catch { /* First launch. */ }
    nativeTheme.themeSource = state.settings.theme;
    nativeTheme.on('updated', updateWindowColors);
    const trayIcon = nativeImage.createFromPath(join(here, isMac ? '../assets/trayTemplate.png' : '../assets/app.png')).resize({ width: isMac ? 18 : 32, height: isMac ? 18 : 32 });
    if (isMac) trayIcon.setTemplateImage(true);
    tray = new Tray(trayIcon);
    const openTrayMenu = () => { hidePeek(); tray.popUpContextMenu(menu()); };
    tray.on('click', isMac ? openTrayMenu : toggleFloat);
    tray.on('right-click', openTrayMenu);
    if (isMac) {
      tray.on('mouse-enter', showTrayPeek);
      tray.on('mouse-leave', () => { clearTimeout(peekTimer); peekTimer = setTimeout(hidePeek, 300); });
    }
    publish();
    createWindow('float');
    createWindow('peek');
    ipcMain.handle('float-peek', (event, expanded: unknown) => {
      if (![floating?.webContents, peekWindow?.webContents].includes(event.sender) || typeof expanded !== 'boolean') return;
      clearTimeout(peekTimer);
      if (expanded) { if (event.sender === peekWindow?.webContents && peekSource === 'tray') showTrayPeek(); else showPeek(); } else peekTimer = setTimeout(hidePeek, 300);
    });
    floating?.on('hide', () => { if (peekSource === 'float') hidePeek(); });
    ipcMain.handle('get-state', () => state);
    ipcMain.handle('window-menus', event => event.sender === details?.webContents ? Menu.getApplicationMenu()?.items.map(item => item.label) ?? [] : []);
    ipcMain.handle('window-menu', (event, label: unknown, x: unknown, y: unknown) => {
      if (event.sender !== details?.webContents || typeof label !== 'string' || typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const submenu = Menu.getApplicationMenu()?.items.find(item => item.label === label)?.submenu;
      if (!submenu || !details) return;
      const [width, height] = details.getContentSize();
      return new Promise<void>(resolve => submenu.popup({ window: details, x: Math.round(Math.max(0, Math.min(width, x))), y: Math.round(Math.max(0, Math.min(height, y))), callback: resolve }));
    });
    ipcMain.handle('reset-data', () => resetService.read());
    ipcMain.handle('reset-source', async (_event, value: unknown) => { const url = resetSourceUrl(value); if (!url) throw new Error('无效的来源链接'); await shell.openExternal(url); });
    ipcMain.handle('token-catalog', (_event, force: unknown) => tokenStore.list(force === true));
    ipcMain.handle('today-usage', (_event, force: unknown) => tokenStore.today(force === true));
    ipcMain.handle('scope-usage', (_event, ids: unknown) => { if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id))) throw new Error('无效的聊天标识'); return tokenStore.scopeUsage(ids); });
    ipcMain.handle('token-session', (_event, id: unknown) => { if (typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id)) throw new Error('无效的聊天标识'); return tokenStore.read(id); });
    ipcMain.on('drag', (event, phase: string, x: number, y: number) => {
      if (event.sender !== floating?.webContents || state.settings.locked || !Number.isFinite(x) || !Number.isFinite(y)) return;
      if (phase === 'start') { hidePeek(); resizeAnchor = undefined; const bounds = floating.getBounds(); drag = { x, y, windowX: bounds.x, windowY: bounds.y }; }
      if (phase === 'move' && drag) { floating.setPosition(Math.round(drag.windowX + x - drag.x), Math.round(drag.windowY + y - drag.y)); clampWindow(); }
      if (phase === 'end') drag = undefined;
    });
    ipcMain.handle('refresh', () => refresh());
    ipcMain.handle('settings', (_event, patch: Partial<Settings>) => { if (patch && typeof patch === 'object') updateSettings(patch); });
    ipcMain.handle('action', async (_event, action: string) => {
      if (action === 'details') openDetails();
      if (action === 'tokens') openDetails('tokens');
      if (action === 'show') floating?.showInactive();
      if (action === 'menu') menu().popup({ window: floating });
      if (action === 'hide') floating?.hide();
      if (action === 'online' && (!state.updatedAt || Date.now() - state.updatedAt >= state.settings.interval * 60_000)) schedule(1000);
      if (action === 'choose') { const result = await dialog.showOpenDialog({ ...(process.platform === 'win32' ? { filters: [{ name: 'Codex', extensions: ['exe'] }] } : {}), properties: ['openFile'] }); if (!result.canceled) updateSettings({ codexPath: result.filePaths[0] }); }
      if (action === 'choose-sessions') { const result = await dialog.showOpenDialog({ title: '选择 Codex sessions 会话目录', properties: ['openDirectory'] }); if (!result.canceled) updateSettings({ sessionPath: result.filePaths[0] }); }
      if (action === 'install') await shell.openExternal('https://developers.openai.com/codex/cli/');
      if (action === 'login') {
        try { if (!client.alive) await client.start(detectCodex(state.settings.codexPath)); const result = await client.request<{ authUrl?: string }>('account/login/start', { type: 'chatgpt' }); if (result.authUrl) { const url = new URL(result.authUrl); if (url.protocol === 'https:' && ['auth.openai.com', 'auth0.openai.com', 'chatgpt.com'].includes(url.hostname)) await shell.openExternal(url.href); else throw new Error('无法打开登录地址'); } }
        catch { state.error = '登录启动失败，请先在 Codex 中完成登录'; publish(); }
      }
    });
    client.onAccountChanged = () => { invalidate(); delete notices.auth; void (active ?? Promise.resolve()).then(() => { if (!quitting) void refresh(); }); };
    powerMonitor.on('resume', () => schedule(1000));
    const displayChanged = () => { hidePeek(); resizeAnchor = undefined; clampWindow(); };
    screen.on('display-added', displayChanged); screen.on('display-removed', displayChanged); screen.on('display-metrics-changed', displayChanged);
    setInterval(() => {
      if (!state.updatedAt || state.refreshing || paused) return;
      const resets = state.buckets.flatMap(b => [b.primary?.resetsAt, b.secondary?.resetsAt]).filter((time): time is number => typeof time === 'number' && time * 1000 <= Date.now() && time * 1000 > state.updatedAt! && !resetChecks.has(time));
      if (resets.length) { resets.forEach(time => resetChecks.add(time)); void refresh(); }
    }, 1000).unref();
    void refresh();
    liveTimer = setInterval(() => void refreshLive(), 1000); liveTimer.unref(); void refreshLive();
  });
}
app.on('activate', () => { if (app.isReady() && !quitting) openDetails(); });
app.on('window-all-closed', () => {});
app.on('before-quit', () => { quitting = true; clearTimeout(peekTimer); clearTimeout(timer); clearInterval(liveTimer); client.stop(); });
