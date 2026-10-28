import { VK, esc, numAttr, safePosition, VkElement, define, plain } from './base.mjs';
import { iconOf, hasIcon } from './icons.mjs';

/**
 * vk-icon —— 一个符号。
 * 全量 Lucide；名字不认识时退到 circle-help，并在 dataset 上留痕，审计能查。
 */
export class VkIcon extends VkElement {
  static watchSource = false;
  static frame = false;
  static renderedRoot = '.vk-icon';

  onAttr(name) {
    if (name === 'name' || name === 'label') {
      this.querySelector(':scope > .vk-icon[data-vk-inline]')?.remove();
    }
  }

  render() {
    const inline = this.querySelector(':scope > .vk-icon[data-vk-inline]');
    if (inline && inline.dataset.vkName === (this.getAttribute('name') || 'circle-help')) return;
    const raw = (this.getAttribute('name') || 'circle-help').trim();
    const known = hasIcon(raw);
    const body = known ? iconOf(raw) : iconOf('circle-help');
    const label = this.getAttribute('label') || '';

    if (!known) this.dataset.vkUnknown = raw;
    else delete this.dataset.vkUnknown;

    this.innerHTML = `<span class="vk-icon"${label ? ' role="img"' : ' aria-hidden="true"'}${
      label ? ` aria-label="${esc(label)}"` : ''
    }><svg viewBox="0 0 24 24">${body}</svg></span>`;
  }
}

/**
 * vk-img —— 一张图。
 * 只有它有真实的加载失败态：占位不是装饰，是"这里本该有东西"。
 */
export class VkImg extends VkElement {
  static watchSource = true;
  static frame = false;
  static renderedRoot = '.vk-img';

  capture() {}

  render() {
    this.removeAttribute('data-error');
    const src = this.getAttribute('src') || '';
    const alt = this.getAttribute('alt') || '';
    const ratioRaw = this.getAttribute('ratio') || '';
    const ratio = /^\s*\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*$/.test(ratioRaw) ? ratioRaw : '';
    if (ratioRaw && !ratio) this._warnOnce('ratio', `的 ratio="${ratioRaw}" 不合法，按图片原比例显示`);
    const fit = this.getAttribute('fit') || 'cover';
    const focus = safePosition(this.getAttribute('position') || '50% 50%');
    const radius = this.getAttribute('radius') || '';

    this.innerHTML = `
      <span class="vk-img"${radius ? ` data-radius="${esc(radius)}"` : ''}${ratio ? ` style="aspect-ratio:${esc(ratio)}"` : ''}>
        ${src ? `<img src="${esc(src)}" alt="${esc(alt)}" style="object-fit:${esc(fit)};object-position:${esc(focus)}" loading="eager">` : ''}
        <span class="vk-img-ph"${alt ? ` role="img" aria-label="${esc(alt)}"` : ' aria-hidden="true"'}>${esc(alt || '图')}</span>
      </span>
    `;

    const img = this.querySelector('img');
    if (img) {
      img.addEventListener('error', () => {
        this.setAttribute('data-error', '');
        this.dispatchEvent(new CustomEvent('vk:img-error'));
      }, { once: true });
      img.addEventListener('load', () => {
        this.removeAttribute('data-error');
        this.dispatchEvent(new CustomEvent('vk:img-load'));
      }, { once: true });
      if (img.complete && img.naturalWidth === 0) {
        this.setAttribute('data-error', '');
        this.dispatchEvent(new CustomEvent('vk:img-error'));
      } else if (img.complete) {
        this.dispatchEvent(new CustomEvent('vk:img-load'));
      }
    } else this.setAttribute('data-error', '');

    // 只有显式 w/h 才写尺寸；移除属性时把之前写的尺寸清掉，不留幽灵几何。
    this._geo = this._geo || new Set();
    for (const [attr, prop] of [['w', 'width'], ['h', 'height']]) {
      if (attr === 'h' && ratio) {
        // ratio 与 h 同时给时，比例是作者更明确的意图，不能让固定 h 把它压死。
        this.style.height = '';
        this._geo.delete('height');
        continue;
      }
      if (this.hasAttribute(attr)) {
        this.style[prop] = numAttr(this, attr, { min: attr === 'h' ? 32 : 48, max: attr === 'h' ? 1080 : 1920, fallback: attr === 'h' ? 32 : 48 }) + 'px';
        this._geo.add(prop);
      } else if (this._geo.has(prop)) {
        this.style[prop] = '';
        this._geo.delete(prop);
      }
    }
    VK._invalidate();
  }
}

/**
 * vk-box —— 一个面。
 * 只有 w/h/x/y 需要 JS：它们是任意数值，CSS 里写不出来。
 * 其余（tone/pad/radius/border）全部走 CSS。
 */
export class VkBox extends VkElement {
  static watchSource = false;

  render() {
    // w/h/x/y 由 Frame 原语统一应用；这里只保留一个空渲染。
  }
}

/** 纯文本宿主：内容就是子节点，Frame 只负责 w/measure。 */
export class VkText extends VkElement {
  static watchSource = false;
  render() {}
}

/** 分隔线：Frame 只负责 w；线宽/颜色走 CSS。 */
export class VkRule extends VkElement {
  static watchSource = false;
  render() {}
}

export function defineElements() {
  define('vk-icon', VkIcon);
  define('vk-img', VkImg);
  define('vk-box', VkBox);
  define('vk-text', VkText);
  define('vk-rule', VkRule);
  define('vk-mark', plain());
}
