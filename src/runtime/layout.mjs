import { VkElement, define, attrSpace, attrNum, attrText, warn } from './base.mjs';

/* ------------------------------------------------------------------ 竖排 */
export class VkStack extends VkElement {
  render() {
    const gap = attrSpace(this, 'gap', 'normal');
    if (gap) this.style.setProperty('--vk-gap', gap);
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
      console.warn('[vk] <vk-stack> 写了 weights，但容器没有确定高度：按内容高排。给它 grow 或 h。', this);
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
    this.registerPlace();
  }
}

/* ------------------------------------------------------------------ 并置 */
export class VkPair extends VkElement {
  render() {
    this.style.setProperty('--vk-split', String(attrNum(this, 'split', 50)));
    const gap = attrSpace(this, 'gap', 'wide');
    if (gap) this.style.setProperty('--vk-gap', gap);
    const symbol = attrText(this, 'symbol', 'none');
    if (symbol === 'none') {
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
