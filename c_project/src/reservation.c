#include "../include/railway.h"

/*
 * Helper: Allocate lowest available slot number in 1..max_slots.
 */
static int acquire_slot(bool occupied[], int max_slots) {
    for (int s = 1; s <= max_slots; s++) {
        if (!occupied[s]) {
            occupied[s] = true;
            return s;
        }
    }
    return 0;
}

/*
 * Helper: Release a physical berth or RAC slot upon cancellation.
 */
static void release_slot(bool occupied[], int max_slots, int slot) {
    if (slot >= 1 && slot <= max_slots) {
        occupied[slot] = false;
    }
}

/*
 * Helper: Deterministic 6-digit pseudo-random PNR generator that guarantees
 * uniqueness via O(1) Hash Table collision check.
 */
static int generate_unique_pnr(RailwaySystem *sys) {
    int pnr;
    do {
        sys->rng_state = sys->rng_state * 1103515245u + 12345u;
        unsigned int r = (sys->rng_state >> 16) & 0x7FFFu;
        sys->rng_state = sys->rng_state * 1103515245u + 12345u;
        unsigned int r2 = (sys->rng_state >> 16) & 0x7FFFu;
        unsigned int combined = (r << 15) ^ r2;
        pnr = PNR_MIN + (int)(combined % (PNR_MAX - PNR_MIN + 1));
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

/*
 * Initialize all three core data structures and berth tracking arrays.
 */
void system_init(RailwaySystem *sys) {
    dll_init(&sys->confirmed_list, MAX_CONFIRMED);
    dll_init(&sys->rac_list, MAX_RAC);
    heap_init(&sys->waiting_heap, HEAP_CAPACITY);
    ht_init(&sys->pnr_table);

    for (int i = 0; i <= MAX_CONFIRMED; i++) {
        sys->confirmed_berths[i] = false;
    }
    for (int i = 0; i <= MAX_RAC; i++) {
        sys->rac_slots[i] = false;
    }

    sys->clock_seq = 1;
    sys->rng_state = 20261118u;
}

void system_free(RailwaySystem *sys) {
    dll_free(&sys->confirmed_list);
    dll_free(&sys->rac_list);
    heap_free(&sys->waiting_heap);
    ht_free(&sys->pnr_table);
}

/*
 * Book a ticket:
 *   1. Confirmed List (DLL) if confirmed_list.size < MAX_CONFIRMED
 *   2. RAC List (DLL)       if rac_list.size < MAX_RAC
 *   3. Priority Waiting List (Indexed Max-Heap) otherwise
 * Registers the generated 6-digit PNR in the Hash Table in O(1) average time.
 * Returns the generated PNR (> 0) on success, or -1 on failure.
 */
int book_ticket(RailwaySystem *sys, const char *name, int age, QuotaType quota) {
    if (!name || strlen(name) == 0 || age <= 0 || quota < QUOTA_VIP || quota > QUOTA_GENERAL) {
        return -1;
    }

    Passenger p;
    p.pnr = generate_unique_pnr(sys);
    strncpy(p.name, name, MAX_NAME_LEN - 1);
    p.name[MAX_NAME_LEN - 1] = '\0';
    p.age = age;
    p.quota = quota;
    p.timestamp = sys->clock_seq++;

    if (sys->confirmed_list.size < sys->confirmed_list.capacity) {
        p.status = STATUS_CONFIRMED;
        p.slot_number = acquire_slot(sys->confirmed_berths, MAX_CONFIRMED);
        DLLNode *node = dll_push_back(&sys->confirmed_list, p);
        if (!node) {
            release_slot(sys->confirmed_berths, MAX_CONFIRMED, p.slot_number);
            return -1;
        }
        ht_insert(&sys->pnr_table, p.pnr, STATUS_CONFIRMED, node, -1);
    } else if (sys->rac_list.size < sys->rac_list.capacity) {
        p.status = STATUS_RAC;
        p.slot_number = acquire_slot(sys->rac_slots, MAX_RAC);
        DLLNode *node = dll_push_back(&sys->rac_list, p);
        if (!node) {
            release_slot(sys->rac_slots, MAX_RAC, p.slot_number);
            return -1;
        }
        ht_insert(&sys->pnr_table, p.pnr, STATUS_RAC, node, -1);
    } else {
        p.status = STATUS_WAITING;
        p.slot_number = 0;
        if (sys->waiting_heap.size >= sys->waiting_heap.capacity) {
            return -1;
        }
        ht_insert(&sys->pnr_table, p.pnr, STATUS_WAITING, NULL, -1);
        if (!heap_insert(&sys->waiting_heap, &sys->pnr_table, p)) {
            ht_remove(&sys->pnr_table, p.pnr);
            return -1;
        }
    }

    return p.pnr;
}

/*
 * Cancel ticket by 6-digit PNR:
 *   - O(1) lookup via Hash Table.
 *   - Case A (CONFIRMED): Remove DLLNode in O(1), promote front RAC to vacated
 *     Confirmed berth in O(1), extract Max-Heap root into vacated RAC slot in O(log N).
 *   - Case B (RAC): Remove DLLNode in O(1), extract Max-Heap root into vacated RAC slot in O(log N).
 *   - Case C (WAITING): Remove at heap_index in O(log N) and re-heapify with synchronized HT.
 */
bool cancel_ticket(RailwaySystem *sys, int pnr) {
    HashEntry *entry = ht_search(&sys->pnr_table, pnr);
    if (entry == NULL) {
        printf("Cancellation failed: PNR %d not found.\n", pnr);
        return false;
    }

    Passenger cancelled;
    BookingStatus orig_status = entry->status;

    if (orig_status == STATUS_CONFIRMED) {
        if (!dll_remove_node(&sys->confirmed_list, entry->dll_node, &cancelled)) {
            return false;
        }
        int freed_berth = cancelled.slot_number;
        ht_remove(&sys->pnr_table, pnr);
        printf("Cancelled CONFIRMED PNR %d (%s, Berth #%d).\n",
               cancelled.pnr, cancelled.name, freed_berth);

        /* Promote front RAC passenger to Confirmed Berth */
        Passenger promoted_rac;
        if (dll_pop_front(&sys->rac_list, &promoted_rac)) {
            int freed_rac_slot = promoted_rac.slot_number;
            promoted_rac.status = STATUS_CONFIRMED;
            promoted_rac.slot_number = freed_berth;
            DLLNode *new_conf_node = dll_push_back(&sys->confirmed_list, promoted_rac);
            ht_update(&sys->pnr_table, promoted_rac.pnr, STATUS_CONFIRMED, new_conf_node, -1);
            printf("  -> Promoted RAC PNR %d (%s) to CONFIRMED Berth #%d.\n",
                   promoted_rac.pnr, promoted_rac.name, freed_berth);

            /* Extract highest-priority Waiting List passenger into freed RAC slot */
            Passenger promoted_wl;
            if (heap_extract_max(&sys->waiting_heap, &sys->pnr_table, &promoted_wl)) {
                promoted_wl.status = STATUS_RAC;
                promoted_wl.slot_number = freed_rac_slot;
                DLLNode *new_rac_node = dll_push_back(&sys->rac_list, promoted_wl);
                ht_update(&sys->pnr_table, promoted_wl.pnr, STATUS_RAC, new_rac_node, -1);
                printf("  -> Promoted WL PNR %d (%s, %s) to RAC Slot #%d.\n",
                       promoted_wl.pnr, promoted_wl.name,
                       quota_to_string(promoted_wl.quota), freed_rac_slot);
            } else {
                release_slot(sys->rac_slots, MAX_RAC, freed_rac_slot);
            }
        } else {
            release_slot(sys->confirmed_berths, MAX_CONFIRMED, freed_berth);
        }
    } else if (orig_status == STATUS_RAC) {
        if (!dll_remove_node(&sys->rac_list, entry->dll_node, &cancelled)) {
            return false;
        }
        int freed_rac_slot = cancelled.slot_number;
        ht_remove(&sys->pnr_table, pnr);
        printf("Cancelled RAC PNR %d (%s, RAC #%d).\n",
               cancelled.pnr, cancelled.name, freed_rac_slot);

        Passenger promoted_wl;
        if (heap_extract_max(&sys->waiting_heap, &sys->pnr_table, &promoted_wl)) {
            promoted_wl.status = STATUS_RAC;
            promoted_wl.slot_number = freed_rac_slot;
            DLLNode *new_rac_node = dll_push_back(&sys->rac_list, promoted_wl);
            ht_update(&sys->pnr_table, promoted_wl.pnr, STATUS_RAC, new_rac_node, -1);
            printf("  -> Promoted WL PNR %d (%s, %s) to RAC Slot #%d.\n",
                   promoted_wl.pnr, promoted_wl.name,
                   quota_to_string(promoted_wl.quota), freed_rac_slot);
        } else {
            release_slot(sys->rac_slots, MAX_RAC, freed_rac_slot);
        }
    } else if (orig_status == STATUS_WAITING) {
        int heap_idx = entry->heap_index;
        if (!heap_remove_at(&sys->waiting_heap, &sys->pnr_table, heap_idx, &cancelled)) {
            return false;
        }
        ht_remove(&sys->pnr_table, pnr);
        printf("Cancelled WAITING PNR %d (%s, %s) from Heap Index [%d] in O(log N).\n",
               cancelled.pnr, cancelled.name, quota_to_string(cancelled.quota), heap_idx);
    }

    return true;
}

/*
 * Check exact PNR status in O(1) average time via the Hash Table.
 */
void check_pnr_status(const RailwaySystem *sys, int pnr) {
    HashEntry *entry = ht_search(&sys->pnr_table, pnr);
    if (entry == NULL) {
        printf("\nPNR %d: NOT FOUND in reservation records.\n", pnr);
        return;
    }

    int bucket = ht_hash(pnr);
    printf("\n--- PNR STATUS LOOKUP (Hash Bucket #%d) ---\n", bucket);

    if (entry->status == STATUS_CONFIRMED || entry->status == STATUS_RAC) {
        const Passenger *p = &entry->dll_node->data;
        printf("PNR Number : %d\n", p->pnr);
        printf("Passenger  : %s (Age %d)\n", p->name, p->age);
        printf("Quota      : %s\n", quota_to_string(p->quota));
        if (entry->status == STATUS_CONFIRMED) {
            printf("Status     : CONFIRMED (Berth #%d)\n", p->slot_number);
        } else {
            printf("Status     : RAC (RAC Slot #%d)\n", p->slot_number);
        }
    } else {
        const Passenger *p = &sys->waiting_heap.nodes[entry->heap_index].data;
        int rank = heap_compute_priority_rank(&sys->waiting_heap, entry->heap_index);
        printf("PNR Number : %d\n", p->pnr);
        printf("Passenger  : %s (Age %d)\n", p->name, p->age);
        printf("Quota      : %s (Priority %d)\n", quota_to_string(p->quota), (int)p->quota);
        printf("Status     : WAITING LIST (Priority Rank #%d | Heap Index [%d] | Seq #%ld)\n",
               rank, entry->heap_index, p->timestamp);
    }
    printf("-------------------------------------------\n");
}

/*
 * Print formatted reservation charts for Confirmed, RAC, and Priority Waiting List.
 */
void display_all_charts(const RailwaySystem *sys) {
    printf("\n====================================================================\n");
    printf("              RAILWAY RESERVATION SYSTEM - LIVE CHARTS              \n");
    printf("====================================================================\n");

    /* 1. Confirmed Chart */
    printf("\n[1] CONFIRMED BERTHS (%d / %d)\n",
           sys->confirmed_list.size, sys->confirmed_list.capacity);
    printf("+--------+----------------------+-----+----------------+---------+\n");
    printf("| PNR    | Passenger Name       | Age | Quota          | Berth # |\n");
    printf("+--------+----------------------+-----+----------------+---------+\n");
    if (sys->confirmed_list.size == 0) {
        printf("| (No confirmed passengers)                                      |\n");
    } else {
        const DLLNode *curr = sys->confirmed_list.head;
        while (curr != NULL) {
            const Passenger *p = &curr->data;
            printf("| %6d | %-20s | %3d | %-14s | B-%02d    |\n",
                   p->pnr, p->name, p->age, quota_to_string(p->quota), p->slot_number);
            curr = curr->next;
        }
    }
    printf("+--------+----------------------+-----+----------------+---------+\n");

    /* 2. RAC Chart */
    printf("\n[2] RAC LIST (%d / %d)\n",
           sys->rac_list.size, sys->rac_list.capacity);
    printf("+--------+----------------------+-----+----------------+---------+\n");
    printf("| PNR    | Passenger Name       | Age | Quota          | RAC #   |\n");
    printf("+--------+----------------------+-----+----------------+---------+\n");
    if (sys->rac_list.size == 0) {
        printf("| (No RAC passengers)                                            |\n");
    } else {
        const DLLNode *curr = sys->rac_list.head;
        while (curr != NULL) {
            const Passenger *p = &curr->data;
            printf("| %6d | %-20s | %3d | %-14s | RAC-%02d  |\n",
                   p->pnr, p->name, p->age, quota_to_string(p->quota), p->slot_number);
            curr = curr->next;
        }
    }
    printf("+--------+----------------------+-----+----------------+---------+\n");

    /* 3. Priority Waiting List Chart (Sorted Priority View + Heap Index) */
    printf("\n[3] PRIORITY WAITING LIST (Indexed Max-Heap Size: %d)\n",
           sys->waiting_heap.size);
    printf("+------+--------+----------------------+-----+----------------+----------+----------+\n");
    printf("| Rank | PNR    | Passenger Name       | Age | Quota          | Heap Idx | Seq Time |\n");
    printf("+------+--------+----------------------+-----+----------------+----------+----------+\n");
    if (sys->waiting_heap.size == 0) {
        printf("| (Waiting list is empty)                                                           |\n");
    } else {
        /* Copy indices and sort for non-destructive priority display */
        int n = sys->waiting_heap.size;
        int indices[HEAP_CAPACITY];
        for (int i = 0; i < n; i++) {
            indices[i] = i;
        }
        for (int i = 0; i < n - 1; i++) {
            for (int j = i + 1; j < n; j++) {
                if (heap_compare(&sys->waiting_heap.nodes[indices[j]].data,
                                 &sys->waiting_heap.nodes[indices[i]].data) > 0) {
                    int tmp = indices[i];
                    indices[i] = indices[j];
                    indices[j] = tmp;
                }
            }
        }
        for (int r = 0; r < n; r++) {
            int idx = indices[r];
            const Passenger *p = &sys->waiting_heap.nodes[idx].data;
            printf("| WL-%-1d | %6d | %-20s | %3d | %-14s | [%2d]     | T-%04ld   |\n",
                   r + 1, p->pnr, p->name, p->age, quota_to_string(p->quota), idx, p->timestamp);
        }
    }
    printf("+------+--------+----------------------+-----+----------------+----------+----------+\n");
}

/*
 * Preload 10 sample passengers across all quotas (VIP, Tatkal, Senior, General)
 * so Confirmed (5), RAC (2), and Priority Waiting List (3+) are populated immediately.
 */
void preload_sample_data(RailwaySystem *sys) {
    system_free(sys);
    system_init(sys);

    struct {
        const char *name;
        int age;
        QuotaType quota;
    } samples[10] = {
        { "Aarav Sharma",    34, QUOTA_GENERAL },
        { "Meera Nair",      67, QUOTA_SENIOR  },
        { "Rohan Verma",     28, QUOTA_TATKAL  },
        { "Kavita Iyer",     42, QUOTA_GENERAL },
        { "Vikram Malhotra", 51, QUOTA_VIP     },
        { "Suresh Kulkarni", 71, QUOTA_SENIOR  },
        { "Ananya Gupta",    24, QUOTA_GENERAL },
        { "Devika Menon",    39, QUOTA_GENERAL },
        { "Rajeshwar Rao",   64, QUOTA_SENIOR  },
        { "Priya Deshmukh",  31, QUOTA_VIP     }
    };

    printf("\nPreloading 10 sample passengers across all quotas...\n");
    for (int i = 0; i < 10; i++) {
        int pnr = book_ticket(sys, samples[i].name, samples[i].age, samples[i].quota);
        if (pnr > 0) {
            HashEntry *e = ht_search(&sys->pnr_table, pnr);
            printf("  Booked PNR %d | %-16s | %-14s -> %s\n",
                   pnr, samples[i].name, quota_to_string(samples[i].quota),
                   status_to_string(e->status));
        }
    }
}

static void write_csv_escaped(FILE *fp, const char *text) {
    fputc('"', fp);
    for (const char *ch = text; *ch != '\0'; ch++) {
        if (*ch == '"') {
            fputc('"', fp);
        }
        fputc(*ch, fp);
    }
    fputc('"', fp);
}

/*
 * Export Confirmed, RAC, and Priority Waiting List passengers to a CSV manifest.
 */
bool export_passenger_manifest(const RailwaySystem *sys, const char *filename) {
    if (!sys || !filename) {
        return false;
    }

    FILE *fp = fopen(filename, "w");
    if (!fp) {
        fprintf(stderr, "Error: Unable to open '%s' for writing.\n", filename);
        return false;
    }

    fprintf(fp, "Status,Assignment,PNR,Passenger Name,Age,Quota,Booking Sequence,Hash Bucket,Heap Index\n");

    for (const DLLNode *c = sys->confirmed_list.head; c != NULL; c = c->next) {
        const Passenger *p = &c->data;
        fprintf(fp, "CONFIRMED,B-%02d,%d,", p->slot_number, p->pnr);
        write_csv_escaped(fp, p->name);
        fprintf(fp, ",%d,", p->age);
        write_csv_escaped(fp, quota_to_string(p->quota));
        fprintf(fp, ",T-%04ld,%d,-1\n", p->timestamp, ht_hash(p->pnr));
    }

    for (const DLLNode *r = sys->rac_list.head; r != NULL; r = r->next) {
        const Passenger *p = &r->data;
        fprintf(fp, "RAC,RAC-%02d,%d,", p->slot_number, p->pnr);
        write_csv_escaped(fp, p->name);
        fprintf(fp, ",%d,", p->age);
        write_csv_escaped(fp, quota_to_string(p->quota));
        fprintf(fp, ",T-%04ld,%d,-1\n", p->timestamp, ht_hash(p->pnr));
    }

    int n = sys->waiting_heap.size;
    int indices[HEAP_CAPACITY];
    for (int i = 0; i < n; i++) {
        indices[i] = i;
    }
    for (int i = 0; i < n - 1; i++) {
        for (int j = i + 1; j < n; j++) {
            if (heap_compare(&sys->waiting_heap.nodes[indices[j]].data,
                             &sys->waiting_heap.nodes[indices[i]].data) > 0) {
                int tmp = indices[i];
                indices[i] = indices[j];
                indices[j] = tmp;
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
        fprintf(fp, ",T-%04ld,%d,%d\n", p->timestamp, ht_hash(p->pnr), idx);
    }

    fclose(fp);
    printf("Exported passenger manifest to '%s'.\n", filename);
    return true;
}

