import { VkElement, define, attrText, esc, warn, takeSlot, fillSlot } from './base.mjs';

/* ------------------------------------------------------------------ 文字 */
/** 文字是纯 CSS 的：size / ink / tone / align 都由属性选择器完成。 */
export class VkText extends VkElement {
  render() {}
}

/* ------------------------------------------------------------------ 标签 */
export class VkLabel extends VkElement {
  render() {
    if (!this._t) {
      const kids = takeSlot(this);
      const t = document.createElement('span');
      t.className = 'vk-label-t';
      fillSlot(t, kids);
      this._t = t;
      this.prepend(t);
    }
    const counter = attrText(this, 'counter');
    if (counter) {
      if (!this._n) {
        this._n = document.createElement('span');
        this._n.className = 'vk-label-n';
        this.prepend(this._n);
      }
      this._n.textContent = counter;
    } else this._n?.remove();
  }
}

/* ------------------------------------------------------------------ 行内 */
export class VkInline extends VkElement {
  render() {
    const variant = this.getAttribute('variant') || 'code';
    if (variant === 'keys' && !this._keys) {
      const raw = (this.textContent || '').replace(/\s+/g, ' ').trim();
      if (!raw) return;
      this._keys = true;
      const keys = raw
        .split(/\s*\+\s*/)
        .filter(Boolean)
        .map((k) => `<kbd class="vk-key">${esc(k)}</kbd>`)
        .join('<span class="vk-key-plus" aria-hidden="true">+</span>');
      this.innerHTML = `<span class="vk-keys">${keys}</span>`;
    }
  }
}

/* ------------------------------------------------------------------ 图片 */
export class VkImg extends VkElement {
  render() {
    const src = attrText(this, 'src');
    const alt = attrText(this, 'alt');
    const ratio = attrText(this, 'ratio');
    const fill = this.getAttribute('fill') === 'contain' ? 'contain' : 'cover';
    const pos = attrText(this, 'position', '50% 50%');
    if (!src) {
      warn(this, '缺 src');
      this.dataset.error = '';
      this.innerHTML = `<span class="vk-img-ph">${esc(alt || '图')}</span>`;
      return;
    }
    if (!this._img || this._src !== src) {
      this._src = src;
      this.innerHTML = `<img src="${esc(src)}" alt="${esc(alt)}" loading="eager" style="object-fit:${fill};object-position:${esc(pos)}" />`;
      this._img = this.querySelector('img');
      this._img.addEventListener('error', () => (this.dataset.error = ''), { once: true });
      this._img.addEventListener('load', () => delete this.dataset.error, { once: true });
      if (this._img.complete && this._img.naturalWidth === 0) this.dataset.error = '';
    }
    if (ratio) this.style.aspectRatio = ratio;
    else this.style.removeProperty('aspect-ratio');
  }
}

/* ------------------------------------------------------------------ 面 */
export class VkBox extends VkElement {
  render() {
    if (!this._bd) {
      const kids = takeSlot(this);
      const bd = document.createElement('div');
      bd.className = 'vk-box-bd';
      this.replaceChildren(bd);
      fillSlot(bd, kids);
      this._bd = bd;
    }
    const title = attrText(this, 'title');
    const chrome = this.getAttribute('chrome') === 'dots';
    if (!title && !chrome) {
      this._hd?.remove();
      this._hd = null;
      return;
    }
    if (!this._hd) {
      this._hd = document.createElement('header');
      this._hd.className = 'vk-box-hd';
      this.insertBefore(this._hd, this._bd);
    }
    const sig = `${chrome}|${title}`;
    if (this._hdSig === sig) return;
    this._hdSig = sig;
    this._hd.innerHTML = `${chrome ? '<span class="vk-dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}${
      title ? `<span class="vk-box-t">${esc(title)}</span>` : ''
    }`;
  }
}

export function defineElements() {
  define('vk-text', VkText);
  define('vk-label', VkLabel);
  define('vk-inline', VkInline);
  define('vk-img', VkImg);
  define('vk-box', VkBox);
}
