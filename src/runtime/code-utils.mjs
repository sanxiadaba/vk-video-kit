/** 代码块用到的 DOM 辅助；纯函数在 src/shared/code.mjs。 */
export { tokenDiff } from '../shared/code.mjs';

/**
 * 代码内 token 强调：mark="name" / mark="name,fallback"。
 * 只走文本节点，不碰标签；按标识符边界匹配；注释和字符串里的同名文字不标。
 */
export function markTerms(root, terms) {
  if (!root || !terms.length) return;
  const alts = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  let re;
  try {
    re = new RegExp(`(?<![\\w$])(?:${alts})(?![\\w$])`, 'g');
  } catch {
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const host = node.parentElement;
    if (!host || host.closest('.vk-c, .vk-s, .vk-com')) continue;
    const text = node.nodeValue;
    let m;
    let last = 0;
    let frag = null;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      if (!frag) frag = document.createDocumentFragment();
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const mark = document.createElement('mark');
      mark.className = 'vk-tok';
      mark.textContent = m[0];
      frag.appendChild(mark);
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (!frag) continue;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  }
}

/**
 * 把一个字符区间包成 span（可重复调用：同一个 key 会先拆掉旧包）。
 * 返回第一个包好的 span，供 vk-edge 之类需要"指到字符"的地方取包围盒。
 */
export function wrapCharRange(root, start, end, cls = 'vk-dw', key = '') {
  if (!root) return null;
  if (key) {
    for (const old of root.querySelectorAll(`[data-vk-range="${key}"]`)) {
      old.replaceWith(...old.childNodes);
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets = [];
  let pos = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const len = node.nodeValue.length;
    const s = Math.max(start - pos, 0);
    const e = Math.min(end - pos, len);
    if (s < e) targets.push({ node, s, e });
    pos += len;
  }
  let first = null;
  for (const { node, s, e } of targets) {
    const mid = node.splitText(s);
    mid.splitText(e - s);
    const span = document.createElement('span');
    span.className = cls;
    if (key) span.dataset.vkRange = key;
    mid.replaceWith(span);
    span.appendChild(mid);
    if (!first) first = span;
  }
  return first;
}

export function wrapRange(root, start, end) {
  return wrapCharRange(root, start, end, 'vk-dw', '');
}
