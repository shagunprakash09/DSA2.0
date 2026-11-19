import React, { useState } from 'react';
import {
  Search,
  TicketPlus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  X,
  Download,
} from 'lucide-react';
import {
  BookingStatus,
  DEFAULT_JOURNEY_DATE,
  DEFAULT_JOURNEY_TIME,
  DLLNode,
  LookupResult,
  MAX_CONFIRMED,
  MAX_RAC,
  OperationResult,
  Passenger,
  QuotaType,
  quotaLabel,
  quotaShort,
} from '../engine/railwayEngine';

interface OperationsViewProps {
  confirmedNodes: DLLNode[];
  racNodes: DLLNode[];
  waitingSorted: Array<{ rank: number; heapIndex: number; passenger: Passenger }>;
  lastOp: OperationResult | null;
  lookupResult: LookupResult | null;
  onBook: (
    name: string,
    age: number,
    quota: QuotaType,
    journeyDate: string,
    journeyTime: string
  ) => void;
  onCancel: (pnr: number) => void;
  onLookup: (pnr: number) => void;
  onDownloadETicket: (pnr: number) => void;
}

export const OperationsView: React.FC<OperationsViewProps> = ({
  confirmedNodes,
  racNodes,
  waitingSorted,
  lastOp,
  lookupResult,
  onBook,
  onCancel,
  onLookup,
  onDownloadETicket,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('32');
  const [quota, setQuota] = useState<QuotaType>(QuotaType.TATKAL);
  const [journeyDate, setJourneyDate] = useState(DEFAULT_JOURNEY_DATE);
  const [journeyTime, setJourneyTime] = useState(DEFAULT_JOURNEY_TIME);
  const [pnrQuery, setPnrQuery] = useState('');
  const [chartPnrFilter, setChartPnrFilter] = useState('');

  const normalizedFilter = chartPnrFilter.trim();
  const isFiltering = normalizedFilter.length > 0;
  const filteredConfirmed = isFiltering
    ? confirmedNodes.filter((n) => String(n.data.pnr).includes(normalizedFilter))
    : confirmedNodes;
  const filteredRac = isFiltering
    ? racNodes.filter((n) => String(n.data.pnr).includes(normalizedFilter))
    : racNodes;
  const filteredWaiting = isFiltering
    ? waitingSorted.filter((w) => String(w.passenger.pnr).includes(normalizedFilter))
    : waitingSorted;
  const totalMatches = filteredConfirmed.length + filteredRac.length + filteredWaiting.length;

  const handleBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAge = parseInt(age, 10);
    if (!name.trim() || Number.isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      return;
    }
    onBook(name.trim(), parsedAge, quota, journeyDate, journeyTime);
    setName('');
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pnrQuery.trim(), 10);
    if (!Number.isNaN(parsed)) {
      onLookup(parsed);
    }
  };

  const handleCancelInput = () => {
    const parsed = parseInt(pnrQuery.trim(), 10);
    if (!Number.isNaN(parsed)) {
      onCancel(parsed);
    }
  };

  const selectPnr = (pnr: number) => {
    setPnrQuery(String(pnr));
    onLookup(pnr);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Control Column */}
      <div className="lg:col-span-4 space-y-6">
        {/* Book Ticket Panel */}
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Book Ticket</h2>
            <span className="text-xs font-mono text-slate-500">
              {confirmedNodes.length < MAX_CONFIRMED
                ? 'Next -> Confirmed'
                : racNodes.length < MAX_RAC
                  ? 'Next -> RAC'
                  : 'Next -> Waiting Heap'}
            </span>
          </div>

          <form onSubmit={handleBookSubmit} className="space-y-4">
            <div>
              <label htmlFor="passenger-name" className="block text-xs font-medium text-slate-700 mb-1.5">
                Passenger Name
              </label>
              <input
                id="passenger-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Siddharth Rao"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label htmlFor="passenger-age" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Age
                </label>
                <input
                  id="passenger-age"
                  type="number"
                  min={1}
                  max={120}
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div className="col-span-2">
                <label htmlFor="passenger-quota" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Priority Quota
                </label>
                <select
                  id="passenger-quota"
                  value={quota}
                  onChange={(e) => setQuota(Number(e.target.value) as QuotaType)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                >
                  <option value={QuotaType.VIP}>1 · VIP / Emergency</option>
                  <option value={QuotaType.TATKAL}>2 · Tatkal</option>
                  <option value={QuotaType.SENIOR}>3 · Senior Citizen</option>
                  <option value={QuotaType.GENERAL}>4 · General</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="journey-date" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Journey Date
                </label>
                <input
                  id="journey-date"
                  type="date"
                  required
                  value={journeyDate}
                  onChange={(e) => setJourneyDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div>
                <label htmlFor="journey-time" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Departure Time
                </label>
                <input
                  id="journey-time"
                  type="time"
                  required
                  value={journeyTime}
                  onChange={(e) => setJourneyTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <TicketPlus className="w-4 h-4" />
              Issue Ticket & Generate PNR
            </button>
          </form>
        </section>

        {/* PNR Lookup & Cancellation Panel */}
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">PNR Lookup & Cancel</h2>
            <span className="text-xs font-mono text-slate-500">O(1) Hash Probe</span>
          </div>

          <form onSubmit={handleLookupSubmit} className="space-y-3">
            <div>
              <label htmlFor="pnr-query" className="block text-xs font-medium text-slate-700 mb-1.5">
                6-Digit PNR Number (or click any row)
              </label>
              <input
                id="pnr-query"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pnrQuery}
                onChange={(e) => setPnrQuery(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 932251"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="submit"
                disabled={!pnrQuery.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                Check Status
              </button>
              <button
                type="button"
                disabled={!pnrQuery.trim()}
                onClick={handleCancelInput}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Cancel PNR
              </button>
            </div>
          </form>

          {lookupResult && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              {lookupResult.found && lookupResult.passenger ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      PNR {lookupResult.pnr}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      Bucket #{lookupResult.bucket} · Chain #{lookupResult.chainDepth}
                    </span>
                  </div>
                  <div className="text-slate-800 font-medium">
                    {lookupResult.passenger.name}{' '}
                    <span className="text-slate-500 font-normal">
                      · Age {lookupResult.passenger.age} · {quotaLabel(lookupResult.passenger.quota)}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    Journey: {lookupResult.passenger.journeyDate} at {lookupResult.passenger.journeyTime}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="text-xs font-mono">
                      {lookupResult.status === BookingStatus.CONFIRMED && (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          CONFIRMED · Berth B-0{lookupResult.passenger.slotNumber} ({lookupResult.dllNodeId})
                        </span>
                      )}
                      {lookupResult.status === BookingStatus.RAC && (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                          <Clock className="w-3.5 h-3.5" />
                          RAC · Slot RAC-0{lookupResult.passenger.slotNumber} ({lookupResult.dllNodeId})
                        </span>
                      )}
                      {lookupResult.status === BookingStatus.WAITING && (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700">
                          <AlertCircle className="w-3.5 h-3.5" />
                          WAITING LIST · Rank #{lookupResult.priorityRank} · Heap[{lookupResult.heapIndex}]
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDownloadETicket(lookupResult.pnr)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      Download e-Ticket
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-red-700">
                  PNR <span className="font-mono font-semibold">{lookupResult.pnr}</span> not found in Hash Bucket #{lookupResult.bucket}.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Last Operation Algorithmic Trace */}
        {lastOp && (
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-900">Execution Trace</h2>
              <span
                className={`text-xs font-medium ${
                  lastOp.success ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {lastOp.success ? 'Completed' : 'Rejected'}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-900">{lastOp.title}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{lastOp.summary}</p>

            {lastOp.steps.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                {lastOp.steps.map((step, i) => (
                  <div key={i} className="text-xs leading-relaxed">
                    <div className="flex items-center justify-between text-slate-500 font-mono mb-0.5">
                      <span>
                        {i + 1}. {step.structure}
                      </span>
                      <span className="text-blue-700 font-semibold">{step.complexity}</span>
                    </div>
                    <p className="text-slate-700">{step.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Right Charts Column */}
      <div className="lg:col-span-8 space-y-6">
        {/* Live PNR Search Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="chart-pnr-filter"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={chartPnrFilter}
              onChange={(e) => setChartPnrFilter(e.target.value.replace(/\D/g, ''))}
              placeholder="Filter charts by PNR (e.g. 932)..."
              aria-label="Filter charts by PNR"
              className="w-full pl-9 pr-8 py-1.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
            {isFiltering && (
              <button
                type="button"
                onClick={() => setChartPnrFilter('')}
                aria-label="Clear PNR filter"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs font-mono tabular-nums text-slate-600 whitespace-nowrap shrink-0">
            {isFiltering ? (
              <span>
                {totalMatches} {totalMatches === 1 ? 'match' : 'matches'} · {filteredConfirmed.length} Confirmed ·{' '}
                {filteredRac.length} RAC · {filteredWaiting.length} Waiting
              </span>
            ) : (
              <span>Instant chart filter across Confirmed, RAC &amp; Waiting</span>
            )}
          </div>
        </div>

        {/* 1. Confirmed Berths Chart */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Confirmed Berths Chart
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Doubly Linked List · O(1) insertion and O(1) node removal via Hash Table pointer
              </p>
            </div>
            <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap shrink-0">
              {isFiltering ? `${filteredConfirmed.length} shown · ` : ''}
              {confirmedNodes.length} / {MAX_CONFIRMED} Occupied
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4">Berth</th>
                  <th className="py-2.5 px-4">PNR</th>
                  <th className="py-2.5 px-4">Passenger</th>
                  <th className="py-2.5 px-4 text-right">Age</th>
                  <th className="py-2.5 px-4">Quota</th>
                  <th className="py-2.5 px-4">Journey</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredConfirmed.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                      {isFiltering
                        ? `No confirmed passengers matching PNR "${normalizedFilter}".`
                        : 'No confirmed passengers. Book a ticket or preload sample data.'}
                    </td>
                  </tr>
                ) : (
                  filteredConfirmed.map((node) => {
                    const p = node.data;
                    const highlighted = lastOp?.highlightedPnrs.includes(p.pnr);
                    return (
                      <tr
                        key={p.pnr}
                        className={`hover:bg-slate-50 transition-colors ${
                          highlighted ? 'bg-emerald-50/60' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono font-semibold text-emerald-700 tabular-nums">
                          B-0{p.slotNumber}
                        </td>
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => selectPnr(p.pnr)}
                            className="font-mono font-semibold text-blue-700 hover:underline tabular-nums cursor-pointer"
                          >
                            {p.pnr}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                          {p.age}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 text-xs font-mono">
                          {quotaShort(p.quota)}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 text-xs whitespace-nowrap">
                          {p.journeyDate} · {p.journeyTime}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => onDownloadETicket(p.pnr)}
                              className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              e-Ticket
                            </button>
                            <button
                              type="button"
                              onClick={() => onCancel(p.pnr)}
                              className="text-xs font-medium text-red-700 hover:text-red-900 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. RAC List Chart */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                RAC (Reservation Against Cancellation) List
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Doubly Linked List · Head promotes to Confirmed in O(1) when any Confirmed berth cancels
              </p>
            </div>
            <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap shrink-0">
              {isFiltering ? `${filteredRac.length} shown · ` : ''}
              {racNodes.length} / {MAX_RAC} Occupied
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4">RAC Slot</th>
                  <th className="py-2.5 px-4">PNR</th>
                  <th className="py-2.5 px-4">Passenger</th>
                  <th className="py-2.5 px-4 text-right">Age</th>
                  <th className="py-2.5 px-4">Quota</th>
                  <th className="py-2.5 px-4">Journey</th>
                  <th className="py-2.5 px-4 text-right">Queue Pos</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRac.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-sm text-slate-500">
                      {isFiltering
                        ? `No RAC passengers matching PNR "${normalizedFilter}".`
                        : 'RAC queue is currently empty.'}
                    </td>
                  </tr>
                ) : (
                  filteredRac.map((node) => {
                    const p = node.data;
                    const trueRacIdx = racNodes.findIndex((r) => r.id === node.id);
                    const highlighted = lastOp?.highlightedPnrs.includes(p.pnr);
                    return (
                      <tr
                        key={p.pnr}
                        className={`hover:bg-slate-50 transition-colors ${
                          highlighted ? 'bg-amber-50/70' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono font-semibold text-amber-700 tabular-nums">
                          RAC-0{p.slotNumber}
                        </td>
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => selectPnr(p.pnr)}
                            className="font-mono font-semibold text-blue-700 hover:underline tabular-nums cursor-pointer"
                          >
                            {p.pnr}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                          {p.age}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 text-xs font-mono">
                          {quotaShort(p.quota)}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 text-xs whitespace-nowrap">
                          {p.journeyDate} · {p.journeyTime}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-500">
                          {trueRacIdx === 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                              Head <ArrowRight className="w-3 h-3" /> Next Confirmed
                            </span>
                          ) : (
                            `Node #${trueRacIdx + 1}`
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => onDownloadETicket(p.pnr)}
                              className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              e-Ticket
                            </button>
                            <button
                              type="button"
                              onClick={() => onCancel(p.pnr)}
                              className="text-xs font-medium text-red-700 hover:text-red-900 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Priority Waiting List Chart */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Priority Waiting Queue
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Indexed Max-Heap ordered by Quota Priority (1=VIP to 4=General), then FIFO timestamp
              </p>
            </div>
            <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap shrink-0">
              {isFiltering ? `${filteredWaiting.length} shown · ` : ''}
              {waitingSorted.length} Waiting
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4">WL Rank</th>
                  <th className="py-2.5 px-4">PNR</th>
                  <th className="py-2.5 px-4">Passenger</th>
                  <th className="py-2.5 px-4 text-right">Age</th>
                  <th className="py-2.5 px-4">Quota Priority</th>
                  <th className="py-2.5 px-4">Journey</th>
                  <th className="py-2.5 px-4 text-right">Heap Idx</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredWaiting.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-sm text-slate-500">
                      {isFiltering
                        ? `No waiting passengers matching PNR "${normalizedFilter}".`
                        : 'Priority waiting queue is empty.'}
                    </td>
                  </tr>
                ) : (
                  filteredWaiting.map(({ rank, heapIndex, passenger: p }) => {
                    const highlighted = lastOp?.highlightedPnrs.includes(p.pnr);
                    return (
                      <tr
                        key={p.pnr}
                        className={`hover:bg-slate-50 transition-colors ${
                          highlighted ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono font-semibold text-blue-700 tabular-nums">
                          WL-{rank}
                        </td>
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => selectPnr(p.pnr)}
                            className="font-mono font-semibold text-blue-700 hover:underline tabular-nums cursor-pointer"
                          >
                            {p.pnr}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                          {p.age}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-mono text-slate-700">
                          {quotaShort(p.quota)}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 text-xs whitespace-nowrap">
                          {p.journeyDate} · {p.journeyTime}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                          [{heapIndex}]
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => onDownloadETicket(p.pnr)}
                              className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              e-Ticket
                            </button>
                            <button
                              type="button"
                              onClick={() => onCancel(p.pnr)}
                              className="text-xs font-medium text-red-700 hover:text-red-900 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
