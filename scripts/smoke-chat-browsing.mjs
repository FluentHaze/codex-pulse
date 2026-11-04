/** Isolated chat refresh, drawer navigation, copy and responsive layout regression checks. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { _electron } = await import(pathToFileURL(process.env.CODEX_PULSE_PLAYWRIGHT).href);
const root = await mkdtemp(join(tmpdir(), 'pulse-chat-smoke-'));
await writeFile(join(root, 'pulse.json'), JSON.stringify({ starGuideShown: true }));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let desktop, originalClipboard;
try {
  desktop = await _electron.launch({
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${root}`],
    env,
  });
  await desktop.evaluate(({ app, ipcMain }) => {
    app.chatFixtureCount = 5;
    app.catalogReads = 0;
    app.scopeIds = [];
    const tokens = {
      input: 1234567,
      output: 234567,
      cachedInput: 345678,
      reasoning: 45678,
      total: 1469134,
    };
    const stats = () => ({
      date: '2026-11-04',
      timeZone: 'Asia/Shanghai',
      tokens,
      hourly: [],
      turnCount: 3,
      recordCount: 3,
      duplicateRecords: 0,
      scannedFiles: 1,
      skippedFiles: 0,
      warnings: [],
      updatedAt: Date.now(),
    });
    for (const key of ['token-catalog', 'token-session', 'today-usage', 'scope-usage'])
      ipcMain.removeHandler(key);
    ipcMain.handle('token-catalog', async () => {
      app.catalogReads++;
      return {
        root: '/fixture',
        limited: false,
        sessions: Array.from({ length: app.chatFixtureCount }, (_, i) => ({
          id: `chat-${app.chatFixtureCount - i - 1}`,
          title: `聊天 ${app.chatFixtureCount - i - 1}：用于检查长标题在窄窗口中的显示与完整内容`,
          projectName: '测试项目',
          updatedAt: Date.now(),
        })),
      };
    });
    ipcMain.handle('token-session', (_event, id) => ({
      id,
      updatedAt: Date.now(),
      warnings: [],
      turns: Array.from({ length: 3 }, (_, i) => ({
        id: `turn-${i}`,
        number: i + 1,
        startedAt: new Date().toISOString(),
        model: 'fixture-model',
        status: 'completed',
        tokens,
        complete: true,
        messages: [
          { role: 'user', phase: null, truncated: false, text: `第 ${i + 1} 轮的问题` },
          { role: 'assistant', phase: 'final', truncated: false, text: '回复内容\n'.repeat(150) },
        ],
      })),
    }));
    ipcMain.handle('today-usage', async () => {
      await new Promise((done) => setTimeout(done, 120));
      return stats();
    });
    ipcMain.handle('scope-usage', (_event, ids) => {
      app.scopeIds = ids;
      return stats();
    });
  });
  originalClipboard = await desktop.evaluate(({ clipboard }) => clipboard.readText());
  const floating = await desktop.firstWindow();
  await floating.waitForFunction(() => Boolean(window.pulse));
  await floating.evaluate(() => window.pulse.settings({ language: 'zh-CN', theme: 'light' }));
  await floating.evaluate(() => window.pulse.action('details'));
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    page = desktop.windows().find((p) => p.url().includes('view=details'));
    if (!page) await floating.waitForTimeout(100);
  }
  assert.ok(page);
  await desktop.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((win) => win.webContents.getURL().includes('view=details'))
      .webContents.setBackgroundThrottling(false);
  });
  // Use a controlled renderer clock so native desktop occlusion cannot delay polling.
  await page.clock.install();
  await page.reload();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('.recent-sessions > button').first().waitFor();
  await desktop.evaluate(({ app }) => {
    app.chatFixtureCount = 6;
  });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.recent-sessions b')].some((e) =>
      e.textContent.startsWith('聊天 5'),
    ),
  );
  // The overview keeps five rows and replaces the oldest when a new chat appears.
  assert.ok(await desktop.evaluate(({ app }) => app.catalogReads >= 2));
  await page.locator('.recent-sessions > button').first().click();
  const list = page.locator('.token-session-list');
  await list.getByRole('button').filter({ hasText: '聊天 5：' }).click();
  await page.waitForFunction(() =>
    document.querySelector('.token-selected-title')?.textContent.startsWith('聊天 5：'),
  );
  await desktop.evaluate(({ app }) => {
    app.chatFixtureCount = 7;
  });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await list.getByRole('button').filter({ hasText: '聊天 6：' }).waitFor();
  // Keep the fixture visible even if another desktop window temporarily takes focus.
  await page.evaluate(() =>
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    }),
  );
  // Exercise the actual interval, not just the visibility-resume path.
  await desktop.evaluate(({ app }) => {
    app.chatFixtureCount = 8;
  });
  await page.clock.fastForward(30010);
  await list.getByRole('button').filter({ hasText: '聊天 7：' }).waitFor();
  assert.match(await page.locator('.token-selected-title').textContent(), /聊天 5/);
  await list.getByRole('button', { name: '全部匹配聊天的总用量' }).click();
  await page.waitForFunction(() => document.querySelector('.token-summary'));
  assert.equal(await desktop.evaluate(({ app }) => app.scopeIds.length), 8);
  await list.getByRole('button').filter({ hasText: '聊天 0：' }).click();
  await page.locator('.token-turn').last().click();
  const drawer = page.locator('.token-message-drawer');
  await drawer.waitFor({ state: 'visible' });
  await drawer
    .getByRole('button', { name: '上一轮', exact: true })
    .isDisabled()
    .then((value) => assert.equal(value, true));
  await drawer.locator('.turn-drawer-body').evaluate((el) => {
    el.scrollTop = 400;
  });
  await drawer.getByRole('button', { name: '下一轮', exact: true }).click();
  assert.match(await drawer.locator('h2').textContent(), /第 2 轮/);
  assert.equal(
    await drawer.locator('.turn-drawer-content').getAttribute('data-turn-direction'),
    'next',
  );
  assert.equal(await drawer.locator('.turn-drawer-body').evaluate((el) => el.scrollTop), 0);
  await drawer.getByRole('button', { name: '下一轮', exact: true }).click();
  assert.equal(
    await drawer.getByRole('button', { name: '下一轮', exact: true }).isDisabled(),
    true,
  );
  assert.match(await drawer.locator('.turn-drawer-metrics').textContent(), /1,234,567/);
  await drawer.getByRole('button', { name: '复制用量', exact: true }).click();
  await drawer.getByRole('status').filter({ hasText: '已复制' }).waitFor();
  assert.match(await desktop.evaluate(({ clipboard }) => clipboard.readText()), /1234567/);
  await mkdir('release', { recursive: true });
  await page.screenshot({ path: 'release/chat-drawer-light.png' });
  await drawer.getByRole('button', { name: '关闭', exact: true }).click();
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: 'today' })),
  );
  await page.getByTestId('daily-total').waitFor();
  await page.getByRole('button', { name: '精确数值', exact: true }).click();
  assert.match(await page.getByTestId('daily-total').textContent(), /1,469,134/);
  await page.getByRole('button', { name: '复制用量', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '已复制' }).waitFor();
  assert.match(
    await desktop.evaluate(({ clipboard }) => clipboard.readText()),
    /输入 Token: 1234567/,
  );
  await mkdir('release', { recursive: true });
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => window.pulse.settings({ theme }), theme);
    for (const width of [1100, 850, 700]) {
      await desktop.evaluate(
        ({ BrowserWindow }, width) =>
          BrowserWindow.getAllWindows()
            .find((win) => win.webContents.getURL().includes('view=details'))
            .setSize(width, 850),
        width,
      );
      await page.waitForTimeout(120);
      if (width === 700)
        assert.equal(
          await page
            .locator('.app-toolbar nav button')
            .first()
            .evaluate((el) => getComputedStyle(el).fontSize),
          '0px',
        );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({ path: `release/chat-usage-${theme}-${width}.png` });
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '精确数值', exact: true }).click();
  assert.match(await page.getByTestId('daily-total').textContent(), /1.5M/);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: 'overview' })),
  );
  await page.locator('.recent-sessions b').first().waitFor();
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((win) => win.webContents.getURL().includes('view=details'))
      .setSize(1100, 1000),
  );
  await page.screenshot({ path: 'release/chat-overview-dark.png' });
  // Cards with different content must not inherit the chart's height.
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => window.pulse.settings({ theme }), theme);
    for (const width of [1100, 700]) {
      await desktop.evaluate(
        ({ BrowserWindow }, width) =>
          BrowserWindow.getAllWindows()
            .find((win) => win.webContents.getURL().includes('view=details'))
            .setSize(width, 850),
        width,
      );
      for (const tab of ['overview', 'today', 'tokens', 'settings']) {
        await page.evaluate(
          (tab) => window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: tab })),
          tab,
        );
        await page.waitForTimeout(150);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        await page.screenshot({ path: `release/refined-${tab}-${theme}-${width}.png` });
      }
    }
  }
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: 'overview' })),
  );
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((win) => win.webContents.getURL().includes('view=details'))
      .setSize(1100, 850),
  );
  for (const count of [5, 1, 0]) {
    await desktop.evaluate(({ app }, count) => {
      app.chatFixtureCount = count;
    }, count);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(
      (count) => document.querySelectorAll('.recent-sessions b').length === count,
      count,
    );
    const card = page.locator('.recent-sessions');
    if (count === 5) {
      const edges = await page.locator('.overview-secondary').evaluate((el) => ({
        chart: el.querySelector('.usage-chart').getBoundingClientRect().bottom,
        content: el.querySelector('.connection').getBoundingClientRect().bottom,
      }));
      assert.ok(
        Math.abs(edges.chart - edges.content) < 8,
        `complete row: ${JSON.stringify(edges)}`,
      );
    }
    const before = await card.evaluate((el) => el.getBoundingClientRect().height);
    await page.locator('.usage-canvas').evaluate((el) => {
      el.style.height = '450px';
    });
    assert.equal(await card.evaluate((el) => el.getBoundingClientRect().height), before);
    assert.equal(await card.evaluate((el) => getComputedStyle(el).minHeight), '0px');
    assert.ok(
      (await card.evaluate(
        (el) =>
          el.getBoundingClientRect().bottom -
          el.querySelector('.recent-all').getBoundingClientRect().bottom,
      )) < 24,
    );
    await page.screenshot({ path: `release/refined-recent-${count}.png` });
    await page.locator('.usage-canvas').evaluate((el) => {
      el.style.height = '';
    });
  }
  await desktop.evaluate(({ app }) => {
    app.chatFixtureCount = 5;
  });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => document.querySelectorAll('.recent-sessions b').length === 5);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.match(
    await page
      .locator('.recent-sessions > button')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
    /pulse-ink-in/,
  );
  await page.locator('.usage-chart').getByRole('button', { name: '分钟', exact: true }).click();
  await page.locator('.usage-chart').getByRole('button', { name: '小时', exact: true }).click();
  assert.match(
    await page.locator('.usage-canvas > svg').evaluate((el) => getComputedStyle(el).animationName),
    /pulse-page-in/,
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await page
      .locator('.recent-sessions > button')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
    'none',
  );
  assert.equal(
    await page.locator('.usage-canvas > svg').evaluate((el) => getComputedStyle(el).animationName),
    'none',
  );
  // Exercise the added operation animations through real UI actions.
  await page.setViewportSize({ width: 1100, height: 1400 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page
    .locator('.main-navigation')
    .getByRole('button', { name: '今日用量', exact: true })
    .click();
  await page.waitForTimeout(300);
  const navigationEdges = await page.locator('.main-navigation').evaluate((nav) => {
    const selected = nav.querySelector('[aria-current="page"]').getBoundingClientRect();
    const plate = nav.querySelector('.main-navigation-indicator').getBoundingClientRect();
    return { selected: selected.y, plate: plate.y };
  });
  assert.ok(Math.abs(navigationEdges.selected - navigationEdges.plate) < 1);
  assert.match(
    await page
      .locator('.main-navigation-indicator')
      .evaluate((el) => getComputedStyle(el).transitionProperty),
    /transform/,
  );
  const toolbarHeight = await page
    .locator('.daily-toolbar')
    .evaluate((el) => el.getBoundingClientRect().height);
  await page.locator('.daily-toolbar .refresh-button').click();
  assert.equal(
    await page.locator('.daily-toolbar').evaluate((el) => el.getBoundingClientRect().height),
    toolbarHeight,
  );
  await page.locator('.daily-toolbar .refresh-button[data-state="success"]').waitFor();
  assert.match(await page.locator('.daily-toolbar .refresh-button').textContent(), /✓/);
  assert.ok(
    await page.locator('.daily-toolbar').evaluate((el) => el.getBoundingClientRect().height < 64),
  );
  assert.equal(
    await page
      .locator('.daily-analysis')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
    2,
  );
  assert.ok(
    await page
      .locator('.usage-composition')
      .evaluate((el) => el.getBoundingClientRect().height < 380),
  );
  await page.locator('.usage-chart').getByRole('button', { name: '分钟', exact: true }).click();
  assert.equal(await page.locator('.usage-periods').getAttribute('data-period'), 'minute');
  await page.locator('.usage-chart').getByRole('button', { name: '小时', exact: true }).click();
  assert.match(
    await page
      .locator('.usage-period-indicator')
      .evaluate((el) => getComputedStyle(el).transitionProperty),
    /transform/,
  );
  await page.getByRole('button', { name: '精确数值', exact: true }).click();
  assert.match(
    await page
      .getByTestId('daily-total')
      .locator('.animated-value')
      .evaluate((el) => getComputedStyle(el).animationName),
    /pulse-value-update/,
  );
  await page.evaluate(() => {
    window.themeWipes = 0;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = (...args) => {
      window.themeWipes++;
      return start(...args);
    };
  });
  const originalTheme = await page
    .getByRole('switch', { name: '深色主题', exact: true })
    .getAttribute('aria-checked');
  await page.getByRole('switch', { name: '深色主题', exact: true }).click();
  await page.waitForFunction(
    (previous) => document.querySelector('.theme-toggle').getAttribute('aria-checked') !== previous,
    originalTheme,
  );
  await page.waitForFunction(() => window.themeWipes > 0);
  const firstTheme = await page
    .getByRole('switch', { name: '深色主题', exact: true })
    .getAttribute('aria-checked');
  await page.getByRole('switch', { name: '深色主题', exact: true }).click();
  await page.waitForFunction(() => window.themeWipes === 2);
  await page.waitForFunction(
    (previous) => document.querySelector('.theme-toggle').getAttribute('aria-checked') !== previous,
    firstTheme,
  );
  await page.waitForTimeout(550);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('switch', { name: '深色主题', exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.themeWipes), 2);
  assert.equal(
    await page
      .locator('.main-navigation-indicator')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    '0s',
  );
  await page.screenshot({ path: 'release/today-compact-layout.png' });
  await page
    .locator('.usage-composition')
    .screenshot({ path: 'release/today-composition-strip.png' });
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: 'overview' })),
  );
  await page.locator('.recent-sessions b').first().waitFor();
  await page.setViewportSize({ width: 1100, height: 1400 });
  await page
    .locator('.overview-secondary')
    .screenshot({ path: 'release/overview-composed-dark.png' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(
    await page
      .locator('.logo-mark .brand-icon')
      .evaluate((el) => getComputedStyle(el).animationIterationCount),
    'infinite',
  );
  await page.evaluate(() => document.documentElement.classList.add('motion-paused'));
  assert.equal(
    await page
      .locator('.logo-mark .brand-icon')
      .evaluate((el) => getComputedStyle(el).animationPlayState),
    'paused',
  );
  await page.evaluate(() => document.documentElement.classList.remove('motion-paused'));
  const snapshot = await page.evaluate(() => window.pulse.getState());
  const sendLive = (total) =>
    desktop.evaluate(
      ({ BrowserWindow }, { snapshot, total }) => {
        snapshot.live = {
          ...snapshot.live,
          title: 'Live fixture',
          status: 'collecting',
          complete: true,
          tokens: { input: total, output: 0, total, cachedInput: 0, reasoning: 0 },
          updatedAt: Date.now(),
        };
        BrowserWindow.getAllWindows()
          .find((win) => win.webContents.getURL().includes('view=details'))
          .webContents.send('state', snapshot);
      },
      { snapshot, total },
    );
  await sendLive(1500001);
  await page.waitForFunction(
    () => document.querySelector('.session-count .animated-value')?.textContent === '1.5M',
  );
  const previousNumber = await page.locator('.session-count .animated-value').elementHandle();
  await sendLive(1500101);
  await page.waitForFunction((element) => !element.isConnected, previousNumber);
  assert.equal(await page.locator('.session-count .animated-value').textContent(), '1.5M');
  assert.match(
    await page
      .locator('.session-count .animated-value')
      .evaluate((el) => getComputedStyle(el).animationName),
    /pulse-value-update/,
  );
  const border = await page
    .locator('.toolbar-refresh')
    .evaluate((el) => getComputedStyle(el).borderTopStyle);
  assert.equal(border, 'solid');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await page
      .locator('.logo-mark .brand-icon')
      .evaluate((el) => getComputedStyle(el).animationName),
    'none',
  );
  assert.equal(
    await page
      .locator('.session-count .animated-value')
      .evaluate((el) => getComputedStyle(el).animationName),
    'none',
  );
  await page.evaluate(async () => {
    await window.pulse.settings({ language: 'en' });
    window.dispatchEvent(new CustomEvent('pulse-navigate', { detail: 'today' }));
  });
  await page.setViewportSize({ width: 700, height: 1100 });
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(
    await page
      .locator('.usage-composition')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
    2,
  );
  await page.screenshot({ path: 'release/today-compact-en-700.png' });
  assert.deepEqual(errors, []);
  console.log(
    'Chat browsing smoke passed: catalog refresh, scope, drawer navigation, exact values, clipboard, themes and widths',
  );
} finally {
  if (desktop && originalClipboard !== undefined)
    await desktop.evaluate(({ clipboard }, text) => clipboard.writeText(text), originalClipboard);
  await desktop?.close();
  await rm(root, { recursive: true, force: true });
}
