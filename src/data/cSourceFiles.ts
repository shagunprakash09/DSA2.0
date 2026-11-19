export interface CSourceFile {
  path: string;
  label: string;
  role: string;
  content: string;
}

export const C_SOURCE_FILES: CSourceFile[] = [
  {
    path: 'include/railway.h',
    label: 'railway.h',
    role: 'Core structs, constants, and module prototypes',
    content: `#ifndef RAILWAY_H
#define RAILWAY_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

#define MAX_CONFIRMED     5
#define MAX_RAC           2
#define HEAP_CAPACITY     128
#define HASH_TABLE_SIZE   101     /* Prime bucket count for uniform hashing */
#define MAX_NAME_LEN      64
#define PNR_MIN           100000
#define PNR_MAX           999999

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
    int           slot_number;    /* Berth # (1..5), RAC # (1..2), or 0 for WL */
} Passenger;

/* 1. Doubly Linked List */
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

/* 2. Indexed Max-Heap */
typedef struct {
    Passenger data;
} HeapNode;

typedef struct {
    HeapNode nodes[HEAP_CAPACITY];
    int      size;
    int      capacity;
} IndexedMaxHeap;

/* 3. Hash Table (Separate Chaining) */
typedef struct HashEntry {
    int               pnr;
    BookingStatus     status;
    DLLNode          *dll_node;    /* Non-NULL when CONFIRMED or RAC */
    int               heap_index;  /* Valid [0..size-1] when WAITING, else -1 */
    struct HashEntry *next;
} HashEntry;

typedef struct {
    HashEntry *buckets[HASH_TABLE_SIZE];
    int        count;
} HashTable;

typedef struct {
    DoublyLinkedList confirmed_list;
    DoublyLinkedList rac_list;
    IndexedMaxHeap   waiting_heap;
    HashTable        pnr_table;
    bool             confirmed_berths[MAX_CONFIRMED + 1];
    bool             rac_slots[MAX_RAC + 1];
    long             clock_seq;
    unsigned int     rng_state;
} RailwaySystem;

void     dll_init(DoublyLinkedList *list, int capacity);
DLLNode *dll_push_back(DoublyLinkedList *list, Passenger p);
bool     dll_pop_front(DoublyLinkedList *list, Passenger *out);
bool     dll_remove_node(DoublyLinkedList *list, DLLNode *node, Passenger *out);
void     dll_free(DoublyLinkedList *list);

void       ht_init(HashTable *ht);
int        ht_hash(int pnr);
bool       ht_insert(HashTable *ht, int pnr, BookingStatus status, DLLNode *dll_node, int heap_index);
HashEntry *ht_search(const HashTable *ht, int pnr);
bool       ht_update(HashTable *ht, int pnr, BookingStatus status, DLLNode *dll_node, int heap_index);
bool       ht_update_heap_index(HashTable *ht, int pnr, int new_heap_index);
bool       ht_remove(HashTable *ht, int pnr);
void       ht_free(HashTable *ht);

void heap_init(IndexedMaxHeap *heap, int capacity);
int  heap_compare(const Passenger *a, const Passenger *b);
bool heap_insert(IndexedMaxHeap *heap, HashTable *ht, Passenger p);
bool heap_extract_max(IndexedMaxHeap *heap, HashTable *ht, Passenger *out);
bool heap_remove_at(IndexedMaxHeap *heap, HashTable *ht, int index, Passenger *out);
int  heap_compute_priority_rank(const IndexedMaxHeap *heap, int index);
void heap_free(IndexedMaxHeap *heap);

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

#endif /* RAILWAY_H */`,
  },
  {
    path: 'src/dll.c',
    label: 'dll.c',
    role: 'O(1) Doubly Linked List for Confirmed & RAC lists',
    content: `#include "../include/railway.h"

void dll_init(DoublyLinkedList *list, int capacity) {
    list->head = NULL;
    list->tail = NULL;
    list->size = 0;
    list->capacity = capacity;
}

DLLNode *dll_push_back(DoublyLinkedList *list, Passenger p) {
    if (list->size >= list->capacity) {
        return NULL;
    }
    DLLNode *node = (DLLNode *)malloc(sizeof(DLLNode));
    if (!node) {
        fprintf(stderr, "Error: Memory allocation failed in dll_push_back.\\n");
        return NULL;
    }
    node->data = p;
    node->prev = list->tail;
    node->next = NULL;

    if (list->tail != NULL) {
        list->tail->next = node;
    } else {
        list->head = node;
    }
    list->tail = node;
    list->size++;
    return node;
}

bool dll_pop_front(DoublyLinkedList *list, Passenger *out) {
    if (list->head == NULL) {
        return false;
    }
    DLLNode *front = list->head;
    if (out != NULL) {
        *out = front->data;
    }
    list->head = front->next;
    if (list->head != NULL) {
        list->head->prev = NULL;
    } else {
        list->tail = NULL;
    }
    free(front);
    list->size--;
    return true;
}

bool dll_remove_node(DoublyLinkedList *list, DLLNode *node, Passenger *out) {
    if (list == NULL || node == NULL || list->size == 0) {
        return false;
    }
    if (out != NULL) {
        *out = node->data;
    }
    if (node->prev != NULL) {
        node->prev->next = node->next;
    } else {
        list->head = node->next;
    }
    if (node->next != NULL) {
        node->next->prev = node->prev;
    } else {
        list->tail = node->prev;
    }
    free(node);
    list->size--;
    return true;
}

void dll_free(DoublyLinkedList *list) {
    DLLNode *curr = list->head;
    while (curr != NULL) {
        DLLNode *next = curr->next;
        free(curr);
        curr = next;
    }
    list->head = NULL;
    list->tail = NULL;
    list->size = 0;
}`,
  },
  {
    path: 'src/heap.c',
    label: 'heap.c',
    role: 'Indexed Max-Heap with Hash Table index synchronization',
    content: `#include "../include/railway.h"

void heap_init(IndexedMaxHeap *heap, int capacity) {
    heap->size = 0;
    heap->capacity = (capacity > HEAP_CAPACITY) ? HEAP_CAPACITY : capacity;
}

/* Primary: Quota (1=VIP < 2=Tatkal < 3=Senior < 4=General). Secondary: Earlier timestamp */
int heap_compare(const Passenger *a, const Passenger *b) {
    if ((int)a->quota != (int)b->quota) {
        return ((int)b->quota - (int)a->quota);
    }
    if (a->timestamp != b->timestamp) {
        return (a->timestamp < b->timestamp) ? 1 : -1;
    }
    return 0;
}

static void heap_swap(IndexedMaxHeap *heap, HashTable *ht, int i, int j) {
    if (i == j) return;
    HeapNode temp = heap->nodes[i];
    heap->nodes[i] = heap->nodes[j];
    heap->nodes[j] = temp;

    if (ht != NULL) {
        ht_update_heap_index(ht, heap->nodes[i].data.pnr, i);
        ht_update_heap_index(ht, heap->nodes[j].data.pnr, j);
    }
}

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

bool heap_insert(IndexedMaxHeap *heap, HashTable *ht, Passenger p) {
    if (heap->size >= heap->capacity) return false;
    int idx = heap->size;
    heap->nodes[idx].data = p;
    heap->size++;
    if (ht != NULL) {
        ht_update_heap_index(ht, p.pnr, idx);
    }
    heap_sift_up(heap, ht, idx);
    return true;
}

bool heap_extract_max(IndexedMaxHeap *heap, HashTable *ht, Passenger *out) {
    return heap_remove_at(heap, ht, 0, out);
}

bool heap_remove_at(IndexedMaxHeap *heap, HashTable *ht, int index, Passenger *out) {
    if (heap->size == 0 || index < 0 || index >= heap->size) return false;
    if (out != NULL) *out = heap->nodes[index].data;

    int last = heap->size - 1;
    if (index == last) {
        heap->size--;
        return true;
    }

    heap->nodes[index] = heap->nodes[last];
    heap->size--;
    if (ht != NULL) {
        ht_update_heap_index(ht, heap->nodes[index].data.pnr, index);
    }

    int parent = (index - 1) / 2;
    if (index > 0 && heap_compare(&heap->nodes[index].data, &heap->nodes[parent].data) > 0) {
        heap_sift_up(heap, ht, index);
    } else {
        heap_sift_down(heap, ht, index);
    }
    return true;
}

int heap_compute_priority_rank(const IndexedMaxHeap *heap, int index) {
    if (index < 0 || index >= heap->size) return -1;
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
}`,
  },
  {
    path: 'src/hashtable.c',
    label: 'hashtable.c',
    role: 'Separate Chaining Hash Table for O(1) PNR lookup',
    content: `#include "../include/railway.h"

void ht_init(HashTable *ht) {
    for (int i = 0; i < HASH_TABLE_SIZE; i++) {
        ht->buckets[i] = NULL;
    }
    ht->count = 0;
}

int ht_hash(int pnr) {
    int h = pnr % HASH_TABLE_SIZE;
    return (h < 0) ? (h + HASH_TABLE_SIZE) : h;
}

bool ht_insert(HashTable *ht, int pnr, BookingStatus status, DLLNode *dll_node, int heap_index) {
    if (ht_search(ht, pnr) != NULL) return false;
    int bucket = ht_hash(pnr);
    HashEntry *entry = (HashEntry *)malloc(sizeof(HashEntry));
    if (!entry) return false;

    entry->pnr = pnr;
    entry->status = status;
    entry->dll_node = dll_node;
    entry->heap_index = heap_index;
    entry->next = ht->buckets[bucket];
    ht->buckets[bucket] = entry;
    ht->count++;
    return true;
}

HashEntry *ht_search(const HashTable *ht, int pnr) {
    int bucket = ht_hash(pnr);
    HashEntry *curr = ht->buckets[bucket];
    while (curr != NULL) {
        if (curr->pnr == pnr) return curr;
        curr = curr->next;
    }
    return NULL;
}

bool ht_update(HashTable *ht, int pnr, BookingStatus status, DLLNode *dll_node, int heap_index) {
    HashEntry *entry = ht_search(ht, pnr);
    if (!entry) return false;
    entry->status = status;
    entry->dll_node = dll_node;
    entry->heap_index = heap_index;
    return true;
}

bool ht_update_heap_index(HashTable *ht, int pnr, int new_heap_index) {
    HashEntry *entry = ht_search(ht, pnr);
    if (!entry) return false;
    entry->heap_index = new_heap_index;
    return true;
}

bool ht_remove(HashTable *ht, int pnr) {
    int bucket = ht_hash(pnr);
    HashEntry *curr = ht->buckets[bucket];
    HashEntry *prev = NULL;
    while (curr != NULL) {
        if (curr->pnr == pnr) {
            if (prev != NULL) prev->next = curr->next;
            else ht->buckets[bucket] = curr->next;
            free(curr);
            ht->count--;
            return true;
        }
        prev = curr;
        curr = curr->next;
    }
    return false;
}

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
}`,
  },
  {
    path: 'src/reservation.c',
    label: 'reservation.c',
    role: 'Booking, Cascade Cancellation, PNR Status, Charts & Preload',
    content: `#include "../include/railway.h"

static int acquire_slot(bool occupied[], int max_slots) {
    for (int s = 1; s <= max_slots; s++) {
        if (!occupied[s]) {
            occupied[s] = true;
            return s;
        }
    }
    return 0;
}

static void release_slot(bool occupied[], int max_slots, int slot) {
    if (slot >= 1 && slot <= max_slots) occupied[slot] = false;
}

static int generate_unique_pnr(RailwaySystem *sys) {
    int pnr;
    do {
        sys->rng_state = sys->rng_state * 1103515245u + 12345u;
        unsigned int r = (sys->rng_state >> 16) & 0x7FFFu;
        sys->rng_state = sys->rng_state * 1103515245u + 12345u;
        unsigned int r2 = (sys->rng_state >> 16) & 0x7FFFu;
        pnr = PNR_MIN + (int)(((r << 15) ^ r2) % (PNR_MAX - PNR_MIN + 1));
    } while (ht_search(&sys->pnr_table, pnr) != NULL);
    return pnr;
}

const char *quota_to_string(QuotaType quota) {
    switch (quota) {
        case QUOTA_VIP:     return "VIP/Emergency";
        case QUOTA_TATKAL:  return "Tatkal";
        case QUOTA_SENIOR:  return "Senior Citizen";
        case QUOTA_GENERAL: return "General";
        default:            return "Unknown";
    }
}

const char *status_to_string(BookingStatus status) {
    switch (status) {
        case STATUS_CONFIRMED: return "CONFIRMED";
        case STATUS_RAC:       return "RAC";
        case STATUS_WAITING:   return "WAITING";
        default:               return "UNKNOWN";
    }
}

void system_init(RailwaySystem *sys) {
    dll_init(&sys->confirmed_list, MAX_CONFIRMED);
    dll_init(&sys->rac_list, MAX_RAC);
    heap_init(&sys->waiting_heap, HEAP_CAPACITY);
    ht_init(&sys->pnr_table);
    for (int i = 0; i <= MAX_CONFIRMED; i++) sys->confirmed_berths[i] = false;
    for (int i = 0; i <= MAX_RAC; i++) sys->rac_slots[i] = false;
    sys->clock_seq = 1;
    sys->rng_state = 20261118u;
}

void system_free(RailwaySystem *sys) {
    dll_free(&sys->confirmed_list);
    dll_free(&sys->rac_list);
    heap_free(&sys->waiting_heap);
    ht_free(&sys->pnr_table);
}

int book_ticket(RailwaySystem *sys, const char *name, int age, QuotaType quota) {
    if (!name || strlen(name) == 0 || age <= 0 || quota < QUOTA_VIP || quota > QUOTA_GENERAL) {
        return -1;
    }
    Passenger p;
    p.pnr = generate_unique_pnr(sys);
    strncpy(p.name, name, MAX_NAME_LEN - 1);
    p.name[MAX_NAME_LEN - 1] = '\\0';
    p.age = age;
    p.quota = quota;
    p.timestamp = sys->clock_seq++;

    if (sys->confirmed_list.size < sys->confirmed_list.capacity) {
        p.status = STATUS_CONFIRMED;
        p.slot_number = acquire_slot(sys->confirmed_berths, MAX_CONFIRMED);
        DLLNode *node = dll_push_back(&sys->confirmed_list, p);
        ht_insert(&sys->pnr_table, p.pnr, STATUS_CONFIRMED, node, -1);
    } else if (sys->rac_list.size < sys->rac_list.capacity) {
        p.status = STATUS_RAC;
        p.slot_number = acquire_slot(sys->rac_slots, MAX_RAC);
        DLLNode *node = dll_push_back(&sys->rac_list, p);
        ht_insert(&sys->pnr_table, p.pnr, STATUS_RAC, node, -1);
    } else {
        p.status = STATUS_WAITING;
        p.slot_number = 0;
        ht_insert(&sys->pnr_table, p.pnr, STATUS_WAITING, NULL, -1);
        heap_insert(&sys->waiting_heap, &sys->pnr_table, p);
    }
    return p.pnr;
}

bool cancel_ticket(RailwaySystem *sys, int pnr) {
    HashEntry *entry = ht_search(&sys->pnr_table, pnr);
    if (!entry) return false;

    Passenger cancelled;
    if (entry->status == STATUS_CONFIRMED) {
        dll_remove_node(&sys->confirmed_list, entry->dll_node, &cancelled);
        int freed_berth = cancelled.slot_number;
        ht_remove(&sys->pnr_table, pnr);

        Passenger promoted_rac;
        if (dll_pop_front(&sys->rac_list, &promoted_rac)) {
            int freed_rac = promoted_rac.slot_number;
            promoted_rac.status = STATUS_CONFIRMED;
            promoted_rac.slot_number = freed_berth;
            DLLNode *conf_node = dll_push_back(&sys->confirmed_list, promoted_rac);
            ht_update(&sys->pnr_table, promoted_rac.pnr, STATUS_CONFIRMED, conf_node, -1);

            Passenger promoted_wl;
            if (heap_extract_max(&sys->waiting_heap, &sys->pnr_table, &promoted_wl)) {
                promoted_wl.status = STATUS_RAC;
                promoted_wl.slot_number = freed_rac;
                DLLNode *rac_node = dll_push_back(&sys->rac_list, promoted_wl);
                ht_update(&sys->pnr_table, promoted_wl.pnr, STATUS_RAC, rac_node, -1);
            } else {
                release_slot(sys->rac_slots, MAX_RAC, freed_rac);
            }
        } else {
            release_slot(sys->confirmed_berths, MAX_CONFIRMED, freed_berth);
        }
    } else if (entry->status == STATUS_RAC) {
        dll_remove_node(&sys->rac_list, entry->dll_node, &cancelled);
        int freed_rac = cancelled.slot_number;
        ht_remove(&sys->pnr_table, pnr);

        Passenger promoted_wl;
        if (heap_extract_max(&sys->waiting_heap, &sys->pnr_table, &promoted_wl)) {
            promoted_wl.status = STATUS_RAC;
            promoted_wl.slot_number = freed_rac;
            DLLNode *rac_node = dll_push_back(&sys->rac_list, promoted_wl);
            ht_update(&sys->pnr_table, promoted_wl.pnr, STATUS_RAC, rac_node, -1);
        } else {
            release_slot(sys->rac_slots, MAX_RAC, freed_rac);
        }
    } else {
        int heap_idx = entry->heap_index;
        heap_remove_at(&sys->waiting_heap, &sys->pnr_table, heap_idx, &cancelled);
        ht_remove(&sys->pnr_table, pnr);
    }
    return true;
}

static void write_csv_escaped(FILE *fp, const char *text) {
    fputc('"', fp);
    for (const char *ch = text; *ch != '\\0'; ch++) {
        if (*ch == '"') fputc('"', fp);
        fputc(*ch, fp);
    }
    fputc('"', fp);
}

bool export_passenger_manifest(const RailwaySystem *sys, const char *filename) {
    if (!sys || !filename) return false;
    FILE *fp = fopen(filename, "w");
    if (!fp) return false;

    fprintf(fp, "Status,Assignment,PNR,Passenger Name,Age,Quota,Booking Sequence,Hash Bucket,Heap Index\\n");
    for (const DLLNode *c = sys->confirmed_list.head; c != NULL; c = c->next) {
        const Passenger *p = &c->data;
        fprintf(fp, "CONFIRMED,B-%02d,%d,", p->slot_number, p->pnr);
        write_csv_escaped(fp, p->name);
        fprintf(fp, ",%d,", p->age);
        write_csv_escaped(fp, quota_to_string(p->quota));
        fprintf(fp, ",T-%04ld,%d,-1\\n", p->timestamp, ht_hash(p->pnr));
    }
    for (const DLLNode *r = sys->rac_list.head; r != NULL; r = r->next) {
        const Passenger *p = &r->data;
        fprintf(fp, "RAC,RAC-%02d,%d,", p->slot_number, p->pnr);
        write_csv_escaped(fp, p->name);
        fprintf(fp, ",%d,", p->age);
        write_csv_escaped(fp, quota_to_string(p->quota));
        fprintf(fp, ",T-%04ld,%d,-1\\n", p->timestamp, ht_hash(p->pnr));
    }
    int n = sys->waiting_heap.size;
    int indices[HEAP_CAPACITY];
    for (int i = 0; i < n; i++) indices[i] = i;
    for (int i = 0; i < n - 1; i++) {
        for (int j = i + 1; j < n; j++) {
            if (heap_compare(&sys->waiting_heap.nodes[indices[j]].data,
                             &sys->waiting_heap.nodes[indices[i]].data) > 0) {
                int tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
            }
        }
    }
    for (int r = 0; r < n; r++) {
        int idx = indices[r];
        const Passenger *p = &sys->waiting_heap.nodes[idx].data;
        fprintf(fp, "WAITING,WL-%d,%d,", r + 1, p->pnr);
        write_csv_escaped(fp, p->name);
        fprintf(fp, ",%d,", p->age);
        write_csv_escaped(fp, quota_to_string(p->quota));
        fprintf(fp, ",T-%04ld,%d,%d\\n", p->timestamp, ht_hash(p->pnr), idx);
    }
    fclose(fp);
    return true;
}`,
  },
  {
    path: 'src/main.c',
    label: 'main.c',
    role: 'Interactive CLI menu loop',
    content: `#include "../include/railway.h"

static void clear_stdin_line(void) {
    int c;
    while ((c = getchar()) != '\\n' && c != EOF) {}
}

int main(void) {
    RailwaySystem sys;
    system_init(&sys);

    int choice = 0;
    while (true) {
        printf("\\n1. Book Ticket\\n2. Cancel Ticket by PNR\\n3. Check PNR Status\\n");
        printf("4. Display All Charts\\n5. Preload Sample Data\\n6. Export CSV Manifest\\n7. Exit\\nSelect: ");
        if (scanf("%d", &choice) != 1) {
            clear_stdin_line();
            continue;
        }
        clear_stdin_line();

        if (choice == 1) {
            char name[MAX_NAME_LEN];
            int age = 0, quota = 4;
            printf("Name: ");
            if (!fgets(name, sizeof(name), stdin)) continue;
            name[strcspn(name, "\\n")] = '\\0';
            printf("Age: ");
            if (scanf("%d", &age) != 1) { clear_stdin_line(); continue; }
            clear_stdin_line();
            printf("Quota (1=VIP, 2=Tatkal, 3=Senior, 4=General): ");
            if (scanf("%d", &quota) != 1) { clear_stdin_line(); continue; }
            clear_stdin_line();
            int pnr = book_ticket(&sys, name, age, (QuotaType)quota);
            if (pnr > 0) check_pnr_status(&sys, pnr);
        } else if (choice == 2) {
            int pnr = 0;
            printf("Enter PNR: ");
            if (scanf("%d", &pnr) == 1) cancel_ticket(&sys, pnr);
            clear_stdin_line();
        } else if (choice == 3) {
            int pnr = 0;
            printf("Enter PNR: ");
            if (scanf("%d", &pnr) == 1) check_pnr_status(&sys, pnr);
            clear_stdin_line();
        } else if (choice == 4) {
            display_all_charts(&sys);
        } else if (choice == 5) {
            preload_sample_data(&sys);
            display_all_charts(&sys);
        } else if (choice == 6) {
            export_passenger_manifest(&sys, "passenger_manifest.csv");
        } else if (choice == 7) {
            break;
        }
    }
    system_free(&sys);
    return 0;
}`,
  },
  {
    path: 'Makefile',
    label: 'Makefile',
    role: 'GCC C11 build configuration (-Wall -Wextra -Werror)',
    content: `CC      = gcc
CFLAGS  = -Wall -Wextra -Werror -std=c11 -O2 -Iinclude
TARGET  = railway_reservation
SRCS    = src/main.c src/dll.c src/heap.c src/hashtable.c src/reservation.c

all: $(TARGET)

$(TARGET): $(SRCS) include/railway.h
\t$(CC) $(CFLAGS) $(SRCS) -o $(TARGET)

clean:
\trm -f $(TARGET)`,
  },
];

export const SAMPLE_CLI_TRANSCRIPT = `Preloading 10 sample passengers across all quotas...
  Booked PNR 779758 | Aarav Sharma     | General        -> CONFIRMED
  Booked PNR 649622 | Meera Nair       | Senior Citizen -> CONFIRMED
  Booked PNR 867882 | Rohan Verma      | Tatkal         -> CONFIRMED
  Booked PNR 341427 | Kavita Iyer      | General        -> CONFIRMED
  Booked PNR 223778 | Vikram Malhotra  | VIP/Emergency  -> CONFIRMED
  Booked PNR 543843 | Suresh Kulkarni  | Senior Citizen -> RAC
  Booked PNR 538465 | Ananya Gupta     | General        -> RAC
  Booked PNR 798267 | Devika Menon     | General        -> WAITING
  Booked PNR 475162 | Rajeshwar Rao    | Senior Citizen -> WAITING
  Booked PNR 932251 | Priya Deshmukh   | VIP/Emergency  -> WAITING

> Cancel PNR 649622 (Confirmed Berth #2)
Cancelled CONFIRMED PNR 649622 (Meera Nair, Berth #2).
  -> Promoted RAC PNR 543843 (Suresh Kulkarni) to CONFIRMED Berth #2.
  -> Promoted WL PNR 932251 (Priya Deshmukh, VIP/Emergency) to RAC Slot #1.

> Cancel PNR 475162 (Middle of Waiting List Heap)
Cancelled WAITING PNR 475162 (Rajeshwar Rao, Senior Citizen) from Heap Index [1] in O(log N).

> Check PNR Status: 798267
--- PNR STATUS LOOKUP (Hash Bucket #95) ---
PNR Number : 798267
Passenger  : Devika Menon (Age 39)
Quota      : General (Priority 4)
Status     : WAITING LIST (Priority Rank #1 | Heap Index [0] | Seq #8)`;
