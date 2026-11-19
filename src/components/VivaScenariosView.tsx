import React from 'react';
import { Play } from 'lucide-react';
import { SAMPLE_CLI_TRANSCRIPT } from '../data/cSourceFiles';

interface VivaScenariosViewProps {
  onRunScenario: (scenarioId: 'preload' | 'vip_jump' | 'confirmed_cascade' | 'mid_heap_cancel') => void;
}

export const VivaScenariosView: React.FC<VivaScenariosViewProps> = ({ onRunScenario }) => {
  const scenarios = [
    {
      id: 'preload' as const,
      title: '01. Preload 10 Multi-Quota Passengers',
      goal: 'Populate Confirmed (5), RAC (2), and Waiting List (3) immediately for presentation.',
      mechanism: 'Fills Confirmed DLL, then RAC DLL, then inserts General, Senior, and VIP into Indexed Max-Heap so VIP rises to Heap[0].',
    },
    {
      id: 'vip_jump' as const,
      title: '02. Book Emergency VIP + Tatkal into Full Train',
      goal: 'Demonstrate Quota priority ordering and FIFO tie-breaking inside the Waiting List.',
      mechanism: 'Inserts a Tatkal (P2) and a VIP (P1) passenger; VIP sifts above General/Senior while preserving FIFO order among VIPs.',
    },
    {
      id: 'confirmed_cascade' as const,
      title: '03. Cancel Confirmed Berth #2 (Full Promotion Cascade)',
      goal: 'Verify O(1) DLL removal -> O(1) RAC promotion -> O(log N) Max-Heap extraction.',
      mechanism: 'Removes Berth #2 directly via Hash Table DLLNode*, pops RAC Head into Berth #2, and extracts Heap[0] into the freed RAC slot.',
    },
    {
      id: 'mid_heap_cancel' as const,
      title: '04. Cancel Middle Node of Waiting List Heap',
      goal: 'Prove O(log N) arbitrary Waiting List cancellation without scanning the heap.',
      mechanism: 'Looks up heap_index in O(1) from Hash Table, swaps with last heap node, updates indices, and sifts up or down to restore heap order.',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-6 space-y-4">
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Interactive Viva Demonstration Scenarios
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Execute any scenario below against the live engine, then switch to Operations or Data Structures to inspect the resulting pointers, heap tree, and execution trace.
          </p>

          <div className="mt-5 divide-y divide-slate-100">
            {scenarios.map((sc) => (
              <div key={sc.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{sc.title}</h3>
                  <p className="text-xs text-slate-700 mt-1">{sc.goal}</p>
                  <p className="text-xs text-slate-500 mt-1">{sc.mechanism}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRunScenario(sc.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Run Scenario
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="lg:col-span-6">
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Verified C11 CLI Output Transcript
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Compiled with gcc -Wall -Wextra -Werror -std=c11 and verified with invariant assertions
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-700 font-semibold">
              make && ./railway_reservation
            </span>
          </div>

          <pre className="p-5 overflow-x-auto text-xs leading-relaxed font-mono bg-slate-950 text-slate-100">
            <code>{SAMPLE_CLI_TRANSCRIPT}</code>
          </pre>
        </section>
      </div>
    </div>
  );
};
