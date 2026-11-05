/* ============================================================================
   v17 · 自检
   ----------------------------------------------------------------------------
   只判「无论你画什么，它都错」的事：
     越界 / 裁切 / 压字 / 字号地板 / 对比度 / 断锚点 / 空帧 / 渲染失败 / 素材失败
   不判审美、不判焦点数量、不判版面预算。好看由默认值和自动适配负责，
   检查只负责"别画错"。所有判据对所有件一视同仁，没有组件特判。
   ========================================================================== */

const FLOOR = 36; // 手机 0.4× 后 14.6px：再小就不是字了
const TEXT_RATIO = 4.5;
const LARGE_RATIO = 3;
const LARGE = 112;

const name = (el) => {
  const id = el.id ? `#${el.id}` : '';
  const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/)[0]}` : '';
  return `<${el.localName}${id}${cls}>`;
};

const parseColor = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
};
const blend = (f, b) => {
  const a = f.a + b.a * (1 - f.a);
  if (a <= 0.0001) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (f.r * f.a + b.r * b.a * (1 - f.a)) / a,
    g: (f.g * f.a + b.g * b.a * (1 - f.a)) / a,
    b: (f.b * f.a + b.b * b.a * (1 - f.a)) / a,
    a,
  };
};
const lum = (c) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const ratio = (a, b) => {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** 背景：向上叠所有有色的祖先；遇到图片/渐变就放弃（不误报）。 */
function bgOf(el) {
  let n = el;
  let acc = null;
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
    const c = parseColor(cs.backgroundColor);
    if (c && c.a > 0.01) {
      acc = acc ? blend(acc, c) : c;
      if (c.a >= 0.99) break;
    }
    n = n.parentElement;
  }
  return acc ? blend(acc, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 };
}

const isOverlay = (el) => !!el.closest('vk-callout');

export function auditPage(stageEl) {
  const stage = stageEl || document.querySelector('.vk-stage');
  if (!stage) return { issues: [{ type: 'no-page', what: '页面里没有 <vk-page>' }] };

  const issues = [];
  const page = stage.closest('vk-page') || stage.parentElement;
  const sr = stage.getBoundingClientRect();
  const pr = page.getBoundingClientRect();
  const scale = stage.offsetWidth ? sr.width / stage.offsetWidth : 1;

  const safe = { left: sr.left + 120 * scale, right: sr.right - 120 * scale, top: sr.top + 96 * scale, bottom: sr.bottom - 96 * scale };

  const els = [...stage.querySelectorAll('*')].filter((el) => {
    if (el.closest('svg') || el.closest('.katex') || el.closest('.vk-sr')) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;
  });

  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;

    // 1. 出画布
    if (r.left < pr.left - 2 || r.right > pr.right + 2 || r.top < pr.top - 2 || r.bottom > pr.bottom + 2) {
      if (!isOverlay(el)) {
        issues.push({
          type: 'off-canvas',
          what: `${name(el)} 出了画布`,
          fix: `左 ${Math.round(r.left - pr.left)} / 上 ${Math.round(r.top - pr.top)} / 右 ${Math.round(r.right - pr.right)} / 下 ${Math.round(
            r.bottom - pr.bottom
          )}px；删内容或降一级 gap`,
        });
      }
      continue;
    }

    // 2. 出安全区
    if (!isOverlay(el) && !el.closest('[bleed]')) {
      if (r.left < safe.left - 2 || r.right > safe.right + 2 || r.top < safe.top - 2 || r.bottom > safe.bottom + 2) {
        const over = Math.round(Math.max(0, safe.top - r.top, r.bottom - safe.bottom, safe.left - r.left, r.right - safe.right) / (scale || 1));
        issues.push({
          type: 'safe-area',
          what: `${name(el)} 超出安全区 ${over}px`,
          fix: '内容要落在版心 1680×888 里：删一行 / 降一级 gap / 拆帧',
        });
      }
    }

    // 3. 被裁 / 截断
    const cs = getComputedStyle(el);
    const hidden = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    if (hidden && el.scrollWidth > el.clientWidth + 2) {
      issues.push({ type: 'clipped', what: `${name(el)} 的内容被裁掉 ${el.scrollWidth - el.clientWidth}px`, fix: '换成 long="wrap"、缩短内容，或换一帧' });
    }
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 2) {
      issues.push({ type: 'truncated', what: `${name(el)} 的文字被省略号截断`, fix: '缩短文字或换宽容器' });
    }

    // 4. 字号地板
    if (ownText(el) && !el.closest('.katex')) {
      const fs = parseFloat(cs.fontSize);
      if (fs && fs < FLOOR - 0.5) {
        issues.push({ type: 'font', what: `${name(el)} 的字号只有 ${Math.round(fs)}px`, fix: `最小 ${FLOOR}px；用 size="caption"（48）或以上` });
      }
    }

    // 5. 对比度（合成背景；图片/渐变上跳过，不误报）
    if (ownText(el) && !el.closest('.katex')) {
      const fg = parseColor(cs.color);
      const bg = bgOf(el);
      if (fg && bg) {
        const fs = parseFloat(cs.fontSize) || 16;
        const bold = Number(cs.fontWeight) >= 600;
        const large = fs >= LARGE || (bold && fs >= 84);
        const need = large ? LARGE_RATIO : TEXT_RATIO;
        const cr = ratio(fg, bg);
        if (cr < need) {
          issues.push({
            type: 'contrast',
            what: `${name(el)} 的文字对比度 ${cr.toFixed(2)}:1，低于 ${need}:1`,
            fix: '换成更深的墨（ink="primary"）或更浅的底',
          });
        }
      }
    }
  }

  // 6. 同级压字（覆盖层是显式覆盖，不算）
  const containers = [stage, ...stage.querySelectorAll('vk-canvas, vk-grid, vk-stack, vk-pair, vk-layer')];
  for (const box of containers) {
    const kids = [...box.children].filter(
      (el) =>
        !isOverlay(el) &&
        !el.matches('vk-callout') &&
        el.getClientRects().length &&
        getComputedStyle(el).display !== 'none' &&
        getComputedStyle(el).position !== 'absolute'
    );
    // vk-layer 的存在意义就是叠放：里面的重叠是作者要的，不是错误。
    const stackable = box.matches('vk-layer');
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        if (stackable) break;
        const a = kids[i].getBoundingClientRect();
        const b = kids[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 4 && h > 4) {
          issues.push({ type: 'overlap', what: `${name(kids[i])} 压在 ${name(kids[j])} 上`, fix: '改成上下排，或用 vk-layer 明确叠放' });
        }
      }
    }
  }

  // 7. 断锚点（指向空气的标注）
  for (const c of stage.querySelectorAll('vk-callout')) {
    for (const attr of ['for', 'from', 'to']) {
      const expr = c.getAttribute(attr);
      if (!expr) continue;
      const hit = window.vk?.resolveAnchor?.(stage, expr, c) || window.vk?.resolveTarget?.(stage, expr, c);
      if (!hit) {
        issues.push({ type: 'anchor', what: `<vk-callout> 的 ${attr}="${expr}" 指不到东西`, fix: '写 #id / .class / vk-标签，或 #id@line:5' });
      }
    }
  }

  // 8. 空件：构建期没读到内容时，组件会渲染成一个空窗——它不报错，但什么也没讲。
  const DATA_TAGS = ['vk-code', 'vk-term', 'vk-diff', 'vk-asm', 'vk-bytes', 'vk-tree', 'vk-math', 'vk-bits', 'vk-callout'];
  for (const tag of DATA_TAGS) {
    for (const el of stage.querySelectorAll(tag)) {
      if (el.closest('svg')) continue;
      if (!el.textContent.trim() && !el.querySelector('img,svg,table')) {
        issues.push({ type: 'empty-part', what: `${name(el)} 是空的`, fix: '构建期没读到内容：检查 src 路径 / 内联脚本，或先跑 vk render' });
      }
    }
  }

  // 8.5 画布子项超出画布：x/y/w/h 放错了，出图时被裁掉一截，肉眼很难发现。
  for (const canvas of stage.querySelectorAll('vk-canvas')) {
    const cb = canvas.getBoundingClientRect();
    for (const kid of canvas.children) {
      const r = kid.getBoundingClientRect();
      const over = Math.round(
        Math.max(0, cb.left - r.left, r.right - cb.right, cb.top - r.top, r.bottom - cb.bottom) / (scale || 1)
      );
      if (over > 2) {
        issues.push({
          type: 'canvas-overflow',
          what: `${name(kid)} 超出了 canvas ${over}px`,
          fix: '改它的 x / y / w / h，或把 canvas 的 h 放大',
        });
      }
    }
  }

  // 8.6 画布子项互相重叠：绝对定位写错就会叠在一起，肉眼在缩略图里看不出来。
  for (const canvas of stage.querySelectorAll('vk-canvas')) {
    const kids = [...canvas.children];
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a1 = kids[i].getBoundingClientRect();
        const b1 = kids[j].getBoundingClientRect();
        const w = Math.min(a1.right, b1.right) - Math.max(a1.left, b1.left);
        const h = Math.min(a1.bottom, b1.bottom) - Math.max(a1.top, b1.top);
        if (w > 2 && h > 2) {
          issues.push({
            type: 'canvas-overlap',
            what: `${name(kids[i])} 和 ${name(kids[j])} 重叠了 ${Math.round(w)}×${Math.round(h)}px`,
            fix: '改其中一个的 x / y / h；真要叠放，用 <vk-layer>',
          });
        }
      }
    }
  }

  // 9. 渲染失败 / 数据过期 / 图片失败
  for (const el of stage.querySelectorAll('[data-vk-error]')) issues.push({ type: 'render', what: `${name(el)} 渲染失败`, fix: '看控制台第一条报错' });
  for (const el of stage.querySelectorAll('[data-vk-stale]')) issues.push({ type: 'stale', what: `${name(el)} 缺少预编译数据`, fix: '运行 vk render 重新生成' });
  for (const el of stage.querySelectorAll('vk-img[data-error]')) issues.push({ type: 'asset', what: `${name(el)} 的图片加载失败`, fix: '检查 src 路径' });

  // 9. 空帧
  const chars = (stage.innerText || '').replace(/\s+/g, '').length;
  const media = [...stage.querySelectorAll('img, svg, vk-canvas')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 80 && r.height > 80;
  }).length;
  if (!chars && !media) issues.push({ type: 'empty', what: '这一帧什么都没有画', fix: '检查脚本是否加载、组件是否渲染' });

  return { issues };
}

/** 只看数字：给"这一帧是否成立"一个可比较的量。 */
export function metrics(stageEl) {
  const stage = stageEl || document.querySelector('.vk-stage');
  if (!stage) return null;
  const sr = stage.getBoundingClientRect();
  const scale = stage.offsetWidth ? sr.width / stage.offsetWidth : 1;
  // 铺满整帧的背景不参与"内容占多满"：它是底，不是内容。
  const rects = [...stage.querySelectorAll('*')]
    .filter((el) => !el.closest('svg') && !isOverlay(el) && !el.matches('vk-callout') && !el.closest('[bleed="all"]'))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 1 && r.height > 1);
  const top = rects.length ? Math.min(...rects.map((r) => r.top)) : sr.top;
  const bottom = rects.length ? Math.max(...rects.map((r) => r.bottom)) : sr.top;
  const left = rects.length ? Math.min(...rects.map((r) => r.left)) : sr.left;
  const right = rects.length ? Math.max(...rects.map((r) => r.right)) : sr.left;
  const focus = stage.querySelectorAll('[state="current"], [data-current], .is-current').length;
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
  VK.resolveTarget = resolveTargetExport;
VK.resolveAnchor = resolveAnchorExport;
}

/* 自检要用同一个锚点解析：从 base 再导出一次，避免两份实现。 */
import { resolveTarget as resolveTargetExport, resolveAnchor as resolveAnchorExport } from './base.mjs';
