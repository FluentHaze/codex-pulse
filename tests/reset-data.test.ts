import test from 'node:test';
import assert from 'node:assert/strict';
import { parseForecast, parseTimeline, ResetService, resetSourceUrl } from '../electron/reset-data';
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
  assert.equal(calls, 2);
  assert.deepEqual(first, shared);
  await service.read();
  assert.equal(calls, 2);
  fail = true;
  now += 60_001;
  const next = await service.read();
  assert.equal(calls, 4);
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
      timelineCalls++;
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
