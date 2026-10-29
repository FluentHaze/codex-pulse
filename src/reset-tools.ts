import type { ResetEvent } from '../electron/reset-data';

/** Multiple announcements at the same confirmed instant form one reset. */
export function resetIntervals(events: ResetEvent[], now: number) {
  const times = [
    ...new Set(
      events
        .filter((event) => event.announced)
        .map((event) => Date.parse(event.at))
        .filter((at) => at <= now),
    ),
  ].sort((a, b) => a - b);
  return times
    .slice(1)
    .map((at, index) => ({ at, days: (at - times[index]) / 86400000 }))
    .slice(-8);
}

const utc = (at: number) =>
  new Date(at)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
const escape = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

export function resetCalendarFile(at: number, label: string, now: number) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Codex Pulse//Reset Reminder//EN',
    'BEGIN:VEVENT',
    `UID:quota-${at}@codex-pulse`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(at)}`,
    `DTEND:${utc(at + 60000)}`,
    `SUMMARY:${escape(label)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(label)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // RFC 5545 folds lines at 75 octets without splitting UTF-8 characters.
  return (
    lines
      .map((line) => {
        const parts: string[] = [];
        let current = '',
          bytes = 0;
        for (const character of line) {
          const size = new TextEncoder().encode(character).length;
          if (bytes + size > 75) {
            parts.push(current);
            current = ' ';
            bytes = 1;
          }
          current += character;
          bytes += size;
        }
        parts.push(current);
        return parts.join('\r\n');
      })
      .join('\r\n') + '\r\n'
  );
}
