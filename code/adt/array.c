#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define N 8000000

int main(void) {
    int *a = (int *)malloc(sizeof(int) * N);
    int i;
    long long sum = 0;
    for (i = 0; i < N; i++) a[i] = i;
    clock_t t0 = clock();
    for (i = 0; i < N; i++) sum += a[i];
    clock_t t1 = clock();
    printf("%lld %.1f\n", sum, (double)(t1 - t0) * 1000.0 / CLOCKS_PER_SEC);
    free(a);
    return 0;
}
