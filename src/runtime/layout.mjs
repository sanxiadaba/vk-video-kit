import { VkElement, define, attrSpace, spaceCss, attrNum, attrText, warn } from './base.mjs';

/* ------------------------------------------------------------------ 竖排 */
export class VkStack extends VkElement {
  render() {
    const gap = attrSpace(this, 'gap', 'normal');
    if (gap) this.style.setProperty('--vk-gap', gap);
    const pad = attrSpace(this, 'pad', 'none');
    if (pad && pad !== '0px') this.style.setProperty('--vk-pad', pad);
    else this.style.removeProperty('--vk-pad');
    this._weights();
  }

  _weights() {
    const raw = attrText(this, 'weights').trim();
    for (const el of this.children) {
      el.removeAttribute('data-weight');
      el.style.removeProperty('--vk-weight');
    }
    if (!raw) return;
    const list = raw.split(/[\s,]+/).filter(Boolean).map(Number);
    if (!list.length || list.some((n) => !Number.isFinite(n) || n <= 0)) return;
    if (!this.hasAttribute('grow') && !this.hasAttribute('h')) {
      warn(this, 'weights 需要容器有确定高度：给 <vk-stack> 写 grow，或放进 vk-canvas 里给 h');
      return;
    }
    [...this.children].forEach((el, i) => {
      if (list[i] == null) return;
      el.setAttribute('data-weight', '');
      el.style.setProperty('--vk-weight', String(list[i]));
    });
  }
}

/* ------------------------------------------------------------------ 网格 */
export class VkGrid extends VkElement {
  render() {
    const pad = attrSpace(this, 'pad', 'none');
    if (pad && pad !== '0px') this.style.setProperty('--vk-pad', pad);
    else this.style.removeProperty('--vk-pad');
    const ratio = attrText(this, 'ratio').trim();
    if (ratio) {
      const list = ratio.split(/[\s,]+/).filter(Boolean).map(Number);
      if (list.length && list.every((n) => Number.isFinite(n) && n > 0)) {
        this.style.gridTemplateColumns = list.map((n) => `${n}fr`).join(' ');
        this.style.removeProperty('--vk-cols');
      } else {
        warn(this, `ratio="${ratio}" 要是正数序列，如 "1 8 23"`);
        this.style.removeProperty('grid-template-columns');
      }
    } else {
      this.style.removeProperty('grid-template-columns');
      this.style.setProperty('--vk-cols', String(attrNum(this, 'cols', 2)));
    }
    // span / row-span 落到变量：CSS 只写一条 grid-column: span var(--vk-span)。
    // 这样 1–12 都成立，不用为每一档写一条选择器（旧版只有 2–6 有规则）。
    for (const el of this.children) {
      el.style.setProperty('--vk-span', String(Math.min(12, Math.max(1, attrNum(el, 'span', 1)))));
      el.style.setProperty('--vk-row-span', String(Math.min(12, Math.max(1, attrNum(el, 'row-span', 1)))));
    }
    const gap = attrSpace(this, 'gap', 'normal');
    if (gap) this.style.setProperty('--vk-gap', gap);
  }
}

/* ------------------------------------------------------------------ 坐标 */
export class VkCanvas extends VkElement {
  render() {
    const pad = attrSpace(this, 'pad', 'none');
    this.style.padding = pad || '0px';
    this._w = this.hasAttribute('w') ? attrNum(this, 'w') : 0;
    this._h = this.hasAttribute('h') ? attrNum(this, 'h') : 0;
    for (const el of this.children) el.style.position = 'absolute';
    this.registerPlace();
  }

  place() {
    let right = 0;
    let bottom = 0;
    for (const el of this.children) {
      const x = Number.parseFloat(el.style.left) || 0;
      const y = Number.parseFloat(el.style.top) || 0;
      right = Math.max(right, x + el.offsetWidth);
      bottom = Math.max(bottom, y + el.offsetHeight);
    }
    const pad = Number.parseFloat(this.style.padding) || 0;
    this.style.width = `${this._w || Math.ceil(right) + pad * 2}px`;
    this.style.height = `${this._h || Math.ceil(bottom) + pad * 2}px`;
  }
}

/* ------------------------------------------------------------------ 叠层 */
export class VkLayer extends VkElement {
  render() {
    const pad = attrSpace(this, 'pad', 'none');
    if (pad && pad !== '0px') this.style.setProperty('--vk-pad', pad);
    else this.style.removeProperty('--vk-pad');
    this.registerPlace();
  }
}

/* ------------------------------------------------------------------ 并置 */
export class VkPair extends VkElement {
  render() {
    this.style.setProperty('--vk-split', String(attrNum(this, 'split', 50)));
    // 轴上有字时，中间那条缝要容得下它：没显式写 gap 就把缝放大一档。
    const symbol = attrText(this, 'symbol', 'none');
    const gap = this.hasAttribute('gap')
      ? attrSpace(this, 'gap', 'wide')
      : spaceCss(symbol === 'none' ? 'wide' : 'section');
    // 轴上有字时，缝宽 = section + wide：字放在缝里，才压不到两边的窗。
    if (!this.hasAttribute('gap') && symbol !== 'none') this.style.setProperty('--vk-gap', 'calc(var(--vk-gap-section) * 2)');
    if (gap) this.style.setProperty('--vk-gap', gap);
    // split 是不对称分栏：中轴上那个字会被挤进窄的一边，索性不画。
    if (symbol === 'none' || this.hasAttribute('split')) {
      delete this.dataset.symbol;
      delete this.dataset.axis;
    } else {
      this.dataset.symbol = symbol;
      this.dataset.axis = '';
    }
  }
}

export function defineLayout() {
  define('vk-stack', VkStack);
  define('vk-grid', VkGrid);
  define('vk-canvas', VkCanvas);
  define('vk-layer', VkLayer);
  define('vk-pair', VkPair);
}

