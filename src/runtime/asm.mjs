/**
 * 汇编清单：地址 / 机器码 / 指令三列。
 *
 * 构建期把 objdump -d 或普通 .s 解析成 data-vk-asm；运行时只摆行。
 * 每行同时带 data-line（源行）与 data-addr（指令地址），两种锚点都能指。
 */
import { VkElement, define, esc } from './base.mjs';
import { splitInsn } from '../shared/asm.mjs';

/** 操作数：逗号后留空格；寄存器加重、立即数降一阶，括号保持墨色。 */
function operandHtml(text) {
  const clean = String(text || '')
    .replace(/,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  return esc(clean).replace(/(%[a-z0-9]+|\$?0x[0-9a-f]+|\b\d+\b)/gi, (s) =>
    s.startsWith('%') ? `<span class="vk-op-reg">${s}</span>` : `<span class="vk-op-imm">${s}</span>`
  );
}

export class VkAsm extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-asm';

  capture() {
    const data = this.querySelector(':scope > script[data-vk-asm]');
    this._data = null;
    if (data) {
      try {
        const d = JSON.parse(data.textContent);
        if (d && Array.isArray(d.rows)) this._data = d;
      } catch {
        /* 损坏的汇编数据按缺失处理 */
      }
    }
    if (this.getAttribute('src') && !this._data) this.stale('缺少预编译汇编数据');
    this._raw = this.textContent.trim();
  }

  render() {
    const d = this._data;
    if (!d) {
      const raw = this._raw || '';
      this.innerHTML = raw
        ? `<pre class="vk-asm vk-asm-raw" data-stale>${esc(raw)}</pre>`
        : '<div class="vk-asm" data-empty>缺少汇编数据</div>';
      return;
    }
    const hasAddr = d.rows.some((r) => r.addr);
    const hasBytes = d.rows.some((r) => r.bytes);
    const showBytes = this.hasAttribute('bytes') && hasBytes;
    const showAddr = this.getAttribute('address') !== 'none' && hasAddr;
    const density = this.getAttribute('density') || 'normal';
    const title = this.getAttribute('title') || d.file || '';
    const hl = new Set();
    for (const part of (this.getAttribute('highlight') || '').split(',')) {
      const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) continue;
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2] || m[1], 10);
      for (let i = a; i <= b; i++) hl.add(i);
    }
    const focus = new Set();
    for (const part of (this.getAttribute('focus') || '').split(',')) {
      const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) continue;
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2] || m[1], 10);
      for (let i = a; i <= b; i++) focus.add(i);
    }
    const rows = d.rows
      .map((r) => {
        if (r.kind === 'label') {
          return `<div class="vk-asm-label" data-vk-part="line" data-line="${r.line}" data-addr="${esc(r.addr || '')}">${esc(r.label || r.text || '')}:</div>`;
        }
        if (!r.text) return `<div class="vk-asm-row is-blank" data-line="${r.line}"></div>`;
        const isHl = hl.size ? hl.has(r.line) : !!r.hl;
        const isDim = focus.size && !focus.has(r.line);
        const parts = r.m || r.o ? { mnemonic: r.m || '', operands: r.o || '' } : splitInsn(r.text);
        return `<div class="vk-asm-row${isHl ? ' is-hl' : ''}${isDim ? ' is-dim' : ''}" data-vk-part="line" data-line="${r.line}" data-addr="${esc(r.addr || '')}">
          ${showAddr ? `<span class="vk-asm-a" data-meta>${r.addr ? '0x' + esc(r.addr) : ''}</span>` : ''}
          ${showBytes ? `<span class="vk-asm-b" data-meta>${esc(r.bytes || '')}</span>` : ''}
          <span class="vk-asm-m">${esc(parts.mnemonic)}</span>
          <span class="vk-asm-o">${operandHtml(parts.operands)}</span>
        </div>`;
      })
      .join('');
    const cols = `<div class="vk-asm-cols vk-asm-cols-hd" aria-hidden="true">
      ${showAddr ? '<span class="vk-asm-a" data-meta>地址</span>' : ''}
      ${showBytes ? '<span class="vk-asm-b" data-meta>机器码</span>' : ''}
      <span class="vk-asm-m" data-meta>指令</span>
      <span class="vk-asm-o" data-meta>操作数</span>
    </div>`;
    const head =
      this.getAttribute('chrome') === 'none'
        ? ''
        : `<div class="vk-asm-hd"><span class="vk-asm-file" data-meta>${esc(title)}</span><span class="vk-asm-range" data-meta>${esc(
            [this.getAttribute('lines') || '', d.base || ''].filter(Boolean).join(' · ')
          )}</span><span class="vk-asm-lang" data-meta>asm</span></div>`;
    this.innerHTML = `<div class="vk-asm" data-density="${esc(density)}" data-show-addr="${showAddr ? '1' : '0'}" data-show-bytes="${showBytes ? '1' : '0'}">
      ${head}${cols}<div class="vk-asm-bd" data-vk-part="bd">${rows}</div>
    </div>`;
  }
}

export function defineAsm() {
  define('vk-asm', VkAsm);
}
