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
    this.dataset.align = attrEnum(this, 'align', 'center');
  }
}

export function definePage() {
  define('vk-page', VkPage);
}
