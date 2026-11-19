#include "../include/railway.h"

/*
 * Initialize an empty Indexed Max-Heap.
 * Time Complexity: O(1)
 */
void heap_init(IndexedMaxHeap *heap, int capacity) {
    heap->size = 0;
    heap->capacity = (capacity > HEAP_CAPACITY) ? HEAP_CAPACITY : capacity;
}

/*
 * Compare priority between two Waiting List passengers.
 * Returns > 0 if passenger 'a' has strictly higher priority than 'b'.
 * Returns < 0 if passenger 'b' has strictly higher priority than 'a'.
 *
 * Priority Rules:
 *   1. Primary Key: Quota Priority (1=VIP < 2=Tatkal < 3=Senior < 4=General).
 *      Lower numeric quota value means HIGHER priority.
 *   2. Secondary Key: Earlier booking timestamp (lower timestamp = HIGHER priority).
 */
int heap_compare(const Passenger *a, const Passenger *b) {
    if ((int)a->quota != (int)b->quota) {
        return ((int)b->quota - (int)a->quota); /* Smaller quota code wins */
    }
    if (a->timestamp != b->timestamp) {
        return (a->timestamp < b->timestamp) ? 1 : -1; /* Earlier booking wins */
    }
    return 0;
}

/*
 * Swap two heap elements at indices i and j and IMMEDIATELY synchronize
 * both PNRs' heap_index values in the Hash Table.
 * Average Time Complexity: O(1)
 */
static void heap_swap(IndexedMaxHeap *heap, HashTable *ht, int i, int j) {
    if (i == j) {
        return;
    }
    HeapNode temp = heap->nodes[i];
    heap->nodes[i] = heap->nodes[j];
    heap->nodes[j] = temp;

    if (ht != NULL) {
        ht_update_heap_index(ht, heap->nodes[i].data.pnr, i);
        ht_update_heap_index(ht, heap->nodes[j].data.pnr, j);
    }
}

/*
 * Restore Max-Heap property upward from index idx.
 * Time Complexity: O(log N)
 */
static void heap_sift_up(IndexedMaxHeap *heap, HashTable *ht, int idx) {
    while (idx > 0) {
        int parent = (idx - 1) / 2;
        if (heap_compare(&heap->nodes[idx].data, &heap->nodes[parent].data) > 0) {
            heap_swap(heap, ht, idx, parent);
            idx = parent;
        } else {
            break;
        }
    }
}

/*
 * Restore Max-Heap property downward from index idx.
 * Time Complexity: O(log N)
 */
static void heap_sift_down(IndexedMaxHeap *heap, HashTable *ht, int idx) {
    while (true) {
        int left = 2 * idx + 1;
        int right = 2 * idx + 2;
        int best = idx;

        if (left < heap->size &&
            heap_compare(&heap->nodes[left].data, &heap->nodes[best].data) > 0) {
            best = left;
        }
        if (right < heap->size &&
            heap_compare(&heap->nodes[right].data, &heap->nodes[best].data) > 0) {
            best = right;
        }

        if (best != idx) {
            heap_swap(heap, ht, idx, best);
            idx = best;
        } else {
            break;
        }
    }
}

/*
 * Insert a new passenger into the Indexed Max-Heap and record their
 * final heap_index in the Hash Table.
 * Time Complexity: O(log N)
 */
bool heap_insert(IndexedMaxHeap *heap, HashTable *ht, Passenger p) {
    if (heap->size >= heap->capacity) {
        return false;
    }

    int idx = heap->size;
    heap->nodes[idx].data = p;
    heap->size++;

    /* Register initial heap position in Hash Table before sifting */
    if (ht != NULL) {
        ht_update_heap_index(ht, p.pnr, idx);
    }

    heap_sift_up(heap, ht, idx);
    return true;
}

/*
 * Extract the highest-priority passenger (root at index 0) from the Max-Heap.
 * Keeps remaining elements' Hash Table indices synchronized.
 * Time Complexity: O(log N)
 */
bool heap_extract_max(IndexedMaxHeap *heap, HashTable *ht, Passenger *out) {
    return heap_remove_at(heap, ht, 0, out);
}

/*
 * Remove an arbitrary node at 'index' (obtained in O(1) from the Hash Table)
 * and re-heapify in either direction (upward or downward) in O(log N).
 * Time Complexity: O(log N)
 */
bool heap_remove_at(IndexedMaxHeap *heap, HashTable *ht, int index, Passenger *out) {
    if (heap->size == 0 || index < 0 || index >= heap->size) {
        return false;
    }

    if (out != NULL) {
        *out = heap->nodes[index].data;
    }

    int last = heap->size - 1;
    if (index == last) {
        heap->size--;
        return true;
    }

    /* Move last node into the vacated slot and update its Hash Table index */
    heap->nodes[index] = heap->nodes[last];
    heap->size--;

    if (ht != NULL) {
        ht_update_heap_index(ht, heap->nodes[index].data.pnr, index);
    }

    /* Replacement node could have higher OR lower priority than its new parent */
    int parent = (index - 1) / 2;
    if (index > 0 && heap_compare(&heap->nodes[index].data, &heap->nodes[parent].data) > 0) {
        heap_sift_up(heap, ht, index);
    } else {
        heap_sift_down(heap, ht, index);
    }

    return true;
}

/*
 * Compute the 1-based exact Waiting List priority rank of the element at 'index'
 * by counting how many passengers in the waiting heap outrank it.
 * Note: PNR lookup itself is O(1); rank computation is O(N) only when displaying WL rank.
 */
int heap_compute_priority_rank(const IndexedMaxHeap *heap, int index) {
    if (index < 0 || index >= heap->size) {
        return -1;
    }
    int rank = 1;
    const Passenger *target = &heap->nodes[index].data;
    for (int i = 0; i < heap->size; i++) {
        if (i != index && heap_compare(&heap->nodes[i].data, target) > 0) {
            rank++;
        }
    }
    return rank;
}

void heap_free(IndexedMaxHeap *heap) {
    heap->size = 0;
}
