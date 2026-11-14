/**
 * v24 · 需要测量的两个件：源码窗（按宽/高缩放）与图片（失败态）。
 * 其余组件的几何在构建期已经定完，运行期不碰。
 */
import { VkElement, define } from './base.mjs';
import { FLOOR } from '../vocab.mjs';

/**
 * 源码窗：
 * 1. 先向上长到 84：短代码不要永远缩在 56，窗内右半边空着。
 * 2. 长行再往下缩到 40；地板仍放不下，交给自检报「被裁」。
 * 3. 长高受页面底边约束，绝不为放大而把整页顶出去。
 */
export class VkCode extends VkElement {
  static __observed = ['size'];

  paint() {
    const lines = this.querySelector('.vk-lines');
    if (!lines) return;
    this.style.removeProperty('font-size');
    const base = parseFloat(getComputedStyle(lines).fontSize) || 56;
    const page = this.closest('vk-page');
    const body = this.closest('.vk-body');
    const limit = body || page;
    const overflows = () => [...this.querySelectorAll('.vk-lc, .vk-dc, .vk-aops')].some((el) => el.scrollWidth > el.clientWidth + 1);
    const outOfPage = () => !!limit && this.getBoundingClientRect().bottom > limit.getBoundingClientRect().bottom - 8;

    let px = base;
    const longest = Math.max(0, ...[...this.querySelectorAll('.vk-lc, .vk-dc')].map((el) => el.textContent.length));
    const slack = [...this.querySelectorAll('.vk-lc, .vk-dc')].every((el) => el.scrollWidth < el.clientWidth * 0.72);
    if (longest <= 28 && slack) {
      while (px < 84) {
        const next = Math.min(84, px + 2);
        this.style.fontSize = `${next}px`;
        if (overflows() || outOfPage()) {
          this.style.fontSize = `${px}px`;
          break;
        }
        px = next;
      }
    }

    while (px > FLOOR && overflows()) {
      px = Math.max(FLOOR, px - 2);
      this.style.fontSize = `${px}px`;
    }
    if (px === FLOOR) this.style.fontSize = `${FLOOR}px`;
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
