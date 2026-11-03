/** Calendar-aware buckets and shape-preserving cubic curves shared by usage charts. */
import type { DailyStats } from '../electron/types';
export type Period = 'minute' | 'hour' | 'day';
export type Point = { x: number; y: number };
export const step = { minute: 60000, hour: 3600000, day: 86400000 };
export function bucketIndex(time: number, period: Period): number {
  const date = new Date(time);
  return period === 'day'
    ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / step.day
    : Math.floor(time / step[period]);
}
export function bucketDate(index: number, period: Period): Date {
  const date = new Date(index * step[period]);
  return period === 'day'
    ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    : date;
}
export function previousDay(index: number, period: Period): number {
  const date = bucketDate(index, period);
  date.setDate(date.getDate() - 1);
  return bucketIndex(date.getTime(), period);
}
export function aggregateTimeline(stats: DailyStats | undefined, period: Period) {
  const result = new Map<number, number | null>();
  const add = (time: number, total: number | null) => {
    const key = bucketIndex(time, period);
    const previous = result.get(key);
    result.set(key, total === null || previous === null ? null : (previous ?? 0) + total);
  };
  if (period === 'day' && stats?.daily) {
    stats.daily.forEach((sample) =>
      add(new Date(`${sample.date}T00:00:00`).getTime(), sample.total),
    );
  } else if (stats?.timeline) stats.timeline.forEach((sample) => add(sample.time, sample.total));
  else if (period !== 'minute') {
    for (const day of [stats?.yesterday, stats]) {
      if (!day) continue;
      const [year, month, date] = day.date.split('-').map(Number);
      day.hourly?.forEach((hour) =>
        add(new Date(year, month - 1, date, hour.hour).getTime(), hour.total),
      );
    }
  }
  return result;
}
/** Harmonic tangents stay within each segment's range, without inventing peaks. */
export function smoothPath(points: Point[]): string {
  if (!points.length) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  const slopes = points
    .slice(1)
    .map((point, i) => (point.y - points[i].y) / (point.x - points[i].x));
  const tangents = points.map((_, i) => {
    if (!i) return slopes[0];
    if (i === points.length - 1) return slopes[i - 1];
    const a = slopes[i - 1],
      b = slopes[i];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      width = (b.x - a.x) / 3;
    path += ` C${a.x + width},${a.y + tangents[i - 1] * width} ${b.x - width},${b.y - tangents[i] * width} ${b.x},${b.y}`;
  }
  return path;
}
export function splitPaths(values: (number | null)[], max: number) {
  const groups: Point[][] = [];
  values.forEach((value, i) => {
    if (value === null) return;
    if (!i || values[i - 1] === null) groups.push([]);
    groups[groups.length - 1].push({
      x: (i / Math.max(1, values.length - 1)) * 1000,
      y: 240 - (value / max) * 220,
    });
  });
  return groups.map((points) => ({
    line: smoothPath(points),
    area: `${smoothPath(points)} L${points[points.length - 1].x},240 L${points[0].x},240 Z`,
  }));
}

/** Two 3px columns plus their spacing require at least 10 screen pixels per minute. */
export function minuteCapacity(width: number) {
  return Math.max(8, Math.floor(width / 10));
}
export function resizeMinuteWindow(
  start: number,
  count: number,
  delta: number,
  side: 'left' | 'right',
  lower: number,
  end: number,
  maxCount: number,
) {
  if (side === 'left') {
    const right = start + count;
    const nextStart = Math.max(
      lower,
      right - maxCount,
      Math.min(right - 8, start + Math.round(delta)),
    );
    return { start: nextStart, count: right - nextStart };
  }
  const nextEnd = Math.min(
    end + 1,
    start + maxCount,
    Math.max(start + 8, start + count + Math.round(delta)),
  );
  return { start, count: nextEnd - start };
}
