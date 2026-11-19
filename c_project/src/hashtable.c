#include "../include/railway.h"

/*
 * Initialize an empty Hash Table using Separate Chaining.
 * Time Complexity: O(M) where M = HASH_TABLE_SIZE
 */
void ht_init(HashTable *ht) {
    for (int i = 0; i < HASH_TABLE_SIZE; i++) {
        ht->buckets[i] = NULL;
    }
    ht->count = 0;
}

/*
 * Compute bucket index for a 6-digit PNR using modulo prime hashing.
 * Time Complexity: O(1)
 */
int ht_hash(int pnr) {
    int h = pnr % HASH_TABLE_SIZE;
    return (h < 0) ? (h + HASH_TABLE_SIZE) : h;
}

/*
 * Insert a new PNR -> location mapping into the Hash Table.
 * Inserts at bucket head for O(1) insertion.
 * Average Time Complexity: O(1)
 */
bool ht_insert(HashTable *ht, int pnr, BookingStatus status, DLLNode *dll_node, int heap_index) {
    if (ht_search(ht, pnr) != NULL) {
        return false; /* Duplicate PNR guard */
    }

    int bucket = ht_hash(pnr);
    HashEntry *entry = (HashEntry *)malloc(sizeof(HashEntry));
    if (!entry) {
        fprintf(stderr, "Error: Memory allocation failed in ht_insert.\n");
        return false;
    }

    entry->pnr = pnr;
    entry->status = status;
    entry->dll_node = dll_node;
    entry->heap_index = heap_index;
    entry->next = ht->buckets[bucket];
    ht->buckets[bucket] = entry;
    ht->count++;

    return true;
}

/*
 * Look up a PNR in the Hash Table.
 * Average Time Complexity: O(1)
 */
HashEntry *ht_search(const HashTable *ht, int pnr) {
    int bucket = ht_hash(pnr);
    HashEntry *curr = ht->buckets[bucket];
    while (curr != NULL) {
        if (curr->pnr == pnr) {
            return curr;
        }
        curr = curr->next;
    }
    return NULL;
}

/*
 * Update status and location pointer/index when a passenger is promoted
 * (e.g., Waiting List -> RAC or RAC -> Confirmed).
 * Average Time Complexity: O(1)
 */
bool ht_update(HashTable *ht, int pnr, BookingStatus status, DLLNode *dll_node, int heap_index) {
    HashEntry *entry = ht_search(ht, pnr);
    if (entry == NULL) {
        return false;
    }
    entry->status = status;
    entry->dll_node = dll_node;
    entry->heap_index = heap_index;
    return true;
}

/*
 * Synchronize only the heap_index field during heap swaps / heapify operations.
 * Average Time Complexity: O(1)
 */
bool ht_update_heap_index(HashTable *ht, int pnr, int new_heap_index) {
    HashEntry *entry = ht_search(ht, pnr);
    if (entry == NULL) {
        return false;
    }
    entry->heap_index = new_heap_index;
    return true;
}

/*
 * Remove a PNR entry from its bucket chain upon cancellation.
 * Average Time Complexity: O(1)
 */
bool ht_remove(HashTable *ht, int pnr) {
    int bucket = ht_hash(pnr);
    HashEntry *curr = ht->buckets[bucket];
    HashEntry *prev = NULL;

    while (curr != NULL) {
        if (curr->pnr == pnr) {
            if (prev != NULL) {
                prev->next = curr->next;
            } else {
                ht->buckets[bucket] = curr->next;
            }
            free(curr);
            ht->count--;
            return true;
        }
        prev = curr;
        curr = curr->next;
    }
    return false;
}

/*
 * Free all chained entries in the Hash Table.
 * Time Complexity: O(M + N)
 */
void ht_free(HashTable *ht) {
    for (int i = 0; i < HASH_TABLE_SIZE; i++) {
        HashEntry *curr = ht->buckets[i];
        while (curr != NULL) {
            HashEntry *next = curr->next;
            free(curr);
            curr = next;
        }
        ht->buckets[i] = NULL;
    }
    ht->count = 0;
}
