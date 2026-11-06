import { VkElement, define, attrEnum, takeSlot, fillSlot } from './base.mjs';

/**
 * vk-page —— 一帧。
 * 它只做两件事：把作者内容搬进版心，把 align 交给 CSS。
 * 不缩放、不套壳：出片尺寸就是设计尺寸。
 */
export class VkPage extends VkElement {
  render() {
    if (!this._stage) {
      const kids = takeSlot(this);
      const stage = document.createElement('div');
      stage.className = 'vk-stage';
      this.replaceChildren(stage);
      fillSlot(stage, kids);
      this._stage = stage;
    }
    this.dataset.align = attrEnum(this, 'align', 'band');
    // 标题带：首个子栈吃满版心，内容才能在剩余带里居中（.vk-stage > * 的 flex:0 会压住 CSS 规则）。
    const first = this._stage && this._stage.firstElementChild;
    if (first && first.tagName === 'VK-STACK') {
      if (this.dataset.align === 'band') first.style.flex = '1 1 auto';
      else first.style.removeProperty('flex');
    }
  }
}

export function definePage() {
  define('vk-page', VkPage);
}
