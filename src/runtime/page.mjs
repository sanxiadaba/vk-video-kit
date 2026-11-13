/**
 * v24 · 一页的 fit
 * ----------------------------------------------------------------------------
 * 标题带固定以后，正文只剩一块固定高度。内容比它高时只做一档 0.9 的
 * 左上对齐缩放：不出现 0.72–0.87 的五种缩印，也不把正文左缘推离标题。
 *
 * 只在 place=band 上工作；封面/贴顶/贴底是作者明确的构图，不动。
 * 带标注的页面不缩：标注是页面坐标，缩放会把引线/圈和外层拆开。
 * 整帧出血图不参与，否则会把背景图也缩掉。
 */
import { VkElement, define, FIT } from './base.mjs';

const FIT_SHALLOW = 0.9;
const FIT_DEEP = 0.8;

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
    if (contentH <= body.clientHeight + 2) return;

    const scale = contentH / body.clientHeight > 1.12 ? FIT_DEEP : FIT_SHALLOW;
    body.style.alignContent = 'start';
    body.style.transformOrigin = 'top left';
    body.style.transform = `scale(${scale})`;
    body.setAttribute('data-vk-fit', String(scale));
  }
}

define('vk-page', VkPage);
