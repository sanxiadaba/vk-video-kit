/**
 * 汇编文本解析 —— 构建期与单测共用。
 *
 * 认两种输入：
 *   1. objdump -d：  401136: 55                    push   %rbp
 *   2. 普通 .s：     push %rbp
 * 不猜语义：能认出地址就填地址，认不出就留空；标签单独成行。
 */

const OBJDUMP = /^\s*([0-9a-f]{4,16}):\s*((?:[0-9a-f]{2}\s+)+)\s*(.*)$/i;
const LABEL_ADDR = /^\s*([0-9a-f]{4,16})\s+<([^>]+)>:\s*$/i;
const LABEL_PLAIN = /^\s*([\w.$@][\w.$@:]*):\s*(?:#.*)?$/;

export function parseAsm(text) {
  const rows = [];
  const labels = [];
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  lines.forEach((raw, i) => {
    const line = i + 1;
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

  return { rows, labels };
}

/** 把一条指令拆成助记符与操作数；只是显示辅助，不改变原文。 */
export function splitInsn(text) {
  const t = String(text || '').trim();
  const m = t.match(/^([a-z][\w.]*)\s+(.*)$/i);
  if (m) return { mnemonic: m[1], operands: m[2] };
  return { mnemonic: t, operands: '' };
}
