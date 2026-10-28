import { VkElement, define, takeSlot, fillSlot } from './base.mjs';

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

export function defineCompositions() {
  define('vk-page', VkPage);
}
