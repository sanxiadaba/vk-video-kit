/**
 * v19 · 自检与度量
 * ----------------------------------------------------------------------------
 * 硬错只有五类（无论怎么画都错）：
 *   1. 没有 <vk-page>，或画布不是 1920×1080
 *   2. 组件自己渲染失败
 *   3. 资源加载失败（图片、字体）
 *   4. 文字被裁 / 内容出界
 *   5. 锚点指空
 *
 * 其余（容量、留白、重叠、焦点数、对比度、字号）只报数，不拦。
 * 这不是门禁，是让作者看见。
 */

const PAGE_W = 1920;
const PAGE_H = 1080;

const rgb = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
  return { r, g, b, a };
};

const lum = ({ r, g, b }) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const ratio = (a, b) => {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

function bgOf(el) {
  let n = el;
  while (n && n.nodeType === 1) {
    const c = rgb(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0.5) return c;
    n = n.parentElement;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

/** 真正有字/有图的那一块：用文本 Range 与图片矩形量，不用容器盒子（容器会被 grid 拉高）。 */
function inkBoxOf(stage) {
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  const add = (r) => {
    if (r.width < 1 && r.height < 1) return;
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
  };
  const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    if (n.parentElement?.closest('.vk-sr')) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) add(r);
  }
  for (const el of stage.querySelectorAll('img, svg.vk-gedges, .vk-co-ring, .vk-co-line, .vk-tl-dot, .vk-bit, .vk-cell, .vk-tl-i')) add(el.getBoundingClientRect());
  return Number.isFinite(top) ? { top, bottom, left, right } : null;
}

export function auditPage(stage) {
  const issues = [];
  const elements = [];
  const overlaps = [];
  const contrast = [];
  const push = (code, message, fix) => issues.push({ code, message, fix });

  const page = stage?.closest?.('vk-page');
  if (!page) {
    return { issues: [{ code: 'frame', message: '这一页没有 <vk-page>', fix: '把内容包进 <vk-page>…</vk-page>' }], metrics: null, elements, overlaps, contrast };
  }
  const pr = page.getBoundingClientRect();
  if (Math.round(pr.width) !== PAGE_W || Math.round(pr.height) !== PAGE_H) {
    push('frame', `画布是 ${Math.round(pr.width)}×${Math.round(pr.height)}，不是 1920×1080`, '检查页面样式是否覆盖了 vk-page 的宽高');
  }

  /* 2. 渲染失败 */
  for (const el of page.querySelectorAll('[data-vk-error]')) push('render', `<${el.localName}> 渲染失败`, '看控制台里的 [vk] 错误；这是组件抛的，不是版式问题');

  /* 3. 资源 */
  for (const img of page.querySelectorAll('vk-img img')) {
    if (img.complete && img.naturalWidth === 0) {
      const host = img.closest('vk-img');
      push('asset', `图片没加载：${img.getAttribute('src') || '(没有 src)'}`, host?.getAttribute('alt') ? `alt="${host.getAttribute('alt')}"` : '检查路径是否相对页面文件');
    }
  }
  for (const f of window.vk?._fonts || []) {
    if (!f.ok) push('asset', `字体没加载：${f.family}`, '跑一次 vk render 会重建字体；检查 assets/fonts 是否完整');
  }

  /* 5. 锚点 */
  for (const el of page.querySelectorAll('vk-callout[data-vk-anchor-missing]')) {
    const target = el.getAttribute('for') || el.getAttribute('to') || el.getAttribute('from') || '';
    push('anchor', `标注指不到东西：${target}`, '锚点只认 #id / #id@line:3 / #id@item:2 / #id@side:left；@line 是窗口里第几行，1 起');
  }

  /* 4. 文字超出容器（横向） */
  for (const el of page.querySelectorAll('.vk-lc, .vk-dc, .vk-title, .vk-lede, .vk-tl-label, .vk-tl-note, .vk-bar-l, vk-table td, vk-table th, .vk-step-t, .vk-cell-v')) {
    if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
      push('clipped', `<${el.localName} class="${String(el.className).split(' ')[0]}"> 的文字超出容器（宽 ${el.scrollWidth} > ${el.clientWidth}）`, '缩短这一行、拆帧，或让代码窗换行（long="wrap"）');
    }
  }
  for (const el of page.querySelectorAll('.vk-lines')) {
    if (el.scrollWidth > el.clientWidth + 4) push('clipped', '代码窗横向被裁：字号已经缩到地板，仍然放不下', '把最长的行改短，或拆成两帧');
  }

  /* 4. 墨迹出界 */
  const ink = inkBoxOf(stage);
  if (ink) {
    const bottom = ink.bottom - pr.top;
    const top = ink.top - pr.top;
    if (bottom > PAGE_H + 2) push('clipped', `内容超出画布底部 ${Math.round(bottom - PAGE_H)}px`, '拆帧，或改用更少的内容');
    if (top < -2) push('clipped', `内容超出画布顶部 ${Math.round(-top)}px`, '检查是否用了绝对定位');
  }

  const safeH = 888;
  const metrics = ink
    ? {
        contentTop: Math.max(0, Math.round(ink.top - pr.top)),
        contentBottom: Math.round(ink.bottom - pr.top),
        contentLeft: Math.max(0, Math.round(ink.left - pr.left)),
        contentRight: Math.round(ink.right - pr.left),
        fill: Math.round(((ink.bottom - ink.top) / safeH) * 100),
        focus: 0,
      }
    : { contentTop: 0, contentBottom: 0, contentLeft: 0, contentRight: 0, fill: 0, focus: 0 };

  /* 焦点：按「看这里」的所在组件计数，同一个组件里多处高亮算一处。 */
  const focusHosts = new Set();
  for (const el of page.querySelectorAll('[data-state="current"], .is-cur, em, [tone="focus"], .vk-co-ring')) {
    const host = el.closest('vk-code, vk-cells, vk-bytes, vk-table, vk-list, vk-steps, vk-bars, vk-timeline, vk-graph, vk-tree, vk-head, vk-text, .vk-tl-i, .vk-gnode') || el;
    focusHosts.add(host);
  }
  metrics.focus = focusHosts.size;

  /* 元素清单（frame.json）：只列 vk-* 与标题行，坐标相对页面。 */
  for (const el of page.querySelectorAll('vk-page *')) {
    if (el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (!el.localName.startsWith('vk-') && !el.classList.contains('vk-title')) continue;
    elements.push({
      tag: el.localName,
      id: el.id || '',
      x: Math.round(r.left - pr.left),
      y: Math.round(r.top - pr.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      fs: Math.round(parseFloat(getComputedStyle(el).fontSize) || 0),
    });
  }

  /* 重叠：同一层相邻块之间有明显相交才报。 */
  const groups = [page.querySelector('.vk-body'), ...page.querySelectorAll('vk-flow')].filter(Boolean);
  for (const g of groups) {
    const kids = [...g.children].filter((c) => c.localName.startsWith('vk-') && !c.closest('vk-callout'));
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect();
        const b = kids[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w <= 2 || h <= 2) continue;
        const area = w * h;
        const min = Math.min(a.width * a.height, b.width * b.height);
        if (min > 0 && area / min > 0.06) overlaps.push({ a: kids[i].localName, b: kids[j].localName, area: Math.round(area) });
      }
    }
  }

  /* 对比度：文字元素的实际颜色 vs 最近的实底。 */
  for (const el of page.querySelectorAll('vk-text, .vk-title, .vk-lede, vk-code, vk-table, vk-tree, vk-cells, vk-bars, vk-timeline, vk-steps, vk-list, .vk-co-note')) {
    const cs = getComputedStyle(el);
    const fg = rgb(cs.color);
    if (!fg) continue;
    const r = ratio(fg, bgOf(el));
    if (r < 4.5) contrast.push({ text: (el.textContent || '').trim().slice(0, 24), ratio: Number(r.toFixed(2)), size: Math.round(parseFloat(cs.fontSize) || 0) });
  }

  return { issues, metrics, elements, overlaps, contrast };
}

export function auditDocument() {
  return [...document.querySelectorAll('.vk-stage')].map((stage) => auditPage(stage));
}

if (typeof window !== 'undefined') {
  window.vk ||= {};
  window.vk.auditPage = auditPage;
  window.vk.auditDocument = auditDocument;
}
