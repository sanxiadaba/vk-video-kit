/**
 * 汇编清单：地址 / 机器码 / 指令三列。
 *
 * 构建期把 objdump -d 或普通 .s 解析成 data-vk-asm；运行时只摆行。
 * 每行同时带 data-line（源行）与 data-addr（指令地址），两种锚点都能指。
 */
import { VkElement, define, esc, lineSet, applyContentSize, fitContent } from './base.mjs';
import { splitInsn } from '../shared/asm.mjs';
import { tokenizeAsm, tokensToHtml } from '../shared/shell.mjs';
import { parseColumns, parseFence } from '../shared/vocab.mjs';
import { DOTS } from './window.mjs';

/**
 * 操作数分色：寄存器 / 立即数 / 地址 / 注释 各自一色，用与 vk-term 同一张
 * 地址、注释、标点全是操作数的墨色——指令读起来还是一整块。
 */
function operandHtml(text) {
  // 逗号后留一个空格：这是排版，不是词法；token 在排版后的文本上切。
  const clean = String(text || '')
    .replace(/,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  return tokensToHtml(tokenizeAsm(clean, { mnemonic: false }));
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
      applyContentSize(this);
      return;
    }
    const hasAddr = d.rows.some((r) => r.addr);
    const hasBytes = d.rows.some((r) => r.bytes);
    if (d.skipped > 0) {
      this.dataset.vkSkipped = String(d.skipped);
      this._warnOnce(
        'skipped',
        `跳过了 ${d.skipped} 行非指令行（objdump 的 file format / Disassembly of section / objdump 提示）。它们不是作者写错的指令；要显示就删掉这些行再构建`
      );
    } else {
      delete this.dataset.vkSkipped;
    }
    if (d.unmerged > 0) {
      this.dataset.vkUnmerged = String(d.unmerged);
      this._warnOnce(
        'asm-cont',
        `有 ${d.unmerged} 行像是 objdump 的机器码续行（只有缩进的十六进制字节），但前面没有可接的地址行；已按普通行保留。请检查 lines 截取是否从指令中间开始`
      );
    } else {
      delete this.dataset.vkUnmerged;
    }
    const showBytes = this.hasAttribute('bytes') && hasBytes;
    // 列开关：地址列由 columns 决定（默认打开）；列标题也写在 columns。
    const columnSpec = parseColumns('vk-asm', this.getAttribute('columns'));
    const showAddr = columnSpec.on.has('address') && hasAddr;
    const mass = this.getAttribute('mass') || 'normal';
    // 窗头是"这段东西从哪来"：没有 title 时退到构建期记下的文件名，再退到"汇编"。
    const title = this.getAttribute('title') || d.file || '汇编';
    const hl = lineSet(this.getAttribute('current') || '');
    const focus = lineSet(this.getAttribute('focus'));
    const revealRaw = this.getAttribute('reveal');
    this.dataset.reveal = revealRaw === 'line' || revealRaw === 'none' ? revealRaw : 'all';
    const orderList = (this.getAttribute('order') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const showOrder = orderList.length > 0;
    let insn = 0;
    const fence = parseFence(this.getAttribute('fence'));
    const fenceAfter = fence.after;
    const fenceLabel = fence.label;
    const rows = d.rows
      .map((r) => {
        if (r.kind === 'label') {
          return `<div class="vk-asm-label" data-vk-part="line" data-line="${r.line}" data-addr="${esc(r.addr || '')}">${esc(r.label || r.text || '')}:</div>`;
        }
        if (!r.text) return `<div class="vk-asm-row is-blank" data-line="${r.line}"></div>`;
        const isHl = hl.has(r.line);
        const isDim = focus.size && !focus.has(r.line);
        const parts = r.m || r.o ? { mnemonic: r.m || '', operands: r.o || '' } : splitInsn(r.text);
        const ord = orderList[insn++];
        const badge = ord != null ? `<span class="vk-asm-order" data-meta>${esc(ord)}</span>` : '';
        const row = `<div class="vk-asm-row${isHl ? ' is-hl' : ''}${isDim ? ' is-dim' : ''}" data-vk-part="line" data-line="${r.line}" data-addr="${esc(r.addr || '')}">
          ${showOrder ? `<span class="vk-asm-ord">${badge}</span>` : ''}
          ${showAddr ? `<span class="vk-asm-a" data-meta>${r.addr ? '0x' + esc(r.addr) : ''}</span>` : ''}
          ${showBytes ? `<span class="vk-asm-b" data-meta>${esc(r.bytes || '')}</span>` : ''}
          <span class="vk-asm-m">${parts.mnemonic ? `<span class="vk-tok-cmd">${esc(parts.mnemonic)}</span>` : ''}</span>
          <span class="vk-asm-o">${operandHtml(parts.operands)}</span>
        </div>`;
        if (fenceAfter && String(r.line) === fenceAfter) {
          return `${row}<div class="vk-asm-fence" data-fence="${esc(fenceAfter)}" data-meta><span class="vk-asm-fence-t">${esc(fenceLabel)}</span></div>`;
        }
        return row;
      })
      .join('');
    // 列标题：columns 的 titles: 段；不写 = 默认名，titles:none 关掉整行。
    const labelsOn = columnSpec.titles !== 'none';
    const labelParts = Array.isArray(columnSpec.titles) ? columnSpec.titles : [];
    const label = (col, fallback) => labelParts[col] || fallback;
    // chrome 只有 min / none：none = 不要窗，不是只要窗头不要。
    // 这一块自己画壳（.vk-asm 有边框和底色），所以要把 chrome 写进 DOM，
    // 让 CSS 能把壳一起去掉——否则嵌进 vk-window 就是"窗口里套窗口"。
    const chrome = this.getAttribute('chrome') === 'none' ? 'none' : 'min';
    const cols = labelsOn
      ? `<div class="vk-asm-cols vk-asm-cols-hd" aria-hidden="true">
      ${showOrder ? '<span class="vk-asm-ord" data-meta>执行</span>' : ''}
      ${showAddr ? `<span class="vk-asm-a" data-meta>${esc(label(0, '地址'))}</span>` : ''}
      ${showBytes ? `<span class="vk-asm-b" data-meta>${esc(label(1, '机器码'))}</span>` : ''}
      <span class="vk-asm-m" data-meta>${esc(label(2, '指令'))}</span>
      <span class="vk-asm-o" data-meta>${esc(label(3, '操作数'))}</span>
    </div>`
      : '';
    const head =
      chrome === 'none'
        ? ''
        : `<div class="vk-asm-hd">${DOTS}<span class="vk-asm-file" data-meta>${esc(title)}</span><span class="vk-asm-range" data-meta>${esc(
            [this.getAttribute('lines') || '', d.base || ''].filter(Boolean).join(' · ')
          )}</span><span class="vk-asm-lang" data-meta>asm</span></div>`;
    /**
     * 列模板由「实际输出的列」推出来，不由 CSS 里的开关组合硬编码。
     * 地址列给 max-content：8 位 0x 地址在 40px 等宽下装不进 180px。
     * 否则 7 字节指令会被折成两行，一整张清单瞬间高出一倍。
     */
    const gridCols = [
      showOrder ? 'calc(var(--vk-cs) * 120 / 48)' : '',
      showAddr ? 'minmax(calc(var(--vk-cs) * 180 / 48), max-content)' : '',
      showBytes ? 'max(calc(var(--vk-cs) * 500 / 48), calc(var(--vk-cs) * 12))' : '',
      'calc(var(--vk-cs) * 160 / 48)',
      'minmax(0, 1fr)',
    ]
      .filter(Boolean)
      .join(' ');
    this.innerHTML = `<div class="vk-asm" style="--vk-asm-cols:${gridCols}" data-chrome="${chrome}" data-mass="${esc(mass)}" data-long="${esc(this.getAttribute('long') || 'clip')}" data-show-addr="${showAddr ? '1' : '0'}" data-show-bytes="${showBytes ? '1' : '0'}" data-show-order="${showOrder ? '1' : '0'}">
      ${head}${cols}<div class="vk-asm-bd" data-vk-part="bd">${rows}</div>
    </div>`;
    applyContentSize(this);
  }

  place() {
    fitContent(this, '.vk-asm-bd');
  }
}

export function defineAsm() {
  define('vk-asm', VkAsm);
}
