#include <stdio.h>

int is_pow2(unsigned n) {
    return n && !(n & (n - 1));
}

int main(void) {
    unsigned ns[] = {0, 1, 2, 3, 8, 12, 16};
    for (int i = 0; i < 7; i++)
        printf("%2u -> %d\n", ns[i], is_pow2(ns[i]));
    return 0;
}
