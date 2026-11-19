import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { C_SOURCE_FILES } from '../data/cSourceFiles';

export const CSourceView: React.FC = () => {
  const [selectedPath, setSelectedPath] = useState(C_SOURCE_FILES[0].path);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const activeFile = C_SOURCE_FILES.find((f) => f.path === selectedPath) ?? C_SOURCE_FILES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedPath(activeFile.path);
      setTimeout(() => setCopiedPath(null), 1800);
    } catch {
      // Clipboard API unavailable in restricted frame
    }
  };

  const handleDownloadFile = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.label;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Architecture & Complexity Matrix */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900">
          How the Three Data Structures Interact
        </h2>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed max-w-4xl">
          The Hash Table serves as the central O(1) directory mapping every 6-digit PNR to either a direct Doubly Linked List node pointer (Confirmed / RAC) or an array index inside the Indexed Max-Heap (Waiting List). Every heap swap immediately updates both swapped PNRs inside the Hash Table so middle-of-queue cancellations stay O(log N).
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-2.5 px-4">Operation</th>
                <th className="py-2.5 px-4">Data Structures Involved</th>
                <th className="py-2.5 px-4">Time Complexity</th>
                <th className="py-2.5 px-4">Mechanism</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-900">Book Ticket (Confirmed / RAC)</td>
                <td className="py-2.5 px-4">DLL + Hash Table</td>
                <td className="py-2.5 px-4 font-mono text-blue-700 font-semibold">O(1) avg</td>
                <td className="py-2.5 px-4 text-xs">
                  Tail insertion via <code className="font-mono">dll_push_back</code> returns <code className="font-mono">DLLNode*</code> stored in Hash Table.
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-900">Book Ticket (Waiting List)</td>
                <td className="py-2.5 px-4">Indexed Max-Heap + Hash Table</td>
                <td className="py-2.5 px-4 font-mono text-blue-700 font-semibold">O(log N)</td>
                <td className="py-2.5 px-4 text-xs">
                  Inserts at heap tail and sifts up by (Quota, Timestamp); every swap updates <code className="font-mono">heap_index</code> in Hash Table.
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-900">Check PNR Status</td>
                <td className="py-2.5 px-4">Hash Table</td>
                <td className="py-2.5 px-4 font-mono text-blue-700 font-semibold">O(1) avg</td>
                <td className="py-2.5 px-4 text-xs">
                  Probes <code className="font-mono">buckets[pnr % 101]</code> to read exact berth, RAC slot, or heap index directly.
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-900">Cancel Confirmed / RAC</td>
                <td className="py-2.5 px-4">Hash Table + DLL + Max-Heap</td>
                <td className="py-2.5 px-4 font-mono text-blue-700 font-semibold">O(log N)</td>
                <td className="py-2.5 px-4 text-xs">
                  O(1) DLL unlink via pointer, O(1) RAC head promotion, O(log N) Max-Heap extraction into RAC.
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-900">Cancel Middle of Waiting List</td>
                <td className="py-2.5 px-4">Hash Table + Indexed Max-Heap</td>
                <td className="py-2.5 px-4 font-mono text-blue-700 font-semibold">O(log N)</td>
                <td className="py-2.5 px-4 text-xs">
                  Retrieves exact <code className="font-mono">heap_index</code> in O(1), replaces with tail node, and sifts up or down cleanly.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Modular C Source Explorer */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div className="flex flex-wrap items-center gap-1.5">
            {C_SOURCE_FILES.map((file) => {
              const active = file.path === activeFile.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  {file.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedPath === activeFile.path ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy File
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadFile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download {activeFile.label}
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between text-xs text-slate-600">
          <span className="font-mono font-medium text-slate-800">{activeFile.path}</span>
          <span>{activeFile.role}</span>
        </div>

        <pre className="p-5 overflow-x-auto text-xs leading-relaxed font-mono bg-slate-950 text-slate-100 max-h-[560px]">
          <code>{activeFile.content}</code>
        </pre>
      </section>
    </div>
  );
};
