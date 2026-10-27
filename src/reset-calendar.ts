/**
 * 按本机日期组织公告，生成周一开头的月历；空单元格只负责对齐，不代表事件。
 */
import type { ResetEvent } from '../electron/reset-data';
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function monthDays(month: Date): (Date | null)[] {
  const year = month.getFullYear(),
    index = month.getMonth();
  const offset = (new Date(year, index, 1).getDay() + 6) % 7;
  const count = new Date(year, index + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, cell) =>
    cell < offset || cell >= offset + count ? null : new Date(year, index, cell - offset + 1),
  );
}
export function eventsByDay(events: ResetEvent[]): Map<string, ResetEvent[]> {
  const result = new Map<string, ResetEvent[]>();
  for (const event of events) {
    const key = dayKey(new Date(event.at));
    result.set(key, [...(result.get(key) ?? []), event]);
  }
  return result;
}
