	.file	"sum.c"
	.section	.text.unlikely,"x"
LCOLDB0:
	.text
LHOTB0:
	.p2align 4,,15
	.globl	_add
	.def	_add;	.scl	2;	.type	32;	.endef
_add:
	movl	8(%esp), %eax
	addl	4(%esp), %eax
	ret
	.section	.text.unlikely,"x"
LCOLDE0:
	.text
LHOTE0:
	.section	.text.unlikely,"x"
LCOLDB1:
	.text
LHOTB1:
	.p2align 4,,15
	.globl	_sum_to
	.def	_sum_to;	.scl	2;	.type	32;	.endef
_sum_to:
	movl	4(%esp), %ecx
	testl	%ecx, %ecx
	jle	L5
	addl	$1, %ecx
	movl	$1, %edx
	xorl	%eax, %eax
	.p2align 4,,10
L4:
	addl	%edx, %eax
	addl	$1, %edx
	cmpl	%ecx, %edx
	jne	L4
	rep ret
L5:
	xorl	%eax, %eax
	ret
	.section	.text.unlikely,"x"
LCOLDE1:
	.text
LHOTE1:
	.ident	"GCC: (i686-posix-dwarf-rev0, Built by MinGW-W64 project) 4.9.4"
