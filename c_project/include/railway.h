#ifndef RAILWAY_H
#define RAILWAY_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

/* ============================================================================
 * CONFIGURATION CONSTANTS
 * ============================================================================ */
#define MAX_CONFIRMED     5
#define MAX_RAC           2
#define HEAP_CAPACITY     128
#define HASH_TABLE_SIZE   101     /* Prime bucket count for uniform hashing */
#define MAX_NAME_LEN      64
#define PNR_MIN           100000
#define PNR_MAX           999999

/* ============================================================================
 * DOMAIN ENUMERATIONS & CORE PASSENGER RECORD
 * ============================================================================ */
typedef enum {
    QUOTA_VIP     = 1,  /* Highest priority: VIP / Emergency */
    QUOTA_TATKAL  = 2,  /* Tatkal                            */
    QUOTA_SENIOR  = 3,  /* Senior Citizen                    */
    QUOTA_GENERAL = 4   /* Lowest priority: General          */
} QuotaType;

typedef enum {
    STATUS_CONFIRMED = 1,
    STATUS_RAC       = 2,
    STATUS_WAITING   = 3
} BookingStatus;

typedef struct {
    int           pnr;
    char          name[MAX_NAME_LEN];
    int           age;
    QuotaType     quota;
    long          timestamp;      /* Monotonic sequence for FIFO tie-breaking */
    BookingStatus status;
    int           slot_number;    /* Berth # (1..5) for Confirmed, RAC # (1..2) for RAC, 0 for WL */
} Passenger;

/* ============================================================================
 * 1. DOUBLY LINKED LIST (Confirmed Berths & RAC Slots)
 * ============================================================================ */
typedef struct DLLNode {
    Passenger       data;
    struct DLLNode *prev;
    struct DLLNode *next;
} DLLNode;

typedef struct {
    DLLNode *head;
    DLLNode *tail;
    int      size;
    int      capacity;
} DoublyLinkedList;

/* ============================================================================
 * 2. INDEXED MAX-HEAP (Priority Waiting List)
 * ============================================================================ */
typedef struct {
    Passenger data;
} HeapNode;

typedef struct {
    HeapNode nodes[HEAP_CAPACITY];
    int      size;
    int      capacity;
} IndexedMaxHeap;

/* ============================================================================
 * 3. HASH TABLE WITH SEPARATE CHAINING (O(1) PNR Lookup & Index Mapping)
 * ============================================================================ */
typedef struct HashEntry {
    int               pnr;
    BookingStatus     status;
    DLLNode          *dll_node;    /* Non-NULL when status is CONFIRMED or RAC */
    int               heap_index;  /* Valid index [0..size-1] when WAITING, else -1 */
    struct HashEntry *next;
} HashEntry;

typedef struct {
    HashEntry *buckets[HASH_TABLE_SIZE];
    int        count;
} HashTable;

/* ============================================================================
 * UNIFIED RAILWAY RESERVATION SYSTEM CONTEXT
 * ============================================================================ */
typedef struct {
    DoublyLinkedList confirmed_list;
    DoublyLinkedList rac_list;
    IndexedMaxHeap   waiting_heap;
    HashTable        pnr_table;
    bool             confirmed_berths[MAX_CONFIRMED + 1]; /* 1-indexed berth occupancy */
    bool             rac_slots[MAX_RAC + 1];            /* 1-indexed RAC slot occupancy */
    long             clock_seq;
    unsigned int     rng_state;
} RailwaySystem;

/* ============================================================================
 * DOUBLY LINKED LIST PROTOTYPES (src/dll.c)
 * ============================================================================ */
void     dll_init(DoublyLinkedList *list, int capacity);
DLLNode *dll_push_back(DoublyLinkedList *list, Passenger p);
bool     dll_pop_front(DoublyLinkedList *list, Passenger *out);
bool     dll_remove_node(DoublyLinkedList *list, DLLNode *node, Passenger *out);
void     dll_free(DoublyLinkedList *list);

/* ============================================================================
 * HASH TABLE PROTOTYPES (src/hashtable.c)
 * ============================================================================ */
void       ht_init(HashTable *ht);
int        ht_hash(int pnr);
bool       ht_insert(HashTable *ht, int pnr, BookingStatus status, DLLNode *dll_node, int heap_index);
HashEntry *ht_search(const HashTable *ht, int pnr);
bool       ht_update(HashTable *ht, int pnr, BookingStatus status, DLLNode *dll_node, int heap_index);
bool       ht_update_heap_index(HashTable *ht, int pnr, int new_heap_index);
bool       ht_remove(HashTable *ht, int pnr);
void       ht_free(HashTable *ht);

/* ============================================================================
 * INDEXED MAX-HEAP PROTOTYPES (src/heap.c)
 * ============================================================================ */
void heap_init(IndexedMaxHeap *heap, int capacity);
int  heap_compare(const Passenger *a, const Passenger *b);
bool heap_insert(IndexedMaxHeap *heap, HashTable *ht, Passenger p);
bool heap_extract_max(IndexedMaxHeap *heap, HashTable *ht, Passenger *out);
bool heap_remove_at(IndexedMaxHeap *heap, HashTable *ht, int index, Passenger *out);
int  heap_compute_priority_rank(const IndexedMaxHeap *heap, int index);
void heap_free(IndexedMaxHeap *heap);

/* ============================================================================
 * RESERVATION SYSTEM OPERATIONS (src/reservation.c)
 * ============================================================================ */
void        system_init(RailwaySystem *sys);
void        system_free(RailwaySystem *sys);
int         book_ticket(RailwaySystem *sys, const char *name, int age, QuotaType quota);
bool        cancel_ticket(RailwaySystem *sys, int pnr);
void        check_pnr_status(const RailwaySystem *sys, int pnr);
void        display_all_charts(const RailwaySystem *sys);
bool        export_passenger_manifest(const RailwaySystem *sys, const char *filename);
void        preload_sample_data(RailwaySystem *sys);
const char *quota_to_string(QuotaType quota);
const char *status_to_string(BookingStatus status);

#endif /* RAILWAY_H */
