#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define N 8000000

typedef struct Node { int v; struct Node *next; } Node;

int main(void) {
    Node *head = NULL;
    int i;
    long long sum = 0;
    for (i = 0; i < N; i++) {
        Node *n = (Node *)malloc(sizeof(Node));
        n->v = i;
        n->next = head;
        head = n;
    }
    clock_t t0 = clock();
    for (Node *p = head; p; p = p->next) sum += p->v;
    clock_t t1 = clock();
    printf("%lld %.1f\n", sum, (double)(t1 - t0) * 1000.0 / CLOCKS_PER_SEC);
    return 0;
}
