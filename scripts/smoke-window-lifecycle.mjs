/** 悬浮窗关闭/恢复回归：使用隔离配置，不依赖账号或网络。 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { _electron } = await import(pathToFileURL(process.env.CODEX_PULSE_PLAYWRIGHT).href);
const temporary = await mkdtemp(join(tmpdir(), 'pulse-window-lifecycle-'));
await writeFile(
  join(temporary, 'pulse.json'),
  JSON.stringify({ starGuideShown: true, settings: { language: 'zh-CN', showOnLaunch: true } }),
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
try {
  desktop = await _electron.launch({
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${temporary}`],
    env,
  });
  await desktop.evaluate(({ app }) => {
    app.lifecycleErrors = [];
    process.on('uncaughtExceptionMonitor', (error) => app.lifecycleErrors.push(error.message));
  });
  const floating = await desktop.firstWindow();
  await floating.waitForFunction(() => Boolean(window.pulse));
  for (let attempt = 0; attempt < 3; attempt++) {
    await floating.evaluate(() => window.pulse.action('show'));
    assert.equal(
      await desktop.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes('view=float'),
        );
        win.close();
        return !win.isDestroyed() && !win.isVisible();
      }),
      true,
      'closing hides the floating window without destroying it',
    );
    await floating.evaluate(() => window.pulse.action('show'));
    assert.equal(
      await desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes('view=float'))
          .isVisible(),
      ),
      true,
      'the existing floating window can be shown again',
    );
    // 构建与托盘共用的菜单，确认关闭/恢复后仍能安全访问窗口。
    await desktop.evaluate(({ Menu, app }) => {
      Menu.prototype.popup = function () {
        app.lifecycleMenu = this.items.map((item) => item.label);
      };
    });
    await floating.evaluate(() => window.pulse.action('menu'));
    assert.ok(await desktop.evaluate(({ app }) => app.lifecycleMenu.includes('退出应用')));
  }
  assert.deepEqual(await desktop.evaluate(({ app }) => app.lifecycleErrors), []);
  console.log(
    'PASS: repeated floating close/show and shared tray menu, no main-process exceptions',
  );
} finally {
  if (desktop) await desktop.close();
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
