#include "../include/railway.h"

static void clear_stdin_line(void) {
    int c;
    while ((c = getchar()) != '\n' && c != EOF) {
    }
}

static void print_menu(void) {
    printf("\n================ RAILWAY RESERVATION QUEUE SYSTEM ================\n");
    printf("1. Book Ticket\n");
    printf("2. Cancel Ticket by PNR\n");
    printf("3. Check PNR Status (O(1) Hash Lookup)\n");
    printf("4. Display All Charts (Confirmed, RAC, Priority Waiting List)\n");
    printf("5. Preload Sample Data (10 Passengers)\n");
    printf("6. Download Passenger Manifest (Export CSV)\n");
    printf("7. Exit\n");
    printf("Select an option (1-7): ");
}

int main(void) {
    RailwaySystem sys;
    system_init(&sys);

    int choice = 0;
    while (true) {
        print_menu();
        if (scanf("%d", &choice) != 1) {
            printf("Invalid input. Please enter a number between 1 and 7.\n");
            clear_stdin_line();
            continue;
        }
        clear_stdin_line();

        if (choice == 1) {
            char name[MAX_NAME_LEN];
            int age = 0;
            int quota_in = 4;

            printf("Enter Passenger Name: ");
            if (!fgets(name, sizeof(name), stdin)) {
                continue;
            }
            size_t len = strlen(name);
            if (len > 0 && name[len - 1] == '\n') {
                name[len - 1] = '\0';
            }

            printf("Enter Age: ");
            if (scanf("%d", &age) != 1 || age <= 0 || age > 120) {
                printf("Invalid age.\n");
                clear_stdin_line();
                continue;
            }
            clear_stdin_line();

            printf("Select Quota (1=VIP/Emergency, 2=Tatkal, 3=Senior Citizen, 4=General): ");
            if (scanf("%d", &quota_in) != 1 || quota_in < 1 || quota_in > 4) {
                printf("Invalid quota choice.\n");
                clear_stdin_line();
                continue;
            }
            clear_stdin_line();

            int pnr = book_ticket(&sys, name, age, (QuotaType)quota_in);
            if (pnr > 0) {
                printf("\nTicket booked successfully! Generated PNR: %d\n", pnr);
                check_pnr_status(&sys, pnr);
            } else {
                printf("\nBooking failed (invalid input or waiting list full).\n");
            }
        } else if (choice == 2) {
            int pnr = 0;
            printf("Enter 6-digit PNR to cancel: ");
            if (scanf("%d", &pnr) != 1) {
                printf("Invalid PNR format.\n");
                clear_stdin_line();
                continue;
            }
            clear_stdin_line();
            cancel_ticket(&sys, pnr);
        } else if (choice == 3) {
            int pnr = 0;
            printf("Enter 6-digit PNR to check: ");
            if (scanf("%d", &pnr) != 1) {
                printf("Invalid PNR format.\n");
                clear_stdin_line();
                continue;
            }
            clear_stdin_line();
            check_pnr_status(&sys, pnr);
        } else if (choice == 4) {
            display_all_charts(&sys);
        } else if (choice == 5) {
            preload_sample_data(&sys);
            display_all_charts(&sys);
        } else if (choice == 6) {
            export_passenger_manifest(&sys, "passenger_manifest.csv");
        } else if (choice == 7) {
            printf("Shutting down Railway Reservation System...\n");
            break;
        } else {
            printf("Please choose a valid option (1-7).\n");
        }
    }

    system_free(&sys);
    return 0;
}
