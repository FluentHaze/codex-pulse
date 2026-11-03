/** Interactive local preview; simulated updates never download or install. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { _electron } = await import(pathToFileURL(process.env.CODEX_PULSE_PLAYWRIGHT).href);
const temporary = await mkdtemp(join(tmpdir(), 'pulse-update-preview-'));
await writeFile(join(temporary, 'pulse.json'), JSON.stringify({ starGuideShown: true }));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
try {
  desktop = await _electron.launch({
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${temporary}`],
    env,
  });
  await desktop.evaluate(({ app, ipcMain, BrowserWindow }) => {
    app.noticeActions = [];
    app.noticeState = { currentVersion: '0.1.36', status: 'latest', installMode: 'dmg' };
    ipcMain.removeHandler('update-state');
    ipcMain.handle('update-state', () => app.noticeState);
    ipcMain.removeHandler('update-action');
    ipcMain.handle('update-action', (_event, action) => {
      app.noticeActions.push(action);
      const status =
        action === 'install' ? 'installing' : action === 'check' ? 'available' : 'downloading';
      app.noticeState = { ...app.noticeState, status, version: '0.1.37', percent: 42 };
      for (const win of BrowserWindow.getAllWindows())
        win.webContents.send('update-state', app.noticeState);
    });
  });
  const floating = await desktop.firstWindow();
  await floating.waitForFunction(() => Boolean(window.pulse));
  await floating.evaluate(() => window.pulse.settings({ language: 'zh-CN', theme: 'dark' }));
  await floating.evaluate(() => window.pulse.action('details'));
  let page;
  for (let n = 0; n < 100 && !page; n++) {
    page = desktop.windows().find((p) => p.url().includes('view=details'));
    if (!page) await floating.waitForTimeout(100);
  }
  assert.ok(page);
  await page.locator('.sidebar-version').waitFor();
  const send = async (status, extra = {}) => {
    await desktop.evaluate(
      ({ app, BrowserWindow }, value) => {
        app.noticeState = { currentVersion: '0.1.36', installMode: 'dmg', ...value };
        for (const win of BrowserWindow.getAllWindows())
          win.webContents.send('update-state', app.noticeState);
      },
      { status, ...extra },
    );
  };
  await send('available', { version: '0.1.37' });
  await desktop.evaluate(async ({ app, BrowserWindow }) => {
    const details = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('view=details'),
    );
    details.setSize(1100, 780);
    details.center();
    details.show();
    app.focus({ steal: true });
    const controls = new BrowserWindow({
      width: 340,
      height: 420,
      title: '更新提示预览控制台',
      alwaysOnTop: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    const html = `<!doctype html><meta charset="utf-8"><title>更新提示预览控制台</title>
    <style>body{font:14px -apple-system,sans-serif;padding:18px;background:#f5f5f7;color:#222}button,select{display:block;width:100%;margin:8px 0;padding:8px}small{line-height:1.6;color:#666}</style>
    <b>更新提示 · 本地模拟</b><small><p>版本 v0.1.37 仅用于预览。所有下载和安装操作均已拦截。</p></small>
    <select id="state"><option value="available">发现新版本</option><option value="downloading">下载中（42%）</option><option value="downloaded">新版本已就绪</option><option value="installing">安装中</option><option value="error">更新失败</option><option value="latest">已是最新版（隐藏提示）</option></select>
    <select id="theme"><option value="dark">深色</option><option value="light">浅色</option></select>
    <select id="width"><option value="1100">宽窗口（1100）</option><option value="700">窄窗口（700）</option></select>
    <small>关闭应用窗口即可结束预览；使用独立临时设置。</small>`;
    await controls.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const [x, y] = details.getPosition();
    controls.setPosition(Math.max(0, x + 760), Math.max(0, y + 40));
    controls.show();
    controls.on('closed', () => app.quit());
    details.on('closed', () => app.quit());
  });
  const controls = desktop.windows().find((p) => p.url().startsWith('data:'));
  assert.ok(controls);
  await controls.exposeFunction('previewChange', async (kind, value) => {
    if (kind === 'state') await send(value, { version: '0.1.37', percent: 42 });
    if (kind === 'theme') await page.evaluate((theme) => window.pulse.settings({ theme }), value);
    if (kind === 'width')
      await desktop.evaluate(
        ({ BrowserWindow }, width) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().includes('view=details'))
            .setSize(width, 780),
        Number(value),
      );
  });
  await controls.evaluate(() => {
    for (const kind of ['state', 'theme', 'width'])
      document
        .getElementById(kind)
        .addEventListener('change', (event) => window.previewChange(kind, event.target.value));
  });
  await page
    .locator('.sidebar-update-notice:visible')
    .getByText('发现新版本', { exact: true })
    .waitFor();
  await controls.selectOption('#state', 'downloading');
  await page.locator('.sidebar-update-notice:visible').getByText(/42%/).waitFor();
  await controls.selectOption('#state', 'downloaded');
  await page
    .locator('.sidebar-update-notice:visible')
    .getByText('新版本已就绪', { exact: true })
    .waitFor();
  await controls.selectOption('#state', 'available');
  console.log(
    'Preview ready: desktop app and independent state/theme/width controls are open. No real update actions run.',
  );
  await new Promise((resolve) => desktop.on('close', resolve));
} finally {
  if (desktop) await desktop.close().catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}
