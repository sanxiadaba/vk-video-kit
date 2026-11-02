import { VK, esc, numAttr, safePosition, VkElement, define, plain } from './base.mjs';
import { formatNumber } from '../shared/format.mjs';
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
    // src 的自定义 SVG 由构建期内联；运行时保留构建产物，不再覆盖。
    if (this.hasAttribute('src')) return;
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

/**
 * vk-label —— 一行小字：分类、进度、状态。
 *
 * 它是「标签 / 角标」这一个东西：kicker（纯文字）、chip（浅底）、badge（实色）。
 * 字号与色板全部读 vk-text 使用的同一套 token；不写 tone 时走 ink 墨阶。
 * 图标是可选的：写 icon 才出现图标槽，没写就没有空槽（不留幽灵节点）。
 */
export class VkLabel extends VkElement {
  static watchSource = false;
  static frame = false;
  static renderedRoot = '.vk-label';

  render() {
    // 渲染后 textContent 仍是标签文字（图标是 svg，不带字），所以每次都能从 DOM 取回原文。
    const text = (this.textContent || '').replace(/\s+/g, ' ').trim();
    const raw = (this.getAttribute('icon') || '').trim();
    const known = raw ? hasIcon(raw) : false;
    if (raw && !known) this.dataset.vkUnknown = raw;
    else delete this.dataset.vkUnknown;
    // 没写 icon 时不生成 .vk-label-ic：图标槽的存在本身就是作者意图。
    const icon = raw
      ? `<span class="vk-label-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${iconOf(
          known ? raw : 'circle-help'
        )}</svg></span>`
      : '';
    this.innerHTML = `<span class="vk-label" data-vk-part="label" data-meta>${icon}<span class="vk-label-t">${esc(
      text
    )}</span></span>`;
  }
}

/** 纯文本宿主：内容就是子节点，Frame 只负责 w/measure。 */
export class VkText extends VkElement {
  static watchSource = false;

  render() {
    // 14.0：vk-stat 的"数值写法"搬到这里。排版（标签/单位放哪）归配方，
    // 而"52980 写成 52,980"是文本机制，跟着文字走。
    const format = this.getAttribute('format');
    if (!format || format === 'none') return;
    const raw = (this.textContent || '').trim();
    if (!raw || this._formatted) return;
    const next = formatNumber(raw, format);
    if (next !== raw) {
      this._formatted = true;
      this.textContent = next;
    }
  }
}

/**
 * 行内文字：code / math / sup / sub / link。
 * 字号跟所在文本行（1em），不写死；math 由构建期把 KaTeX 产物放进 script。
 */
export class VkInline extends VkElement {
  static watchSource = false;
  static frame = false;

  render() {
    const variant = this.getAttribute('variant') || 'code';
    // 键位：`Ctrl + C` 写成两枚键帽。它和行内代码是同一件事（行内小件），
    // 只是长相不同——14.0 把 vk-keys 并进这里，少一个标签。
    if (variant === 'keys') {
      const raw = (this.textContent || '').replace(/\s+/g, ' ').trim();
      if (raw && !this._keysDone) {
        this._keysDone = true;
        const keys = raw
          .split(/\s+\+\s+/)
          .filter(Boolean)
          .map(
            (k, i) =>
              `${i ? '<span class="vk-keyplus" aria-hidden="true" data-meta>+</span>' : ''}<kbd class="vk-key">${esc(k)}</kbd>`
          )
          .join('');
        this.innerHTML = `<span class="vk-keys" role="group" aria-label="${esc(raw)}">${keys}</span>`;
      }
      return;
    }
    if (variant === 'math' && !this._mathDone) {
      const data = this.querySelector(':scope > script[data-vk-math]');
      if (data) {
        this._mathDone = true;
        const html = data.textContent;
        data.remove();
        this.innerHTML = `<span class="vk-inline-math">${html}</span>`;
      } else {
        this.stale('缺少预编译公式');
      }
    }
    if (variant === 'link' && !this._hrefBound) {
      this._hrefBound = true;
      const href = this.getAttribute('href');
      if (href) {
        this.setAttribute('role', 'link');
        this.setAttribute('tabindex', '0');
        this.style.cursor = 'pointer';
        const go = () => {
          const h = this.getAttribute('href');
          if (h) location.href = h;
        };
        this.addEventListener('click', go);
        this.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            go();
          }
        });
      }
    }
  }
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
  define('vk-label', VkLabel);
  define('vk-inline', VkInline);
  define('vk-rule', VkRule);
}
