/**
 * vk-caption —— 旧名，转发到 vk-label。
 *
 * 「你写的 / 编译器给的」这种小字不是块里的标签：它属于目标块。
 * 减法第一波把这件事并进 vk-label：写 for 的 label 就是归属说明。
 *
 * 旧标签继续可用（DOM 仍是 .vk-caption，像素与旧版本一致）：
 *   · anchor="above"（默认）贴在目标块上方，anchor="below" 贴在下方；
 *   · 左边界对齐目标块的首字符（用 Range 量真实字形，不是盒子的左内边）；
 *   · 字号 caption、墨阶 secondary，没有第二套可调外观。
 *
 * 只画覆盖层，不参与正文布局；目标找不到时只警告一次。
 */
import { define } from './base.mjs';
import { VkLabel } from './elements.mjs';

export class VkCaption extends VkLabel {
  connectedCallback() {
    super.connectedCallback?.();
    this.dataset.vkAlias = 'vk-label';
  }

  /** 旧标签本来就是"贴块"：没写 for 时也不该回到正文流里。 */
  _anchored() {
    return true;
  }

  /** 作者内容只在第一次渲染时取一次（之后 DOM 里已经是渲染产物）。 */
  capture() {
    if (this._captured) return;
    this._captured = true;
    this._text = (this.textContent || '').replace(/\s+/g, ' ').trim();
  }
}

export function defineCaption() {
  define('vk-caption', VkCaption);
}
