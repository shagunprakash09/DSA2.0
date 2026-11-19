import PptxGenJS from 'pptxgenjs';

export interface PresentationSlide {
  id: number;
  kicker: string;
  title: string;
  subtitle: string;
  bullets?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  highlightBox?: {
    heading: string;
    body: string;
  };
  speakerNotes: string;
}

export const PRESENTATION_SLIDES: PresentationSlide[] = [
  {
    id: 1,
    kicker: 'Advanced Data Structures Project',
    title: 'Railway Reservation Waiting Queue System',
    subtitle:
      'High-Efficiency Ticket Allocation, O(1) PNR Lookup & Priority Waiting List Management in C11 and Interactive Web Workbench',
    bullets: [
      'Core Implementation: ISO C11 (Modular GCC Project + Portable Single-File Build)',
      'Interactive Frontend: React 19 + TypeScript + Tailwind CSS v4 + D3.js + PptxGenJS',
      'Core Structures: Doubly Linked List, Indexed Max-Heap, Separate Chaining Hash Table',
      'Exports: CSV Passenger Manifest, Printable HTML e-Ticket, and PowerPoint (.pptx)',
    ],
    speakerNotes:
      'Good morning/afternoon everyone. Today I am presenting the Railway Reservation Waiting Queue System. The core algorithmic engine is written from scratch in ISO C11 without external libraries, paired with a React + TypeScript interactive workbench for live visualization, D3 analytics, CSV manifest export, and e-Ticket generation.',
  },
  {
    id: 2,
    kicker: '01 · Problem Statement',
    title: 'Why Naive Queues Fail in Railway Reservations',
    subtitle:
      'Real-world reservation charts require multi-tier priority ordering alongside instant arbitrary cancellation.',
    bullets: [
      'FIFO arrays require O(N) shifting whenever a passenger in the middle cancels a Confirmed berth or Waiting ticket.',
      'Simple FIFO waiting lists ignore priority quotas (VIP/Emergency, Tatkal, Senior Citizen, General).',
      'Standard binary heaps lack direct PNR indexing, forcing O(N) linear scans before canceling a waiting passenger.',
      'Project Goal: Guarantee O(1) PNR lookup, O(1) Confirmed/RAC deletion, and O(log N) Waiting List cancellation.',
    ],
    speakerNotes:
      'In a naive reservation system using plain arrays or standard queues, cancelling a ticket from the middle requires shifting elements in O(N) time, and finding a passenger in a priority heap also requires an O(N) scan. Our goal was to eliminate every O(N) bottleneck on lookup, insertion, and cancellation.',
  },
  {
    id: 3,
    kicker: '02 · System Architecture',
    title: 'Three-Structure Synchronized Design',
    subtitle:
      'The Separate Chaining Hash Table acts as the central directory linking every PNR to its active memory location.',
    table: {
      headers: ['Tier', 'Capacity', 'Data Structure', 'Stored Reference in Hash Table'],
      rows: [
        ['Confirmed Berths', '5 Berths (B-01..B-05)', 'Doubly Linked List', 'Direct DLLNode* pointer'],
        ['RAC Slots', '2 Slots (RAC-01..RAC-02)', 'Doubly Linked List', 'Direct DLLNode* pointer'],
        ['Priority Waiting', '128 Slots (Max-Heap)', 'Indexed Max-Heap', 'Synchronized array heap_index'],
        ['PNR Directory', '101 Prime Buckets', 'Hash Table (Chaining)', 'h(pnr) = pnr % 101'],
      ],
    },
    speakerNotes:
      'This table summarizes how our three structures collaborate. Confirmed Berths (capacity 5) and RAC Slots (capacity 2) are managed as Doubly Linked Lists. Overflow goes into an Indexed Max-Heap (capacity 128). Every booking is registered in a 101-bucket Separate Chaining Hash Table storing either a direct DLLNode pointer or the live heap array index.',
  },
  {
    id: 4,
    kicker: '03 · Doubly Linked List',
    title: 'Confirmed Berths & RAC Queue Management (dll.c)',
    subtitle:
      'Maintains insertion order for RAC promotion while allowing O(1) arbitrary cancellation anywhere in the berth chart.',
    bullets: [
      'dll_push_back(): Appends new bookings at the tail in O(1) and returns the allocated DLLNode* pointer.',
      'dll_pop_front(): Promotes the longest-waiting RAC passenger (HEAD) to Confirmed in O(1).',
      'dll_remove_node(): Unlinks any cancelled berth directly via prev and next pointers in O(1) without traversal.',
      'Physical berth numbers (B-01..B-05) are tracked via occupancy flags so promoted RAC passengers inherit the exact freed berth.',
    ],
    speakerNotes:
      'Why use a Doubly Linked List instead of a Singly Linked List? In a Singly Linked List, deleting an arbitrary middle node given only its pointer still takes O(N) to find its predecessor. With prev and next pointers in a Doubly Linked List, dll_remove_node unlinks any node in strict O(1) time.',
  },
  {
    id: 5,
    kicker: '04 · Indexed Max-Heap',
    title: 'Quota-Driven Priority Waiting List (heap.c)',
    subtitle:
      'Ensures higher-priority quotas advance ahead of General bookings while preserving strict FIFO fairness within each quota.',
    bullets: [
      'Primary Key: Quota Priority (1 = VIP/Emergency > 2 = Tatkal > 3 = Senior Citizen > 4 = General).',
      'Secondary Key: Monotonic booking timestamp (earlier sequence number wins ties cleanly).',
      'Index Synchronization: Every heap_swap(i, j) immediately updates ht_update_heap_index() for both PNRs in O(1).',
      'Middle Removal: heap_remove_at(index) swaps in the tail node and performs bidirectional sift-up or sift-down in O(log N).',
    ],
    highlightBox: {
      heading: 'Critical Synchronization Invariant',
      body: 'For every i in [0 .. heap.size - 1]: ht_search(heap.nodes[i].pnr)->heap_index == i',
    },
    speakerNotes:
      'The waiting list uses an Indexed Max-Heap. Lower quota integer values represent higher urgency, and ties within the same quota are broken by earlier booking timestamp. Crucially, whenever two nodes swap during sift-up or sift-down, both PNRs have their heap_index updated in the Hash Table so arbitrary cancellation remains O(log N).',
  },
  {
    id: 6,
    kicker: '05 · Hash Table',
    title: 'O(1) PNR Lookup via Separate Chaining (hashtable.c)',
    subtitle:
      'Maps unique 6-digit PNRs (100000–999999) directly to booking metadata without linear scans.',
    bullets: [
      'Prime Bucket Count (M = 101) minimizes clustering under modulo hashing: bucket = pnr % 101.',
      'Each HashEntry stores pnr, status, DLLNode* pointer, and heap_index.',
      'ht_update() transitions entries in O(1) when a passenger is promoted from Waiting -> RAC or RAC -> Confirmed.',
      'Guaranteed uniqueness: generate_unique_pnr() checks ht_search() before issuing any new 6-digit PNR.',
    ],
    speakerNotes:
      'We chose a prime bucket size of 101 with Separate Chaining to handle collisions cleanly via linked chains. Status checks probe buckets[pnr % 101] in O(1) average time and immediately know the exact Berth number, RAC slot, or Heap index.',
  },
  {
    id: 7,
    kicker: '06 · Complexity & Cascade',
    title: 'Cancellation Promotion Cascade & Big-O Analysis',
    subtitle:
      'Canceling a Confirmed berth triggers an automatic, invariant-preserving two-stage promotion.',
    table: {
      headers: ['Operation', 'Time Complexity', 'Execution Path'],
      rows: [
        ['Book Confirmed / RAC', 'O(1) avg', 'dll_push_back + ht_insert'],
        ['Book Waiting List', 'O(log N)', 'ht_insert + heap_insert (siftUp)'],
        ['Check PNR Status', 'O(1) avg', 'ht_search(pnr) -> read berth / RAC / heap_index'],
        ['Cancel Confirmed', 'O(log N)', 'dll_remove_node O(1) -> pop RAC O(1) -> extractMax O(log N)'],
        ['Cancel RAC', 'O(log N)', 'dll_remove_node O(1) -> extractMax O(log N)'],
        ['Cancel Waiting List', 'O(log N)', 'ht_search O(1) -> heap_remove_at(heap_index) O(log N)'],
      ],
    },
    speakerNotes:
      'Let us trace a Confirmed cancellation step-by-step: First, ht_search locates the DLLNode pointer in O(1). Second, dll_remove_node frees the Confirmed berth in O(1). Third, dll_pop_front promotes the longest-waiting RAC passenger into that freed berth in O(1). Finally, heap_extract_max pulls the highest-priority Waiting passenger into RAC in O(log N).',
  },
  {
    id: 8,
    kicker: '07 · Technology Stack',
    title: 'Languages, Frameworks & Build Tooling',
    subtitle:
      'Dual implementation: zero-dependency C11 systems codebase paired with a modern TypeScript web workbench.',
    table: {
      headers: ['Layer', 'Language / Tool', 'Purpose in Project'],
      rows: [
        ['Core DSA Engine (CLI)', 'ISO C11 (GCC + Make)', 'Modular DLL, Heap, Hash Table, CLI & CSV export (zero external libs)'],
        ['C Unit & Invariant Tests', 'C11 (<assert.h>)', 'Verifies heap-order and Hash Table index invariants on every step'],
        ['Web UI & State Engine', 'TypeScript + React 19', 'Mirrors C11 engine with live step-by-step trace & pointer diagrams'],
        ['Styling & Typography', 'Tailwind CSS v4', 'Plus Jakarta Sans + JetBrains Mono (tabular numerals)'],
        ['Charts & Deck Export', 'D3.js + PptxGenJS', '7-day booking frequency line chart & client-side .pptx generation'],
      ],
    },
    speakerNotes:
      'If asked about the languages and tools used: the core assignment is written in pure ISO C11 compiled cleanly with gcc -Wall -Wextra -Werror -std=c11 and zero external libraries. The interactive frontend uses React 19, TypeScript, Vite, Tailwind CSS v4, D3.js for the 7-day analytics chart, and PptxGenJS to generate this PowerPoint file.',
  },
  {
    id: 9,
    kicker: '08 · Application Features',
    title: 'Interactive Web Workbench & Documentation Exports',
    subtitle:
      'Operational features built on top of the synchronized data structures.',
    bullets: [
      'Operations Console: Book tickets with Journey Date & Departure Time, check O(1) PNR status, and inspect live execution traces.',
      'Live PNR Search Filter: Filter Confirmed, RAC, and Waiting tables instantaneously without running full lookups.',
      'Visualizers & Analytics: Live SVG Binary Heap tree, DLL node chains, occupied Hash buckets, and D3 7-day booking chart.',
      'Document Exports: One-click CSV Passenger Manifest, printable HTML e-Tickets, and 10-slide PowerPoint (.pptx) deck.',
    ],
    speakerNotes:
      'During a live demo, we can filter any PNR across all three charts, inspect the SVG binary heap tree in the Data Structures tab, view the 7-day booking frequency line chart in Analytics, and export either a full CSV manifest or an individual HTML e-Ticket.',
  },
  {
    id: 10,
    kicker: '09 · Verification & Conclusion',
    title: 'Clean C11 Compilation & Invariant Testing',
    subtitle:
      'Compiled with strict warnings-as-errors and verified with automated structural invariant assertions.',
    bullets: [
      'Modular build: c_project/ (include/railway.h, dll.c, heap.c, hashtable.c, reservation.c, main.c, Makefile).',
      'Portable single-file build: railway_single_file.c compiles cleanly with gcc -Wall -Wextra -Werror -std=c11 -O2.',
      'Automated test_runner validates Hash Table <-> Heap index parity across preloading, VIP jumps, and middle deletions.',
      'Conclusion: Combining DLL, Indexed Max-Heap, and Hash Table achieves optimal asymptotic bounds for railway queues.',
    ],
    speakerNotes:
      'To conclude, every data structure invariant is verified both by automated C assertions in test_runner.c and by TypeScript strict type-checking and Vite production builds. Thank you—I am happy to answer any questions or run a live scenario.',
  },
];

export async function downloadPresentationPptx(
  liveStats?: { confirmed: number; rac: number; waiting: number; total: number }
): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'RailQueue DSA';
  pptx.title = 'Railway Reservation Waiting Queue System';
  pptx.subject = 'Advanced Data Structures Presentation';

  const NAVY = '0F172A';
  const BLUE = '1D4ED8';
  const SLATE = '475569';
  const BORDER = 'CBD5E1';
  const BG_LIGHT = 'F8FAFC';
  const WHITE = 'FFFFFF';

  for (const s of PRESENTATION_SLIDES) {
    const slide = pptx.addSlide();
    const isCover = s.id === 1;

    if (isCover) {
      slide.background = { color: NAVY };
      slide.addText(s.kicker.toUpperCase(), {
        x: 0.8,
        y: 1.0,
        w: 8.4,
        h: 0.4,
        fontSize: 12,
        bold: true,
        color: '93C5FD',
        fontFace: 'Calibri',
      });
      slide.addText(s.title, {
        x: 0.8,
        y: 1.5,
        w: 8.4,
        h: 1.1,
        fontSize: 32,
        bold: true,
        color: WHITE,
        fontFace: 'Calibri',
      });
      slide.addText(s.subtitle, {
        x: 0.8,
        y: 2.75,
        w: 8.4,
        h: 0.8,
        fontSize: 15,
        color: 'CBD5E1',
        fontFace: 'Calibri',
      });

      if (s.bullets) {
        slide.addText(
          s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
          {
            x: 0.8,
            y: 3.75,
            w: 8.4,
            h: 1.5,
            fontSize: 13,
            color: 'E2E8F0',
            paraSpaceAfter: 6,
            fontFace: 'Calibri',
          }
        );
      }
      if (liveStats) {
        slide.addText(
          `Live Snapshot: ${liveStats.confirmed}/5 Confirmed  |  ${liveStats.rac}/2 RAC  |  ${liveStats.waiting} Waiting  |  ${liveStats.total} Total PNRs`,
          {
            x: 0.8,
            y: 5.15,
            w: 8.4,
            h: 0.3,
            fontSize: 10,
            color: '94A3B8',
            fontFace: 'Consolas',
          }
        );
      }
    } else {
      slide.background = { color: BG_LIGHT };

      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 10,
        h: 0.08,
        fill: { color: BLUE },
      });

      slide.addText(s.kicker, {
        x: 0.65,
        y: 0.35,
        w: 8.7,
        h: 0.3,
        fontSize: 11,
        bold: true,
        color: BLUE,
        fontFace: 'Calibri',
      });

      slide.addText(s.title, {
        x: 0.65,
        y: 0.65,
        w: 8.7,
        h: 0.55,
        fontSize: 22,
        bold: true,
        color: NAVY,
        fontFace: 'Calibri',
      });

      slide.addText(s.subtitle, {
        x: 0.65,
        y: 1.2,
        w: 8.7,
        h: 0.45,
        fontSize: 13,
        color: SLATE,
        fontFace: 'Calibri',
      });

      let nextY = 1.8;

      if (s.bullets && s.bullets.length > 0) {
        slide.addText(
          s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
          {
            x: 0.7,
            y: nextY,
            w: 8.6,
            h: s.highlightBox ? 2.4 : 3.2,
            fontSize: 14,
            color: '1E293B',
            paraSpaceAfter: 10,
            valign: 'top',
            fontFace: 'Calibri',
          }
        );
        nextY += s.highlightBox ? 2.5 : 3.3;
      }

      if (s.table) {
        const tableRows: PptxGenJS.TableRow[] = [
          s.table.headers.map((h) => ({
            text: h,
            options: {
              bold: true,
              fill: { color: NAVY },
              color: WHITE,
              fontSize: 11,
              margin: [6, 8, 6, 8] as [number, number, number, number],
            },
          })),
          ...s.table.rows.map((row, rIdx) =>
            row.map((cell) => ({
              text: cell,
              options: {
                fill: { color: rIdx % 2 === 0 ? WHITE : 'F1F5F9' },
                color: '1E293B',
                fontSize: 11,
                margin: [5, 8, 5, 8] as [number, number, number, number],
              },
            }))
          ),
        ];

        slide.addTable(tableRows, {
          x: 0.65,
          y: nextY,
          w: 8.7,
          border: { pt: 1, color: BORDER },
          fontFace: 'Calibri',
        });
      }

      if (s.highlightBox) {
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.65,
          y: nextY,
          w: 8.7,
          h: 0.85,
          fill: { color: 'EFF6FF' },
          line: { color: BLUE, pt: 1 },
        });
        slide.addText(s.highlightBox.heading, {
          x: 0.85,
          y: nextY + 0.1,
          w: 8.3,
          h: 0.25,
          fontSize: 11,
          bold: true,
          color: BLUE,
          fontFace: 'Calibri',
        });
        slide.addText(s.highlightBox.body, {
          x: 0.85,
          y: nextY + 0.38,
          w: 8.3,
          h: 0.35,
          fontSize: 12,
          bold: true,
          color: NAVY,
          fontFace: 'Consolas',
        });
      }

      slide.addText(`RailQueue DSA · Slide ${s.id} of ${PRESENTATION_SLIDES.length}`, {
        x: 0.65,
        y: 5.2,
        w: 8.7,
        h: 0.25,
        fontSize: 9,
        color: '64748B',
        align: 'right',
        fontFace: 'Calibri',
      });
    }

    slide.addNotes(s.speakerNotes);
  }

  await pptx.writeFile({ fileName: 'RailQueue_DSA_Presentation.pptx' });
}
