import { VkElement, define, attrLines, attrEnum } from './base.mjs';

/**
 * 代码 / 终端 / 差异 / 汇编：构建期已经把行和高亮排好了，
 * 运行期只做两件事：标出"哪一行是当前"，以及**装不下时按比例缩小字号**。
 *
 * 自适应是这本库的态度：默认不折行、不裁掉内容，组件自己保证装得下，
 * 而不是让作者去猜"这行会不会被切掉"。
 */
const BASE = 56;
const FLOOR = 36;

function fitToBox(host) {
  const win = host.querySelector('.vk-win');
  if (!win || host.hasAttribute('size')) return;
  host.style.setProperty('--vk-cs', BASE + 'px');
  // 从基准字号往下试：行号列不随字号等比缩，所以一步算不准，迭代到收敛。
  for (let i = 0; i < 5; i++) {
    let need = 0;
    for (const row of host.querySelectorAll('[data-vk-line]')) need = Math.max(need, row.scrollWidth);
    const have = win.clientWidth;
    const cs = Number.parseFloat(host.style.getPropertyValue('--vk-cs')) || BASE;
    if (!need || !have) return;
    if (need <= have - 4) return;
    const next = Math.max(FLOOR, cs * ((have - 6) / need));
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
    const s = host.getAttribute('surface');
    if (s) win.dataset.surface = s;
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
    this.style.setProperty('--vk-cs', `var(--vk-fs-${attrEnum(this, 'size', 'body')})`);
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
    for (const src of this.querySelectorAll('.vk-src')) {
      const walker = document.createTreeWalker(src, NodeFilter.SHOW_TEXT);
      const targets = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.includes(word)) targets.push(n);
      for (const node of targets) {
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
  }
}

export class VkTerm extends VkElement {
  render() {
    if (!this.querySelector('.vk-win')) {
      this.stale('缺少预编译的内容');
      return;
    }
    paintState(this);
    // 写了 size 就按它来（fitToBox 不再改字号）；没写则由 fitToBox 自适应。
    if (this.hasAttribute('size')) this.style.setProperty('--vk-cs', `var(--vk-fs-${attrEnum(this, 'size', 'body')})`);
    else this.style.removeProperty('--vk-cs');
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
