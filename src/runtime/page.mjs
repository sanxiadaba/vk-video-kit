import { VkElement, define, takeSlot, fillSlot } from './base.mjs';

/* ------------------------------------------------------------------- page */

/**
 * 一页 1080p 的画布：固定 1920×1080，不缩放。
 *
 * 只有两层：内容层（版心）与出血层（铺满整帧的背景图/色带）。
 * 出血层只收直接子节点上写 bleed="all" 的图/面；其余内容一律守版心。
 */
export class VkPage extends VkElement {
  static watchSource = true;
  static frame = false;
  static slot = true;
  static slotHost = '.vk-page-bd';
  static renderedRoot = '.vk-page';

  render() {
    const rawAlign = this.getAttribute('align');
    const align = rawAlign === 'center' || rawAlign === 'bottom' ? rawAlign : 'top';

    if (!this._shell) {
      const body = takeSlot(this);
      // 出血层只收“铺满整帧”的直接子节点。
      const bleed = body.filter((n) => n.nodeType === 1 && n.getAttribute('bleed') === 'all');
      const rest = body.filter((n) => !bleed.includes(n));
      this.innerHTML = `<div class="vk-page" data-align="top" style="--pw:1920px;--ph:1080px">
        <div class="vk-page-bleed" aria-hidden="true"></div>
        <div class="vk-page-inner"><div class="vk-page-bd" data-vk-part="bd"></div></div>
      </div>`;
      this._shell = this.querySelector('.vk-page');
      this._bd = this.querySelector('.vk-page-bd');
      this._bleed = this.querySelector('.vk-page-bleed');
      fillSlot(this._bleed, bleed);
      fillSlot(this._bd, rest);
      this.dataset.vkPlace = '';
    }

    this._shell.dataset.align = align;
    this._apply();
  }

  connectedCallback() {
    super.connectedCallback?.();
    this._watch();
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
    if (this.style.height !== '1080px') this.style.height = '1080px';
  }
}

export function definePage() {
  define('vk-page', VkPage);
}
