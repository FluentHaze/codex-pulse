import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseForecast,
  parseTimeline,
  parseFeed,
  parseStatus,
  resetLocale,
  ResetService,
  resetSourceUrl,
} from '../electron/reset-data';
import { resetIntervals, resetCalendarFile } from '../src/reset-tools';
import { newestConfirmedReset, resetReminderCandidates } from '../electron/reset-alerts';
import { defaults, type State } from '../electron/types';
import { dayKey, monthDays, eventsByDay } from '../src/reset-calendar';

const forecast = {
  probabilities: { rounded_24h: 32, rounded_48h: 53 },
  confidence: 'low',
  last_reset_at: '2026-10-22T17:10:01Z',
  updated_at: '2026-10-23T08:03:48Z',
  official_signal: {
    summary: 'Reset expected tomorrow',
    url: 'https://x.com/thsottiaux/status/123',
  },
};
const event = {
  id: 'reset-1',
  announced_at: '2026-10-22T17:10:01Z',
  group: 'reset',
  announcement_state: 'announced',
  summary: 'Reset complete',
  url: 'https://x.com/thsottiaux/status/123',
};
test('untrusted API fields are validated and source links cannot open arbitrary protocols or hosts', () => {
  assert.equal(parseForecast(forecast).probability24h, 32);
  assert.equal(
    parseForecast({ ...forecast, probabilities: { rounded_24h: '93', rounded_48h: 101 } })
      .probability24h,
    null,
  );
  assert.equal(
    parseForecast({ ...forecast, probabilities: { rounded_24h: '93', rounded_48h: 101 } })
      .probability48h,
    null,
  );
  assert.throws(() => parseForecast({ error: 'unavailable' }));
  for (const url of [
    'javascript:alert(1)',
    'http://x.com/',
    'https://x.com.evil.test/',
    'https://user:pass@x.com/',
    'file:///etc/passwd',
  ])
    assert.equal(resetSourceUrl(url), null);
  assert.equal(
    resetSourceUrl('https://codex-reset.com/timeline'),
    'https://codex-reset.com/timeline',
  );
});
test('announcements and banked grants do not become confirmed global resets; malformed and duplicate events are dropped', () => {
  const rows = parseTimeline({
    events: [
      event,
      event,
      { ...event, id: 'pending', announcement_state: 'none' },
      { ...event, id: 'banked', group: 'credits' },
      { ...event, id: 'bad', announced_at: 'invalid' },
    ],
  });
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.filter((row) => row.announced).map((row) => row.id),
    ['reset-1'],
  );
  assert.throws(() => parseTimeline({ events: null }));
});
test('concurrent reads share requests, use a 60 second cache and retain partial success on later failure', async () => {
  let now = 1000,
    calls = 0,
    fail = false;
  const service = new ResetService(
    async (input) => {
      calls++;
      if (String(input).endsWith('forecast'))
        return new Response(JSON.stringify(forecast), { status: fail ? 503 : 200 });
      return Response.json({ events: [event] });
    },
    () => now,
  );
  const [first, shared] = await Promise.all([service.read(), service.read()]);
  assert.equal(calls, 3);
  assert.deepEqual(first, shared);
  await service.read();
  assert.equal(calls, 3);
  fail = true;
  now += 60_001;
  const next = await service.read();
  assert.equal(calls, 6);
  assert.equal(next.forecast?.probability24h, 32);
  assert.ok(next.forecastError);
  assert.equal(next.timelineError, null);
  assert.equal(next.forecastFetchedAt, 1000);
  assert.equal(next.timelineFetchedAt, now);
});
test('429 Retry-After throttles the failing endpoint without blocking calendar refreshes', async () => {
  let now = 1000,
    forecastCalls = 0,
    timelineCalls = 0;
  const service = new ResetService(
    async (input) => {
      if (String(input).endsWith('forecast')) {
        forecastCalls++;
        return new Response('', { status: 429, headers: { 'Retry-After': '120' } });
      }
      if (String(input).endsWith('timeline')) timelineCalls++;
      return Response.json({ events: [] });
    },
    () => now,
  );
  await service.read();
  now += 60_001;
  await service.read();
  assert.equal(forecastCalls, 1);
  assert.equal(timelineCalls, 2);
  now += 60_001;
  await service.read();
  assert.equal(forecastCalls, 2);
});

test('localized announcements preserve originals and cannot leak translations between locales', () => {
  const row = {
    id: '12345',
    at: event.announced_at,
    text: 'Reset tomorrow',
    localized_text: '明日リセット',
    translation_status: 'translated',
    url: event.url,
    explicit_reset_claim: true,
  };
  const data = {
    locale: 'ja',
    tweets: [row, row, { ...row, id: 'bad', at: 'bad' }],
    events: [],
    stale: false,
  };
  assert.equal(parseFeed(data, 'ja').posts.length, 1);
  assert.equal(parseFeed(data, 'ja').posts[0].localizedText, '明日リセット');
  assert.equal(parseFeed(data, 'zh').posts[0].localizedText, null);
  assert.equal(parseFeed(data, 'en').posts[0].localizedText, null);
  assert.equal(
    parseFeed({ ...data, tweets: [{ ...row, translation_status: 'pending' }] }, 'ja').posts[0]
      .localizedText,
    null,
  );
  assert.equal(parseFeed(data, 'ja').posts[0].category, 'signal');
  assert.equal(resetLocale('zh-CN'), 'zh');
  assert.equal(resetLocale('zh-TW'), 'en');
  assert.equal(resetLocale('ko'), 'en');
  assert.equal(
    parseTimeline(
      { locale: 'ja', events: [{ ...event, localized_summary: 'リセット完了' }] },
      'ja',
    )[0].localizedSummary,
    'リセット完了',
  );
  assert.equal(
    parseTimeline(
      { locale: 'ja', events: [{ ...event, localized_summary: 'リセット完了' }] },
      'zh',
    )[0].localizedSummary,
    null,
  );
});

test('feed classifications require a confirmed timeline event and banked grants stay separate', () => {
  const tweets = [
    { id: event.id, at: event.announced_at, text: 'Reset', url: event.url },
    { id: 'banked', at: event.announced_at, text: 'Grant', banked_state: 'available' },
    { id: 'ordinary', at: event.announced_at, text: 'A hint', kind: 'reset' },
  ];
  assert.deepEqual(
    parseFeed({ tweets, events: [event], stale: false }).posts.map((row) => row.category),
    ['reset', 'banked', 'other'],
  );
  assert.throws(() => parseFeed({ error: 'unavailable' }));
});

test('unknown and stale service responses never imply operational status', () => {
  assert.throws(() => parseStatus({}));
  assert.equal(parseStatus({ current: { degraded: false } }).state, 'unknown');
  const surfaces = [{ id: 'cli', label: 'CLI', status: 'operational' }];
  assert.equal(parseStatus({ current: { degraded: false }, surfaces }).state, 'operational');
  assert.equal(parseStatus({ current: { degraded: false }, surfaces }).stale, true);
  assert.equal(
    parseStatus({
      current: { degraded: false },
      surfaces: [{ ...surfaces[0], status: 'new_unknown_state' }],
    }).state,
    'unknown',
  );
  assert.equal(parseStatus({ current: { degraded: true }, surfaces }).state, 'degraded');
});

test('language-specific resources are cached separately while forecasts are shared without unused service requests', async () => {
  const calls: string[] = [];
  const service = new ResetService(async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    if (url.pathname.endsWith('forecast')) return Response.json(forecast);
    assert.ok(!url.pathname.endsWith('status-history'));
    const locale = url.searchParams.get('locale');
    return Response.json({
      locale,
      events: [{ ...event, localized_summary: locale === 'zh' ? '重置完成' : 'リセット完了' }],
      tweets: [],
      stale: false,
    });
  });
  const [zh, ja] = await Promise.all([service.read('zh-CN'), service.read('ja')]);
  assert.equal(calls.length, 5);
  assert.equal(zh.events[0].localizedSummary, '重置完成');
  assert.equal(ja.events[0].localizedSummary, 'リセット完了');
  await service.read('zh-CN');
  assert.equal(calls.length, 5);
});

test('cadence excludes pending, banked, duplicate instants and future records', () => {
  const now = Date.parse(event.announced_at);
  const rows = parseTimeline({
    events: [
      event,
      { ...event, id: 'same-time' },
      { ...event, id: 'older', announced_at: new Date(now - 2 * 86400000).toISOString() },
      {
        ...event,
        id: 'banked',
        group: 'credits',
        announced_at: new Date(now - 86400000).toISOString(),
      },
      { ...event, id: 'pending', announcement_state: 'pending' },
      { ...event, id: 'future', announced_at: new Date(now + 86400000).toISOString() },
    ],
  });
  assert.deepEqual(resetIntervals(rows, now), [{ at: now, days: 2 }]);
});

test('calendar export escapes user text, uses UTC and folds long UTF-8 lines', () => {
  const at = Date.parse(event.announced_at);
  const contents = resetCalendarFile(at, 'Test, name;\\\n' + '额度'.repeat(30), at);
  assert.ok(contents.includes('DTSTART:20261022T171001Z\r\n'));
  assert.ok(contents.includes('TRIGGER:-PT15M'));
  assert.ok(contents.includes('SUMMARY:Test\\, name\\;\\\\\\n'));
  for (const line of contents.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  assert.ok(contents.endsWith('END:VCALENDAR\r\n'));
});

test('global notification candidates ignore future events, failed snapshots and banked grants', async () => {
  const at = Date.parse(event.announced_at);
  const service = new ResetService(
    async (input) =>
      String(input).endsWith('forecast')
        ? Response.json(forecast)
        : Response.json({ events: [event] }),
    () => at,
  );
  const data = await service.read();
  assert.equal(newestConfirmedReset(data, at), event.announced_at);
  assert.equal(
    newestConfirmedReset({ ...data, forecastError: 'offline', timelineError: 'offline' }, at),
    null,
  );
  assert.equal(newestConfirmedReset(data, at - 1), null);
  assert.equal(
    newestConfirmedReset(
      {
        ...data,
        forecast: null,
        events: parseTimeline({ events: [{ ...event, group: 'credits' }] }),
      },
      at,
    ),
    null,
  );
});

test('personal reminders use fresh account windows, reject expired dates and keep accounts separate', () => {
  const now = Date.now();
  const state: State = {
    settings: { ...defaults, resetReminder: true },
    account: null,
    plan: null,
    buckets: [
      {
        limitId: 'codex',
        primary: { usedPercent: 50, windowDurationMins: 300, resetsAt: (now + 900000) / 1000 },
        secondary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: (now + 900001) / 1000 },
      },
    ],
    updatedAt: now,
    refreshing: false,
    status: '',
    error: null,
    executable: null,
    live: null,
  };
  const candidates = resetReminderCandidates(state, 'account-a', now);
  assert.equal(candidates.length, 1);
  assert.notEqual(candidates[0].key, resetReminderCandidates(state, 'account-b', now)[0].key);
  assert.deepEqual(resetReminderCandidates(state, null, now), []);
  assert.deepEqual(
    resetReminderCandidates({ ...state, updatedAt: now - 600001 }, 'account-a', now),
    [],
  );
  assert.deepEqual(
    resetReminderCandidates(
      { ...state, settings: { ...state.settings, resetReminder: false } },
      'account-a',
      now,
    ),
    [],
  );
  assert.deepEqual(resetReminderCandidates(state, 'account-a', now + 900002), []);
});
test('Monday-first calendar handles leap years, Sunday starts and groups records by local date', () => {
  const leap = monthDays(new Date(2024, 1, 1));
  assert.equal(leap.filter(Boolean).length, 29);
  assert.equal(leap[0], null);
  assert.equal(leap[3]?.getDate(), 1);
  const sunday = monthDays(new Date(2026, 1, 1));
  assert.equal(sunday[6]?.getDate(), 1);
  assert.equal(sunday.length, 35);
  assert.equal(dayKey(new Date(2026, 0, 2)), '2026-01-02');
  const rows = parseTimeline({ events: [event] });
  assert.equal(eventsByDay(rows).get(dayKey(new Date(event.announced_at)))?.length, 1);
});
