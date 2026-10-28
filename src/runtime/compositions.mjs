import { VK, VkElement, define, esc, takeSlot, fillSlot, resolveTarget, numAttr } from './base.mjs';
import { wrapCharRange } from './code-utils.mjs';
import { roundedPath } from './geometry.mjs';

const num = (v, fallback) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/* ------------------------------------------------------------------- page */

/**
 * 一页 1080p 的画布工具：固定 1920×1080，按容器宽度等比缩放。
 */
export class VkPage extends VkElement {
  static watchSource = true;
  static frame = false;
  static slot = true;
  static slotHost = '.vk-page-bd';
  static renderedRoot = '.vk-page';

  render() {
    const w = 1920;
    const h = 1080;
    const align = this.getAttribute('align') === 'center' ? 'center' : 'top';

    if (!this._shell) {
      const body = takeSlot(this);
      // 坐标系根：只有 1920×1080 与安全区。全库只有白纸一种材质。
      this.innerHTML = `<div class="vk-page" data-align="top" style="--pw:${w}px;--ph:${h}px">
        <div class="vk-page-inner"><div class="vk-page-bd" data-vk-part="bd"></div></div>
      </div>`;
      this._shell = this.querySelector('.vk-page');
      this._bd = this.querySelector('.vk-page-bd');
      fillSlot(this._bd, body);
      this.dataset.vkPlace = '';
    }

    this._shell.dataset.align = align;
    this._apply();
  }

  connectedCallback() {
    super.connectedCallback?.();
    if (this._done) this._watch();
  }

  _watch() {
    if (this._ro || typeof ResizeObserver === 'undefined') return;
    this._ro = new ResizeObserver(() => this._apply());
    this._ro.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    this._ro?.disconnect();
    this._ro = null;
  }

  place() {
    this._apply();
  }

  _apply() {
    const inner = this._shell || this.querySelector('.vk-page');
    if (!inner) return;
    // 不缩放：出片尺寸就是设计尺寸，缩放属于预览器（vk shot）而不是组件。
    inner.style.width = '1920px';
    inner.style.height = '1080px';
    inner.style.transform = '';
    if (this.style.height !== '1080px') this.style.height = '1080px';
  }
}

/* --------------------------------------------------------------- annotate */

let ANNO_SEQ = 0;

/**
 * 行旁批注。
 *
 *   <vk-annotate w="600">
 *     <vk-code id="a" …>…</vk-code>
 *     <vk-note line="2">这一行在栈上开了 6 个字节。</vk-note>
 *   </vk-annotate>
 *
 * 绑定代码行的批注：按行心对齐、贴在该行右侧，行号旁出现蓝点。
 * 关系由"对齐"表达，不画长引线。
 * 只有 for="#id" 指向非代码元素时，才画一条短引线（圆点在目标上）。
 */
export class VkNote extends VkElement {
  static watchSource = true;
  static slot = true;
  static slotHost = '.vk-note-b';
  static renderedRoot = '.vk-note';

  render() {
    const tone = this.getAttribute('tone') || 'accent';
    const n = this.getAttribute('n') || '';
    if (!this._shell) {
      const body = takeSlot(this);
      this.innerHTML = '<div class="vk-note" data-tone="accent"><span class="vk-note-b"></span></div>';
      this._shell = this.querySelector('.vk-note');
      this._body = this.querySelector('.vk-note-b');
      fillSlot(this._body, body);
    }
    this._shell.dataset.tone = tone;
    const emphasis = this.getAttribute('emphasis');
    if (emphasis) this._shell.dataset.emphasis = emphasis;
    else delete this._shell.dataset.emphasis;
    let num = this._body.querySelector(':scope > .vk-anno-n');
    if (n) {
      if (!num) {
        num = document.createElement('span');
        num.className = 'vk-anno-n';
        num.setAttribute('data-meta', '');
        this._body.prepend(num);
      }
      num.textContent = n;
    } else if (num) {
      num.remove();
    }
  }
}

export function defineCompositions() {
  define('vk-page', VkPage);
  // 先定义 vk-note：annotate 升级时要能拿到已经渲染好的批注体。
  define('vk-note', VkNote);
}
