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
  if (win) win.dataset.chrome = host.getAttribute('chrome') === 'none' ? 'none' : 'min';
}

export class VkCode extends VkElement {
  render() {
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
