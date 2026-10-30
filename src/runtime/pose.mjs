/**
 * L5 姿态层：一处注意力词汇。
 *
 *   act      做什么动作   focus / context / mark / trace / badge / compare
 *   strength 多响         solid / soft / ghost
 *
 * 作者只写这两个属性，运行期把它们折成 data-act / data-strength，
 * 再由 CSS 给唯一配方。旧词（tone="focus" / state="current"）仍然能用，
 * 但会被翻译成同一套数据属性——这样库里只有一条注意力路径。
 */

const ACTS = new Set(['focus', 'context', 'mark', 'trace', 'badge', 'compare']);
const STRENGTHS = new Set(['solid', 'soft', 'ghost']);

/** 行/格这类「叶子」：focus 落成 data-state="current"，沿用已有的行配方。 */
const ROWISH = '.vk-cell, .vk-line, .vk-tree-row, .vk-step, .vk-tl-item, .vk-bit-row, .vk-bar, tbody tr, .vk-asm-row, .vk-bytes-row';

/** 块/文字这类「整块」：focus 落成钴蓝 ink（tone 的注意力一侧）。 */
const BLOCKISH = 'vk-stat, vk-text, vk-quote, vk-callout, vk-title, vk-tag';

function dimSiblings(el, amount) {
  const stop = el.closest('[data-act="context"]');
  let node = el;
  while (node && node !== stop?.parentElement) {
    const parent = node.parentElement;
    if (!parent) break;
    for (const sib of parent.children) {
      if (sib === node) continue;
      if (sib.hasAttribute?.('data-vk-keep') || sib.matches?.('[act="context"]')) continue;
      if (!sib.style) continue;
      sib.style.opacity = String(amount);
      sib.dataset.vkDimmed = '1';
    }
    node = parent;
    if (stop && parent === stop) break;
  }
}

function apply(el) {
  const act = el.getAttribute('act');
  if (!act || !ACTS.has(act)) return;
  const strength = STRENGTHS.has(el.getAttribute('strength')) ? el.getAttribute('strength') : 'solid';

  el.dataset.act = act;
  el.dataset.strength = strength;

  if (act === 'focus') {
    // 一个 focus 就是一个 region：行上色、块改 ink，配方各有各的，语义只这一条。
    if (el.matches(ROWISH)) {
      if (!el.hasAttribute('state')) el.dataset.state = 'current';
    } else if (el.matches(BLOCKISH)) {
      if (!el.hasAttribute('tone')) el.setAttribute('tone', 'focus');
    }
  }

  if (act === 'context') {
    const amount = strength === 'ghost' ? 0.5 : strength === 'soft' ? 0.34 : 0.28;
    dimSiblings(el, amount);
  }
}

export function poseAll(root = document) {
  for (const el of root.querySelectorAll('[act]')) apply(el);
}

export function installPose(VK) {
  // Node 里导入包（SSR / 类型检查）时没有 document，直接退出。
  if (typeof document === 'undefined') return;
  let queued = false;
  const run = () => {
    const root = VK.page?.() || document;
    poseAll(root);
    // 组件是异步渲染的：格子/行晚于首帧出现，所以订阅 DOM 变化再补跑。
    if (!run.observer) {
      run.observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          poseAll(VK.page?.() || document);
        });
      });
      run.observer.observe(root, { childList: true, subtree: true });
    }
    requestAnimationFrame(() => poseAll(VK.page?.() || document));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  VK.pose = () => {
    const root = VK.page?.() || document;
    for (const el of root.querySelectorAll('[data-vk-dimmed]')) {
      el.style.opacity = '';
      delete el.dataset.vkDimmed;
    }
    poseAll(root);
  };
}


