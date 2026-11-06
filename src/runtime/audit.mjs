/* ============================================================================
   v18 · 自检
   ----------------------------------------------------------------------------
   只判五类「无法辩解」的事，每类一条，报根因不报后代：

     frame    这一页没有 <vk-page>，或者画布不是 1920×1080
     render   件自己抛了错（脚本异常 / 缺预编译数据）
     asset    资源加载失败（图片、字体、脚本）
     clipped  文字被裁掉了（横向或纵向，含祖先的 overflow）
     anchor   标注指向空气（for / from / to 解析不到）

   版式判断（出安全区、重叠、留白、焦点数、对比度、密度）不进自检：
   它们要么靠默认值和组件自适应保证，要么是作者的选择。
   这些只作为 metrics 打印出来，不阻止出图。

   每个 issue 的形状固定：{ code, message, fix, rect? }。给机器读也给 AI 读。
   ========================================================================== */

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const TOL = 2;

const name = (el) => {
  const id = el.id ? `#${el.id}` : '';
  const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '';
  return `<${el.localName}${id}${cls}>`;
};

const isOverlay = (el) => !!el.closest('vk-callout');
const isDeco = (el) => !!el.closest('[data-vk-deco], .katex, svg');

/** 元素自己的文字（不含子元素里的）。 */
const ownText = (el) => {
  for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
  return false;
};

/** 元素里所有文字的墨迹矩形（不是盒子）。 */
function inkRect(el) {
  const range = document.createRange();
  let box = null;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width < 0.5 || r.height < 0.5) continue;
      box = box
        ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) }
        : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
  }
  return box;
}

const CLIP = new Set(['hidden', 'clip', 'auto', 'scroll']);

export function auditPage(stageEl) {
  const stage = stageEl || document.querySelector('.vk-stage');
  if (!stage) return { issues: [{ code: 'frame', message: '这一页没有 <vk-page>', fix: '把内容包进 <vk-page>…</vk-page>' }] };

  const issues = [];
  const page = stage.closest('vk-page');
  const sr = stage.getBoundingClientRect();
  const scale = stage.offsetWidth ? sr.width / stage.offsetWidth : 1;

  /* frame：画布尺寸。 */
  if (page) {
    const pr = page.getBoundingClientRect();
    const w = Math.round(pr.width / scale);
    const h = Math.round(pr.height / scale);
    if (w !== CANVAS_W || h !== CANVAS_H) {
      issues.push({ code: 'frame', message: `画布是 ${w}×${h}，不是 ${CANVAS_W}×${CANVAS_H}`, fix: '别给 vk-page 写宽高：一帧就是 1920×1080' });
    }
  }

  /* clipped（一）：整块超出画布。图片、表格这类没有文字的元素也查。 */
  {
    let worst = null;
    let over = 0;
    for (const el of stage.querySelectorAll('*')) {
      if (isOverlay(el) || isDeco(el) || el.closest('[bleed]')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const d = Math.max(0, sr.top - r.top, r.bottom - sr.bottom, sr.left - r.left, r.right - sr.right);
      if (d > over + 1) {
        over = d;
        worst = el;
      }
    }
    if (worst && over > 4) {
      issues.push({
        code: 'clipped',
        message: `${name(worst)} 超出画布 ${Math.round(over / (scale || 1))}px`,
        fix: '删内容、降一级 gap、把图改小，或者拆一帧',
      });
    }
  }

  /* clipped（二）：文字被任何一个祖先的 overflow 裁掉。 */
  const seen = new Set();
  for (const el of stage.querySelectorAll('*')) {
    if (seen.has(el) || isOverlay(el) || isDeco(el)) continue;
    if (!ownText(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) continue;
    const ink = inkRect(el);
    if (!ink) continue;

    let box = ink;
    let node = el;
    // 一直查到 vk-page（它自己 overflow:hidden）：内容超出画布 = 被 page 裁掉。
    while (node && node !== stage.parentElement) {
      const s = getComputedStyle(node);
      if (CLIP.has(s.overflowX) || CLIP.has(s.overflowY)) {
        const r = node.getBoundingClientRect();
        const overX = Math.max(0, box.left < r.left - TOL ? r.left - box.left : 0, box.right > r.right + TOL ? box.right - r.right : 0);
        const overY = Math.max(0, box.top < r.top - TOL ? r.top - box.top : 0, box.bottom > r.bottom + TOL ? box.bottom - r.bottom : 0);
        if (overX > TOL || overY > TOL) {
          for (const d of el.querySelectorAll('*')) seen.add(d);
          const px = Math.round(Math.max(overX, overY) / (scale || 1));
          const axis = overX > TOL ? '右' : '下';
          issues.push({
            code: 'clipped',
            message: `${name(el)} 的文字被裁掉 ${px}px（${axis}）`,
            fix:
              el.closest('vk-code, vk-term, vk-diff, vk-asm, vk-bytes')
                ? '删掉 size 让它自己缩，或改 long="wrap"，或把行弄短'
                : '缩短内容、换更宽的容器，或拆一帧',
          });
          break;
        }
      }
      node = node.parentElement;
    }
  }

  /* render / stale：件自己说它没画出来。 */
  for (const el of stage.querySelectorAll('[data-vk-error]')) {
    issues.push({ code: 'render', message: `${name(el)} 渲染失败`, fix: '看控制台第一条报错' });
  }
  for (const el of stage.querySelectorAll('[data-vk-stale]')) {
    issues.push({ code: 'render', message: `${name(el)} 缺预编译数据`, fix: '重新跑 vk render（构建期没算出来）' });
  }

  /* asset：图片加载失败。 */
  for (const el of stage.querySelectorAll('vk-img[data-error], img[data-error]')) {
    const src = el.getAttribute('src') || el.querySelector('img')?.getAttribute('src') || '';
    issues.push({ code: 'asset', message: `${name(el)} 的图片没加载出来`, fix: src ? `检查 ${src.split('/').pop()} 的路径` : '写 src' });
  }

  /* anchor：标注指向空气。按 mode 只查这个形态真正会用的属性。 */
  for (const c of stage.querySelectorAll('vk-callout')) {
    const mode = c.getAttribute('mode') || 'arrow';
    const attrs = mode === 'arrow' ? ['from', 'to'] : ['for'];
    for (const attr of attrs) {
      const expr = c.getAttribute(attr);
      if (!expr) continue;
      const hit = window.vk?.resolveAnchor?.(stage, expr, c);
      if (!hit) {
        issues.push({ code: 'anchor', message: `<vk-callout> 的 ${attr}="${expr}" 指不到东西`, fix: '写 #id / .class / vk-标签，或 #id@line:5（行号按源文件算）' });
      }
    }
  }

  return { issues };
}

/** 只看数字：给「这一帧什么形状」一个可比较的量，不参与判定。 */
export function metrics(stageEl) {
  const stage = stageEl || document.querySelector('.vk-stage');
  if (!stage) return null;
  const sr = stage.getBoundingClientRect();
  const scale = stage.offsetWidth ? sr.width / stage.offsetWidth : 1;
  const rects = [...stage.querySelectorAll('*')]
    .filter((el) => !el.closest('svg') && !isDeco(el) && !isOverlay(el) && !el.closest('[bleed="all"]'))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 1 && r.height > 1);
  const top = rects.length ? Math.min(...rects.map((r) => r.top)) : sr.top;
  const bottom = rects.length ? Math.max(...rects.map((r) => r.bottom)) : sr.top;
  const left = rects.length ? Math.min(...rects.map((r) => r.left)) : sr.left;
  const right = rects.length ? Math.max(...rects.map((r) => r.right)) : sr.left;
  // 焦点按「件」计数：一段字节的高亮、一整段代码的聚光都只算一处。
  const COMPONENT = 'vk-code, vk-term, vk-diff, vk-asm, vk-cells, vk-tree, vk-bytes, vk-bits, vk-steps, vk-timeline, vk-bars, vk-table, vk-text';
  const focus = new Set(
    [...stage.querySelectorAll('[state="current"], [data-current], .is-current')].map(
      (el) => el.closest(COMPONENT) || el
    )
  ).size;
  return {
    contentTop: Math.round((top - sr.top) / scale),
    contentBottom: Math.round((bottom - sr.top) / scale),
    contentLeft: Math.round((left - sr.left) / scale),
    contentRight: Math.round((right - sr.left) / scale),
    fill: Math.round(((bottom - top) / (888 * scale)) * 100),
    focus,
  };
}

export function auditPages(root = document) {
  const stages = [...root.querySelectorAll('.vk-stage')];
  const pages = stages.map((stage) => auditPage(stage));
  return { pages, issues: pages.flatMap((p, i) => p.issues.map((x) => ({ ...x, page: i }))) };
}

export function installAudit(VK) {
  VK.auditPage = auditPage;
  VK.auditPages = auditPages;
  VK.metrics = metrics;
  VK.resolveTarget = resolveTarget;
  VK.resolveAnchor = resolveAnchor;
}

import { resolveTarget, resolveAnchor } from './base.mjs';
