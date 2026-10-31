/**
 * 汇编文本解析 —— 构建期与单测共用。
 *
 * 认两种输入：
 *   1. objdump -d：  401136: 55                    push   %rbp
 *   2. 普通 .s：     push %rbp
 * 不猜语义：能认出地址就填地址，认不出就留空；标签单独成行。
 */

// 机器码段可以为空：`objdump --no-show-raw-insn` 与部分反汇编器只给地址。
const OBJDUMP = /^\s*([0-9a-f]{4,16}):\s*((?:[0-9a-f]{2}\s+)*)\s*(.+)$/i;
const LABEL_ADDR = /^\s*([0-9a-f]{4,16})\s+<([^>]+)>:\s*$/i;
const LABEL_PLAIN = /^\s*([\w.$@][\w.$@:]*):\s*(?:#.*)?$/;

/**
 * objdump 自己打印的表头 / 诊断，不是作者写的指令。
 *
 * 它们和指令混在同一个文本流里，以前会被当成 insn 画出来：
 * `hello.exe: file format pei-i386`、`Disassembly of section .text:`、
 * `objdump: warning: ...` 甚至会把 `objdump` 拆成助记符。
 * 这些行必须整行跳过，但跳过不能静默：parseAsm 返回 skipped 计数，
 * 运行时 vk-asm 用它 _warnOnce 说明。
 */
const ASM_NOISE = [
  /^\s*[^\s:][^:]*:\s+file format\s+\S+.*$/i,
  /^\s*(?:Disassembly|Contents) of section\b.*:\s*$/i,
  /^\s*objdump:\s*(?:warning|error):/i,
];

export function isAsmNoise(line) {
  const s = String(line ?? '');
  return ASM_NOISE.some((rx) => rx.test(s));
}

export function parseAsm(text) {
  const rows = [];
  const labels = [];
  let skipped = 0;
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  lines.forEach((raw, i) => {
    const line = i + 1;
    if (isAsmNoise(raw)) {
      skipped++;
      return;
    }
    const lab = raw.match(LABEL_ADDR);
    if (lab) {
      labels.push({ addr: lab[1], name: lab[2], line });
      rows.push({ line, kind: 'label', addr: lab[1], bytes: '', text: lab[2] });
      return;
    }
    const obj = raw.match(OBJDUMP);
    if (obj) {
      rows.push({
        line,
        kind: 'insn',
        addr: obj[1],
        bytes: obj[2].trim().replace(/\s+/g, ' '),
        text: obj[3].trim(),
      });
      return;
    }
    const plain = raw.match(LABEL_PLAIN);
    if (plain && !raw.match(/^\s/)) {
      labels.push({ addr: '', name: plain[1], line });
      rows.push({ line, kind: 'label', addr: '', bytes: '', text: plain[1] });
      return;
    }
    const body = raw.trim();
    if (!body) {
      rows.push({ line, kind: 'blank', addr: '', bytes: '', text: '' });
      return;
    }
    rows.push({ line, kind: 'insn', addr: '', bytes: '', text: body });
  });

  return { rows, labels, skipped };
}

/** 把一条指令拆成助记符与操作数；只是显示辅助，不改变原文。 */
export function splitInsn(text) {
  const t = String(text || '').trim();
  // 助记符后可以没有空白（`movl$LC0,28(%esp)`），也可以带前导点（`.file`）。
  const m = t.match(/^([a-z.][\w.]*)\s*(.*)$/i);
  if (m) return { mnemonic: m[1], operands: m[2] };
  return { mnemonic: t, operands: '' };
}
