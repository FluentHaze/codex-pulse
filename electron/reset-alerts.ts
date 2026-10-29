import type { ResetData } from './reset-data.js';
import type { State } from './types.js';

export function resetReminderCandidates(state: State, identity: string | null, now: number) {
  if (
    !state.settings.resetReminder ||
    !identity ||
    !state.updatedAt ||
    now - state.updatedAt > 600000
  )
    return [];
  return state.buckets.flatMap((bucket) =>
    (['primary', 'secondary'] as const).flatMap((slot) => {
      const at = bucket[slot]?.resetsAt;
      return typeof at === 'number' &&
        Number.isFinite(at) &&
        at * 1000 > now &&
        at * 1000 - now <= 900000
        ? [
            {
              key: `reminder:${identity}:${bucket.limitId}:${slot}:${at}`,
              name: bucket.limitName ?? bucket.limitId,
            },
          ]
        : [];
    }),
  );
}

export function newestConfirmedReset(data: ResetData, now: number): string | null {
  const times = [
    ...(!data.forecastError &&
    data.forecastFetchedAt !== null &&
    now - data.forecastFetchedAt < 600000
      ? [data.forecast?.lastResetAt]
      : []),
    ...(!data.timelineError &&
    data.timelineFetchedAt !== null &&
    now - data.timelineFetchedAt < 600000
      ? data.events.filter((event) => event.announced).map((event) => event.at)
      : []),
  ].filter((at): at is string => !!at && Number.isFinite(Date.parse(at)) && Date.parse(at) <= now);
  return times.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}
