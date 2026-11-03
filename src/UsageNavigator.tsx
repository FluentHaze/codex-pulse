/** Today's overview and adjustable selection share the same time scale. */
import { useMemo, useRef } from 'react';
import type { DailyStats } from '../electron/types';
import { t } from '../electron/i18n';
import { aggregateTimeline, resizeMinuteWindow, splitPaths } from './usage-chart';
export function UsageNavigator({
  stats,
  start,
  count,
  lower,
  end,
  maxCount,
  onChange,
}: {
  stats?: DailyStats;
  start: number;
  count: number;
  lower: number;
  end: number;
  maxCount: number;
  onChange(start: number, count: number): void;
}) {
  const drag = useRef<{
    x: number;
    start: number;
    count: number;
    width: number;
    side?: 'left' | 'right';
  } | null>(null);
  const total = end - lower + 1;
  const upper = Math.max(lower, end - count + 1);
  const clamp = (value: number) => Math.max(lower, Math.min(upper, Math.round(value)));
  const data = useMemo(() => aggregateTimeline(stats, 'minute'), [stats]);
  const values = Array.from({ length: Math.ceil(total / 5) }, (_, i) => {
    let sum = 0;
    for (let j = 0; j < 5 && i * 5 + j < total; j++) sum += data.get(lower + i * 5 + j) ?? 0;
    return sum;
  });
  const paths = splitPaths(values, Math.max(1, ...values));
  const stopDrag = () => {
    drag.current = null;
  };
  return (
    <>
      <div
        className="usage-navigator"
        onPointerDown={(event) => {
          if (event.button !== 0 || !stats) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const index = lower + ((event.clientX - rect.left) / rect.width) * total;
          const next = index >= start && index <= start + count ? start : clamp(index - count / 2);
          onChange(next, count);
          drag.current = { x: event.clientX, start: next, count, width: rect.width };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const origin = drag.current;
          if (!origin) return;
          const delta = ((event.clientX - origin.x) / origin.width) * total;
          if (origin.side) {
            const next = resizeMinuteWindow(
              origin.start,
              origin.count,
              delta,
              origin.side,
              lower,
              end,
              maxCount,
            );
            onChange(next.start, next.count);
          } else
            onChange(
              Math.max(lower, Math.min(end - origin.count + 1, Math.round(origin.start + delta))),
              origin.count,
            );
        }}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={stopDrag}
      >
        <svg viewBox="0 0 1000 240" preserveAspectRatio="none" aria-hidden="true">
          {paths.map((path, i) => (
            <g key={i}>
              <path d={path.area} className="usage-overview-area" />
              <path
                d={path.line}
                className="usage-overview-line"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </svg>
        <div
          className="usage-window"
          style={{
            left: `${((start - lower) / total) * 100}%`,
            width: `${(count / total) * 100}%`,
          }}
          aria-hidden="true"
        />
        <input
          type="range"
          aria-label={t('拖动时间窗口')}
          min={lower}
          max={upper}
          value={start}
          step={1}
          disabled={!stats || lower === upper}
          onChange={(event) => onChange(Number(event.target.value), count)}
        />
        {(['left', 'right'] as const).map((side) => (
          <button
            key={side}
            className="usage-navigator-handle"
            style={{ left: `${((start - lower + (side === 'right' ? count : 0)) / total) * 100}%` }}
            aria-label={t(side === 'left' ? '调整开始时间' : '调整结束时间')}
            disabled={!stats}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              const parent = event.currentTarget.parentElement!;
              drag.current = { x: event.clientX, start, count, width: parent.clientWidth, side };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const next = resizeMinuteWindow(
                start,
                count,
                event.key === 'ArrowLeft' ? -1 : 1,
                side,
                lower,
                end,
                maxCount,
              );
              onChange(next.start, next.count);
            }}
          />
        ))}
      </div>
      <div className="usage-history-dates" aria-hidden="true">
        <span>00:00</span>
        <span>23:59</span>
      </div>
    </>
  );
}
