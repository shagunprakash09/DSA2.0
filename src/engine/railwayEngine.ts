export enum QuotaType {
  VIP = 1,
  TATKAL = 2,
  SENIOR = 3,
  GENERAL = 4,
}

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  RAC = 'RAC',
  WAITING = 'WAITING',
}

export interface Passenger {
  pnr: number;
  name: string;
  age: number;
  quota: QuotaType;
  timestamp: number;
  journeyDate: string;
  journeyTime: string;
  bookedDate: string; // YYYY-MM-DD for 7-day booking analytics
  bookedAt: string;
  status: BookingStatus;
  slotNumber: number; // 1..5 for Confirmed, 1..2 for RAC, 0 for Waiting
}

export function formatLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function offsetIsoDate(daysOffset: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysOffset);
  return formatLocalIsoDate(d);
}

export const DEFAULT_JOURNEY_DATE = '2026-11-20';
export const DEFAULT_JOURNEY_TIME = '08:30';

export interface DLLNode {
  id: string;
  data: Passenger;
  prev: DLLNode | null;
  next: DLLNode | null;
}

export interface HashEntry {
  pnr: number;
  bucket: number;
  status: BookingStatus;
  dllNode: DLLNode | null;
  heapIndex: number; // -1 if not in heap
  next: HashEntry | null;
}

export interface TraceStep {
  structure: 'Hash Table' | 'Doubly Linked List' | 'Indexed Max-Heap' | 'System';
  complexity: string;
  detail: string;
}

export interface OperationResult {
  success: boolean;
  title: string;
  summary: string;
  pnr?: number;
  steps: TraceStep[];
  highlightedPnrs: number[];
}

export interface LookupResult {
  found: boolean;
  pnr: number;
  bucket: number;
  chainDepth: number;
  status?: BookingStatus;
  passenger?: Passenger;
  heapIndex?: number;
  priorityRank?: number;
  dllNodeId?: string;
}

export const MAX_CONFIRMED = 5;
export const MAX_RAC = 2;
export const HASH_TABLE_SIZE = 101;
export const HEAP_CAPACITY = 128;

export function quotaLabel(quota: QuotaType): string {
  switch (quota) {
    case QuotaType.VIP:
      return 'VIP / Emergency';
    case QuotaType.TATKAL:
      return 'Tatkal';
    case QuotaType.SENIOR:
      return 'Senior Citizen';
    case QuotaType.GENERAL:
      return 'General';
  }
}

export function quotaShort(quota: QuotaType): string {
  switch (quota) {
    case QuotaType.VIP:
      return 'P1 · VIP';
    case QuotaType.TATKAL:
      return 'P2 · Tatkal';
    case QuotaType.SENIOR:
      return 'P3 · Senior';
    case QuotaType.GENERAL:
      return 'P4 · General';
  }
}

/* ============================================================================
 * 1. DOUBLY LINKED LIST (Confirmed & RAC Management)
 * ============================================================================ */
export class DoublyLinkedList {
  head: DLLNode | null = null;
  tail: DLLNode | null = null;
  size = 0;
  readonly capacity: number;
  private nodeSeq = 1;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  pushBack(passenger: Passenger, prefix: string): DLLNode | null {
    if (this.size >= this.capacity) {
      return null;
    }
    const node: DLLNode = {
      id: `${prefix}_${this.nodeSeq++}`,
      data: { ...passenger },
      prev: this.tail,
      next: null,
    };
    if (this.tail !== null) {
      this.tail.next = node;
    } else {
      this.head = node;
    }
    this.tail = node;
    this.size++;
    return node;
  }

  popFront(): Passenger | null {
    if (this.head === null) {
      return null;
    }
    const front = this.head;
    this.head = front.next;
    if (this.head !== null) {
      this.head.prev = null;
    } else {
      this.tail = null;
    }
    front.prev = null;
    front.next = null;
    this.size--;
    return front.data;
  }

  removeNode(node: DLLNode): Passenger | null {
    if (this.size === 0) {
      return null;
    }
    if (node.prev !== null) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next !== null) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    node.prev = null;
    node.next = null;
    this.size--;
    return node.data;
  }

  toArray(): DLLNode[] {
    const res: DLLNode[] = [];
    let curr = this.head;
    while (curr !== null) {
      res.push(curr);
      curr = curr.next;
    }
    return res;
  }
}

/* ============================================================================
 * 2. HASH TABLE WITH SEPARATE CHAINING (M = 101)
 * ============================================================================ */
export class HashTable {
  buckets: Array<HashEntry | null> = Array.from({ length: HASH_TABLE_SIZE }, () => null);
  count = 0;

  hash(pnr: number): number {
    const h = pnr % HASH_TABLE_SIZE;
    return h < 0 ? h + HASH_TABLE_SIZE : h;
  }

  insert(pnr: number, status: BookingStatus, dllNode: DLLNode | null, heapIndex: number): boolean {
    if (this.search(pnr) !== null) {
      return false;
    }
    const bucket = this.hash(pnr);
    const entry: HashEntry = {
      pnr,
      bucket,
      status,
      dllNode,
      heapIndex,
      next: this.buckets[bucket],
    };
    this.buckets[bucket] = entry;
    this.count++;
    return true;
  }

  search(pnr: number): { entry: HashEntry; depth: number } | null {
    const bucket = this.hash(pnr);
    let curr = this.buckets[bucket];
    let depth = 1;
    while (curr !== null) {
      if (curr.pnr === pnr) {
        return { entry: curr, depth };
      }
      curr = curr.next;
      depth++;
    }
    return null;
  }

  update(pnr: number, status: BookingStatus, dllNode: DLLNode | null, heapIndex: number): boolean {
    const found = this.search(pnr);
    if (!found) {
      return false;
    }
    found.entry.status = status;
    found.entry.dllNode = dllNode;
    found.entry.heapIndex = heapIndex;
    return true;
  }

  updateHeapIndex(pnr: number, newHeapIndex: number): boolean {
    const found = this.search(pnr);
    if (!found) {
      return false;
    }
    found.entry.heapIndex = newHeapIndex;
    return true;
  }

  remove(pnr: number): boolean {
    const bucket = this.hash(pnr);
    let curr = this.buckets[bucket];
    let prev: HashEntry | null = null;
    while (curr !== null) {
      if (curr.pnr === pnr) {
        if (prev !== null) {
          prev.next = curr.next;
        } else {
          this.buckets[bucket] = curr.next;
        }
        this.count--;
        return true;
      }
      prev = curr;
      curr = curr.next;
    }
    return false;
  }

  getOccupiedBuckets(): Array<{ bucket: number; entries: HashEntry[] }> {
    const occupied: Array<{ bucket: number; entries: HashEntry[] }> = [];
    for (let i = 0; i < HASH_TABLE_SIZE; i++) {
      let curr = this.buckets[i];
      if (curr !== null) {
        const entries: HashEntry[] = [];
        while (curr !== null) {
          entries.push({ ...curr });
          curr = curr.next;
        }
        occupied.push({ bucket: i, entries });
      }
    }
    return occupied;
  }
}

/* ============================================================================
 * 3. INDEXED MAX-HEAP (Priority Waiting List)
 * ============================================================================ */
export class IndexedMaxHeap {
  nodes: Passenger[] = [];
  readonly capacity: number;

  constructor(capacity = HEAP_CAPACITY) {
    this.capacity = capacity;
  }

  get size(): number {
    return this.nodes.length;
  }

  compare(a: Passenger, b: Passenger): number {
    if (a.quota !== b.quota) {
      return b.quota - a.quota; // Smaller quota code (1=VIP) wins
    }
    if (a.timestamp !== b.timestamp) {
      return a.timestamp < b.timestamp ? 1 : -1; // Earlier timestamp wins
    }
    return 0;
  }

  private swap(ht: HashTable, i: number, j: number, trace: TraceStep[]): void {
    if (i === j) return;
    const temp = this.nodes[i];
    this.nodes[i] = this.nodes[j];
    this.nodes[j] = temp;

    ht.updateHeapIndex(this.nodes[i].pnr, i);
    ht.updateHeapIndex(this.nodes[j].pnr, j);

    trace.push({
      structure: 'Indexed Max-Heap',
      complexity: 'O(1)',
      detail: `Swapped heap[${i}] (PNR ${this.nodes[i].pnr}) <-> heap[${j}] (PNR ${this.nodes[j].pnr}) and synced Hash Table indices.`,
    });
  }

  private siftUp(ht: HashTable, idx: number, trace: TraceStep[]): void {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.compare(this.nodes[idx], this.nodes[parent]) > 0) {
        this.swap(ht, idx, parent, trace);
        idx = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(ht: HashTable, idx: number, trace: TraceStep[]): void {
    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let best = idx;

      if (left < this.nodes.length && this.compare(this.nodes[left], this.nodes[best]) > 0) {
        best = left;
      }
      if (right < this.nodes.length && this.compare(this.nodes[right], this.nodes[best]) > 0) {
        best = right;
      }
      if (best !== idx) {
        this.swap(ht, idx, best, trace);
        idx = best;
      } else {
        break;
      }
    }
  }

  insert(ht: HashTable, passenger: Passenger, trace: TraceStep[]): boolean {
    if (this.nodes.length >= this.capacity) {
      return false;
    }
    const idx = this.nodes.length;
    this.nodes.push({ ...passenger });
    ht.updateHeapIndex(passenger.pnr, idx);
    trace.push({
      structure: 'Indexed Max-Heap',
      complexity: 'O(log N)',
      detail: `Inserted PNR ${passenger.pnr} (${quotaLabel(passenger.quota)}, T-${passenger.timestamp}) at heap[${idx}], starting siftUp.`,
    });
    this.siftUp(ht, idx, trace);
    return true;
  }

  extractMax(ht: HashTable, trace: TraceStep[]): Passenger | null {
    return this.removeAt(ht, 0, trace);
  }

  removeAt(ht: HashTable, index: number, trace: TraceStep[]): Passenger | null {
    if (this.nodes.length === 0 || index < 0 || index >= this.nodes.length) {
      return null;
    }
    const removed = this.nodes[index];
    const lastIdx = this.nodes.length - 1;
    if (index === lastIdx) {
      this.nodes.pop();
      trace.push({
        structure: 'Indexed Max-Heap',
        complexity: 'O(1)',
        detail: `Removed tail element heap[${index}] (PNR ${removed.pnr}); no re-heapify needed.`,
      });
      return removed;
    }

    const replacement = this.nodes.pop()!;
    this.nodes[index] = replacement;
    ht.updateHeapIndex(replacement.pnr, index);
    trace.push({
      structure: 'Indexed Max-Heap',
      complexity: 'O(log N)',
      detail: `Moved tail PNR ${replacement.pnr} into vacated heap[${index}] (was PNR ${removed.pnr}) and synced Hash Table.`,
    });

    const parent = Math.floor((index - 1) / 2);
    if (index > 0 && this.compare(this.nodes[index], this.nodes[parent]) > 0) {
      this.siftUp(ht, index, trace);
    } else {
      this.siftDown(ht, index, trace);
    }
    return removed;
  }

  computePriorityRank(index: number): number {
    if (index < 0 || index >= this.nodes.length) return -1;
    let rank = 1;
    const target = this.nodes[index];
    for (let i = 0; i < this.nodes.length; i++) {
      if (i !== index && this.compare(this.nodes[i], target) > 0) {
        rank++;
      }
    }
    return rank;
  }

  getSortedView(): Array<{ rank: number; heapIndex: number; passenger: Passenger }> {
    const indexed = this.nodes.map((passenger, heapIndex) => ({ heapIndex, passenger }));
    indexed.sort((a, b) => this.compare(b.passenger, a.passenger));
    return indexed.map((item, idx) => ({
      rank: idx + 1,
      heapIndex: item.heapIndex,
      passenger: item.passenger,
    }));
  }
}

/* ============================================================================
 * UNIFIED RAILWAY RESERVATION ENGINE
 * ============================================================================ */
export class RailwayEngine {
  confirmedList = new DoublyLinkedList(MAX_CONFIRMED);
  racList = new DoublyLinkedList(MAX_RAC);
  waitingHeap = new IndexedMaxHeap(HEAP_CAPACITY);
  pnrTable = new HashTable();

  private confirmedBerths: boolean[] = Array(MAX_CONFIRMED + 1).fill(false);
  private racSlots: boolean[] = Array(MAX_RAC + 1).fill(false);
  private clockSeq = 1;
  private rngState = 20261118;

  private acquireSlot(occupied: boolean[], maxSlots: number): number {
    for (let s = 1; s <= maxSlots; s++) {
      if (!occupied[s]) {
        occupied[s] = true;
        return s;
      }
    }
    return 0;
  }

  private releaseSlot(occupied: boolean[], maxSlots: number, slot: number): void {
    if (slot >= 1 && slot <= maxSlots) {
      occupied[slot] = false;
    }
  }

  private generateUniquePnr(): number {
    let pnr: number;
    do {
      this.rngState = (Math.imul(this.rngState, 1103515245) + 12345) >>> 0;
      const r1 = (this.rngState >>> 16) & 0x7fff;
      this.rngState = (Math.imul(this.rngState, 1103515245) + 12345) >>> 0;
      const r2 = (this.rngState >>> 16) & 0x7fff;
      const combined = ((r1 << 15) ^ r2) >>> 0;
      pnr = 100000 + (combined % 900000);
    } while (this.pnrTable.search(pnr) !== null);
    return pnr;
  }

  reset(): void {
    this.confirmedList = new DoublyLinkedList(MAX_CONFIRMED);
    this.racList = new DoublyLinkedList(MAX_RAC);
    this.waitingHeap = new IndexedMaxHeap(HEAP_CAPACITY);
    this.pnrTable = new HashTable();
    this.confirmedBerths = Array(MAX_CONFIRMED + 1).fill(false);
    this.racSlots = Array(MAX_RAC + 1).fill(false);
    this.clockSeq = 1;
    this.rngState = 20261118;
  }

  bookTicket(
    name: string,
    age: number,
    quota: QuotaType,
    journeyDate = DEFAULT_JOURNEY_DATE,
    journeyTime = DEFAULT_JOURNEY_TIME,
    bookedDateOverride?: string
  ): OperationResult {
    const trimmed = name.trim();
    if (!trimmed || age < 1 || age > 120) {
      return {
        success: false,
        title: 'Invalid Passenger Input',
        summary: 'Provide a valid passenger name and age between 1 and 120.',
        steps: [],
        highlightedPnrs: [],
      };
    }

    const pnr = this.generateUniquePnr();
    const timestamp = this.clockSeq++;
    const safeDate = journeyDate || DEFAULT_JOURNEY_DATE;
    const safeTime = journeyTime || DEFAULT_JOURNEY_TIME;
    const bookedDate = bookedDateOverride || formatLocalIsoDate(new Date());
    const bookedAtDate = bookedDateOverride ? new Date(`${bookedDateOverride}T10:15:00`) : new Date();
    const bookedAt = bookedAtDate.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const steps: TraceStep[] = [];

    if (this.confirmedList.size < this.confirmedList.capacity) {
      const berth = this.acquireSlot(this.confirmedBerths, MAX_CONFIRMED);
      const passenger: Passenger = {
        pnr,
        name: trimmed,
        age,
        quota,
        timestamp,
        journeyDate: safeDate,
        journeyTime: safeTime,
        bookedDate,
        bookedAt,
        status: BookingStatus.CONFIRMED,
        slotNumber: berth,
      };
      const node = this.confirmedList.pushBack(passenger, 'CONF')!;
      this.pnrTable.insert(pnr, BookingStatus.CONFIRMED, node, -1);
      const bucket = this.pnrTable.hash(pnr);

      steps.push(
        {
          structure: 'Doubly Linked List',
          complexity: 'O(1)',
          detail: `Confirmed list has free capacity (${this.confirmedList.size}/${MAX_CONFIRMED}). Appended node ${node.id} for Berth B-0${berth}.`,
        },
        {
          structure: 'Hash Table',
          complexity: 'O(1)',
          detail: `Inserted PNR ${pnr} into bucket [${bucket}] (${pnr} % ${HASH_TABLE_SIZE}) pointing directly to ${node.id}.`,
        }
      );

      return {
        success: true,
        title: `Booked PNR ${pnr} — Confirmed Berth B-0${berth}`,
        summary: `${trimmed} (${quotaLabel(quota)}) assigned directly to Confirmed Berth B-0${berth}.`,
        pnr,
        steps,
        highlightedPnrs: [pnr],
      };
    }

    if (this.racList.size < this.racList.capacity) {
      const racSlot = this.acquireSlot(this.racSlots, MAX_RAC);
      const passenger: Passenger = {
        pnr,
        name: trimmed,
        age,
        quota,
        timestamp,
        journeyDate: safeDate,
        journeyTime: safeTime,
        bookedDate,
        bookedAt,
        status: BookingStatus.RAC,
        slotNumber: racSlot,
      };
      const node = this.racList.pushBack(passenger, 'RAC')!;
      this.pnrTable.insert(pnr, BookingStatus.RAC, node, -1);
      const bucket = this.pnrTable.hash(pnr);

      steps.push(
        {
          structure: 'Doubly Linked List',
          complexity: 'O(1)',
          detail: `Confirmed full (${MAX_CONFIRMED}/${MAX_CONFIRMED}). Appended node ${node.id} to RAC list at RAC-0${racSlot}.`,
        },
        {
          structure: 'Hash Table',
          complexity: 'O(1)',
          detail: `Inserted PNR ${pnr} into bucket [${bucket}] pointing directly to ${node.id}.`,
        }
      );

      return {
        success: true,
        title: `Booked PNR ${pnr} — RAC Slot RAC-0${racSlot}`,
        summary: `${trimmed} (${quotaLabel(quota)}) placed into RAC Slot RAC-0${racSlot}.`,
        pnr,
        steps,
        highlightedPnrs: [pnr],
      };
    }

    if (this.waitingHeap.size >= this.waitingHeap.capacity) {
      return {
        success: false,
        title: 'Waiting List Full',
        summary: 'Waiting list capacity reached.',
        steps: [],
        highlightedPnrs: [],
      };
    }

    const passenger: Passenger = {
      pnr,
      name: trimmed,
      age,
      quota,
      timestamp,
      journeyDate: safeDate,
      journeyTime: safeTime,
      bookedDate,
      bookedAt,
      status: BookingStatus.WAITING,
      slotNumber: 0,
    };
    const bucket = this.pnrTable.hash(pnr);
    this.pnrTable.insert(pnr, BookingStatus.WAITING, null, -1);
    steps.push({
      structure: 'Hash Table',
      complexity: 'O(1)',
      detail: `Registered PNR ${pnr} in bucket [${bucket}] before heap insertion.`,
    });

    this.waitingHeap.insert(this.pnrTable, passenger, steps);
    const finalEntry = this.pnrTable.search(pnr)!.entry;
    const rank = this.waitingHeap.computePriorityRank(finalEntry.heapIndex);

    return {
      success: true,
      title: `Booked PNR ${pnr} — Waiting List Rank #${rank}`,
      summary: `${trimmed} (${quotaLabel(quota)}, T-${timestamp}) placed at Heap[${finalEntry.heapIndex}] (Priority Rank #${rank}).`,
      pnr,
      steps,
      highlightedPnrs: [pnr],
    };
  }

  cancelTicket(pnr: number): OperationResult {
    const found = this.pnrTable.search(pnr);
    if (!found) {
      return {
        success: false,
        title: `PNR ${pnr} Not Found`,
        summary: `Hash Table probe at bucket [${this.pnrTable.hash(pnr)}] found no active ticket for PNR ${pnr}.`,
        steps: [
          {
            structure: 'Hash Table',
            complexity: 'O(1)',
            detail: `Checked bucket [${this.pnrTable.hash(pnr)}] (${pnr} % ${HASH_TABLE_SIZE}): PNR ${pnr} does not exist.`,
          },
        ],
        highlightedPnrs: [],
      };
    }

    const steps: TraceStep[] = [];
    const highlighted: number[] = [];
    const entry = found.entry;

    steps.push({
      structure: 'Hash Table',
      complexity: 'O(1)',
      detail: `Located PNR ${pnr} in bucket [${entry.bucket}] (chain depth ${found.depth}) with status ${entry.status}.`,
    });

    if (entry.status === BookingStatus.CONFIRMED && entry.dllNode) {
      const cancelled = this.confirmedList.removeNode(entry.dllNode)!;
      const freedBerth = cancelled.slotNumber;
      this.pnrTable.remove(pnr);

      steps.push({
        structure: 'Doubly Linked List',
        complexity: 'O(1)',
        detail: `Unlinked Confirmed node ${entry.dllNode.id} (${cancelled.name}, Berth B-0${freedBerth}) directly via stored pointer.`,
      });

      const promotedRac = this.racList.popFront();
      if (promotedRac) {
        const freedRacSlot = promotedRac.slotNumber;
        promotedRac.status = BookingStatus.CONFIRMED;
        promotedRac.slotNumber = freedBerth;
        const newConfNode = this.confirmedList.pushBack(promotedRac, 'CONF')!;
        this.pnrTable.update(promotedRac.pnr, BookingStatus.CONFIRMED, newConfNode, -1);
        highlighted.push(promotedRac.pnr);

        steps.push({
          structure: 'Doubly Linked List',
          complexity: 'O(1)',
          detail: `Popped front RAC passenger PNR ${promotedRac.pnr} (${promotedRac.name}) and moved to Confirmed Berth B-0${freedBerth} (${newConfNode.id}).`,
        });

        const promotedWl = this.waitingHeap.extractMax(this.pnrTable, steps);
        if (promotedWl) {
          promotedWl.status = BookingStatus.RAC;
          promotedWl.slotNumber = freedRacSlot;
          const newRacNode = this.racList.pushBack(promotedWl, 'RAC')!;
          this.pnrTable.update(promotedWl.pnr, BookingStatus.RAC, newRacNode, -1);
          highlighted.push(promotedWl.pnr);

          steps.push({
            structure: 'Doubly Linked List',
            complexity: 'O(1)',
            detail: `Moved highest-priority WL passenger PNR ${promotedWl.pnr} (${promotedWl.name}, ${quotaLabel(promotedWl.quota)}) into RAC-0${freedRacSlot} and updated Hash Table.`,
          });
        } else {
          this.releaseSlot(this.racSlots, MAX_RAC, freedRacSlot);
        }
      } else {
        this.releaseSlot(this.confirmedBerths, MAX_CONFIRMED, freedBerth);
      }

      return {
        success: true,
        title: `Cancelled Confirmed PNR ${pnr} (Berth B-0${freedBerth})`,
        summary: promotedRac
          ? `Promoted RAC PNR ${promotedRac.pnr} to Berth B-0${freedBerth}${highlighted[1] ? ` and WL PNR ${highlighted[1]} to RAC` : ''}.`
          : `Released Berth B-0${freedBerth} back to available confirmed inventory.`,
        pnr,
        steps,
        highlightedPnrs: highlighted,
      };
    }

    if (entry.status === BookingStatus.RAC && entry.dllNode) {
      const cancelled = this.racList.removeNode(entry.dllNode)!;
      const freedRacSlot = cancelled.slotNumber;
      this.pnrTable.remove(pnr);

      steps.push({
        structure: 'Doubly Linked List',
        complexity: 'O(1)',
        detail: `Unlinked RAC node ${entry.dllNode.id} (${cancelled.name}, RAC-0${freedRacSlot}) directly via stored pointer.`,
      });

      const promotedWl = this.waitingHeap.extractMax(this.pnrTable, steps);
      if (promotedWl) {
        promotedWl.status = BookingStatus.RAC;
        promotedWl.slotNumber = freedRacSlot;
        const newRacNode = this.racList.pushBack(promotedWl, 'RAC')!;
        this.pnrTable.update(promotedWl.pnr, BookingStatus.RAC, newRacNode, -1);
        highlighted.push(promotedWl.pnr);

        steps.push({
          structure: 'Doubly Linked List',
          complexity: 'O(1)',
          detail: `Promoted highest-priority WL passenger PNR ${promotedWl.pnr} (${promotedWl.name}, ${quotaLabel(promotedWl.quota)}) to RAC-0${freedRacSlot}.`,
        });
      } else {
        this.releaseSlot(this.racSlots, MAX_RAC, freedRacSlot);
      }

      return {
        success: true,
        title: `Cancelled RAC PNR ${pnr} (RAC-0${freedRacSlot})`,
        summary: promotedWl
          ? `Promoted highest-priority Waiting List PNR ${promotedWl.pnr} (${promotedWl.name}) into RAC-0${freedRacSlot}.`
          : `Released RAC Slot RAC-0${freedRacSlot}.`,
        pnr,
        steps,
        highlightedPnrs: highlighted,
      };
    }

    // Waiting List cancellation in O(log N) via Hash Table heapIndex
    const heapIdx = entry.heapIndex;
    const cancelled = this.waitingHeap.removeAt(this.pnrTable, heapIdx, steps)!;
    this.pnrTable.remove(pnr);
    steps.push({
      structure: 'Hash Table',
      complexity: 'O(1)',
      detail: `Removed PNR ${pnr} from bucket [${entry.bucket}].`,
    });

    return {
      success: true,
      title: `Cancelled Waiting PNR ${pnr} from Heap[${heapIdx}]`,
      summary: `Removed ${cancelled.name} (${quotaLabel(cancelled.quota)}) directly from Heap[${heapIdx}] in O(log N) without linear scan.`,
      pnr,
      steps,
      highlightedPnrs: [],
    };
  }

  checkPnrStatus(pnr: number): LookupResult {
    const bucket = this.pnrTable.hash(pnr);
    const found = this.pnrTable.search(pnr);
    if (!found) {
      return { found: false, pnr, bucket, chainDepth: 0 };
    }
    const { entry, depth } = found;
    if (entry.status === BookingStatus.CONFIRMED || entry.status === BookingStatus.RAC) {
      return {
        found: true,
        pnr,
        bucket,
        chainDepth: depth,
        status: entry.status,
        passenger: entry.dllNode?.data,
        dllNodeId: entry.dllNode?.id,
      };
    }
    const passenger = this.waitingHeap.nodes[entry.heapIndex];
    const rank = this.waitingHeap.computePriorityRank(entry.heapIndex);
    return {
      found: true,
      pnr,
      bucket,
      chainDepth: depth,
      status: BookingStatus.WAITING,
      passenger,
      heapIndex: entry.heapIndex,
      priorityRank: rank,
    };
  }

  preloadSampleData(): OperationResult {
    this.reset();
    const samples: Array<{ name: string; age: number; quota: QuotaType; dayOffset: number }> = [
      { name: 'Aarav Sharma', age: 34, quota: QuotaType.GENERAL, dayOffset: -6 },
      { name: 'Meera Nair', age: 67, quota: QuotaType.SENIOR, dayOffset: -5 },
      { name: 'Rohan Verma', age: 28, quota: QuotaType.TATKAL, dayOffset: -5 },
      { name: 'Kavita Iyer', age: 42, quota: QuotaType.GENERAL, dayOffset: -4 },
      { name: 'Vikram Malhotra', age: 51, quota: QuotaType.VIP, dayOffset: -3 },
      { name: 'Suresh Kulkarni', age: 71, quota: QuotaType.SENIOR, dayOffset: -2 },
      { name: 'Ananya Gupta', age: 24, quota: QuotaType.GENERAL, dayOffset: -2 },
      { name: 'Devika Menon', age: 39, quota: QuotaType.GENERAL, dayOffset: -1 },
      { name: 'Rajeshwar Rao', age: 64, quota: QuotaType.SENIOR, dayOffset: 0 },
      { name: 'Priya Deshmukh', age: 31, quota: QuotaType.VIP, dayOffset: 0 },
    ];

    const bookedPnrs: number[] = [];
    for (const s of samples) {
      const res = this.bookTicket(
        s.name,
        s.age,
        s.quota,
        DEFAULT_JOURNEY_DATE,
        DEFAULT_JOURNEY_TIME,
        offsetIsoDate(s.dayOffset)
      );
      if (res.pnr) bookedPnrs.push(res.pnr);
    }

    return {
      success: true,
      title: 'Preloaded 10 Sample Passengers',
      summary:
        'Populated 5 Confirmed Berths (DLL), 2 RAC Slots (DLL), and 3 Waiting List Passengers (Indexed Max-Heap across General, Senior, and VIP quotas) indexed in Hash Table.',
      steps: [
        {
          structure: 'Doubly Linked List',
          complexity: 'O(1) each',
          detail: 'First 5 passengers filled Confirmed Berths B-01 through B-05.',
        },
        {
          structure: 'Doubly Linked List',
          complexity: 'O(1) each',
          detail: 'Passengers 6 and 7 filled RAC-01 and RAC-02.',
        },
        {
          structure: 'Indexed Max-Heap',
          complexity: 'O(log N) each',
          detail:
            'Passengers 8 (General), 9 (Senior Citizen), and 10 (VIP/Emergency) inserted into Max-Heap; VIP promoted to Heap[0] (Rank #1).',
        },
        {
          structure: 'Hash Table',
          complexity: 'O(1) each',
          detail: 'All 10 PNRs mapped into separate-chaining buckets (M = 101) with live pointers and heap indices.',
        },
      ],
      highlightedPnrs: bookedPnrs.slice(-3),
    };
  }

  exportPassengerManifestCsv(): { csv: string; rowCount: number } {
    const escapeCsv = (value: string | number): string => {
      const str = String(value);
      if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = [
      'Status',
      'Assignment',
      'PNR',
      'Passenger Name',
      'Age',
      'Quota',
      'Journey Date',
      'Departure Time',
      'Booked At',
      'Booking Sequence',
      'Hash Bucket',
      'Heap Index',
    ].join(',');

    const rows: string[] = [header];

    for (const node of this.confirmedList.toArray()) {
      const p = node.data;
      rows.push(
        [
          'CONFIRMED',
          `B-0${p.slotNumber}`,
          p.pnr,
          escapeCsv(p.name),
          p.age,
          escapeCsv(quotaLabel(p.quota)),
          p.journeyDate,
          p.journeyTime,
          escapeCsv(p.bookedAt),
          `T-${String(p.timestamp).padStart(4, '0')}`,
          this.pnrTable.hash(p.pnr),
          -1,
        ].join(',')
      );
    }

    for (const node of this.racList.toArray()) {
      const p = node.data;
      rows.push(
        [
          'RAC',
          `RAC-0${p.slotNumber}`,
          p.pnr,
          escapeCsv(p.name),
          p.age,
          escapeCsv(quotaLabel(p.quota)),
          p.journeyDate,
          p.journeyTime,
          escapeCsv(p.bookedAt),
          `T-${String(p.timestamp).padStart(4, '0')}`,
          this.pnrTable.hash(p.pnr),
          -1,
        ].join(',')
      );
    }

    for (const { rank, heapIndex, passenger: p } of this.waitingHeap.getSortedView()) {
      rows.push(
        [
          'WAITING',
          `WL-${rank}`,
          p.pnr,
          escapeCsv(p.name),
          p.age,
          escapeCsv(quotaLabel(p.quota)),
          p.journeyDate,
          p.journeyTime,
          escapeCsv(p.bookedAt),
          `T-${String(p.timestamp).padStart(4, '0')}`,
          this.pnrTable.hash(p.pnr),
          heapIndex,
        ].join(',')
      );
    }

    return {
      csv: rows.join('\r\n'),
      rowCount: rows.length - 1,
    };
  }

  generateETicketHtml(pnr: number): { html: string; filename: string } | null {
    const lookup = this.checkPnrStatus(pnr);
    if (!lookup.found || !lookup.passenger) {
      return null;
    }

    const p = lookup.passenger;
    const escapeHtml = (value: string | number): string =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const statusLine =
      lookup.status === BookingStatus.CONFIRMED
        ? `CONFIRMED · Berth B-0${p.slotNumber}`
        : lookup.status === BookingStatus.RAC
          ? `RAC · Slot RAC-0${p.slotNumber}`
          : `WAITING LIST · Priority Rank #${lookup.priorityRank} (Heap[${lookup.heapIndex}])`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>e-Ticket PNR ${p.pnr} — RailQueue DSA</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
    .ticket { max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; }
    .header { padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: baseline; }
    .brand { font-size: 18px; font-weight: 700; }
    .pnr { font-family: ui-monospace, monospace; font-size: 16px; font-weight: 700; color: #1d4ed8; }
    .body { padding: 24px; }
    .status { font-family: ui-monospace, monospace; font-size: 14px; font-weight: 700; color: #0f172a; padding: 10px 14px; background: #f1f5f9; border-radius: 8px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; color: #64748b; font-weight: 500; padding: 8px 0; width: 42%; border-bottom: 1px solid #f1f5f9; }
    td { text-align: right; color: #0f172a; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; }
    .note { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <div class="brand">RailQueue DSA — Electronic Reservation Slip</div>
      <div class="pnr">PNR: ${p.pnr}</div>
    </div>
    <div class="body">
      <div class="status">${escapeHtml(statusLine)}</div>
      <table>
        <tr><th>Passenger Name</th><td>${escapeHtml(p.name)}</td></tr>
        <tr><th>Age</th><td>${p.age} yrs</td></tr>
        <tr><th>Quota Priority</th><td>${escapeHtml(quotaLabel(p.quota))}</td></tr>
        <tr><th>Journey Date</th><td>${escapeHtml(p.journeyDate)}</td></tr>
        <tr><th>Departure Time</th><td>${escapeHtml(p.journeyTime)}</td></tr>
        <tr><th>Issued At</th><td>${escapeHtml(p.bookedAt)}</td></tr>
        <tr><th>Booking Sequence</th><td>T-${String(p.timestamp).padStart(4, '0')}</td></tr>
        <tr><th>Hash Table Bucket</th><td>Bucket #${lookup.bucket} (Chain #${lookup.chainDepth})</td></tr>
      </table>
    </div>
    <div class="note">
      Simulated reservation slip generated locally by RailQueue DSA. This document is for demonstration and data-structure documentation only and is not connected to live IRCTC ticketing or payment systems.
    </div>
  </div>
</body>
</html>`;

    return {
      html,
      filename: `eticket_PNR_${p.pnr}.html`,
    };
  }
}
