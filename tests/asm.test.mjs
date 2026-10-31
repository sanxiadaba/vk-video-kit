import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAsm, splitInsn } from '../src/shared/asm.mjs';

test('asm：objdump 解析地址、机器码、指令与标签', () => {
  const text = [
    '0000000000401136 <main>:',
    '  401136: 55                    push   %rbp',
    '  401137: 48 89 e5              mov    %rsp,%rbp',
  ].join('\n');
  const { rows, labels } = parseAsm(text);
  assert.equal(labels.length, 1);
  assert.equal(labels[0].name, 'main');
  assert.equal(rows[1].addr, '401136');
  assert.equal(rows[1].bytes, '55');
  assert.equal(rows[1].text, 'push   %rbp');
  assert.equal(rows[2].bytes, '48 89 e5');
});

test('asm：objdump 的机器码续行并回上一条指令，指令数 = 地址行数', () => {
  // 真实 objdump 折行：8 字节 movabs 被拆成「地址 + 7 字节」和「只有 1 字节」两行。
  const text = [
    '0000000000401000 <main>:',
    '  401000: 48 b8 88 77 66 55 44 33  movabs $0x1122334455667788,%rax',
    '  22 11', // 续行没有地址，只有缩进的机器码
    '  401009: 55                    push   %rbp',
  ].join('\n');
  const { rows, labels, unmerged } = parseAsm(text);
  const insns = rows.filter((r) => r.kind === 'insn');
  // 地址行只有两行：401000 / 401009；中间那行只有机器码，是续行，不占一条指令。
  assert.equal(insns.length, 2);
  assert.equal(labels.length, 1);
  assert.equal(insns[0].addr, '401000');
  assert.equal(insns[0].bytes, '48 b8 88 77 66 55 44 33 22 11');
  assert.equal(insns[0].text, 'movabs $0x1122334455667788,%rax');
  assert.equal(insns[1].addr, '401009');
  assert.equal(insns[1].bytes, '55');
  assert.equal(unmerged, 0);
  assert.ok(!insns.some((r) => r.text === '22 11' || r.text === '00'), '续行不能被画成独立指令');
});

test('asm：没有可接地址的机器码续行不硬猜，计入 unmerged', () => {
  const { rows, unmerged } = parseAsm('  00\n  401000: 55  push %rbp');
  assert.equal(unmerged, 1);
  assert.equal(rows.filter((r) => r.kind === 'insn').length, 2, '无法合并时仍保留原行，交给运行时提示');
});

test('asm：普通 .s 没有地址列，但每行仍可显示', () => {
  const { rows } = parseAsm('main:\n  mov eax, 1\n  ret\n');
  assert.equal(rows[0].kind, 'label');
  assert.equal(rows[1].addr, '');
  assert.equal(rows[1].text, 'mov eax, 1');
  assert.equal(rows[2].kind, 'insn');
});

test('asm：助记符与操作数拆分', () => {
  assert.deepEqual(splitInsn('movl $0x2a, -0x4(%rbp)'), { mnemonic: 'movl', operands: '$0x2a, -0x4(%rbp)' });
  assert.deepEqual(splitInsn('ret'), { mnemonic: 'ret', operands: '' });
});

test('asm：objdump 表头不是指令，整行跳过并计数', () => {
  const text = [
    'hello.exe:     file format pei-i386',
    '',
    'Disassembly of section .text:',
    '',
    '00401000 <_main>:',
    '  401000: 55                    push   %rbp',
    '  401001: 48 89 e5              mov    %rsp,%rbp',
    'objdump: warning: something to know',
  ].join('\n');
  const { rows, labels, skipped } = parseAsm(text);
  assert.equal(skipped, 3);
  assert.equal(labels.length, 1);
  const insns = rows.filter((r) => r.kind === 'insn');
  assert.equal(insns.length, 2);
  assert.deepEqual(insns.map((r) => r.text), ['push   %rbp', 'mov    %rsp,%rbp']);
  assert.ok(!rows.some((r) => /file format|Disassembly of section|objdump: warning/.test(r.text)));
});
