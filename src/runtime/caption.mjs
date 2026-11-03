/**
 * vk-caption —— 归属说明。
 *
 * 「你写的 / 编译器给的」这种小字不是块里的标签：它属于目标块。
 * 位置由目标决定：
 *   · anchor="above"（默认）贴在目标块上方，anchor="below" 贴在下方；
 *   · 左边界对齐目标块的首字符（用 Range 量真实字形，不是盒子的左内边）；
 *   · 字号 caption、墨阶 secondary，没有第二套可调外观。
 *
 * 只画覆盖层，不参与正文布局；目标找不到时只警告一次。
 */
import { VK, EDGES, VkElement, define, resolveTarget } from './base.mjs';

/** 目标盒与说明之间的净空。 */
const GAP = 16;

/** 覆盖层只认一个坐标系：最近的定位祖先（没有就退回 body）。 */
function hostOf(el) {
  let host = el.parentElement;
  while (host && getComputedStyle(host).position === 'static') host = host.parentElement;
  if (!host) host = document.body;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  return host;
}

/** 目标块里第一个「真正要读的字」的位置；跳过行号、窗头、无障碍文本。 */
function firstCharRect(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const parent = n.parentElement;
    if (!parent) continue;
    if (parent.closest('[data-meta], .vk-ln, .vk-sr, .vk-hd, .vk-ft, [aria-hidden="true"]')) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    if (rects.length) return rects[0];
  }
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    left: r.left + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0),
    top: r.top + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.borderTopWidth) || 0),
  };
}

export class VkCaption extends VkElement {
  static watchSource = false;
  static frame = false;
  static renderedRoot = '.vk-caption';

  connectedCallback() {
    super.connectedCallback?.();
    this.dataset.vkOverlay = '';
    EDGES.add(this);
  }

  capture() {
    if (this._captured) return;
    this._captured = true;
    this._text = (this.textContent || '').replace(/\s+/g, ' ').trim();
  }

  render() {
    const anchor = this.getAttribute('anchor') === 'below' ? 'below' : 'above';
    this.dataset.anchor = anchor;
    if (!this._span) {
      const span = document.createElement('span');
      span.className = 'vk-caption';
      span.setAttribute('data-vk-part', 'caption');
      this.replaceChildren(span);
      this._span = span;
    }
    this._span.textContent = this._text || '';
    this.style.zIndex = '50';
    this.dataset.vkOverlay = '';
    EDGES.add(this);
    VK._invalidate();
  }

  draw() {
    if (!this.isConnected) return;
    const span = this._span;
    if (!span) return;
    const expr = this.getAttribute('for') || '';
    const target = expr ? resolveTarget(document, expr, this) : null;
    if (!target) {
      span.style.visibility = 'hidden';
      if (expr) this._warnOnce(`for:${expr}`, `的 for="${expr}" 找不到目标块`);
      return;
    }
    const host = hostOf(this);
    const hr = host.getBoundingClientRect();
    if (hr.width < 1 || hr.height < 1) {
      span.style.visibility = 'hidden';
      return;
    }
    const tr = target.getBoundingClientRect();
    if (tr.width < 1 || tr.height < 1) {
      span.style.visibility = 'hidden';
      return;
    }
    const cr = firstCharRect(target);
    const box = span.getBoundingClientRect();
    const above = this.getAttribute('anchor') !== 'below';
    const left = cr.left - hr.left;
    const top = above ? tr.top - hr.top - box.height - GAP : tr.bottom - hr.top + GAP;
    span.style.left = left.toFixed(2) + 'px';
    span.style.top = top.toFixed(2) + 'px';
    span.style.visibility = 'visible';
  }
}

export function defineCaption() {
  define('vk-caption', VkCaption);
}
