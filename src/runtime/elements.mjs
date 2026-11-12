/**
 * v19 · 需要测量的两个件：源码窗（缩字号）与图片（失败态）。
 * 其余组件的几何在构建期已经定完，运行期不碰。
 */
import { VkElement, define } from './base.mjs';
import { FLOOR } from '../vocab.mjs';

/** 源码窗：窗太窄时把字号往下缩，缩到 44 为止；再放不下就交给自检报「被裁」。 */
export class VkCode extends VkElement {
  static __observed = ['size', 'long'];

  paint() {
    if (this.getAttribute('long') === 'wrap') {
      this.style.removeProperty('font-size');
      return;
    }
    const lines = this.querySelector('.vk-lines');
    if (!lines) return;
    this.style.removeProperty('font-size');
    const base = parseFloat(getComputedStyle(lines).fontSize) || 56;
    if (base <= FLOOR) return;
    let px = base;
    const overflows = () => [...this.querySelectorAll('.vk-lc')].some((el) => el.scrollWidth > el.clientWidth + 1);
    if (!overflows()) return;
    while (px > FLOOR) {
      px = Math.max(FLOOR, px - 2);
      this.style.fontSize = `${px}px`;
      if (!overflows()) return;
    }
    this.style.fontSize = `${FLOOR}px`;
  }
}

/** 图片：加载失败时把 alt 显示出来，而不是留一块灰。 */
export class VkImg extends VkElement {
  static __observed = ['src'];

  paint() {
    const img = this.querySelector('img');
    if (!img) return;
    this.removeAttribute('data-broken');
    const broken = () => {
      this.setAttribute('data-broken', this.getAttribute('alt') || '图片没加载');
    };
    img.addEventListener('error', broken, { once: true });
    if (img.complete && img.naturalWidth === 0) broken();
  }
}

define('vk-code', VkCode);
define('vk-img', VkImg);
