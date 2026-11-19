import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  BookingStatus,
  DLLNode,
  offsetIsoDate,
  Passenger,
  QuotaType,
  quotaLabel,
} from '../engine/railwayEngine';

interface AnalyticsViewProps {
  confirmedNodes: DLLNode[];
  racNodes: DLLNode[];
  heapNodes: Passenger[];
  onPreload: () => void;
}

interface DailyMetric {
  isoDate: string;
  dateObj: Date;
  label: string;
  total: number;
  confirmed: number;
  rac: number;
  waiting: number;
  passengers: Passenger[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  confirmedNodes,
  racNodes,
  heapNodes,
  onPreload,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredDay, setHoveredDay] = useState<DailyMetric | null>(null);

  const allPassengers = useMemo(
    () => [
      ...confirmedNodes.map((n) => n.data),
      ...racNodes.map((n) => n.data),
      ...heapNodes,
    ],
    [confirmedNodes, racNodes, heapNodes]
  );

  const dailySeries = useMemo<DailyMetric[]>(() => {
    const days: DailyMetric[] = [];
    for (let offset = -6; offset <= 0; offset++) {
      const isoDate = offsetIsoDate(offset);
      const dateObj = new Date(`${isoDate}T12:00:00`);
      const label = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      days.push({
        isoDate,
        dateObj,
        label,
        total: 0,
        confirmed: 0,
        rac: 0,
        waiting: 0,
        passengers: [],
      });
    }

    const byDate = new Map(days.map((d) => [d.isoDate, d]));
    for (const p of allPassengers) {
      const bucket = byDate.get(p.bookedDate);
      if (!bucket) continue;
      bucket.total += 1;
      bucket.passengers.push(p);
      if (p.status === BookingStatus.CONFIRMED) bucket.confirmed += 1;
      else if (p.status === BookingStatus.RAC) bucket.rac += 1;
      else bucket.waiting += 1;
    }

    return days;
  }, [allPassengers]);

  const quotaBreakdown = useMemo(() => {
    const quotas = [
      QuotaType.VIP,
      QuotaType.TATKAL,
      QuotaType.SENIOR,
      QuotaType.GENERAL,
    ];
    const total = allPassengers.length;
    return quotas.map((q) => {
      const count = allPassengers.filter((p) => p.quota === q).length;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { quota: q, label: quotaLabel(q), count, pct };
    });
  }, [allPassengers]);

  const peakDay = useMemo(() => {
    return dailySeries.reduce(
      (best, cur) => (cur.total > best.total ? cur : best),
      dailySeries[0]
    );
  }, [dailySeries]);

  const total7DayBookings = dailySeries.reduce((acc, d) => acc + d.total, 0);
  const dailyAvg = (total7DayBookings / 7).toFixed(1);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const width = 880;
    const height = 310;
    const margin = { top: 24, right: 28, bottom: 40, left: 44 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxTotal = d3.max(dailySeries, (d) => d.total) ?? 0;
    const yMax = Math.max(3, maxTotal + 1);

    const xScale = d3
      .scalePoint<string>()
      .domain(dailySeries.map((d) => d.isoDate))
      .range([0, innerWidth])
      .padding(0.25);

    const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    // Horizontal grid lines
    const yTicks = yScale.ticks(Math.min(yMax, 6)).filter((t) => Number.isInteger(t));
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#E2E8F0')
      .attr('stroke-dasharray', '3,3');

    // Area fill under curve
    const areaGen = d3
      .area<DailyMetric>()
      .x((d) => xScale(d.isoDate) ?? 0)
      .y0(innerHeight)
      .y1((d) => yScale(d.total))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(dailySeries)
      .attr('fill', 'rgba(29, 78, 216, 0.08)')
      .attr('d', areaGen);

    // Primary line
    const lineGen = d3
      .line<DailyMetric>()
      .x((d) => xScale(d.isoDate) ?? 0)
      .y((d) => yScale(d.total))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(dailySeries)
      .attr('fill', 'none')
      .attr('stroke', '#1D4ED8')
      .attr('stroke-width', 2.5)
      .attr('d', lineGen);

    // X-Axis
    const xAxis = d3
      .axisBottom(xScale)
      .tickFormat((iso) => {
        const match = dailySeries.find((d) => d.isoDate === iso);
        return match ? match.label : iso;
      });

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call((axis) => axis.select('.domain').attr('stroke', '#CBD5E1'))
      .call((axis) => axis.selectAll('.tick line').attr('stroke', '#CBD5E1'))
      .call((axis) =>
        axis
          .selectAll('.tick text')
          .attr('fill', '#475569')
          .style('font-family', 'JetBrains Mono, monospace')
          .style('font-size', '11px')
      );

    // Y-Axis
    const yAxis = d3
      .axisLeft(yScale)
      .tickValues(yTicks)
      .tickFormat((d) => `${d}`);

    g.append('g')
      .call(yAxis)
      .call((axis) => axis.select('.domain').remove())
      .call((axis) => axis.selectAll('.tick line').remove())
      .call((axis) =>
        axis
          .selectAll('.tick text')
          .attr('fill', '#64748B')
          .style('font-family', 'JetBrains Mono, monospace')
          .style('font-size', '11px')
      );

    // Data point markers + value labels + hover hit areas
    const points = g
      .selectAll('.data-point')
      .data(dailySeries)
      .join('g')
      .attr('class', 'data-point')
      .attr('transform', (d) => `translate(${xScale(d.isoDate) ?? 0},${yScale(d.total)})`);

    points
      .append('circle')
      .attr('r', 5)
      .attr('fill', '#FFFFFF')
      .attr('stroke', '#1D4ED8')
      .attr('stroke-width', 2.25);

    points
      .append('text')
      .attr('y', -11)
      .attr('text-anchor', 'middle')
      .attr('fill', '#0F172A')
      .style('font-family', 'JetBrains Mono, monospace')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .text((d) => (d.total > 0 ? String(d.total) : '0'));

    // Full-column invisible hover targets for crisp interaction
    g.selectAll('.hover-band')
      .data(dailySeries)
      .join('rect')
      .attr('class', 'hover-band')
      .attr('x', (d) => (xScale(d.isoDate) ?? 0) - 42)
      .attr('y', 0)
      .attr('width', 84)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => setHoveredDay(d))
      .on('mouseleave', () => setHoveredDay(null));
  }, [dailySeries]);

  const activeDetail = hoveredDay ?? peakDay;

  return (
    <div className="space-y-6">
      {/* Main D3 Line Chart Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              7-Day Ticket Booking Frequency (D3 Line Chart)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Tracks daily ticket bookings over the rolling 7-day window from live system state. Hover any day to inspect passenger breakdown.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 font-mono tabular-nums">
            <div>
              <span className="text-slate-500">7-Day Total</span>{' '}
              <strong className="text-slate-900">{total7DayBookings}</strong>
            </div>
            <div>
              <span className="text-slate-500">Daily Avg</span>{' '}
              <strong className="text-slate-900">{dailyAvg}</strong>
            </div>
            <div>
              <span className="text-slate-500">Peak Day</span>{' '}
              <strong className="text-blue-700">
                {peakDay.label} ({peakDay.total})
              </strong>
            </div>
          </div>
        </div>

        {allPassengers.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-slate-600">
              No active bookings to plot. Preload sample data or book a ticket in Operations.
            </p>
            <button
              type="button"
              onClick={onPreload}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
            >
              Preload 10 Sample Passengers
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="w-full overflow-x-auto">
              <svg
                ref={svgRef}
                viewBox="0 0 880 310"
                className="w-full min-w-[620px] h-auto"
                role="img"
                aria-label="7-day ticket booking frequency line chart"
              />
            </div>

            {/* Interactive Day Inspector Strip */}
            <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="font-mono text-slate-700">
                <strong className="text-slate-900">
                  {hoveredDay ? 'Selected Day' : 'Peak Day'}: {activeDetail.label} ({activeDetail.isoDate})
                </strong>{' '}
                · {activeDetail.total} {activeDetail.total === 1 ? 'booking' : 'bookings'} (
                <span className="text-emerald-700">{activeDetail.confirmed} Confirmed</span> ·{' '}
                <span className="text-amber-700">{activeDetail.rac} RAC</span> ·{' '}
                <span className="text-blue-700">{activeDetail.waiting} Waiting</span>)
              </div>
              <div className="text-slate-500 truncate max-w-xl">
                {activeDetail.passengers.length > 0
                  ? activeDetail.passengers.map((p) => `${p.name} (${p.pnr})`).join(', ')
                  : 'No bookings recorded on this date'}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Supporting Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Daily Booking Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4 text-right">Confirmed</th>
                  <th className="py-2.5 px-4 text-right">RAC</th>
                  <th className="py-2.5 px-4 text-right">Waiting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-xs">
                {dailySeries.map((day) => (
                  <tr key={day.isoDate} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-slate-900 font-medium">
                      {day.label} <span className="text-slate-400">({day.isoDate})</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                      {day.total}
                    </td>
                    <td className="py-2.5 px-4 text-right text-emerald-700">{day.confirmed}</td>
                    <td className="py-2.5 px-4 text-right text-amber-700">{day.rac}</td>
                    <td className="py-2.5 px-4 text-right text-blue-700">{day.waiting}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Active Quota Distribution</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4">Quota Tier</th>
                  <th className="py-2.5 px-4 text-right">Passengers</th>
                  <th className="py-2.5 px-4 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {quotaBreakdown.map((q) => (
                  <tr key={q.quota} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{q.label}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {q.count}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {q.pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
