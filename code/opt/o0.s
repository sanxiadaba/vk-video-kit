	.file	"sum.c"
	.text
	.globl	_add
	.def	_add;	.scl	2;	.type	32;	.endef
_add:
	pushl	%ebp
	movl	%esp, %ebp
	movl	8(%ebp), %edx
	movl	12(%ebp), %eax
	addl	%edx, %eax
	popl	%ebp
	ret
	.globl	_sum_to
	.def	_sum_to;	.scl	2;	.type	32;	.endef
_sum_to:
	pushl	%ebp
	movl	%esp, %ebp
	subl	$16, %esp
	movl	$0, -4(%ebp)
	movl	$1, -8(%ebp)
	jmp	L4
L5:
	movl	-8(%ebp), %eax
	addl	%eax, -4(%ebp)
	addl	$1, -8(%ebp)
L4:
	movl	-8(%ebp), %eax
	cmpl	8(%ebp), %eax
	jle	L5
	movl	-4(%ebp), %eax
	leave
	ret
	.ident	"GCC: (i686-posix-dwarf-rev0, Built by MinGW-W64 project) 4.9.4"
