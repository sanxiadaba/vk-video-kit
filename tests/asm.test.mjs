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
