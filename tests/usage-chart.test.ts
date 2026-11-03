import test from 'node:test';
import assert from 'node:assert/strict';
import { DailyAccumulator, localDayRange } from '../electron/daily-usage';
import {
  aggregateTimeline,
  minuteCapacity,
  resizeMinuteWindow,
  bucketDate,
  bucketIndex,
  previousDay,
  splitPaths,
} from '../src/usage-chart';
import type { UsageSample } from '../electron/types';

test('minute history preserves missing counts, deduplicates copies and aggregates consistently', () => {
  const range = localDayRange(new Date(2026, 10, 3));
  const accumulator = new DailyAccumulator({ ...range, start: -Infinity }, true);
  const make = (key: string, time: number, total: number | null): UsageSample => ({
    key,
    timestamp: new Date(time).toISOString(),
    turnId: key,
    complete: true,
    dedupable: true,
    tokens: { input: total, output: 0, cachedInput: 0, reasoning: 0, total },
  });
  const first = make('a', range.start + 61000, 10);
  accumulator.add(first, 'original', 0);
  accumulator.add(first, 'copy', 0);
  accumulator.add(make('b', range.start + 65000, 20), 'original', 1);
  accumulator.add(make('missing', range.start + 121000, null), 'original', 2);
  accumulator.add(make('history', range.start - 86400000, 50), 'original', 3);
  const stats = accumulator.result(2, 0);
  assert.equal(stats.timeline?.length, 3);
  assert.equal(stats.timeline?.[1].total, 30);
  assert.equal(stats.timeline?.[1].records, 2);
  assert.equal(stats.timeline?.[2].total, null);
  assert.equal(
    aggregateTimeline(stats, 'minute').get(bucketIndex(range.start + 60000, 'minute')),
    30,
  );
  assert.equal(aggregateTimeline(stats, 'hour').get(bucketIndex(range.start, 'hour')), null);
  assert.equal(aggregateTimeline(stats, 'day').get(bucketIndex(range.start, 'day')), null);
  assert.equal(aggregateTimeline(stats, 'day').get(bucketIndex(range.start - 86400000, 'day')), 50);
});

test('calendar day buckets round trip and previous-day comparison retains local clock time', () => {
  const time = new Date(2026, 10, 3, 9, 26).getTime();
  assert.equal(
    bucketDate(bucketIndex(time, 'day'), 'day').getTime(),
    new Date(2026, 10, 3).getTime(),
  );
  for (const period of ['minute', 'hour'] as const) {
    const prior = bucketDate(previousDay(bucketIndex(time, period), period), period);
    assert.equal(prior.getDate(), 2);
    assert.equal(prior.getHours(), 9);
    assert.equal(prior.getMinutes(), period === 'minute' ? 26 : 0);
  }
});

test('smooth paths break on missing data and cubic segments stay inside sample bounds', () => {
  assert.equal(splitPaths([0, null, 5], 5).length, 2);
  const values = [0, 9, 5, 5.2, 12, 8, 5, 11, 8, 3];
  const [{ line }] = splitPaths(values, 12);
  assert.ok(line.includes(' C'));
  const segments = [
    ...line.matchAll(/ C([\d.e+-]+),([\d.e+-]+) ([\d.e+-]+),([\d.e+-]+) ([\d.e+-]+),([\d.e+-]+)/g),
  ];
  assert.equal(segments.length, values.length - 1);
  for (let i = 0; i < segments.length; i++) {
    const y0 = 240 - (values[i] / 12) * 220,
      y1 = 240 - (values[i + 1] / 12) * 220;
    const c1 = Number(segments[i][2]),
      c2 = Number(segments[i][4]);
    for (let j = 0; j <= 20; j++) {
      const u = j / 20;
      const y =
        (1 - u) ** 3 * y0 + 3 * (1 - u) ** 2 * u * c1 + 3 * (1 - u) * u * u * c2 + u ** 3 * y1;
      assert.ok(y >= Math.min(y0, y1) - 1e-8 && y <= Math.max(y0, y1) + 1e-8);
    }
  }
});

test('minute windows respect pixel capacity and resize without moving the opposite edge', () => {
  assert.equal(minuteCapacity(600), 60);
  assert.equal(minuteCapacity(400), 40);
  const left = resizeMinuteWindow(100, 30, -1000, 'left', 0, 1439, 60);
  assert.equal(left.count, 60);
  assert.equal(left.start + left.count, 130);
  const right = resizeMinuteWindow(100, 30, 1000, 'right', 0, 1439, 60);
  assert.equal(right.start, 100);
  assert.equal(right.count, 60);
  assert.deepEqual(resizeMinuteWindow(100, 30, 1000, 'left', 0, 1439, 60), {
    start: 122,
    count: 8,
  });
  assert.deepEqual(resizeMinuteWindow(1430, 8, 1000, 'right', 0, 1439, 60), {
    start: 1430,
    count: 10,
  });
  assert.deepEqual(resizeMinuteWindow(2, 30, -1000, 'left', 0, 1439, 60), { start: 0, count: 32 });
});
