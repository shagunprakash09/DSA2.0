#include "../include/railway.h"
#include <assert.h>

static void assert_invariants(const RailwaySystem *sys) {
    /* 1. Every element in waiting_heap must match its HashEntry heap_index */
    for (int i = 0; i < sys->waiting_heap.size; i++) {
        int pnr = sys->waiting_heap.nodes[i].data.pnr;
        HashEntry *e = ht_search(&sys->pnr_table, pnr);
        assert(e != NULL);
        assert(e->status == STATUS_WAITING);
        assert(e->heap_index == i);
        assert(e->dll_node == NULL);

        /* Verify Max-Heap parent priority invariant */
        if (i > 0) {
            int parent = (i - 1) / 2;
            assert(heap_compare(&sys->waiting_heap.nodes[parent].data,
                                &sys->waiting_heap.nodes[i].data) >= 0);
        }
    }

    /* 2. Every Confirmed DLL node must match its HashEntry dll_node pointer */
    int conf_count = 0;
    for (DLLNode *c = sys->confirmed_list.head; c != NULL; c = c->next) {
        HashEntry *e = ht_search(&sys->pnr_table, c->data.pnr);
        assert(e != NULL);
        assert(e->status == STATUS_CONFIRMED);
        assert(e->dll_node == c);
        assert(e->heap_index == -1);
        conf_count++;
    }
    assert(conf_count == sys->confirmed_list.size);

    /* 3. Every RAC DLL node must match its HashEntry dll_node pointer */
    int rac_count = 0;
    for (DLLNode *r = sys->rac_list.head; r != NULL; r = r->next) {
        HashEntry *e = ht_search(&sys->pnr_table, r->data.pnr);
        assert(e != NULL);
        assert(e->status == STATUS_RAC);
        assert(e->dll_node == r);
        assert(e->heap_index == -1);
        rac_count++;
    }
    assert(rac_count == sys->rac_list.size);

    /* 4. Total Hash Table entries must equal sum of all three structures */
    assert(sys->pnr_table.count ==
           sys->confirmed_list.size + sys->rac_list.size + sys->waiting_heap.size);
}

int main(void) {
    RailwaySystem sys;
    system_init(&sys);

    preload_sample_data(&sys);
    assert_invariants(&sys);
    assert(sys.confirmed_list.size == 5);
    assert(sys.rac_list.size == 2);
    assert(sys.waiting_heap.size == 3);

    /* Book a high-priority Tatkal & VIP passenger into Waiting List */
    int pnr_tatkal = book_ticket(&sys, "Neha Kapoor", 30, QUOTA_TATKAL);
    int pnr_vip = book_ticket(&sys, "Dr. Arjun Sen", 48, QUOTA_VIP);
    assert(pnr_tatkal > 0 && pnr_vip > 0);
    assert_invariants(&sys);

    /* Root of Max-Heap must be a VIP passenger (earliest VIP in WL) */
    assert(sys.waiting_heap.nodes[0].data.quota == QUOTA_VIP);
    int expected_first_wl = sys.waiting_heap.nodes[0].data.pnr;

    /* Cancel Berth #2 (Confirmed) -> promotes front RAC to Confirmed, and heap root to RAC */
    int conf_second_pnr = sys.confirmed_list.head->next->data.pnr;
    int rac_front_pnr = sys.rac_list.head->data.pnr;
    assert(cancel_ticket(&sys, conf_second_pnr));
    assert_invariants(&sys);

    HashEntry *promoted_conf = ht_search(&sys.pnr_table, rac_front_pnr);
    assert(promoted_conf && promoted_conf->status == STATUS_CONFIRMED);
    assert(promoted_conf->dll_node->data.slot_number == 2);

    HashEntry *promoted_rac = ht_search(&sys.pnr_table, expected_first_wl);
    assert(promoted_rac && promoted_rac->status == STATUS_RAC);

    /* Cancel a middle element in Waiting List Heap */
    assert(sys.waiting_heap.size >= 3);
    int mid_wl_pnr = sys.waiting_heap.nodes[2].data.pnr;
    assert(cancel_ticket(&sys, mid_wl_pnr));
    assert_invariants(&sys);
    assert(ht_search(&sys.pnr_table, mid_wl_pnr) == NULL);

    /* Cancel an RAC passenger */
    int rac_pnr = sys.rac_list.head->data.pnr;
    assert(cancel_ticket(&sys, rac_pnr));
    assert_invariants(&sys);

    display_all_charts(&sys);
    check_pnr_status(&sys, pnr_tatkal);

    assert(export_passenger_manifest(&sys, "/tmp/test_passenger_manifest.csv"));
    FILE *csv = fopen("/tmp/test_passenger_manifest.csv", "r");
    assert(csv != NULL);
    int line_count = 0;
    char buf[256];
    while (fgets(buf, sizeof(buf), csv) != NULL) {
        line_count++;
    }
    fclose(csv);
    /* 1 header + 5 confirmed + 2 RAC + 2 waiting = 10 lines */
    assert(line_count == 10);

    system_free(&sys);
    printf("\nALL C DATA STRUCTURE INVARIANT TESTS PASSED.\n");
    return 0;
}
