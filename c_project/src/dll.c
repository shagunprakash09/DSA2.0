#include "../include/railway.h"

/*
 * Initialize an empty Doubly Linked List with a fixed seat/slot capacity.
 * Time Complexity: O(1)
 */
void dll_init(DoublyLinkedList *list, int capacity) {
    list->head = NULL;
    list->tail = NULL;
    list->size = 0;
    list->capacity = capacity;
}

/*
 * Append a passenger at the tail of the Doubly Linked List.
 * Returns the newly allocated DLLNode* so the Hash Table can store a direct
 * pointer for O(1) middle-of-list deletion later.
 * Time Complexity: O(1)
 */
DLLNode *dll_push_back(DoublyLinkedList *list, Passenger p) {
    if (list->size >= list->capacity) {
        return NULL;
    }

    DLLNode *node = (DLLNode *)malloc(sizeof(DLLNode));
    if (!node) {
        fprintf(stderr, "Error: Memory allocation failed in dll_push_back.\n");
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

/*
 * Remove and return the front passenger from the Doubly Linked List.
 * Used when promoting the longest-waiting RAC passenger to Confirmed.
 * Time Complexity: O(1)
 */
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

/*
 * Delete an arbitrary node directly using its pointer in O(1) time.
 * The pointer is retrieved in O(1) from the PNR Hash Table.
 * Time Complexity: O(1)
 */
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

/*
 * Free all nodes in the Doubly Linked List.
 * Time Complexity: O(N)
 */
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
}
