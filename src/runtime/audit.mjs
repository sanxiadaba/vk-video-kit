/**
 * 页面自检：作者页与标本页共用同一份。
 *
 * 只看作者最容易踩的六件事：字号、对比度、安全区、溢出、裁切、重叠、空锚点。
 * 不是"像素基线"，也不需要截图；CLI 的 `vk check`、`vk shot` 自检都调它。
 */

const MIN_FONT = 44;
const MIN_RATIO = 4.5;
const LARGE_RATIO = 3;
const LARGE_FONT = 72;
const OVERLAYS = new Set(['vk-edge', 'vk-pin', 'vk-ring', 'vk-spotlight']);

export function auditPage(root = document) {
  const out = [];
  const stage = root.matches?.('.vk-page, .vk-stage') ? root : root.querySelector?.('.vk-page') || root.querySelector?.('.vk-stage') || root;
  const safe = safeBox(stage);
  const pageRect = stage.getBoundingClientRect();
  const safeRect = safe?.getBoundingClientRect();

  const parse = (s) => {
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
  const bgOf = (el) => {
    let n = el;
    let acc = null;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.01) {
        acc = acc ? blend(acc, c) : c;
        if (c.a >= 0.99) break;
      }
      n = n.parentElement;
    }
    return acc ? blend(acc, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 };
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
  const opaque = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      if (parseFloat(getComputedStyle(n).opacity) < 0.5) return false;
      n = n.parentElement;
    }
    return true;
  };
  const clip = (s) => (s || '').toString().slice(0, 60);
  const overSeen = new Set();
  const safeSeen = new Set();
  const covered = (el, set) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return true;
    return false;
  };

  for (const el of stage.querySelectorAll('*')) {
    if (el.closest('.katex')) continue;
    if (el.hasAttribute?.('data-ellipsis')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (el.closest('svg') || el.closest('.vk-sr')) continue;
    const inAnnoLines = !!el.closest('.vk-anno-lines');
    const inOverlay = !!el.closest('vk-edge, vk-pin, vk-ring, vk-spotlight');
    const inSideNav = !!el.closest('[data-side-nav]');
    const inPageChrome = !!el.closest('.vk-page-hd, .vk-page-ft');
    const pageScaffold = el.matches('.vk-page-inner, .vk-page-bd, .vk-page-hd, .vk-page-ft');

    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const isMeta = !!(el.closest && el.closest('[data-meta]'));
    if (hasText && opaque(el)) {
      const fs = parseFloat(cs.fontSize);
      if (!isMeta && fs < MIN_FONT) out.push({ type: 'font', what: clip(el.className || el.tagName), fs });
      const fg = parse(cs.color);
      if (fg) {
        const cr = ratio(fg, bgOf(el));
        const need = fs >= LARGE_FONT ? LARGE_RATIO : MIN_RATIO;
        if (cr < need) out.push({ type: 'contrast', what: clip(el.className || el.tagName), cr: +cr.toFixed(2), need });
      }
    }

    if (!inSideNav && !inOverlay && (r.left < -4 || r.top < -4 || r.right > pageRect.right + 4 || r.bottom > pageRect.bottom + 4)) {
      if (!inAnnoLines && !covered(el, overSeen)) {
        overSeen.add(el);
        out.push({
          type: 'overflow',
          what: clip(el.className || el.tagName),
          box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
        });
      }
    }

    if (safeRect && !inAnnoLines && !inOverlay && !inSideNav && !inPageChrome && !pageScaffold) {
      if (
        (r.left < safeRect.left - 2 ||
          r.right > safeRect.right + 2 ||
          r.top < safeRect.top - 2 ||
          r.bottom > safeRect.bottom + 2) &&
        !covered(el, safeSeen)
      ) {
        safeSeen.add(el);
        out.push({
          type: 'safe',
          what: clip(el.className || el.tagName),
          box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
        });
      }
    }

    const ox = !inOverlay && (cs.overflowX === 'hidden' || cs.overflowX === 'clip');
    const oy = !inOverlay && (cs.overflowY === 'hidden' || cs.overflowY === 'clip');
    if (ox && el.scrollWidth > el.clientWidth + 3) {
      out.push({ type: 'clip', what: clip(el.className || el.tagName), sw: el.scrollWidth, cw: el.clientWidth });
    }
    if (oy && el.scrollHeight > el.clientHeight + 3) {
      out.push({ type: 'clip-y', what: clip(el.className || el.tagName), sh: el.scrollHeight, ch: el.clientHeight });
    }
  }

  // 行号不能压到代码正文上。
  for (const line of stage.querySelectorAll('.vk-line, .vk-dline')) {
    const num = line.querySelector('.vk-dnums') || line.querySelector('.vk-ln');
    const src = line.querySelector('.vk-src, .vk-dsrc');
    if (!num || !src) continue;
    const nr = num.getBoundingClientRect();
    const sr = src.getBoundingClientRect();
    if (nr.width < 1 || sr.width < 1) continue;
    if (nr.right > sr.left + 0.5) {
      out.push({ type: 'ln-overlap', what: clip(line.className), gap: +(nr.right - sr.left).toFixed(1) });
    }
  }

  // 顶层块重叠：覆盖层（edge/pin/ring/spotlight）与绝对定位元素是显式覆盖，不算。
  const box = safe || stage;
  const kids = [...box.children].filter((el) => {
    if (OVERLAYS.has(el.tagName.toLowerCase())) return false;
    if (el.getClientRects().length === 0) return false;
    const p = getComputedStyle(el).position;
    return p !== 'absolute' && p !== 'fixed';
  });
  for (let i = 0; i < kids.length; i++) {
    for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i].getBoundingClientRect();
      const b = kids[j].getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 4 && h > 4) {
        out.push({
          type: 'overlap',
          what: `${clip(kids[i].className || kids[i].tagName)} × ${clip(kids[j].className || kids[j].tagName)}`,
          size: [Math.round(w), Math.round(h)],
        });
      }
    }
  }

  // 组件级溢出（Frame 原语）：内容比盒子宽/高。
  if (typeof window !== 'undefined' && typeof window.vk?.auditOverflow === 'function') {
    for (const a of window.vk.auditOverflow(stage)) {
      out.push({ type: 'audit-overflow', what: `${a.tag} ${a.sel}`, sw: a.sw, cw: a.cw, sh: a.sh, ch: a.ch });
    }
  }

  // w 是硬宽：量出来必须等于写的数字（容忍 1.5px）。
  for (const el of stage.querySelectorAll('[w]')) {
    const raw = (el.getAttribute('w') || '').trim();
    if (!/^\d+(?:\.\d+)?$/.test(raw)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const want = Number(raw);
    if (el.tagName.toLowerCase() === 'vk-annotate') {
      const notes = el.querySelector('.vk-anno-notes');
      const got = notes?.offsetWidth || 0;
      if (got < 1) continue;
      if (Math.abs(got - want) > 1.5) out.push({ type: 'w', what: 'VK-ANNOTATE notes', want, got, tag: 'vk-annotate' });
      continue;
    }
    const got = el.offsetWidth;
    if (got < 1) continue;
    if (Math.abs(got - want) > 1.5) out.push({ type: 'w', what: clip(el.className || el.tagName), want, got, tag: el.tagName.toLowerCase() });
  }

  // 空锚点：连线/批注会指向空气。
  for (const el of stage.querySelectorAll('[id]')) {
    if (el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) out.push({ type: 'zero', what: `#${el.id}` });
  }

  // 预编译/素材状态。
  const special = [];
  if (stage.querySelector('[data-vk-unknown]')) special.push(`未知图标：${stage.querySelector('[data-vk-unknown]').dataset.vkUnknown}`);
  if (stage.querySelector('[data-vk-stale]')) special.push('有预编译数据过期');
  if (stage.querySelector('[data-vk-parsed]')) special.push('源码被浏览器解析（漏转义）');
  if (stage.querySelector('[data-vk-error]')) special.push('有元件渲染失败');
  if (stage.querySelector('vk-img[data-error], vk-figure[data-error], .vk-fig-win[data-error]')) special.push('图片加载失败');

  return { issues: out, special };
}

function safeBox(stage) {
  return stage.querySelector?.('.vk-page-bd') || stage.querySelector?.('.vk-stage') || stage;
}

export function installAudit(VK) {
  VK.auditPage = auditPage;
}
