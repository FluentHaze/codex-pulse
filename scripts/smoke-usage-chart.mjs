/** Isolated desktop smoke test. Set CODEX_PULSE_PLAYWRIGHT to a local Playwright index.mjs. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { _electron } = await import(pathToFileURL(process.env.CODEX_PULSE_PLAYWRIGHT).href);
const root = await mkdtemp(join(tmpdir(), 'pulse-chart-smoke-'));
await writeFile(join(root, 'pulse.json'), JSON.stringify({ starGuideShown: true }));
const sessions = join(root, 'sessions');
await mkdir(sessions);
const now = new Date();
const lines = [
  JSON.stringify({ type: 'session_meta', payload: { id: 'chart-fixture', source: 'vscode' } }),
];
let total = 0;
for (let day = 4; day >= 0; day--) {
  for (let minute = 0; minute < 1440; minute += 5) {
    const time = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 0, minute);
    if (time.getTime() > now.getTime()) continue;
    const value = Math.round(5000 + Math.max(0, Math.sin(minute / 75)) * 40000);
    total += value;
    const turn = `${day}-${minute}`;
    lines.push(
      JSON.stringify({ type: 'event_msg', payload: { type: 'task_started', turn_id: turn } }),
    );
    const usage = (amount) => ({
      input_tokens: amount,
      output_tokens: 0,
      cached_input_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: amount,
    });
    lines.push(
      JSON.stringify({
        timestamp: time.toISOString(),
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: { total_token_usage: usage(total), last_token_usage: usage(value) },
        },
      }),
    );
  }
}
await writeFile(join(sessions, 'rollout-chart.jsonl'), lines.join('\n') + '\n');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
try {
  desktop = await _electron.launch({
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${root}`],
    env,
  });
  const floating = await desktop.firstWindow();
  await floating.waitForFunction(() => Boolean(window.pulse));
  await floating.evaluate(
    (sessionPath) => window.pulse.settings({ sessionPath, theme: 'light', language: 'zh-CN' }),
    sessions,
  );
  await floating.evaluate(() => window.pulse.action('details'));
  let detail;
  const deadline = Date.now() + 15000;
  while (!detail && Date.now() < deadline) {
    detail = desktop.windows().find((page) => page.url().includes('view=details'));
    if (!detail) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(detail);
  const errors = [];
  detail.on('pageerror', (error) => errors.push(error.message));
  await detail.locator('.usage-chart').waitFor();
  await detail.waitForFunction(() => document.querySelector('.usage-current'));
  const chart = detail.locator('.usage-chart');
  assert.equal(
    await chart.getByRole('button', { name: '小时', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(await chart.locator('.usage-periods button').count(), 3);
  assert.equal(await chart.locator('circle').count(), 0);
  assert.equal(
    await chart
      .locator('.usage-canvas')
      .evaluate((element) => getComputedStyle(element).backgroundImage),
    'none',
  );
  await chart.locator('.usage-canvas').focus();
  await detail.keyboard.press('ArrowRight');
  await chart.locator('.usage-tooltip').waitFor();
  await detail.keyboard.press('Escape');
  assert.equal(await chart.locator('.usage-tooltip').count(), 0);
  assert.equal(await chart.locator('.usage-navigator').count(), 0, 'hour view has no navigator');
  assert.equal(await chart.getByRole('button', { name: '缩小时间轴', exact: true }).count(), 0);
  await chart.getByRole('button', { name: '分钟', exact: true }).click();
  await chart.getByRole('heading', { name: '每分钟 Token 消耗' }).waitFor();
  assert.ok((await chart.locator('.usage-minute-current').count()) > 0);
  assert.ok((await chart.locator('.usage-minute-previous').count()) > 0);
  assert.equal(
    await chart.locator('.usage-canvas path').count(),
    0,
    'minute totals are discrete columns',
  );
  const before = await chart.locator('input[type=range]').inputValue();
  const box = await chart.locator('.usage-canvas').boundingBox();
  await detail.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.7);
  await detail.mouse.down();
  await detail.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 8 });
  await detail.mouse.up();
  assert.ok(
    Number(await chart.locator('input[type=range]').inputValue()) < Number(before),
    'drag browses older minutes',
  );
  await chart.getByRole('button', { name: '放大时间轴', exact: true }).click();
  const oldRange = await chart.locator('.usage-navigation > span').innerText();
  await chart.getByRole('button', { name: '缩小时间轴', exact: true }).click();
  assert.notEqual(await chart.locator('.usage-navigation > span').innerText(), oldRange);
  const navigator = chart.locator('.usage-navigator');
  await navigator.scrollIntoViewIfNeeded();
  const navBox = await navigator.boundingBox();
  const beforeNav = Number(await chart.locator('input[type=range]').inputValue());
  await detail.mouse.move(navBox.x + navBox.width * 0.2, navBox.y + navBox.height / 2);
  await detail.mouse.down();
  await detail.mouse.move(navBox.x + navBox.width * 0.4, navBox.y + navBox.height / 2, {
    steps: 8,
  });
  await detail.mouse.up();
  const afterNav = Number(await chart.locator('input[type=range]').inputValue());
  assert.notEqual(afterNav, beforeNav, 'bottom navigator moves the window');
  const bounds = await chart.locator('input[type=range]').evaluate((element) => ({
    min: Number(element.min),
    max: Number(element.max),
    value: Number(element.value),
  }));
  assert.ok(bounds.value >= bounds.min && bounds.value <= bounds.max);
  assert.equal(await chart.locator('.usage-history-dates').innerText(), '00:00\n23:59');
  const beforeHandle = Number(await chart.locator('input[type=range]').inputValue());
  await chart.getByRole('button', { name: '调整开始时间' }).focus();
  await detail.keyboard.press('ArrowRight');
  assert.equal(Number(await chart.locator('input[type=range]').inputValue()), beforeHandle + 1);
  const beforeWheel = await chart.locator('.usage-navigation > span').innerText();
  await chart.locator('.usage-canvas').scrollIntoViewIfNeeded();
  const wheelBox = await chart.locator('.usage-canvas').boundingBox();
  await detail.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + wheelBox.height / 2);
  await detail.mouse.wheel(0, -100);
  await detail.waitForTimeout(100);
  assert.notEqual(await chart.locator('.usage-navigation > span').innerText(), beforeWheel);
  for (let i = 0; i < 12; i++) await detail.mouse.wheel(0, 200);
  await detail.waitForTimeout(150);
  assert.equal(
    await chart.getByRole('button', { name: '缩小时间轴', exact: true }).isDisabled(),
    true,
  );
  const minimumWidth = await chart
    .locator('.usage-minute-current, .usage-minute-previous')
    .evaluateAll((elements) =>
      Math.min(...elements.map((element) => element.getBoundingClientRect().width)),
    );
  assert.ok(minimumWidth >= 2.99, 'zooming out respects the 3px minimum column width');
  await mkdir('release', { recursive: true });
  await chart.screenshot({ path: 'release/usage-chart-minute-light.png' });
  await chart.getByRole('button', { name: '日', exact: true }).click();
  await chart.getByRole('heading', { name: '每日 Token 消耗' }).waitFor();
  await detail.waitForFunction(() => Boolean(document.querySelector('.usage-current')));
  assert.equal(await chart.locator('.usage-navigator').count(), 0, 'day view has no navigator');
  assert.equal(await chart.locator('.usage-legend > span').count(), 1);
  const daily = await detail.evaluate(() => window.pulse.todayUsage(false, 15));
  assert.equal(daily.daily.length, 15);
  assert.ok(
    daily.timeline.every(
      (sample) =>
        sample.time >= new Date(new Date().setHours(0, 0, 0, 0)).setDate(new Date().getDate() - 1),
    ),
  );
  const fixedRange = await chart.locator('.usage-navigation > span').innerText();
  await chart.locator('.usage-canvas').focus();
  await detail.keyboard.press('Shift+ArrowLeft');
  await detail.keyboard.press('+');
  assert.equal(await chart.locator('.usage-navigation > span').innerText(), fixedRange);

  await chart.getByRole('button', { name: '小时', exact: true }).click();
  await mkdir('release', { recursive: true });
  await chart.screenshot({ path: 'release/usage-chart-light.png' });
  await detail.getByRole('button', { name: '今日用量', exact: true }).click();
  await detail.locator('.today-usage .usage-chart').waitFor();
  assert.equal(await chart.locator('.usage-periods button').count(), 2);
  assert.equal(
    await chart.getByRole('button', { name: '小时', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  await chart.getByRole('button', { name: '分钟', exact: true }).click();
  await detail.evaluate(() => window.pulse.settings({ theme: 'dark' }));
  await detail.locator('.dark .usage-chart').waitFor();
  await chart.screenshot({ path: 'release/usage-chart-dark.png' });
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((win) => win.webContents.getURL().includes('view=details'))
      .setSize(700, 650),
  );
  await detail.waitForTimeout(300);
  assert.ok(
    await chart.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    'narrow chart has no horizontal overflow',
  );
  const narrowMinimum = await chart
    .locator('.usage-minute-current, .usage-minute-previous')
    .evaluateAll((elements) =>
      Math.min(...elements.map((element) => element.getBoundingClientRect().width)),
    );
  assert.ok(narrowMinimum >= 2.99, 'narrow windows preserve column width');
  await chart.screenshot({ path: 'release/usage-chart-small.png' });
  assert.deepEqual(errors, []);
  console.log(
    'Usage chart desktop smoke passed: periods, panning, zoom, keyboard, themes and narrow layout',
  );
} finally {
  if (desktop) await desktop.close();
  if (root.startsWith(join(tmpdir(), 'pulse-chart-smoke-')))
    await rm(root, { recursive: true, force: true });
}
