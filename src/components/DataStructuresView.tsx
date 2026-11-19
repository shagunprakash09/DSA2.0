import React from 'react';
import { ArrowLeftRight, Trash2 } from 'lucide-react';
import {
  BookingStatus,
  DLLNode,
  HASH_TABLE_SIZE,
  HashEntry,
  Passenger,
  quotaShort,
} from '../engine/railwayEngine';

interface DataStructuresViewProps {
  confirmedNodes: DLLNode[];
  racNodes: DLLNode[];
  heapNodes: Passenger[];
  occupiedBuckets: Array<{ bucket: number; entries: HashEntry[] }>;
  onCancel: (pnr: number) => void;
}

export const DataStructuresView: React.FC<DataStructuresViewProps> = ({
  confirmedNodes,
  racNodes,
  heapNodes,
  occupiedBuckets,
  onCancel,
}) => {
  // Compute SVG layout positions for binary heap up to 15 visible tree nodes
  const visibleHeap = heapNodes.slice(0, 15);
  const svgWidth = 860;
  const svgHeight = visibleHeap.length > 7 ? 310 : visibleHeap.length > 3 ? 230 : 150;

  const getCoords = (index: number) => {
    const level = Math.floor(Math.log2(index + 1));
    const levelStart = Math.pow(2, level) - 1;
    const posInLevel = index - levelStart;
    const nodesInLevel = Math.pow(2, level);
    const x = ((posInLevel + 0.5) / nodesInLevel) * svgWidth;
    const y = 44 + level * 78;
    return { x, y };
  };

  return (
    <div className="space-y-6">
      {/* 1. Doubly Linked Lists */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              1. Doubly Linked Lists (Confirmed & RAC)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Each node stores prev/next pointers. The Hash Table retains a direct DLLNode* reference for O(1) arbitrary removal.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Insert Tail: O(1) · Pop Head: O(1) · Delete Pointer: O(1)
          </span>
        </div>

        <div className="mt-5 space-y-5">
          {/* Confirmed DLL Chain */}
          <div>
            <div className="text-xs font-medium text-slate-700 mb-2">
              Confirmed List ({confirmedNodes.length} / 5)
            </div>
            {confirmedNodes.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-3">HEAD -&gt; NULL &lt;- TAIL</p>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-xs font-mono text-slate-500 shrink-0">HEAD</span>
                <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {confirmedNodes.map((node, i) => (
                  <React.Fragment key={node.id}>
                    <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg px-3 py-2 min-w-[168px] shrink-0">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-semibold text-emerald-800">
                          B-0{node.data.slotNumber}
                        </span>
                        <span className="text-slate-500">{node.id}</span>
                      </div>
                      <div className="text-sm font-semibold text-slate-900 mt-1 truncate">
                        {node.data.name}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs font-mono text-slate-600">
                        <span>PNR {node.data.pnr}</span>
                        <button
                          type="button"
                          onClick={() => onCancel(node.data.pnr)}
                          title="Cancel via O(1) DLL pointer"
                          className="text-red-700 hover:text-red-900 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {i < confirmedNodes.length - 1 && (
                      <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
                <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs font-mono text-slate-500 shrink-0">TAIL</span>
              </div>
            )}
          </div>

          {/* RAC DLL Chain */}
          <div className="pt-4 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-700 mb-2">
              RAC List ({racNodes.length} / 2)
            </div>
            {racNodes.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-2">HEAD -&gt; NULL &lt;- TAIL</p>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-xs font-mono text-slate-500 shrink-0">HEAD (Promotes 1st)</span>
                <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {racNodes.map((node, i) => (
                  <React.Fragment key={node.id}>
                    <div className="border border-amber-200 bg-amber-50/40 rounded-lg px-3 py-2 min-w-[168px] shrink-0">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-semibold text-amber-800">
                          RAC-0{node.data.slotNumber}
                        </span>
                        <span className="text-slate-500">{node.id}</span>
                      </div>
                      <div className="text-sm font-semibold text-slate-900 mt-1 truncate">
                        {node.data.name}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs font-mono text-slate-600">
                        <span>PNR {node.data.pnr}</span>
                        <button
                          type="button"
                          onClick={() => onCancel(node.data.pnr)}
                          title="Cancel via O(1) DLL pointer"
                          className="text-red-700 hover:text-red-900 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {i < racNodes.length - 1 && (
                      <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
                <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs font-mono text-slate-500 shrink-0">TAIL</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Indexed Max-Heap */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              2. Indexed Max-Heap (Waiting List Priority Queue)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Heap invariant: parent outranks children by (Quota 1..4 ascending, then Timestamp ascending). Swaps synchronize Hash Table heap_index in O(1).
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Size: {heapNodes.length} · Extract Max / Delete Index: O(log N)
          </span>
        </div>

        {heapNodes.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Waiting list Max-Heap is empty. Book more than 7 passengers to populate the heap.
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {/* Binary Tree Diagram */}
            <div className="overflow-x-auto border border-slate-100 rounded-lg bg-slate-50/50 p-3">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full min-w-[680px] h-auto"
                role="img"
                aria-label="Indexed Max-Heap binary tree representation"
              >
                {visibleHeap.map((_, idx) => {
                  if (idx === 0) return null;
                  const parentIdx = Math.floor((idx - 1) / 2);
                  const from = getCoords(parentIdx);
                  const to = getCoords(idx);
                  return (
                    <line
                      key={`edge-${idx}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="#CBD5E1"
                      strokeWidth={1.5}
                    />
                  );
                })}
                {visibleHeap.map((p, idx) => {
                  const { x, y } = getCoords(idx);
                  const isRoot = idx === 0;
                  return (
                    <g key={p.pnr} transform={`translate(${x}, ${y})`}>
                      <rect
                        x={-72}
                        y={-26}
                        width={144}
                        height={52}
                        rx={8}
                        fill={isRoot ? '#EFF6FF' : '#FFFFFF'}
                        stroke={isRoot ? '#1D4ED8' : '#CBD5E1'}
                        strokeWidth={isRoot ? 1.75 : 1}
                      />
                      <text
                        x={0}
                        y={-8}
                        textAnchor="middle"
                        className="fill-slate-900 font-mono text-[11px] font-semibold"
                      >
                        [{idx}] PNR {p.pnr}
                      </text>
                      <text
                        x={0}
                        y={8}
                        textAnchor="middle"
                        className="fill-blue-700 font-mono text-[10px] font-medium"
                      >
                        {quotaShort(p.quota)} · T-{p.timestamp}
                      </text>
                      <text
                        x={0}
                        y={21}
                        textAnchor="middle"
                        className="fill-slate-500 text-[10px]"
                      >
                        {p.name.slice(0, 18)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Underlying Contiguous Array Representation */}
            <div>
              <div className="text-xs font-medium text-slate-700 mb-2">
                Contiguous Heap Array (nodes[0..{heapNodes.length - 1}])
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {heapNodes.map((p, idx) => (
                  <div
                    key={p.pnr}
                    className={`border rounded-lg p-2.5 text-xs ${
                      idx === 0 ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-slate-500">
                      <span>heap[{idx}]</span>
                      <span className="text-blue-700 font-semibold">Q{p.quota}·T{p.timestamp}</span>
                    </div>
                    <div className="font-medium text-slate-900 truncate mt-1">{p.name}</div>
                    <div className="font-mono text-slate-600 mt-0.5">PNR {p.pnr}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Hash Table (Separate Chaining) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              3. Hash Table with Separate Chaining (M = {HASH_TABLE_SIZE})
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Hash function h(pnr) = pnr % {HASH_TABLE_SIZE}. Occupied buckets shown below with direct DLLNode* pointers and synchronized Heap indices.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Active Entries: {occupiedBuckets.reduce((acc, b) => acc + b.entries.length, 0)} · Avg Lookup: O(1)
          </span>
        </div>

        {occupiedBuckets.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Hash table has 0 active entries.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-2 px-4">Bucket Index</th>
                  <th className="py-2 px-4">Chained Entries (PNR -&gt; Target Reference)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-mono">
                {occupiedBuckets.map(({ bucket, entries }) => (
                  <tr key={bucket} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 tabular-nums w-32">
                      buckets[{bucket}]
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {entries.map((entry, idx) => (
                          <React.Fragment key={entry.pnr}>
                            <span className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50 px-2.5 py-1 rounded-md text-slate-800">
                              <strong className="text-blue-700">{entry.pnr}</strong>
                              <span className="text-slate-400">·</span>
                              <span>{entry.status}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-600">
                                {entry.status === BookingStatus.WAITING
                                  ? `heap_index=${entry.heapIndex}`
                                  : `dll_node=${entry.dllNode?.id}`}
                              </span>
                            </span>
                            {idx < entries.length - 1 && (
                              <span className="text-slate-400">-&gt;</span>
                            )}
                          </React.Fragment>
                        ))}
                        <span className="text-slate-400">-&gt; NULL</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
