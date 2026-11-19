CC      = gcc
CFLAGS  = -Wall -Wextra -Werror -std=c11 -O2 -Iinclude
TARGET  = railway_reservation
SRCS    = src/main.c src/dll.c src/heap.c src/hashtable.c src/reservation.c

all: $(TARGET)

$(TARGET): $(SRCS) include/railway.h
	$(CC) $(CFLAGS) $(SRCS) -o $(TARGET)

clean:
	rm -f $(TARGET)
