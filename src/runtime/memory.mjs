/**
 * 内存图：把进程地址空间一段一段摆开。
 *
 *   <vk-memory addr="0x7fff_ffff" title="进程地址空间">
 *     <i label="stack" size="8 MB" grows="down" mark>局部变量 / 返回地址</i>
 *     <i label="heap" grows="up">malloc / free</i>
 *     <i label=".text" size="16 KB">机器码</i>
 *   </vk-memory>
 *
 * 段不按真实比例（schematic）是默认；scale="linear" 才按 size 争高度。
 * 段一律可被 #id@seg:序号 或 @seg:段名 锚定。
 */
import { VkElement, define, esc } from './base.mjs';

const BYTES = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };

function sizeBytes(text) {
  const m = String(text || '')
    .trim()
    .match(/^([\d.]+)\s*(b|kb|mb|gb|tb)$/i);
  if (!m) return 0;
  return parseFloat(m[1]) * (BYTES[m[2].toLowerCase()] || 1);
}

export class VkMemory extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-memory';

  capture() {
    this._items = [...this.querySelectorAll(':scope > i')].map((el) => ({
      label: el.getAttribute('label') || '',
      size: el.getAttribute('size') || '',
      addr: el.getAttribute('addr') || '',
      grows: el.getAttribute('grows') || '',
      mark: el.hasAttribute('mark'),
      tone: el.getAttribute('tone') || '',
      text: el.textContent.trim(),
    }));
  }

  render() {
    const items = this._items || [];
    if (!items.length) {
      this.innerHTML = '<div class="vk-memory" data-empty>（没有段）</div>';
      return;
    }
    const scale = this.getAttribute('mode') === 'linear' ? 'linear' : 'schematic';
    const orientation = this.getAttribute('orientation') === 'horizontal' ? 'horizontal' : 'vertical';
    const show = this.getAttribute('show') || 'all';
    const density = this.getAttribute('density') || 'normal';
    const title = this.getAttribute('title') || '';
    const addr = this.getAttribute('addr') || '';
    const unit = this.getAttribute('unit') || '';
    const total = items.reduce((n, it) => n + sizeBytes(it.size), 0);
    const maxSize = Math.max(...items.map((it) => sizeBytes(it.size)), 0);

    // linear：总高固定，先给每段保底，再按字节数分剩下的高度——保证总和就是容器高。
    const LINEAR_TOTAL = 540;
    const LINEAR_MIN = 56;
    const heights = items.map(() => 0);
    if (scale === 'linear' && total > 0) {
      const slack = Math.max(0, LINEAR_TOTAL - items.length * LINEAR_MIN);
      items.forEach((it, i) => {
        heights[i] = Math.round(LINEAR_MIN + slack * (sizeBytes(it.size) / total));
      });
    }

    const rows = items
      .map((it, i) => {
        const grow = it.grows === 'up' ? 'up' : it.grows === 'down' ? 'down' : '';
        const growMark = grow ? `<span class="vk-mem-grow" data-grow="${grow}" aria-hidden="true">${grow === 'up' ? '↑' : '↓'}</span>` : '';
        const weight = heights[i] ? ` style="--vk-mem-h:${heights[i]}px"` : '';
        const showAddr = show !== 'values' && it.addr;
        const showSize = show !== 'addresses' && it.size;
        const tone = it.tone ? ` data-tone="${esc(it.tone)}"` : '';
        return `<div class="vk-mem-row" data-vk-part="seg" data-seg="${i}" data-seg-name="${esc(it.label)}"${it.mark ? ' data-mark' : ''}${tone}${weight}>
          <span class="vk-mem-a" data-meta>${showAddr ? esc(it.addr) : ''}</span>
          <span class="vk-mem-name">${growMark}${esc(it.label)}</span>
          <span class="vk-mem-size" data-meta>${showSize ? esc(it.size) : ''}</span>
          <span class="vk-mem-desc">${esc(it.text)}</span>
        </div>`;
      })
      .join('');

    const head = `<header class="vk-mem-hd">
      <span class="vk-mem-title">${esc(title || '内存')}</span>
      <span class="vk-mem-meta" data-meta>${[addr, unit].filter(Boolean).map(esc).join(' · ')}</span>
    </header>`;

    this.innerHTML = `<div class="vk-memory" data-mode="${scale}" data-orientation="${orientation}" data-density="${esc(density)}" data-addr="${items.some((it) => it.addr) ? 'all' : 'none'}" role="list">
      ${head}
      <div class="vk-mem-bd">${rows}</div>
      <p class="vk-mem-note" data-meta>${esc(addr ? `高地址 ${addr}` : '')}</p>
    </div>`;
  }
}

export function defineMemory() {
  define('vk-memory', VkMemory);
}
