import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Play } from 'lucide-react';
import {
  downloadPresentationPptx,
  PRESENTATION_SLIDES,
} from '../data/presentationDeck';
import { SAMPLE_CLI_TRANSCRIPT } from '../data/cSourceFiles';

interface PresentationDeckViewProps {
  liveStats: { confirmed: number; rac: number; waiting: number; total: number };
  onRunScenario: (scenarioId: 'preload' | 'vip_jump' | 'confirmed_cascade' | 'mid_heap_cancel') => void;
}

export const PresentationDeckView: React.FC<PresentationDeckViewProps> = ({
  liveStats,
  onRunScenario,
}) => {
  const [subMode, setSubMode] = useState<'slides' | 'viva'>('slides');
  const [slideIndex, setSlideIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const activeSlide = PRESENTATION_SLIDES[slideIndex];
  const isCover = activeSlide.id === 1;

  const handleDownloadPptx = async () => {
    setIsExporting(true);
    try {
      await downloadPresentationPptx(liveStats);
    } finally {
      setIsExporting(false);
    }
  };

  const scenarios = [
    {
      id: 'preload' as const,
      title: '01. Preload 10 Multi-Quota Passengers',
      goal: 'Populate Confirmed (5), RAC (2), and Waiting List (3) immediately for presentation.',
      mechanism:
        'Fills Confirmed DLL, then RAC DLL, then inserts General, Senior, and VIP into Indexed Max-Heap so VIP rises to Heap[0].',
    },
    {
      id: 'vip_jump' as const,
      title: '02. Book Emergency VIP + Tatkal into Full Train',
      goal: 'Demonstrate Quota priority ordering and FIFO tie-breaking inside the Waiting List.',
      mechanism:
        'Inserts a Tatkal (P2) and a VIP (P1) passenger; VIP sifts above General/Senior while preserving FIFO order among VIPs.',
    },
    {
      id: 'confirmed_cascade' as const,
      title: '03. Cancel Confirmed Berth #2 (Full Promotion Cascade)',
      goal: 'Verify O(1) DLL removal -> O(1) RAC promotion -> O(log N) Max-Heap extraction.',
      mechanism:
        'Removes Berth #2 directly via Hash Table DLLNode*, pops RAC Head into Berth #2, and extracts Heap[0] into the freed RAC slot.',
    },
    {
      id: 'mid_heap_cancel' as const,
      title: '04. Cancel Middle Node of Waiting List Heap',
      goal: 'Prove O(log N) arbitrary Waiting List cancellation without scanning the heap.',
      mechanism:
        'Looks up heap_index in O(1) from Hash Table, swaps with last heap node, updates indices, and sifts up or down to restore heap order.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-mode Switcher & PPTX Export Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setSubMode('slides')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subMode === 'slides'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Slide Deck ({PRESENTATION_SLIDES.length} Slides)
          </button>
          <button
            type="button"
            onClick={() => setSubMode('viva')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subMode === 'viva'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Viva Scenarios &amp; CLI Output
          </button>
        </div>

        <button
          type="button"
          onClick={handleDownloadPptx}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          {isExporting ? 'Generating .pptx...' : 'Download Presentation (.pptx)'}
        </button>
      </div>

      {subMode === 'slides' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Slide Navigator Sidebar */}
          <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-3 space-y-1">
            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
              Slide Outline
            </div>
            {PRESENTATION_SLIDES.map((s, idx) => {
              const active = idx === slideIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSlideIndex(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-50 text-blue-800 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-mono text-[11px] text-slate-400">
                    Slide {String(s.id).padStart(2, '0')}
                  </div>
                  <div className="truncate mt-0.5">{s.title}</div>
                </button>
              );
            })}
          </aside>

          {/* Main 16:9 Slide Stage + Speaker Notes */}
          <div className="lg:col-span-9 space-y-4">
            <div
              className={`border rounded-xl overflow-hidden min-h-[420px] flex flex-col justify-between p-8 sm:p-10 ${
                isCover
                  ? 'bg-slate-900 border-slate-800 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div>
                <div
                  className={`text-xs font-semibold tracking-wide ${
                    isCover ? 'text-blue-300' : 'text-blue-700'
                  }`}
                >
                  {activeSlide.kicker}
                </div>
                <h2
                  className={`text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-balance ${
                    isCover ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {activeSlide.title}
                </h2>
                <p
                  className={`text-sm mt-2 max-w-3xl leading-relaxed ${
                    isCover ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {activeSlide.subtitle}
                </p>

                {activeSlide.bullets && (
                  <ul className="mt-6 space-y-3 text-sm leading-relaxed">
                    {activeSlide.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span
                          className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${
                            isCover ? 'bg-blue-400' : 'bg-blue-700'
                          }`}
                        />
                        <span className={isCover ? 'text-slate-200' : 'text-slate-800'}>
                          {b}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {activeSlide.table && (
                  <div className="mt-6 overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          {activeSlide.table.headers.map((h) => (
                            <th key={h} className="py-2.5 px-3.5 font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {activeSlide.table.rows.map((row, rIdx) => (
                          <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className={`py-2.5 px-3.5 ${
                                  cIdx === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'
                                }`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeSlide.highlightBox && (
                  <div className="mt-6 border border-blue-200 bg-blue-50/70 rounded-lg px-4 py-3">
                    <div className="text-xs font-semibold text-blue-700">
                      {activeSlide.highlightBox.heading}
                    </div>
                    <div className="text-xs font-mono font-semibold text-slate-900 mt-1">
                      {activeSlide.highlightBox.body}
                    </div>
                  </div>
                )}
              </div>

              <div
                className={`mt-8 pt-4 border-t flex items-center justify-between text-xs font-mono ${
                  isCover ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
                }`}
              >
                <span>
                  Live State: {liveStats.confirmed}/5 Confirmed · {liveStats.rac}/2 RAC ·{' '}
                  {liveStats.waiting} Waiting
                </span>
                <span>
                  Slide {activeSlide.id} / {PRESENTATION_SLIDES.length}
                </span>
              </div>
            </div>

            {/* Navigation Controls + Speaker Notes */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <div className="text-xs font-semibold text-slate-500">Speaker Notes</div>
                <p className="text-xs text-slate-700 leading-relaxed">{activeSlide.speakerNotes}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={slideIndex === 0}
                  onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={slideIndex === PRESENTATION_SLIDES.length - 1}
                  onClick={() =>
                    setSlideIndex((i) => Math.min(PRESENTATION_SLIDES.length - 1, i + 1))
                  }
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
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
                  <div
                    key={sc.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
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
      )}
    </div>
  );
};
