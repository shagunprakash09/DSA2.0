import { useMemo, useRef, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import {
  HASH_TABLE_SIZE,
  LookupResult,
  MAX_CONFIRMED,
  MAX_RAC,
  OperationResult,
  QuotaType,
  RailwayEngine,
} from './engine/railwayEngine';
import { OperationsView } from './components/OperationsView';
import { DataStructuresView } from './components/DataStructuresView';
import { CSourceView } from './components/CSourceView';
import { CapacityProgressBar } from './components/CapacityProgressBar';
import { AnalyticsView } from './components/AnalyticsView';
import { PresentationDeckView } from './components/PresentationDeckView';

type TabKey = 'operations' | 'structures' | 'analytics' | 'c_source' | 'viva';

export default function App() {
  const engineRef = useRef<RailwayEngine | null>(null);
  const initialOpRef = useRef<OperationResult | null>(null);

  if (engineRef.current === null) {
    const engine = new RailwayEngine();
    initialOpRef.current = engine.preloadSampleData();
    engineRef.current = engine;
  }

  const [activeTab, setActiveTab] = useState<TabKey>('operations');
  const [version, setVersion] = useState(0);
  const [lastOp, setLastOp] = useState<OperationResult | null>(initialOpRef.current);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);

  const engine = engineRef.current;

  const snapshot = useMemo(() => {
    void version;
    return {
      confirmedNodes: engine.confirmedList.toArray(),
      racNodes: engine.racList.toArray(),
      heapNodes: [...engine.waitingHeap.nodes],
      waitingSorted: engine.waitingHeap.getSortedView(),
      occupiedBuckets: engine.pnrTable.getOccupiedBuckets(),
      totalEntries: engine.pnrTable.count,
    };
  }, [engine, version]);

  const bump = () => setVersion((v) => v + 1);

  const handlePreload = () => {
    const res = engine.preloadSampleData();
    setLastOp(res);
    setLookupResult(null);
    bump();
  };

  const handleResetEmpty = () => {
    engine.reset();
    setLastOp({
      success: true,
      title: 'System Cleared',
      summary: 'Released all Doubly Linked List nodes, Max-Heap slots, and Hash Table entries.',
      steps: [],
      highlightedPnrs: [],
    });
    setLookupResult(null);
    bump();
  };

  const handleBook = (
    name: string,
    age: number,
    quota: QuotaType,
    journeyDate: string,
    journeyTime: string
  ) => {
    const res = engine.bookTicket(name, age, quota, journeyDate, journeyTime);
    setLastOp(res);
    if (res.pnr) {
      setLookupResult(engine.checkPnrStatus(res.pnr));
    }
    bump();
  };

  const handleDownloadETicket = (pnr: number) => {
    const ticket = engine.generateETicketHtml(pnr);
    if (!ticket) return;
    const blob = new Blob([ticket.html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = ticket.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCancel = (pnr: number) => {
    const res = engine.cancelTicket(pnr);
    setLastOp(res);
    setLookupResult(engine.checkPnrStatus(pnr));
    bump();
  };

  const handleLookup = (pnr: number) => {
    const res = engine.checkPnrStatus(pnr);
    setLookupResult(res);
  };

  const handleDownloadManifest = () => {
    const { csv, rowCount } = engine.exportPassengerManifestCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `railway_passenger_manifest_${stamp}.csv`;
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setLastOp({
      success: true,
      title: `Downloaded Passenger Manifest (${rowCount} records)`,
      summary: `Exported Confirmed (${snapshot.confirmedNodes.length}), RAC (${snapshot.racNodes.length}), and Waiting List (${snapshot.heapNodes.length}) passengers to ${filename}.`,
      steps: [
        {
          structure: 'Doubly Linked List',
          complexity: 'O(C + R)',
          detail: `Serialized ${snapshot.confirmedNodes.length} Confirmed and ${snapshot.racNodes.length} RAC records with berth/slot numbers.`,
        },
        {
          structure: 'Indexed Max-Heap',
          complexity: 'O(W log W)',
          detail: `Sorted ${snapshot.heapNodes.length} Waiting List entries by priority rank alongside their live heap_index and hash bucket.`,
        },
      ],
      highlightedPnrs: [],
    });
  };

  const handleRunScenario = (
    scenarioId: 'preload' | 'vip_jump' | 'confirmed_cascade' | 'mid_heap_cancel'
  ) => {
    if (scenarioId === 'preload') {
      const res = engine.preloadSampleData();
      setLastOp(res);
      setLookupResult(null);
      bump();
      setActiveTab('operations');
      return;
    }

    if (scenarioId === 'vip_jump') {
      if (engine.confirmedList.size < MAX_CONFIRMED || engine.racList.size < MAX_RAC) {
        engine.preloadSampleData();
      }
      engine.bookTicket('Neha Kapoor', 30, QuotaType.TATKAL);
      const vipRes = engine.bookTicket('Dr. Arjun Sen', 48, QuotaType.VIP);
      setLastOp(vipRes);
      if (vipRes.pnr) setLookupResult(engine.checkPnrStatus(vipRes.pnr));
      bump();
      setActiveTab('structures');
      return;
    }

    if (scenarioId === 'confirmed_cascade') {
      if (engine.confirmedList.size === 0) {
        engine.preloadSampleData();
      }
      const targetNode = engine.confirmedList.head?.next ?? engine.confirmedList.head;
      if (targetNode) {
        const res = engine.cancelTicket(targetNode.data.pnr);
        setLastOp(res);
        setLookupResult(null);
        bump();
      }
      setActiveTab('operations');
      return;
    }

    if (scenarioId === 'mid_heap_cancel') {
      if (engine.waitingHeap.size < 3) {
        engine.preloadSampleData();
      }
      const midIndex = Math.min(2, engine.waitingHeap.size - 1);
      const target = engine.waitingHeap.nodes[midIndex];
      if (target) {
        const res = engine.cancelTicket(target.pnr);
        setLastOp(res);
        setLookupResult(null);
        bump();
      }
      setActiveTab('structures');
    }
  };

  const navItems: Array<{ key: TabKey; label: string }> = [
    { key: 'operations', label: 'Operations' },
    { key: 'structures', label: 'Data Structures' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'c_source', label: 'C Source' },
    { key: 'viva', label: 'Presentation' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Three-Zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1360px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line brand wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('operations');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            RailQueue DSA
          </a>

          {/* Zone 2: Concise single-line nav links */}
          <nav aria-label="Primary" className="hidden md:flex items-center gap-7">
            {navItems.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`text-sm font-medium py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'text-blue-700 border-blue-700 font-semibold'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handlePreload}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Preload 10 Passengers
            </button>
          </div>
        </div>

        {/* Mobile Nav Fallback */}
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-4 overflow-x-auto">
          {navItems.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`text-xs font-medium py-1 whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? 'text-blue-700 font-semibold' : 'text-slate-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main id="top" className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Page Title & Live Structure Capacity Strip */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-balance">
              Railway Reservation Waiting Queue System
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Modular C11 architecture combining Doubly Linked Lists, an Indexed Max-Heap, and a Separate Chaining Hash Table.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
            <div>
              <span className="text-slate-500">Confirmed DLL</span>{' '}
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {snapshot.confirmedNodes.length}/{MAX_CONFIRMED}
              </span>
            </div>
            <div>
              <span className="text-slate-500">RAC DLL</span>{' '}
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {snapshot.racNodes.length}/{MAX_RAC}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Waiting Heap</span>{' '}
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {snapshot.heapNodes.length}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Hash Table</span>{' '}
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {snapshot.totalEntries} / {HASH_TABLE_SIZE} buckets
              </span>
            </div>
            <button
              type="button"
              onClick={handleDownloadManifest}
              disabled={snapshot.totalEntries === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Passenger Manifest
            </button>
            <button
              type="button"
              onClick={handleResetEmpty}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear All
            </button>
          </div>
        </div>

        {/* Category Fill Progress Bars */}
        <CapacityProgressBar
          confirmedCount={snapshot.confirmedNodes.length}
          racCount={snapshot.racNodes.length}
          waitingCount={snapshot.heapNodes.length}
        />

        {/* Active Tab Viewport */}
        {activeTab === 'operations' && (
          <OperationsView
            confirmedNodes={snapshot.confirmedNodes}
            racNodes={snapshot.racNodes}
            waitingSorted={snapshot.waitingSorted}
            lastOp={lastOp}
            lookupResult={lookupResult}
            onBook={handleBook}
            onCancel={handleCancel}
            onLookup={handleLookup}
            onDownloadETicket={handleDownloadETicket}
          />
        )}

        {activeTab === 'structures' && (
          <DataStructuresView
            confirmedNodes={snapshot.confirmedNodes}
            racNodes={snapshot.racNodes}
            heapNodes={snapshot.heapNodes}
            occupiedBuckets={snapshot.occupiedBuckets}
            onCancel={handleCancel}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            confirmedNodes={snapshot.confirmedNodes}
            racNodes={snapshot.racNodes}
            heapNodes={snapshot.heapNodes}
            onPreload={handlePreload}
          />
        )}

        {activeTab === 'c_source' && <CSourceView />}

        {activeTab === 'viva' && (
          <PresentationDeckView
            liveStats={{
              confirmed: snapshot.confirmedNodes.length,
              rac: snapshot.racNodes.length,
              waiting: snapshot.heapNodes.length,
              total: snapshot.totalEntries,
            }}
            onRunScenario={handleRunScenario}
          />
        )}
      </main>
    </div>
  );
}
