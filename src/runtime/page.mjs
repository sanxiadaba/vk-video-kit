/**
 * v24 · 一页的 fit
 * ----------------------------------------------------------------------------
 * 标题带固定以后，正文只剩一块固定高度。内容比它高时不再硬顶出底部，
 * 而是整块等比缩到能放下的最大比例；内容比它矮时由 CSS 居中。
 *
 * 只在 place=band 上工作；封面/贴顶/贴底是作者明确的构图，不动。
 * 带标注的页面不缩：标注是页面坐标，缩放会把引线/圈和外层拆开。
 * 整帧出血图不参与，否则会把背景图也缩掉。
 */
import { VkElement, define, FIT } from './base.mjs';

const MIN_FIT = 0.72;

export class VkPage extends VkElement {
  static __observed = ['place'];

  connectedCallback() {
    super.connectedCallback();
    FIT.add(this);
  }

  disconnectedCallback() {
    FIT.delete(this);
    super.disconnectedCallback?.();
  }

  fit() {
    const body = this.querySelector('.vk-body');
    if (!body) return;
    body.style.removeProperty('transform');
    body.style.removeProperty('transform-origin');
    body.removeAttribute('data-vk-fit');
    if ((this.getAttribute('place') || 'band') !== 'band') return;
    if (this.querySelector('vk-callout')) return;
    if (this.querySelector('vk-img[bleed="all"]')) return;

    const kids = [...body.children].filter((el) => el.getBoundingClientRect().height > 2);
    if (!kids.length) return;
    const top = Math.min(...kids.map((el) => el.getBoundingClientRect().top));
    const bottom = Math.max(...kids.map((el) => el.getBoundingClientRect().bottom));
    const contentH = bottom - top;
    const bodyH = body.clientHeight;
    if (contentH <= bodyH + 2) return;

    const s = Math.max(MIN_FIT, bodyH / contentH);
    body.style.transformOrigin = 'center center';
    body.style.transform = `scale(${s.toFixed(4)})`;
    body.setAttribute('data-vk-fit', s.toFixed(3));
  }
}

define('vk-page', VkPage);
