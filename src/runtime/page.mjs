/**
 * v24 · 一页的 fit
 * ----------------------------------------------------------------------------
 * 标题带固定以后，正文只剩一块固定高度。内容比它高时按连续比例缩放：
 * 4px 死区、左上对齐、上限 0.96、下限 0.72，不再做 0.9/0.8 离散档。
 *
 * 只在 place=band 上工作；封面/贴顶/贴底是作者明确的构图，不动。
 * 带标注的页面不缩：标注是页面坐标，缩放会把引线/圈和外层拆开。
 * 整帧出血图不参与，否则会把背景图也缩掉。
 */
import { VkElement, define, FIT } from './base.mjs';

const DEADBAND = 4;
const FLOOR_FIT = 0.72;

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
    body.style.removeProperty('align-content');
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
    if (contentH <= bodyH + DEADBAND) return;

    const scale = Math.max(FLOOR_FIT, Math.min(0.96, (bodyH - DEADBAND) / contentH));
    body.style.alignContent = 'start';
    body.style.transformOrigin = 'top left';
    body.style.transform = `scale(${scale.toFixed(4)})`;
    body.setAttribute('data-vk-fit', scale.toFixed(3));
  }
}

define('vk-page', VkPage);
