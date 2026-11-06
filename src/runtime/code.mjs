import { VkElement, define, attrLines, attrEnum, warn } from './base.mjs';
import { FONT, FONT_FLOOR } from '../vocab.mjs';

/**
 * 代码 / 终端 / 差异 / 汇编：构建期已经把行和高亮排好了，
 * 运行期只做两件事：标出「哪一行是当前」，以及**装不下时按比例缩小字号**。
 *
 * size 是上限，不是合同：写 body 表示「最多 56px」，放不下时组件会缩，
 * 缩到 44px 地板还放不下，就交给自检报「文字被裁」——不静默切掉。
 */
const sizePx = (tier) => FONT[tier] || FONT.body;

function fitToBox(host) {
  const win = host.querySelector('.vk-win');
  if (!win) return;
  const start = sizePx(attrEnum(host, 'size') || 'body');
  host.style.setProperty('--vk-cs', `${start}px`);
  // 从起始字号往下试：行号列不随字号等比缩，所以一步算不准，迭代到收敛。
  for (let i = 0; i < 6; i++) {
    let need = 0;
    for (const row of host.querySelectorAll('[data-vk-line]')) need = Math.max(need, row.scrollWidth);
    const have = win.clientWidth;
    const cs = Number.parseFloat(host.style.getPropertyValue('--vk-cs')) || start;
    if (!need || !have) return;
    if (need <= have - 4) return;
    const next = Math.max(FONT_FLOOR, cs * ((have - 6) / need));
    if (Math.abs(next - cs) < 0.4) return;
    host.style.setProperty('--vk-cs', next.toFixed(2) + 'px');
  }
}

/** 一帧里所有行按 current / focus 上状态。 */
function paintState(host) {
  const current = attrLines(host, 'current');
  const focus = attrLines(host, 'focus');
  for (const row of host.querySelectorAll('[data-vk-line]')) {
    const n = Number(row.dataset.vkLine);
    const cur = !!current?.has(n);
    row.classList.toggle('is-current', cur);
    row.classList.toggle('is-dim', !!focus && !focus.has(n) && !cur);
  }
  const win = host.querySelector('.vk-win');
  if (win) {
    win.dataset.chrome = host.getAttribute('chrome') === 'none' ? 'none' : 'min';
    // surface 有默认值（终端默认深色）：没写属性也要落到 DOM，CSS 才挑得中。
    win.dataset.surface = attrEnum(host, 'surface') || 'paper';
  }
}

export class VkCode extends VkElement {
  render() {
    this._mark();
    const lines = this.querySelectorAll('.vk-line[data-vk-line]');
    if (!lines.length) {
      this.stale('缺少预编译的代码');
      return;
    }
    paintState(this);
    this.registerPlace();
  }

  place() {
    fitToBox(this);
  }

  /** mark="malloc"：把窗口里出现的每个词包成 .vk-mark，不碰其它字符。 */
  _mark() {
    for (const old of this.querySelectorAll('.vk-mark')) old.replaceWith(...old.childNodes);
    const word = (this.getAttribute('mark') || '').trim();
    if (!word) return;
    let hit = 0;
    for (const src of this.querySelectorAll('.vk-src')) {
      const walker = document.createTreeWalker(src, NodeFilter.SHOW_TEXT);
      const targets = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.includes(word)) targets.push(n);
      for (const node of targets) {
        hit++;
        const parts = node.textContent.split(word);
        const frag = document.createDocumentFragment();
        parts.forEach((p, i) => {
          if (i) {
            const m = document.createElement('span');
            m.className = 'vk-mark';
            m.textContent = word;
            frag.append(m);
          }
          if (p) frag.append(document.createTextNode(p));
        });
        node.replaceWith(frag);
      }
    }
    if (!hit) warn(this, `mark="${word}" 在这个窗口里找不到：它是一段原文，不是正则`);
  }
}

export class VkTerm extends VkElement {
  render() {
    if (!this.querySelector('.vk-win')) {
      this.stale('缺少预编译的内容');
      return;
    }
    paintState(this);
    this.registerPlace();
  }

  place() {
    fitToBox(this);
  }
}

export class VkDiff extends VkTerm {}
export class VkAsm extends VkTerm {}

export function defineCode() {
  define('vk-code', VkCode);
  define('vk-term', VkTerm);
  define('vk-diff', VkDiff);
  define('vk-asm', VkAsm);
}
