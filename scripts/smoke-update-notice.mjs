/** Isolated update UI check; mock update actions so no installation or download runs. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { _electron } = await import(pathToFileURL(process.env.CODEX_PULSE_PLAYWRIGHT).href);
const temporary = await mkdtemp(join(tmpdir(), 'pulse-update-notice-'));
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
  await desktop.evaluate(({ app, ipcMain }) => {
    app.noticeActions = [];
    app.noticeState = { currentVersion: '0.1.36', status: 'latest', installMode: 'dmg' };
    ipcMain.removeHandler('update-state');
    ipcMain.handle('update-state', () => app.noticeState);
    ipcMain.removeHandler('update-action');
    ipcMain.handle('update-action', (_event, action) => {
      app.noticeActions.push(action);
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
  const notice = page.locator('.sidebar-update-notice:visible');
  for (const status of ['idle', 'checking', 'latest', 'manual', 'error']) {
    await send(status);
    await page.waitForFunction(() => !document.querySelector('.sidebar-update-notice'));
    assert.equal(await page.locator('.sidebar-version .update-dot').count(), 0);
  }
  assert.equal(await page.locator('.toolbar-refresh .refresh-button-icon > svg').count(), 1);
  assert.equal(await page.locator('.toolbar-refresh .refresh-button-icon').textContent(), '');
  await send('available', { version: '0.1.37' });
  await notice.getByText('发现新版本', { exact: true }).waitFor();
  assert.ok((await notice.innerText()).includes('v0.1.37'));
  assert.ok((await page.locator('.sidebar-version').innerText()).includes('v0.1.36'));
  await notice.getByRole('button', { name: '查看更新' }).click();
  await page.locator('.app-update').waitFor();
  await send('error');
  await page.waitForFunction(() => !document.querySelector('.sidebar-update-notice'));
  await page.locator('.app-update [role="alert"]').waitFor();
  assert.equal(await page.locator('.sidebar-version .update-dot').count(), 0);
  await send('downloading', { version: '0.1.37', percent: 42.8 });
  await notice.getByText(/42%/).waitFor();
  assert.equal(await notice.locator('progress').getAttribute('value'), '42.8');
  await send('downloaded', { version: '0.1.37' });
  await notice.getByText('新版本已就绪', { exact: true }).waitFor();
  assert.deepEqual(await desktop.evaluate(({ app }) => app.noticeActions), []);
  await notice.getByRole('button', { name: '重启并安装' }).click();
  assert.deepEqual(await desktop.evaluate(({ app }) => app.noticeActions), ['install']);
  await send('installing', { version: '0.1.37' });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.sidebar-update-notice button')].every((b) => b.disabled),
  );
  await send('error', { version: '0.1.37' });
  await notice.getByText('更新失败，点击重试', { exact: true }).waitFor();
  await notice.getByRole('button', { name: '查看更新' }).click();
  await send('downloaded', { version: '0.1.37' });
  await mkdir('release', { recursive: true });
  for (const theme of ['dark', 'light']) {
    await page.evaluate((theme) => window.pulse.settings({ theme }), theme);
    await page.locator(`.${theme}`).waitFor();
    for (const width of [1100, 700]) {
      await desktop.evaluate(
        ({ BrowserWindow }, width) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().includes('view=details'))
            .setSize(width, 750),
        width,
      );
      await page.waitForTimeout(250);
      assert.equal(await notice.count(), 1);
      const box = await notice.boundingBox();
      assert.ok(box.width >= 120 && box.x >= 0 && box.y >= 0);
      assert.ok(await notice.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
      await page.screenshot({ path: `release/update-notice-${theme}-${width}.png` });
    }
  }
  for (const language of ['en', 'zh-TW', 'ja', 'ko']) {
    await page.evaluate((language) => window.pulse.settings({ language }), language);
    await page.waitForTimeout(150);
    assert.ok(!(await notice.innerText()).includes('新版本已就绪'));
    assert.ok(await notice.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
  }
  console.log(
    'Update notice smoke passed: states, current/target versions, navigation, explicit install, themes, narrow layout and translations',
  );
} finally {
  if (desktop) await desktop.close();
  await rm(temporary, { recursive: true, force: true });
}
