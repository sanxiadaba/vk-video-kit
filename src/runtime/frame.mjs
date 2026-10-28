/* ============================================================================
   runtime · Frame
   ----------------------------------------------------------------------------
   所有块级组件共享的尺寸/溢出契约。只做四件事：

   · w       数字=硬宽；fit=内容宽；full=100%；不写=交给 CSS 默认（块级 100%）
   · h       数字=硬高；full=100%；不写=auto
   · x/y     有值=绝对定位（canvas 坐标）
   · 溢出    统一检测，返回 {el, sel, sw, cw, sh, ch}，不静默裁切

   measure / grow / fill / overflow 是 CSS 属性，这里不写 inline。
   ========================================================================== */

const num = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * 把 w/h/x/y 应用到宿主。重复调用安全；移除属性会清掉上一次写的内联值。
 * @param {HTMLElement} el
 */
export function applyFrame(el) {
  const geo = el._frameGeo || (el._frameGeo = new Set());
  const set = (prop, value) => {
    if (value == null || value === '') {
      if (geo.has(prop)) {
        el.style[prop] = '';
        geo.delete(prop);
      }
      return;
    }
    if (el.style[prop] !== value) el.style[prop] = value;
    geo.add(prop);
  };

  const w = el.getAttribute('w');
  if (w === 'fit') set('width', 'fit-content');
  else if (w === 'full') set('width', '100%');
  else if (w != null && w !== '') {
    const n = num(w);
    if (n != null) set('width', `${n}px`);
  } else set('width', null);

  const h = el.getAttribute('h');
  if (h === 'fit') set('height', 'fit-content');
  else if (h === 'full') set('height', '100%');
  else if (h != null && h !== '') {
    const n = num(h);
    if (n != null) set('height', `${n}px`);
  } else set('height', null);

  const x = el.getAttribute('x');
  const y = el.getAttribute('y');
  const hasX = x != null && x !== '' && num(x) != null;
  const hasY = y != null && y !== '' && num(y) != null;
  if (hasX) set('left', `${num(x)}px`);
  else set('left', null);
  if (hasY) set('top', `${num(y)}px`);
  else set('top', null);

  if (hasX || hasY) {
    el.style.position = 'absolute';
    el._frameAbs = true;
  } else if (el._frameAbs) {
    el.style.position = '';
    el._frameAbs = false;
  }
}

/** 需要检查溢出的内部盒子。选择器是“内容容器”，不是宿主。 */
const OVERFLOW_SELECTORS = [
  '.vk-bd',
  '.vk-dbd',
  '.vk-bd > table',
  '.vk-fig-url',
  '.vk-br-url',
  '.vk-tree-bd',
];

/**
 * 全页溢出审计。返回每一项：{ tag, cls, sel, sw, cw, sh, ch }。
 * 只报“内容比盒子宽/高”，不判断是否该换行；是否可接受由调用方决定。
 */
export function auditOverflow(root = document) {
  const out = [];
  if (!root?.querySelectorAll) return out;
  for (const host of root.querySelectorAll('vk-code, vk-term, vk-diff, vk-table, vk-figure, vk-tree, vk-bytes, vk-callout, vk-title, vk-list')) {
    // 表格自己就是滚动盒：先看宿主。
    if (host.tagName === 'VK-TABLE' && host.scrollWidth > host.clientWidth + 1) {
      out.push({ tag: 'vk-table', cls: 'host', sel: 'vk-table', sw: host.scrollWidth, cw: host.clientWidth, sh: host.scrollHeight, ch: host.clientHeight });
    }
    for (const el of host.querySelectorAll(OVERFLOW_SELECTORS.join(','))) {
      const sw = el.scrollWidth;
      const cw = el.clientWidth;
      const sh = el.scrollHeight;
      const ch = el.clientHeight;
      if (sw > cw + 1 || sh > ch + 1) {
        out.push({
          tag: host.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 60),
          sel: el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(/\s+/)[0]}` : ''),
          sw,
          cw,
          sh,
          ch,
        });
      }
    }
  }
  return out;
}
