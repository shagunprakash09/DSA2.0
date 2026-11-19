import React from 'react';
import { HEAP_CAPACITY, MAX_CONFIRMED, MAX_RAC } from '../engine/railwayEngine';

interface CapacityProgressBarProps {
  confirmedCount: number;
  racCount: number;
  waitingCount: number;
}

export const CapacityProgressBar: React.FC<CapacityProgressBarProps> = ({
  confirmedCount,
  racCount,
  waitingCount,
}) => {
  const confirmedPct = Math.round((confirmedCount / MAX_CONFIRMED) * 100);
  const racPct = Math.round((racCount / MAX_RAC) * 100);
  const waitingPct = Number(((waitingCount / HEAP_CAPACITY) * 100).toFixed(1));

  const items = [
    {
      label: 'Confirmed Berths',
      countLabel: `${confirmedCount} / ${MAX_CONFIRMED}`,
      pct: confirmedPct,
      pctText: `${confirmedPct}%`,
      barClass: 'bg-emerald-600',
      statusText: confirmedCount >= MAX_CONFIRMED ? 'Full' : `${MAX_CONFIRMED - confirmedCount} open`,
      statusClass: confirmedCount >= MAX_CONFIRMED ? 'text-emerald-700' : 'text-slate-600',
    },
    {
      label: 'RAC Slots',
      countLabel: `${racCount} / ${MAX_RAC}`,
      pct: racPct,
      pctText: `${racPct}%`,
      barClass: 'bg-amber-600',
      statusText: racCount >= MAX_RAC ? 'Full' : `${MAX_RAC - racCount} open`,
      statusClass: racCount >= MAX_RAC ? 'text-amber-700' : 'text-slate-600',
    },
    {
      label: 'Waiting List Heap',
      countLabel: `${waitingCount} / ${HEAP_CAPACITY}`,
      pct: waitingPct,
      pctText: `${waitingPct}%`,
      barClass: 'bg-blue-700',
      statusText: waitingCount === 0 ? 'Empty' : `${waitingCount} queued`,
      statusClass: waitingCount > 0 ? 'text-blue-700' : 'text-slate-600',
    },
  ];

  return (
    <section
      aria-label="Queue fill progress"
      className="bg-white border border-slate-200 rounded-xl px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-6"
    >
      {items.map((item) => {
        const clampedWidth = item.pct > 0 ? Math.max(item.pct, 2) : 0;
        return (
          <div key={item.label} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-semibold text-slate-900 truncate">{item.label}</span>
                <span className={`font-medium whitespace-nowrap ${item.statusClass}`}>
                  · {item.statusText}
                </span>
              </div>
              <div className="font-mono tabular-nums text-slate-700 whitespace-nowrap shrink-0">
                {item.countLabel} <span className="font-semibold text-slate-900">({item.pctText})</span>
              </div>
            </div>

            <div
              role="progressbar"
              aria-label={`${item.label} fill`}
              aria-valuenow={item.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"
            >
              <div
                className={`h-full rounded-full transition-all duration-200 ${item.barClass}`}
                style={{ width: `${Math.min(clampedWidth, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
};
