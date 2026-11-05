/**
 * vk-pair —— 并置对照。
 *
 * 两块内容左右（或上下）并置，中间一条轴；轴上可以放一个符号。
 * 它不是 vk-grid 的变体：grid 解决"分几份"，pair 只解决"两块对着看"。
 *
 * 几何（CSS 与测试共用这一条）：
 *   · 两块各占内容区的 split% / (100 - split)%，两块宽度和 = 容器宽 - 2×gap；
 *   · 沟槽总宽 = 2×gap，轴在沟槽正中；
 *   · 轴 1–4px，贯穿容器；符号在轴中点，用纸色垫底把线断开。
 *
 * 子节点顺序就是位置：第一个在左 / 上，第二个在右 / 下。
 * 所有子节点只搬一次（移动节点，不序列化 HTML），之后改属性只换壳。
 */
import { VK, numAttr, takeSlot, VkElement, define } from './base.mjs';

import { SIZE_TIERS, TONE_HINT, toneValue } from '../shared/vocab.mjs';

const SYMBOLS = new Set(['→', '=', 'vs']);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class VkPair extends VkElement {
  static watchSource = false;
  static renderedRoot = '.vk-pair';

  render() {
    const orientation = this.getAttribute('direction') === 'vertical' ? 'vertical' : 'horizontal';
    const axis = this.getAttribute('axis') === 'none' ? 'none' : 'line';
    const rawSymbol = (this.getAttribute('symbol') || 'none').trim();
    // axis="none" 只关掉那条分隔线，不连带关掉符号：
    // 「两块 + 中间一个 →」本身就是一个完整写法，符号不需要一根竖线垫底。
    const symbol = SYMBOLS.has(rawSymbol) ? rawSymbol : 'none';
    const split = clamp(numAttr(this, 'split', { min: 5, max: 95, fallback: 50 }), 5, 95);
    const gap = numAttr(this, 'gap', { min: 8, max: 200, fallback: 24 });
    const axisWidth = numAttr(this, 'axis-width', { min: 1, max: 4, fallback: 2 });
    // 中轴符号的字号：像素数（96）或语义档（headline）。size 只表字号。
    const sizeRaw = (this.getAttribute('size') || '').trim();
    const symbolSize = SIZE_TIERS.includes(sizeRaw)
      ? `var(--vk-t-${sizeRaw})`
      : String(clamp(Number(sizeRaw) || 48, 12, 200)) + 'px';
    // 两侧色调：tone="左,右"（第二段可省；none = 这一侧不上色）。
    const toneTokens = (this.getAttribute('tone') || '').split(',');
    const readTone = (raw, side) => {
      const v = (raw || '').trim();
      if (!v || v.toLowerCase() === 'none') return '';
      const r = toneValue(v);
      if (r.bad) {
        this._warnOnce(`tone:${side}`, `的 tone 里 "${v}" 不认识，按透明处理（可用：${TONE_HINT}）`);
        return '';
      }
      return r.value;
    };
    const toneA = readTone(toneTokens[0], 'a');
    const toneB = readTone(toneTokens[1], 'b');

    if (!this._box) {
      const nodes = takeSlot(this);
      const box = document.createElement('div');
      box.className = 'vk-pair';
      const left = document.createElement('div');
      left.className = 'vk-pair-l';
      left.setAttribute('data-vk-part', 'left');
      const right = document.createElement('div');
      right.className = 'vk-pair-r';
      right.setAttribute('data-vk-part', 'right');
      const axisEl = document.createElement('div');
      axisEl.className = 'vk-pair-axis';
      axisEl.setAttribute('aria-hidden', 'true');

      if (nodes[0]) left.appendChild(nodes[0]);
      if (nodes[1]) right.appendChild(nodes[1]);
      // 多于两块：不静默丢掉，塞进右块并在控制台说一次。
      if (nodes.length > 2) {
        for (const n of nodes.slice(2)) right.appendChild(n);
        this._warnOnce('children', '只并置两块：第 3 个及之后的子节点已并入右块');
      }
      box.append(left, right, axisEl);
      this.replaceChildren(box);
      this._box = box;
      this._left = left;
      this._right = right;
      this._axisEl = axisEl;
    }

    this.dataset.orientation = orientation;
    this.dataset.axis = axis;
    this.dataset.symbol = symbol;
    if (toneA) this._left.dataset.tone = toneA;
    else delete this._left.dataset.tone;
    if (toneB) this._right.dataset.tone = toneB;
    else delete this._right.dataset.tone;
    this._box.dataset.orientation = orientation;
    this._box.dataset.axis = axis;
    this._box.dataset.symbol = symbol;
    this._box.style.setProperty('--vk-pair-split', String(split / 100));
    this._box.style.setProperty('--vk-pair-gap', gap + 'px');
    this._box.style.setProperty('--vk-pair-axis-w', axisWidth + 'px');
    this._box.style.setProperty('--vk-pair-symbol-size', symbolSize);

    let sym = this._box.querySelector('.vk-pair-sym');
    if (symbol === 'none') {
      sym?.remove();
      this._sym = null;
    } else {
      if (!sym) {
        sym = document.createElement('span');
        sym.className = 'vk-pair-sym';
        sym.setAttribute('aria-hidden', 'true');
        sym.setAttribute('data-meta', '');
        this._box.appendChild(sym);
      }
      sym.textContent = symbol;
      sym.dataset.symbol = symbol;
      this._sym = sym;
    }

    // 竖排要按容器实测高度分配两份；横向由 CSS grid 算，不需要运行期。
    if (orientation === 'vertical') this.dataset.vkPlace = '';
    else delete this.dataset.vkPlace;

    VK._invalidate();
  }

  place() {
    if (!this._box || !this._left || !this._right) return;
    if (this.dataset.orientation !== 'vertical') {
      this._left.style.height = '';
      this._right.style.height = '';
      return;
    }
    const box = this._box;
    const left = this._left;
    const right = this._right;
    // 先把高度放开量内容总高，再按 split 分配；两块高度和 + 2×gap = 容器高。
    left.style.height = '';
    right.style.height = '';
    const gap = parseFloat(getComputedStyle(box).getPropertyValue('--vk-pair-gap')) || 24;
    const H = box.clientHeight;
    const total = H - 2 * gap;
    if (H > 0 && total > 0) {
      const split = clamp(parseFloat(getComputedStyle(box).getPropertyValue('--vk-pair-split')) || 0.5, 0.05, 0.95);
      left.style.height = Math.floor(total * split) + 'px';
      right.style.height = Math.floor(total * (1 - split)) + 'px';
    }
  }
}

export function definePair() {
  define('vk-pair', VkPair);
}
