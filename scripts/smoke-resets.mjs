/** Renderer smoke test in an isolated Electron shell; fixtures never touch real account state. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const require = createRequire(import.meta.url);
if (!process.env.CODEX_PULSE_PLAYWRIGHT)
  throw new Error('Set CODEX_PULSE_PLAYWRIGHT to Playwright index.mjs');
const { _electron } = await import(pathToFileURL(process.env.CODEX_PULSE_PLAYWRIGHT).href);
const root = resolve('.');
const output = join(root, '.cache', 'reset-smoke');
await mkdir(output, { recursive: true });
// Reuse the production preload and bundle; only IPC responses are fixture data.
const harness = `
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
app.whenReady().then(async () => {
  const { defaults } = await import(${JSON.stringify(pathToFileURL(join(root, 'dist-electron/types.js')).href)});
  const at = Date.now();
  let settings = { ...defaults, theme: 'light', language: 'zh-CN' };
  const bucket = { limitId: 'codex', limitName: 'Codex', primary: { usedPercent: 91, resetsAt: Math.floor(at / 1000) + 8040, windowDurationMins: 300 }, secondary: { usedPercent: 46, resetsAt: Math.floor(at / 1000) + 367200, windowDurationMins: 10080 } };
  const state = () => ({ settings, locale: settings.language, account: 'FF@example.test', plan: 'plus', buckets: [bucket], updatedAt: at, refreshing: false, status: '已连接', error: null, executable: null, live: { title: '落地页布局调整', sessionId: 'a'.repeat(24), turnId: 'turn-1', turnNumber: 1, tokens: { input: 6400000, output: 1700000, cachedInput: 4000000, reasoning: 300000, total: 8100000 }, status: 'completed', complete: true, updatedAt: at, error: null } });
  const translations = { zh: '全局重置已确认，个人额度以服务端刷新为准。', ja: '全体リセットが確認されました。' };
  const events = Array.from({ length: 9 }, (_, i) => ({ id: 'event-' + i, at: new Date(at - (i * 2 + 1) * 86400000).toISOString(), group: 'reset', announced: true, summary: 'A global reset was confirmed.', localizedSummary: null, url: 'https://codex-reset.com/timeline' }));
  let mode = 'normal';
  app.setRadarMode = (value) => { mode = value; };
  const win = new BrowserWindow({ show: false, width: 1540, height: 1120, webPreferences: { preload: ${JSON.stringify(join(root, 'dist-electron/preload.cjs'))}, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.webContents.session.on('will-download', (_event, item) => {
    item.setSavePath(${JSON.stringify(join(output, 'reset.ics'))});
    item.on('done', (_event, state) => { app.calendarDownload = state; });
  });
  ipcMain.handle('get-state', state);
  ipcMain.handle('claim-star-guide', () => false);
  ipcMain.handle('window-menus', () => []);
  let update = { status: 'idle', currentVersion: '0.1.32' };
  app.setUpdateState = (patch) => { update = { ...update, ...patch }; BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('update-state', update)); };
  ipcMain.handle('update-state', () => update);
  ipcMain.handle('update-action', () => {});
  ipcMain.handle('settings', (_e, patch) => { settings = { ...settings, ...patch }; BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('state', state())); });
  let tokenDelay = 0;
  app.setTokenDelay = (delay) => { tokenDelay = delay; };
  const sessions = [{ id: 'a'.repeat(24), title: '落地页布局调整', projectName: 'luckyfizz-landing', project: 'landing', updatedAt: at }, { id: 'b'.repeat(24), title: '修复弹窗交互', projectName: 'codex-pulse', project: 'pulse', updatedAt: at - 3600000 }];
  const daily = { date: new Date(at).toLocaleDateString('en-CA'), timeZone: 'Asia/Shanghai', tokens: { input: 10200000, output: 2200000, cachedInput: 7600000, reasoning: 1400000, total: 12400000 }, turnCount: 46, recordCount: 124, scannedFiles: 68, skippedFiles: 0, duplicateRecords: 3, warnings: [], updatedAt: at,
    hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, total: hour <= new Date().getHours() ? (hour + 1) * 40000 : 0, input: hour <= new Date().getHours() ? (hour + 1) * 30000 : 0, output: hour <= new Date().getHours() ? (hour + 1) * 10000 : 0, records: hour <= new Date().getHours() ? 2 : 0 })) };
  ipcMain.handle('token-catalog', async () => { if (tokenDelay) await new Promise((done) => setTimeout(done, tokenDelay)); return { root: '/fixture/sessions', sessions, limited: false }; });
  ipcMain.handle('today-usage', async () => { if (tokenDelay) await new Promise((done) => setTimeout(done, tokenDelay)); return daily; });
  ipcMain.handle('scope-usage', async () => { if (tokenDelay) await new Promise((done) => setTimeout(done, tokenDelay)); return daily; });
  ipcMain.handle('token-session', async (_event, id) => { if (tokenDelay) await new Promise((done) => setTimeout(done, tokenDelay)); return { id, updatedAt: at, warnings: [], turns: Array.from({length: 65}, (_, index) => ({ id: 'turn-' + index, number: index + 1, startedAt: new Date(at).toISOString(), model: 'GPT-6.1 Sol', status: 'completed', tokens: daily.tokens, complete: true, messages: [{ role: 'user', text: '调整布局 ' + index, phase: null, truncated: false }] })) }; });
  ipcMain.handle('float-peek', () => {});
  ipcMain.handle('peek-size', () => {});
  ipcMain.on('drag', () => {});
  ipcMain.handle('reset-source', (_e, url) => { app.lastSource = url; });
  ipcMain.handle('reset-data', async () => {
    const language = settings.language;
    const locale = language === 'zh-CN' ? 'zh' : language === 'ja' ? 'ja' : 'en';
    if (mode === 'race') await new Promise((done) => setTimeout(done, language === 'ja' ? 300 : 20));
    const localized = translations[locale] || null;
    const stale = mode === 'stale';
    const empty = mode === 'empty';
    const stamp = new Date(stale ? at - 3600000 : at).toISOString();
    return {
      locale, forecast: empty ? null : { probability24h: 46, probability48h: 71, confidence: 'low', lastResetAt: events[0].at, updatedAt: stamp, signal: null },
      events: empty ? [] : events.map((event) => ({ ...event, localizedSummary: localized })),
      forecastFetchedAt: at, timelineFetchedAt: at, feedFetchedAt: at, statusFetchedAt: at,
      forecastError: empty ? '预测暂不可用，请稍后刷新' : null, timelineError: null, feedError: stale ? '公告暂不可用，请稍后刷新' : null, statusError: null,
      feed: { fetchedAt: stamp, stale, posts: empty ? [] : [
        { id: 'confirmed', at: events[0].at, text: 'A global reset was confirmed.', localizedText: localized, category: 'reset', url: 'https://x.com/thsottiaux/status/12345' },
        { id: 'signal', at: events[0].at, text: 'An announcement is awaiting confirmation.', localizedText: null, category: 'signal', url: null },
        { id: 'banked', at: events[0].at, text: 'Banked reset available.', localizedText: null, category: 'banked', url: null },
        { id: 'other', at: events[0].at, text: 'A display-only update.', localizedText: null, category: 'other', url: null },
      ] },
      status: empty ? null : { state: 'operational', stale, checkedAt: stamp, surfaces: ['cli', 'desktop', 'web', 'api'].map((id) => ({ id, label: id, status: 'operational' })), incidents: [] },
    };
  });
  await win.loadFile(${JSON.stringify(join(root, 'dist/index.html'))}, { query: { view: 'details' } });
});
app.on('window-all-closed', () => app.quit());
`;
const main = join(output, 'main.cjs');
await writeFile(main, harness);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const desktop = await _electron.launch({
  executablePath: require('electron'),
  args: [main, `--user-data-dir=${join(output, 'profile')}`],
  env,
});
try {
  const page = await desktop.firstWindow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const capture = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    const png = await desktop.evaluate(async ({ BrowserWindow }) => {
      const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage();
      return image.toPNG().toString('base64');
    });
    await writeFile(join(output, name), Buffer.from(png, 'base64'));
  };
  const fontSession = await page.context().newCDPSession(page);
  await fontSession.send('DOM.enable');
  await fontSession.send('CSS.enable');
  const chooseTheme = async (value) => {
    const toggle = page.getByRole('switch', { name: '深色主题', exact: true });
    if ((await toggle.getAttribute('aria-checked')) !== String(value === 'dark'))
      await toggle.click();
  };
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('.app').waitFor();
  await page.evaluate(() => document.fonts.load('400 16px "Noto Sans SC"', '今日用量'));
  assert.equal(
    await page.evaluate(() =>
      [...document.fonts].some(
        (font) => font.family === 'Noto Sans SC' && font.status === 'loaded',
      ),
    ),
    true,
    'bundled Chinese font loads from packaged file URL',
  );

  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: 'resets' })),
  );
  await page.getByRole('tab', { name: '重置日历', exact: true }).waitFor();
  assert.equal(
    await page.getByRole('tab', { name: '重置日历', exact: true }).getAttribute('aria-selected'),
    'true',
  );
  assert.equal(await page.getByRole('tabpanel').count(), 1);
  assert.equal(await page.locator('.radar-status').count(), 0);
  assert.equal(await page.locator('select').count(), 0, 'custom pickers replace native selects');
  const themeSwitch = page.getByRole('switch', { name: '深色主题', exact: true });
  await themeSwitch.click();
  await page.locator('.app.dark').waitFor();
  assert.equal(await themeSwitch.getAttribute('aria-checked'), 'true');
  await themeSwitch.click();
  await page.locator('.app.light').waitFor();
  assert.equal(await page.locator('.forecast-odds > .forecast-meter:visible').count(), 2);
  assert.ok((await page.locator('.calendar-markers').count()) > 0, 'calendar restores event dots');
  assert.equal(
    await page.locator('.reset-workspace-heading .reset-actions').count(),
    1,
    'reminders live in workspace heading',
  );

  await capture('radar-calendar-light.png');
  const { root: documentRoot } = await fontSession.send('DOM.getDocument');
  const { nodeId: headingNode } = await fontSession.send('DOM.querySelector', {
    nodeId: documentRoot.nodeId,
    selector: '.page-heading h1',
  });
  const { fonts: renderedFonts } = await fontSession.send('CSS.getPlatformFontsForNode', {
    nodeId: headingNode,
  });
  assert.ok(
    renderedFonts.some((font) => font.isCustomFont && font.familyName.startsWith('Noto Sans SC')),
    'Chinese heading actually renders with the bundled fallback font',
  );
  await writeFile(join(output, 'rendered-fonts.json'), JSON.stringify(renderedFonts, null, 2));

  const size = await page.locator('.reset-tracker').boundingBox();
  assert.ok(
    size.y + size.height <= (await page.evaluate(() => innerHeight)),
    'default calendar fits the desktop viewport',
  );
  await page.getByRole('tab', { name: '重置日历', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(
    await page.getByRole('tab', { name: '公告动态', exact: true }).getAttribute('aria-selected'),
    'true',
  );
  assert.equal(await page.getByRole('tabpanel').count(), 1);
  assert.equal(await page.locator('.radar-post').count(), 3);
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  assert.equal(await page.locator('.radar-post').count(), 1);
  await page.getByRole('button', { name: '上一页', exact: true }).click();
  await page
    .getByText('全局重置已确认，个人额度以服务端刷新为准。', { exact: true })
    .first()
    .waitFor();
  await page.locator('.feed-card details summary').first().click();
  assert.equal(
    await page.locator('.feed-card details[open] p').first().textContent(),
    'A global reset was confirmed.',
  );
  await page
    .locator('.feed-card button')
    .filter({ hasText: /^储备$/ })
    .click();
  assert.equal(await page.locator('.radar-post').count(), 1);
  await page
    .locator('.feed-card button')
    .filter({ hasText: /^全部$/ })
    .click();
  await page.locator('.reset-actions > summary').click();
  await page.locator('.popup-dismiss-backdrop').waitFor();
  const outsideNavigation = await page
    .getByRole('button', { name: '今日用量', exact: true })
    .boundingBox();
  await page.mouse.click(
    outsideNavigation.x + outsideNavigation.width / 2,
    outsideNavigation.y + outsideNavigation.height / 2,
  );
  assert.equal(
    await page.locator('.reset-actions[open]').count(),
    0,
    'outside click closes reminders',
  );
  assert.ok(await page.locator('.page-resets').isVisible(), 'dismissal click does not navigate');
  await page.locator('.reset-actions > summary').click();
  await page.getByLabel('个人窗口提前 15 分钟提醒', { exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.radar-alert-options input').checked);
  assert.equal(
    await page.evaluate(async () => (await window.pulse.getState()).settings.resetReminder),
    true,
  );
  await page.getByRole('button', { name: '导出日历 ↗', exact: true }).click();
  const deadline = Date.now() + 10000;
  let download;
  do {
    download = await desktop.evaluate(({ app }) => app.calendarDownload);
    if (download) break;
    await page.waitForTimeout(100);
  } while (Date.now() < deadline);
  assert.equal(download, 'completed');
  await page.locator('.reset-actions > summary').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.reset-actions[open]').count(), 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture('radar-light.png');
  await page.evaluate(() => window.pulse.settings({ language: 'ja' }));
  await page.getByText('全体リセットが確認されました。', { exact: true }).first().waitFor();
  await page.evaluate(() => window.pulse.settings({ language: 'ko' }));
  await page.getByText('번역이 없어 영어 원문을 표시합니다', { exact: true }).first().waitFor();
  assert.equal(
    await page.locator('.radar-post .announcement-text > p').first().textContent(),
    'A global reset was confirmed.',
  );
  await desktop.evaluate(({ app }) => app.setRadarMode('race'));
  await page.evaluate(async () => {
    await window.pulse.settings({ language: 'ja' });
    await window.pulse.settings({ language: 'zh-CN' });
  });
  await page
    .getByText('全局重置已确认，个人额度以服务端刷新为准。', { exact: true })
    .first()
    .waitFor();
  await page.waitForTimeout(350);
  assert.equal(
    await page.locator('.radar-post .announcement-text > p').first().textContent(),
    '全局重置已确认，个人额度以服务端刷新为准。',
  );
  await page.evaluate(() => window.pulse.settings({ theme: 'dark' }));
  await page.locator('.app.dark').waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture('radar-dark.png');
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(760, 1000),
  );
  assert.ok(
    await page
      .locator('.reset-tracker')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    'no horizontal overflow',
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture('radar-narrow.png');
  await desktop.evaluate(({ app }) => app.setRadarMode('stale'));
  await page.getByRole('button', { name: '刷新预测', exact: true }).click();
  assert.equal(await page.locator('.radar-status').count(), 0);
  await page.getByText('公告暂不可用，请稍后刷新', { exact: true }).waitFor();
  await desktop.evaluate(({ app }) => app.setRadarMode('empty'));
  await page.getByRole('button', { name: '刷新预测', exact: true }).click();
  await page.getByText('暂无匹配公告', { exact: true }).waitFor();
  await page.getByRole('tab', { name: '历史重置节奏', exact: true }).click();
  assert.equal(await page.getByRole('tabpanel').count(), 1);
  await desktop.evaluate(({ app }) => app.setRadarMode('normal'));
  await page.getByRole('button', { name: '刷新预测', exact: true }).click();
  await page.locator('.rhythm-column').first().waitFor();
  assert.equal(await page.locator('.rhythm-column').count(), 8);
  await page.getByRole('tab', { name: '重置日历', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture('radar-calendar-narrow.png');
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1540, 1120),
  );
  await page.evaluate(() => window.pulse.settings({ theme: 'light' }));
  await page.locator('.app.light').waitFor();
  assert.equal(await page.locator('.sidebar-meta > .sidebar-version').count(), 1);
  assert.equal(await page.locator('.sidebar-github').count(), 0);
  assert.equal(await page.locator('.sidebar-update').count(), 0);
  assert.ok((await page.locator('.sidebar-version').textContent()).includes('v0.1.32'));
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: 'overview' })),
  );
  await page.locator('.quota-amount').first().waitFor();
  await page.locator('.recent-sessions > button').first().waitFor();
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1320, 900),
  );
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  const firstQuota = await page.locator('.quota').nth(0).boundingBox();
  const secondQuota = await page.locator('.quota').nth(1).boundingBox();
  const sessionCard = await page.locator('.session-card').boundingBox();
  const usageChart = await page.locator('.overview-secondary .hourly-card').boundingBox();
  const recentCard = await page.locator('.recent-sessions').boundingBox();
  assert.ok(
    Math.abs(firstQuota.width - secondQuota.width) < 1 &&
      Math.abs(firstQuota.width - sessionCard.width) < 1,
    'default width supports three equal quota cards',
  );
  assert.ok(
    Math.abs(secondQuota.x + secondQuota.width - usageChart.x - usageChart.width) < 1,
    'chart aligns with second quota card',
  );
  assert.ok(Math.abs(sessionCard.x - recentCard.x) < 1, 'right-hand columns align');
  assert.ok(
    Math.abs(firstQuota.y + firstQuota.height - sessionCard.y - sessionCard.height) < 1,
    'top row bottom edges align',
  );
  await capture('overview-default-light.png');
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1540, 1120),
  );
  await capture('overview-light.png');
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: 'today' })),
  );
  await page.locator('.daily-overview strong').first().waitFor();
  await page.waitForFunction(
    () => !document.querySelector('.daily-total strong').textContent.includes('—'),
  );
  assert.equal(await page.locator('.usage-composition .composition-row').count(), 4);
  await capture('today-light.png');
  await chooseTheme('dark');
  await page.locator('.app.dark').waitFor();
  await capture('today-dark.png');
  await desktop.evaluate(({ app }) => app.setTokenDelay(600));
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: 'tokens' })),
  );
  await page.locator('.token-session-option').first().waitFor();
  await page.locator('.token-session-option').first().click();
  await page.waitForFunction(() =>
    document.querySelector('.turn-message-preview')?.textContent.includes('调整布局'),
  );
  assert.equal(
    await page.locator('.turn-message-preview').count(),
    30,
    'large conversations render one page',
  );
  await page
    .locator('.turn-pagination')
    .getByRole('button', { name: '下一页', exact: true })
    .click();
  assert.equal(await page.locator('.turn-message-preview').count(), 30);
  await page
    .locator('.turn-pagination')
    .getByRole('button', { name: '下一页', exact: true })
    .click();
  assert.equal(await page.locator('.turn-message-preview').count(), 5);
  await page.locator('.token-session-option').nth(1).click();
  assert.equal(await page.locator('.token-session-option').nth(1).isEnabled(), true);
  await page.waitForFunction(() =>
    document.querySelector('.turn-message-preview')?.textContent.includes('调整布局'),
  );
  await capture('tokens-dark.png');
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: 'overview' })),
  );
  await page.locator('.overview-primary').waitFor();
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: 'tokens' })),
  );
  assert.equal(
    await page.locator('.token-session-option').count(),
    2,
    'cached catalog is immediately available',
  );
  await desktop.evaluate(({ app }) => {
    app.setTokenDelay(0);
    app.setUpdateState({ status: 'downloading', percent: 68, version: '0.1.33' });
  });
  await page.locator('.sidebar-version .update-dot').waitFor();
  assert.ok((await page.locator('.sidebar-version').textContent()).includes('v0.1.32'));
  assert.equal(await page.locator('.sidebar-update').count(), 0);
  await page.locator('.sidebar-version').click();
  await page.getByRole('heading', { name: '版本更新', exact: true }).waitFor();
  assert.equal(await page.locator('.app-update progress').getAttribute('value'), '68');
  await page.getByRole('heading', { name: '关于 Codex Pulse', exact: true }).waitFor();
  assert.deepEqual(await page.locator('.settings-navigation button').allTextContents(), [
    '监控与提醒',
    '悬浮窗',
    '外观与语言',
    'Codex 连接',
    '版本更新',
    '关于 Codex Pulse',
  ]);
  assert.equal(await page.locator('.sidebar-github').count(), 0);
  assert.equal(
    await page
      .locator('#settings-about')
      .getByRole('button', { name: 'GitHub', exact: true })
      .count(),
    1,
  );

  await desktop.evaluate(({ app }) => app.setUpdateState({ status: 'downloaded' }));
  await page.getByRole('button', { name: '重启并安装', exact: true }).waitFor();
  await desktop.evaluate(({ app }) => app.setUpdateState({ status: 'error' }));
  await page.getByText('更新失败，请检查网络或前往下载页面', { exact: false }).waitFor();
  await capture('settings-dark.png');
  await desktop.evaluate(
    async ({ BrowserWindow }, paths) => {
      const win = new BrowserWindow({
        show: false,
        width: 68,
        height: 220,
        webPreferences: {
          preload: paths.preload,
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });
      await win.loadFile(paths.file, { query: { view: 'float' } });
    },
    { preload: join(root, 'dist-electron/preload.cjs'), file: join(root, 'dist/index.html') },
  );
  const rail = desktop.windows().find((window) => window.url().includes('view=float'));
  await rail.emulateMedia({ reducedMotion: 'reduce' });
  await rail.locator('.floating-rail').waitFor();
  for (const selector of ['.rail-item', '.rail-token']) {
    await rail.locator(selector).first().hover();
    assert.equal(
      await rail
        .locator(selector)
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      'rgba(0, 0, 0, 0)',
      'rail items have no independent hover background',
    );
  }
  await chooseTheme('light');
  await rail.locator('.floating-rail.light').waitFor();
  const railImage = await desktop.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((window) =>
      window.webContents.getURL().includes('view=float'),
    );
    return (await window.webContents.capturePage()).toPNG().toString('base64');
  });
  await writeFile(join(output, 'floating-light.png'), Buffer.from(railImage, 'base64'));
  await chooseTheme('dark');
  await rail.locator('.floating-rail.dark').waitFor();
  await desktop.evaluate(
    async ({ BrowserWindow }, paths) => {
      const window = new BrowserWindow({
        show: false,
        width: 360,
        height: 420,
        webPreferences: {
          preload: paths.preload,
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });
      await window.loadFile(paths.file, { query: { view: 'peek' } });
    },
    { preload: join(root, 'dist-electron/preload.cjs'), file: join(root, 'dist/index.html') },
  );
  const peek = desktop.windows().find((window) => window.url().includes('view=peek'));
  await peek.emulateMedia({ reducedMotion: 'reduce' });
  await peek.locator('.peek-window.dark').waitFor();
  await chooseTheme('light');
  await peek.locator('.peek-window.light').waitFor();
  await peek.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  const peekImage = await desktop.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((window) =>
      window.webContents.getURL().includes('view=peek'),
    );
    return (await window.webContents.capturePage()).toPNG().toString('base64');
  });
  await writeFile(join(output, 'peek-light.png'), Buffer.from(peekImage, 'base64'));
  assert.deepEqual(errors, []);
  console.log(
    'PASS: calendar, overview, daily usage, cached async sessions, 30-row turn pagination, compact sidebar and updater states, cross-window live themes, floating rail and peek card, translations, keyboard navigation, ICS',
  );
  console.log('Screenshots: ' + output);
} finally {
  await desktop.close();
}
