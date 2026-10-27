/**
 * 开发用界面冒烟检查：通过 Electron 会话检查页面布局与交互，结束后恢复原设置。
 */
// Run with CODEX_PULSE_PLAYWRIGHT pointing to a local Playwright index.mjs.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { resolve, join, dirname, basename } from 'node:path';
import { mkdtemp, rm, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const require = createRequire(import.meta.url);
const { _electron } = await import(pathToFileURL(process.env.CODEX_PULSE_PLAYWRIGHT).href);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const smokeData = await mkdtemp(join(tmpdir(), 'pulse-smoke-'));
const desktop = await _electron.launch({
  executablePath: process.env.CODEX_PULSE_EXECUTABLE || require('electron'),
  args: [...(process.env.CODEX_PULSE_EXECUTABLE ? [] : ['.']), `--user-data-dir=${smokeData}`],
  env,
});
await desktop.evaluate(({ app }) => {
  app.pulseExceptions = [];
  process.on('uncaughtExceptionMonitor', (error) => app.pulseExceptions.push(error.name));
});
const capture = async (view, path) => {
  const png = await desktop.evaluate(async ({ BrowserWindow }, view) => {
    const win = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes('view=' + view),
    );
    const image = await win.capturePage();
    return image.toPNG().toString('base64');
  }, view);
  await writeFile(path, Buffer.from(png, 'base64'));
};
let controller, originalSettings;
try {
  const menus = await desktop.evaluate(({ Menu }) =>
    Menu.getApplicationMenu().items.map((item) => ({
      label: item.label,
      children: item.submenu?.items
        .filter((child) => child.type !== 'separator')
        .map((child) => child.label),
    })),
  );
  assert.deepEqual(menus.map((item) => item.label).slice(process.platform === 'darwin' ? 1 : 0), [
    '文件',
    '编辑',
    '视图',
    '窗口',
    '帮助',
  ]);
  assert.deepEqual(menus.find((item) => item.label === '窗口').children, [
    '最小化',
    '最大化 / 还原',
    '关闭窗口',
    '显示 / 隐藏悬浮窗',
  ]);
  let floating;
  for (let attempt = 0; attempt < 100; attempt++) {
    floating = desktop.windows().find((win) => win.url().includes('view=float'));
    if (floating) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(floating, 'rail window opened');
  await floating.locator('.floating-rail').waitFor();
  await floating.waitForFunction(() => !!window.pulse);
  let state;
  const deadline = Date.now() + 60000;
  do {
    state = await floating.evaluate(() => window.pulse.getState());
    if (state.status === '已连接' && !state.refreshing) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  assert.equal(state.status, '已连接');
  assert.ok(state.buckets.length);
  controller = floating;
  originalSettings = {
    theme: state.settings.theme,
    quotaDisplay: state.settings.quotaDisplay,
    locked: state.settings.locked,
    sessionPath: state.settings.sessionPath || '',
    watchedSessionId: state.settings.watchedSessionId || '',
  };
  const waitLive = async (predicate, message) => {
    const limit = Date.now() + 15000;
    do {
      const current = await floating.evaluate(() => window.pulse.getState());
      if (predicate(current.live)) return current.live;
      await new Promise((resolve) => setTimeout(resolve, 200));
    } while (Date.now() < limit);
    assert.fail(message);
  };
  const fixtureRoot = join(smokeData, 'realtime-sessions');
  await mkdir(fixtureRoot);
  const liveFile = join(fixtureRoot, 'rollout-live.jsonl');
  const liveEvent = (type, payload = {}) =>
    JSON.stringify({ type: 'event_msg', payload: { type, ...payload } }) + '\n';
  const liveUsage = (input, output) =>
    liveEvent('token_count', {
      info: {
        total_token_usage: {
          input_tokens: input,
          output_tokens: output,
          total_tokens: input + output,
        },
        last_token_usage: {
          input_tokens: input,
          output_tokens: output,
          total_tokens: input + output,
        },
      },
    });
  await writeFile(liveFile, liveEvent('task_started', { turn_id: 'live-a' }) + liveUsage(100, 20));
  await floating.evaluate((sessionPath) => window.pulse.settings({ sessionPath }), fixtureRoot);
  await waitLive(
    (live) => live?.tokens?.total === 120,
    'initial local token event reaches floating window',
  );
  await appendFile(liveFile, liveUsage(200, 40));
  await waitLive((live) => live?.tokens?.total === 240, 'appended local event updates live total');
  await floating.getByText('240', { exact: true }).waitFor();
  await appendFile(liveFile, liveEvent('task_started', { turn_id: 'live-b' }));
  await waitLive(
    (live) => live?.turnId === 'live-b' && live.tokens === null,
    'new turn clears previous total before first usage event',
  );
  await appendFile(liveFile, liveUsage(250, 50));
  await waitLive(
    (live) => live?.turnId === 'live-b' && live.tokens?.total === 60,
    'new turn shows only its own delta',
  );
  await appendFile(liveFile, liveEvent('task_complete', { turn_id: 'live-b' }));
  const completedLive = await waitLive(
    (live) => live?.status === 'completed',
    'completed turn is marked complete',
  );
  await floating.evaluate(
    (watchedSessionId) => window.pulse.settings({ watchedSessionId }),
    completedLive.sessionId,
  );
  await writeFile(
    join(fixtureRoot, 'rollout-other.jsonl'),
    liveEvent('task_started', { turn_id: 'other-chat' }) + liveUsage(1000, 200),
  );
  await new Promise((resolve) => setTimeout(resolve, 3500));
  assert.equal(
    (await floating.evaluate(() => window.pulse.getState())).live.sessionId,
    completedLive.sessionId,
    'pinned chat does not jump to another updated conversation',
  );
  await floating.evaluate(() => window.pulse.settings({ watchedSessionId: '' }));
  await waitLive(
    (live) => live?.turnId === 'other-chat',
    'automatic following selects newest local conversation',
  );
  const internalFile = join(fixtureRoot, 'rollout-guardian.jsonl');
  await writeFile(
    internalFile,
    JSON.stringify({
      type: 'session_meta',
      payload: {
        id: 'guardian-hidden',
        source: { subagent: { other: 'guardian' } },
        thread_source: 'guardian_review',
      },
    }) +
      '\n' +
      liveEvent('task_started', { turn_id: 'guardian-turn' }) +
      liveUsage(5000, 1000),
  );
  const filteredCatalog = await floating.evaluate(() => window.pulse.tokenCatalog(true));
  assert.equal(
    filteredCatalog.sessions.length,
    2,
    'internal Guardian session is excluded from selectable chats',
  );
  await new Promise((resolve) => setTimeout(resolve, 3500));
  assert.equal(
    (await floating.evaluate(() => window.pulse.getState())).live.turnId,
    'other-chat',
    'automatic following ignores newer internal review activity',
  );
  const uiRoot = join(smokeData, 'ui-sessions');
  await mkdir(uiRoot);
  for (let chat = 0; chat < 2; chat++) {
    const lines = [
      JSON.stringify({
        type: 'session_meta',
        payload: { id: 'ui-chat-' + chat, cwd: '/workspace/pulse-' + chat, source: 'vscode' },
      }),
    ];
    let total = 0,
      inputTotal = 0,
      outputTotal = 0;
    for (let hour = 0; hour <= new Date().getHours(); hour++) {
      const timestamp = new Date();
      timestamp.setHours(hour, 20, 0, 0);
      const turn = 'ui-' + chat + '-' + hour;
      const input = ((hour % 5) + 1) * 42000,
        output = ((hour % 3) + 1) * 2500;
      inputTotal += input;
      outputTotal += output;
      total = inputTotal + outputTotal;
      lines.push(
        JSON.stringify({
          timestamp: timestamp.toISOString(),
          type: 'event_msg',
          payload: { type: 'task_started', turn_id: turn },
        }),
      );
      for (const role of ['user', 'assistant'])
        lines.push(
          JSON.stringify({
            type: 'response_item',
            payload: {
              type: 'message',
              role,
              content: [
                {
                  type: role === 'user' ? 'input_text' : 'output_text',
                  text:
                    role === 'user' ? '检查用量面板的显示和交互' : '已完成额度圆环与小时用量展示。',
                },
              ],
              internal_chat_message_metadata_passthrough: { turn_id: turn },
            },
          }),
        );
      lines.push(
        JSON.stringify({
          timestamp: timestamp.toISOString(),
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: {
                input_tokens: inputTotal,
                output_tokens: outputTotal,
                cached_input_tokens: 0,
                reasoning_output_tokens: 0,
                total_tokens: total,
              },
              last_token_usage: {
                input_tokens: input,
                output_tokens: output,
                cached_input_tokens: 0,
                reasoning_output_tokens: 0,
                total_tokens: input + output,
              },
            },
          },
        }),
      );
    }
    await writeFile(join(uiRoot, 'rollout-ui-' + chat + '.jsonl'), lines.join('\n') + '\n');
  }
  await floating.evaluate((sessionPath) => window.pulse.settings({ sessionPath }), uiRoot);
  await floating.evaluate(() => window.pulse.action('details'));

  let detail;
  for (let attempt = 0; attempt < 100; attempt++) {
    detail = desktop.windows().find((win) => win.url().includes('view=details'));
    if (detail) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(detail, 'details window opened');
  await detail.getByRole('heading', { name: '额度概览', exact: true }).waitFor();
  assert.equal(
    (await floating.evaluate(() => window.pulse.getState())).settings.theme,
    'dark',
    'fresh installs default to dark',
  );
  await detail.locator('.hour-bar').first().waitFor();
  assert.equal(
    await detail.locator('.hour-bar').count(),
    24,
    'hour chart renders a full local day',
  );
  await detail.locator('.hour-bar').nth(10).focus();
  await detail.locator('.hour-bar').nth(10).press('ArrowRight');
  assert.ok(
    (await detail.locator('.chart-tooltip').innerText()).includes('11:00'),
    'keyboard arrow opens precise hour tooltip',
  );
  await detail.screenshot({ path: 'release/chart-tooltip-preview.png' });
  await detail.locator('.hour-bar').nth(11).press('Escape');
  assert.equal(await detail.locator('.chart-tooltip').count(), 0, 'Escape dismisses chart tooltip');
  await detail.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
  await detail.getByRole('dialog', { name: '快速操作', exact: true }).waitFor();
  await detail.getByRole('combobox', { name: '搜索操作', exact: true }).fill('今日');
  await detail.getByRole('combobox', { name: '搜索操作', exact: true }).press('Enter');
  await detail.getByRole('heading', { name: '今日用量', exact: true }).waitFor();
  assert.equal(
    await detail.getByRole('dialog', { name: '快速操作', exact: true }).isVisible(),
    false,
    'command palette closes after navigation',
  );
  await detail.getByRole('button', { name: '额度概览', exact: true }).click();
  await detail.getByRole('button', { name: '快速操作', exact: false }).click();
  await detail.screenshot({ path: 'release/commands-preview.png' });
  await detail.getByRole('combobox', { name: '搜索操作', exact: true }).press('Escape');

  await detail.getByRole('button', { name: '今日用量', exact: true }).click();
  await detail.getByRole('heading', { name: '今日用量', exact: true }).waitFor();
  await detail.getByRole('button', { name: '刷新统计', exact: true }).waitFor();
  const today = await detail.evaluate(() => window.pulse.todayUsage());
  assert.ok(
    typeof today.tokens.total === 'number' && today.tokens.total >= 0,
    'fixture daily statistics are available',
  );
  assert.equal(today.hourly.length, 24);
  if (today.hourly.every((hour) => hour.total !== null))
    assert.equal(
      today.hourly.reduce((sum, hour) => sum + hour.total, 0),
      today.tokens.total,
      'hourly sums match daily totals',
    );
  assert.ok(today.scannedFiles > 0, 'today statistics scanned fixture files');
  await detail.screenshot({ path: 'release/today-preview.png' });
  await detail.getByRole('button', { name: 'Token 明细', exact: true }).click();
  await detail.getByRole('heading', { name: 'Token 明细', exact: true }).waitFor();
  await detail.locator('#token-session option').first().waitFor({ state: 'attached' });
  const tokenDeadline = Date.now() + 30000;
  let sessionIds = [];
  do {
    sessionIds = await detail
      .locator('#token-session option')
      .evaluateAll((elements) => elements.map((element) => element.value).filter(Boolean));
    if (sessionIds.length) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < tokenDeadline);
  assert.ok(sessionIds.length, 'fixture conversations found');
  await detail.waitForFunction(() =>
    [...document.querySelectorAll('.daily-metrics strong')].some((node) =>
      /[0-9]/.test(node.textContent),
    ),
  );
  const metrics = await detail.locator('.daily-metrics>section').evaluateAll((nodes) =>
    nodes.map((node) => ({
      padding: parseFloat(getComputedStyle(node).paddingLeft),
      height: node.querySelector('strong').getBoundingClientRect().height,
    })),
  );
  assert.equal(metrics.length, 4);
  assert.ok(
    metrics.every((metric) => metric.padding >= 18 && metric.height < 35),
    'summary metrics retain spacing and one-line values',
  );
  await detail.screenshot({ path: 'release/project-summary-preview.png' });
  assert.equal(
    await detail.locator('#token-session').inputValue(),
    '',
    'default scope selects no chat',
  );
  await detail.locator('#token-session').selectOption(sessionIds[0]);
  await detail.locator('.token-table tbody tr th').first().waitFor();
  await detail
    .getByRole('searchbox', { name: '搜索聊天', exact: true })
    .fill('pulse-no-match-5831');
  await detail.getByRole('heading', { name: '没有匹配的聊天', exact: true }).waitFor();
  assert.equal(
    await detail.locator('.token-table').count(),
    0,
    'empty search never displays stale conversation details',
  );
  await detail.getByRole('button', { name: '清空筛选条件', exact: true }).click();
  await detail.locator('#token-session').selectOption(sessionIds[0]);
  await detail.locator('.token-table tbody tr th').first().waitFor();
  const projectOptions = await detail
    .getByLabel('筛选项目', { exact: true })
    .locator('option')
    .evaluateAll((elements) => elements.map((element) => element.value));
  if (projectOptions.length > 1) {
    await detail
      .getByLabel('筛选项目', { exact: true })
      .selectOption(
        await detail.evaluate(
          async () =>
            (await window.pulse.tokenCatalog()).sessions.find((session) => session.project)
              ?.project || '',
        ),
      );
    assert.equal(
      await detail.locator('#token-session').inputValue(),
      '',
      'project change clears chat selection',
    );
    await detail.getByText('当前项目总用量', { exact: true }).waitFor();
    await detail.getByLabel('筛选项目', { exact: true }).selectOption('*');
    await detail.locator('#token-session').selectOption(sessionIds[0]);
  }
  await detail.getByLabel('筛选更新时间', { exact: true }).selectOption('today');
  await detail.getByLabel('筛选更新时间', { exact: true }).selectOption('all');
  await detail.locator('.token-table tbody tr th').first().waitFor();
  assert.ok(await detail.locator('.token-table tbody tr th').count(), 'turn rows rendered');
  assert.ok(await detail.locator('.turn-message-preview').count(), 'message summaries rendered');
  const messageDetails = detail.locator('.message-detail details').first();
  await messageDetails.locator('summary').click();
  await messageDetails.locator('.message-bubble pre').first().waitFor();
  assert.ok(
    (await messageDetails.locator('.message-bubble pre').first().innerText()).length > 0,
    'message body visible on expansion',
  );
  await messageDetails.locator('.message-bubble').first().scrollIntoViewIfNeeded();
  await detail.screenshot({ path: 'release/token-messages-preview.png' });
  await messageDetails.locator('summary').click();
  await detail.evaluate(() => scrollTo(0, 0));
  assert.equal(
    await detail.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'token page does not overflow horizontally',
  );
  await detail.screenshot({ path: 'release/tokens-preview.png' });
  if (sessionIds.length > 1) {
    await detail.locator('#token-session').selectOption(sessionIds[1]);
    await detail.locator('.token-table tbody tr th').first().waitFor();
  }
  await detail.getByRole('button', { name: '刷新记录', exact: true }).click();
  await detail.locator('.token-table tbody tr th').first().waitFor();
  assert.equal(
    await detail.evaluate(async () => {
      try {
        await window.pulse.tokenSession('../../auth.json');
        return false;
      } catch {
        return true;
      }
    }),
    true,
    'IPC rejects arbitrary file paths',
  );
  await floating.evaluate(
    (sessionPath) => window.pulse.settings({ sessionPath }),
    resolve('.smoke-no-sessions'),
  );
  await detail.getByRole('heading', { name: '未找到本地聊天记录', exact: true }).waitFor();
  await detail.screenshot({ path: 'release/tokens-empty-preview.png' });
  await floating.evaluate((sessionPath) => window.pulse.settings({ sessionPath }), uiRoot);
  await detail.locator('#token-session').selectOption(sessionIds[0]);
  await detail.locator('.token-table tbody tr th').first().waitFor();
  await detail.getByRole('button', { name: '偏好设置' }).click();
  await detail.getByText('监控与提醒', { exact: true }).waitFor();
  await detail.screenshot({ path: 'release/settings-preview.png' });
  const mainBucket = state.buckets.find((bucket) => bucket.limitId === 'codex') || state.buckets[0];
  const quotaCount = [mainBucket?.primary, mainBucket?.secondary].filter(Boolean).length;
  const railBounds = () =>
    desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((win) => win.webContents.getURL().includes('view=float'))
        .getBounds(),
    );
  const size = await railBounds();
  assert.equal(size.width, 68);
  assert.equal(size.height, 68 + Math.max(1, quotaCount) * 72);
  assert.equal(await floating.locator('.mode-toggle').count(), 0, 'rail has no mode buttons');
  assert.equal(
    await floating.evaluate(
      () =>
        document.documentElement.scrollWidth > innerWidth ||
        document.documentElement.scrollHeight > innerHeight,
    ),
    false,
    'vertical rail fits its window',
  );
  await capture('float', 'release/rail-preview.png');
  for (const side of ['left', 'right']) {
    const rail = await desktop.evaluate(({ BrowserWindow, screen }, side) => {
      const win = BrowserWindow.getAllWindows().find((win) =>
        win.webContents.getURL().includes('view=float'),
      );
      const area = screen.getDisplayMatching(win.getBounds()).workArea;
      const bounds = win.getBounds();
      win.setPosition(
        side === 'left' ? area.x + 12 : area.x + area.width - bounds.width - 12,
        area.y + 150,
      );
      return win.getBounds();
    }, side);
    await floating.evaluate(() => window.pulse.peek(true));
    const panel = await desktop.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((win) =>
        win.webContents.getURL().includes('view=peek'),
      );
      return { visible: win.isVisible(), bounds: win.getBounds() };
    });
    assert.ok(panel.visible);
    assert.deepEqual(await railBounds(), rail, 'hover never changes rail bounds');
    assert.ok(
      side === 'left'
        ? panel.bounds.x > rail.x + rail.width
        : panel.bounds.x + panel.bounds.width < rail.x,
      'description appears on free side',
    );
    const popup = desktop.windows().find((win) => win.url().includes('view=peek'));
    await capture('peek', 'release/hover-' + side + '-preview.png');
    await floating.evaluate(() => window.pulse.peek(false));
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(
      await desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((win) => win.webContents.getURL().includes('view=peek'))
          .isVisible(),
      ),
      false,
      'description disappears after leaving',
    );
    assert.deepEqual(await railBounds(), rail, 'closing description keeps rail stable');
  }
  const beforeDrag = await railBounds();
  await floating.mouse.move(34, 13);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((win) => win.webContents.getURL().includes('view=peek'))
        .isVisible(),
    ),
    true,
    'pointer entry shows description',
  );
  await floating.mouse.down();
  await floating.mouse.move(12, 30, { steps: 5 });
  await floating.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const afterDrag = await railBounds();
  assert.notDeepEqual(
    { x: afterDrag.x, y: afterDrag.y },
    { x: beforeDrag.x, y: beforeDrag.y },
    'pointer drag moves rail',
  );
  assert.equal(afterDrag.width, beforeDrag.width);
  assert.equal(afterDrag.height, beforeDrag.height);
  assert.equal(
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((win) => win.webContents.getURL().includes('view=peek'))
        .isVisible(),
    ),
    false,
    'drag hides description',
  );
  await floating.getByRole('button', { name: /本轮.*Token/ }).click();
  await detail.getByRole('heading', { name: 'Token 明细', exact: true }).waitFor();
  await detail.getByRole('button', { name: '额度概览' }).click();
  await detail.getByRole('button', { name: '已用', exact: true }).click();
  await detail.waitForFunction(() =>
    [...document.querySelectorAll('[role="meter"]')].every((node) =>
      node.getAttribute('aria-label').includes('已用'),
    ),
  );
  const expectedUsed = [mainBucket.primary, mainBucket.secondary]
    .filter(Boolean)
    .map((window) => Math.max(0, Math.min(100, window.usedPercent)));
  assert.deepEqual(
    await detail
      .getByRole('meter')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('aria-valuenow')))),
    expectedUsed,
  );
  await detail.getByRole('button', { name: '剩余', exact: true }).click();
  await floating.evaluate(() => window.pulse.settings({ theme: 'system' }));
  await detail.emulateMedia({ colorScheme: 'light' });
  await detail.locator('.app.light').waitFor();
  await detail.emulateMedia({ colorScheme: 'dark' });
  await detail.locator('.app.dark').waitFor();
  await detail.emulateMedia({ colorScheme: null });
  await floating.evaluate(() => window.pulse.settings({ theme: 'dark' }));
  await detail.locator('.app.dark').waitFor();
  await detail.mouse.move(8, 100);
  await detail.locator('.save-toast').waitFor({ state: 'hidden' });
  await detail.screenshot({
    path: 'release/details-dark-preview.png',
    fullPage: true,
    animations: 'disabled',
  });
  await floating.evaluate(() => window.pulse.settings({ theme: 'light' }));
  await detail.locator('.app.light').waitFor();
  assert.equal(
    await detail.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'default window has no horizontal overflow',
  );
  await detail.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('.session-card')).backgroundColor ===
      'rgb(255, 255, 255)',
  );
  await detail.screenshot({
    path: 'release/details-preview.png',
    fullPage: true,
    animations: 'disabled',
  });
  await capture('float', 'release/float-preview.png');
  const rings = await floating.getByRole('meter').evaluateAll((elements) =>
    elements.map((element) => ({
      value: Number(element.getAttribute('aria-valuenow')),
      offset: Number(element.querySelector('.ring-value').getAttribute('stroke-dashoffset')),
    })),
  );
  for (const ring of rings) assert.equal(ring.offset, 100 - ring.value);
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((win) => win.webContents.getURL().includes('view=details'))
      .setSize(700, 550),
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(
    await detail.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'minimum window has no horizontal overflow',
  );
  assert.equal(
    await detail.locator('.quota-summary').first().isVisible(),
    true,
    'minimum-size layout retains reset countdown',
  );
  await detail.screenshot({ path: 'release/details-small-preview.png', fullPage: true });
  await detail.getByRole('button', { name: 'Token 明细', exact: true }).click();
  await detail.locator('#token-session').selectOption(sessionIds[0]);
  await detail.locator('.token-table tbody tr th').first().waitFor();
  assert.equal(
    await detail.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'minimum token window has no horizontal page overflow',
  );
  await detail.screenshot({ path: 'release/tokens-small-preview.png' });
  await detail.getByRole('button', { name: '额度概览', exact: true }).click();
  const pro = {
    ...state,
    settings: { ...state.settings, theme: 'light' },
    plan: 'pro',
    buckets: [
      {
        limitId: 'codex',
        primary: { usedPercent: 5, windowDurationMins: 300, resetsAt: null },
        secondary: null,
      },
    ],
  };
  const inject = (fixture) =>
    desktop.evaluate(({ app, BrowserWindow }, value) => {
      clearInterval(app.pulseFixtureTimer);
      const send = () => {
        for (const win of BrowserWindow.getAllWindows()) win.webContents.send('state', value);
      };
      send();
      app.pulseFixtureTimer = setInterval(send, 50);
    }, fixture);
  await inject(pro);
  await detail.getByText('服务端返回 1 个额度窗口', { exact: true }).waitFor();
  assert.equal(
    await detail.locator('[role="meter"]').count(),
    1,
    'single-window Pro fixture omits missing secondary quota',
  );
  assert.equal(
    await floating.locator('[role="meter"]').count(),
    1,
    'floating window also omits missing secondary quota',
  );
  await detail.screenshot({ path: 'release/pro-single-window-preview.png' });
  const unavailable = {
    ...state,
    settings: { ...state.settings, theme: 'light' },
    buckets: [
      {
        limitId: 'codex',
        primary: { usedPercent: null, windowDurationMins: 300, resetsAt: null },
        secondary: { usedPercent: 100, windowDurationMins: 10080, resetsAt: null },
      },
    ],
  };
  await inject(unavailable);
  await detail.locator('.quota-condition').filter({ hasText: '暂无数据' }).waitFor();
  await detail.getByText('已耗尽', { exact: true }).waitFor();
  assert.equal(
    await detail.locator('.capacity .filled').count(),
    0,
    'unavailable and exhausted windows do not show available capacity',
  );
  assert.equal(
    await detail.locator('[role="meter"]').first().getAttribute('aria-valuenow'),
    null,
    'missing data is not reported as zero',
  );
  await detail.screenshot({ path: 'release/details-states-preview.png', fullPage: true });
  await desktop.evaluate(({ app }) => clearInterval(app.pulseFixtureTimer));
  await floating.evaluate((theme) => window.pulse.settings({ theme }), state.settings.theme);
  assert.deepEqual(
    await desktop.evaluate(({ app }) => app.pulseExceptions),
    [],
    'no uncaught main-process exceptions during desktop regression',
  );
  await detail.close();
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.ok(
    await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length === 2),
  );
  console.log(
    'PASS: keyboard command palette, chart tooltip/arrow navigation, stable vertical rail, drag suppression, left/right hover panels, hourly chart, live token updates, single-window and missing-data states, messages, themes and minimum-size layout',
  );
} finally {
  try {
    if (controller && originalSettings)
      await controller.evaluate((settings) => window.pulse.settings(settings), originalSettings);
  } finally {
    await desktop.close();
    assert.equal(dirname(smokeData), resolve(tmpdir()));
    assert.ok(basename(smokeData).startsWith('pulse-smoke-'));
    await rm(smokeData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
