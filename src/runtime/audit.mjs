import { resolveAnchor } from './base.mjs';
import { LIMITS } from '../shared/limits.mjs';
import { ICON_WHITELIST_HINT, isSemanticIcon } from '../shared/icons.mjs';

/**
 * 页面自检：作者页与标本页共用同一份。
 *
 * 只看作者最容易踩的六件事：字号、对比度、安全区、溢出、裁切、重叠、空锚点。
 * 不是"像素基线"，也不需要截图；CLI 的 `vk check`、`vk shot` 自检都调它。
 *
 * 所有数值来自 shared/limits.mjs —— 这里不再有第二份定义。
 * 对比度分两档：正文 7:1，标注（ink="muted"，即 [data-meta] 里）4.5:1。
 *
 * 批次 G/H 追加了五条设计规则（不是事故）：强调色 ≤1、深色块 ≤1、图标白名单、
 * 页眉不许含文件名/页号、内容必须在 120 边距内。它们的文案与 fix 在 fixFor 里。
 */

/** 交付页的硬边距：120。与 --vk-margin 同一个决定，写在规则里而不是抄 token。 */
const PAGE_MARGIN = 120;
/** 一页最多几块深色区域。 */
const DARK_LIMIT = 1;
/** 深色判定：相对亮度低于它、且有 160×60 以上的可见面。语义色都在 0.05 以上。 */
const DARK_LUM = 0.05;
/** 页眉里不该出现的文件后缀（与构建期 highlight.mjs 同一张表）。 */
const KICKER_FILE_EXT = /\.(?:c|s|exe|o|i)\b/i;
/** 「第 3 页 / 3 帧」这类页号。 */
const KICKER_PAGE_NO = /第\s*[0-9一二三四五六七八九十]+\s*[页帧]|\d+\s*\/\s*\d+\s*[页帧]/;
/** 覆盖层：只画在内容上，不参与"内容边距"与深色块计数。 */
const OVERLAY_SEL = 'vk-edge, vk-pin, vk-ring, vk-annotate, vk-note, [data-vk-overlay]';

const MIN_FONT = LIMITS.fontFloor;
const CONTENT_FONT = LIMITS.fontBody;
const MIN_RATIO = LIMITS.contrastText;
const MUTED_RATIO = LIMITS.contrastMuted;
const LARGE_RATIO = LIMITS.contrastLarge;
const DATA_RATIO = LIMITS.contrastData;
const LARGE_FONT = LIMITS.fontLarge;
const OVERLAYS = new Set(['vk-edge', 'vk-pin', 'vk-ring', 'vk-annotate', 'vk-note']);

/* ------------------------------------------------- 批次 G/H 的五个判定 */

const relLum = (c) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};

const labelOf = (el) => {
  const cls = String(el.className || '')
    .trim()
    .split(/\s+/)[0];
  const base = cls || String(el.tagName || '').toLowerCase();
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12);
  return text && !base.includes(text) ? `${base}「${text}」` : base;
};

/** 行内 / 文字宿主：文字在子 span 里，宿主自己才是"那一行字"。 */
const INLINE_HOSTS = new Set(['VK-LABEL', 'VK-INLINE', 'VK-ICON', 'VK-TEXT']);

const visibleBox = (el) => {
  for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
  const tag = el.tagName;
  if (tag === 'IMG' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'svg' || tag === 'SVG') return true;
  // 文字宿主（kicker / chip / 行内代码 / 图标 / 文字块）：字可能全在子 span 里，
  // 但越界的是整行——报宿主比报它内部的 4px 色条有用得多。
  if (INLINE_HOSTS.has(tag) && (el.textContent || '').trim()) return true;
  const cs = getComputedStyle(el);
  const bg = PARSE_RGB(cs.backgroundColor);
  if (bg && bg.a > 0.06) return true;
  if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
  return ['borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth'].some((k) => parseFloat(cs[k]) >= 1);
};

/**
 * H1 强调色：只数「答案级」元素 —— vk-text 与 vk-panel 上的 tone="focus"。
 *
 * vk-label 是导航、vk-icon 是符号，都不占强调名额；err / warn 是反例/警告，
 * 也不在这里计数（它们不是"第二个答案"）。嵌套时只算最外层一次。
 */
function accentAnswers(stage) {
  const hits = [];
  for (const el of stage.querySelectorAll('vk-text[tone="focus"], vk-panel[tone="focus"]')) {
    if (el.closest('template')) continue;
    if (el.closest('vk-label, vk-icon') || el.closest(OVERLAY_SEL)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    hits.push(el);
  }
  return hits.filter((el) => !hits.some((o) => o !== el && o.contains(el)));
}

/**
 * G3 深色区域：按底色亮度识别，不靠类名。
 *
 * vk-panel variant="dark"、深色终端 / 字节窗、作者自己的 .vk-bg-dark 或内联深底
 * 都会落进同一个判定。小于 160×60 的深色件（编号点、badge）不算"一块区域"。
 */
function darkRegions(stage) {
  const found = [];
  for (const el of stage.querySelectorAll('*')) {
    if (el.closest('template') || el.closest('svg')) continue;
    if (el.closest(OVERLAY_SEL)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.2) continue;
    const explicit = el.matches('vk-panel[variant="dark"], .vk-bg-dark, [data-vk-dark], [data-theme="dark"]');
    const bg = PARSE_RGB(cs.backgroundColor);
    const ownDark = !!bg && bg.a > 0.5 && relLum(bg) < DARK_LUM;
    if (!explicit && !ownDark) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 160 || r.height < 60) continue;
    found.push(el);
  }
  // 嵌在另一块深色里的子块不重复计数（深色分区的标题带也是深色）。
  return found.filter((el) => !found.some((o) => o !== el && o.contains(el)));
}

/**
 * H3 图标白名单（运行期兜底）。
 *
 * 构建期已经拒绝白名单外的 <vk-icon name>；这里拦的是"构建之后又改了 DOM"
 * 或者旧产物直接跑新运行时的情况。自定义 src 的内联 SVG 不算——它是作者自己的图。
 */
function iconIssues(stage) {
  const out = [];
  for (const host of stage.querySelectorAll('vk-icon')) {
    if (host.closest('template')) continue;
    const inline = host.querySelector(':scope > .vk-icon[data-vk-inline]');
    if (inline?.dataset.vkSrc) continue;
    const name = (host.getAttribute('name') || inline?.dataset.vkName || '').trim();
    if (!name) continue;
    // 只按名字判：名字在白名单里就是合法语义图标（图标表没注入是另一件事，
    // 由 data-vk-unknown 的 special 报）。
    if (isSemanticIcon(name)) continue;
    out.push({ type: 'icon', el: host, what: `「${name}」不在语义图标白名单里` });
  }
  return out;
}

/** H4 页眉：kicker 只讲工序，不讲文件名，也不讲页号。 */
function headerIssues(stage) {
  const out = [];
  // kicker 是 vk-label 的默认变体：没写 variant 的也是页眉。
  for (const el of stage.querySelectorAll('vk-label')) {
    if (el.closest('template')) continue;
    const variant = el.getAttribute('variant') || 'kicker';
    if (variant !== 'kicker') continue;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const hit = KICKER_FILE_EXT.exec(text);
    if (hit) {
      out.push({ type: 'header', el, what: `页眉（kicker）"${text}" 里出现了文件名 ${hit[0]}` });
    } else if (KICKER_PAGE_NO.test(text)) {
      out.push({ type: 'header', el, what: `页眉（kicker）"${text}" 写的是页号 / 帧号` });
    }
  }
  return out;
}

/**
 * H5 内容必须在 120 边距内。
 *
 * 只查交付页（1920×1080、未缩放）：审阅页把帧缩小排在一起，坐标不是画布坐标；
 * 标本台（.vk-stage）与图版页（data-allow-void）是目录版式，页骨架的 96 顶带
 * 本来就是版式的一部分，120 边距是"交付帧"的规则。
 *
 * 覆盖层（annotate / ring / edge / note）与出血层不属内容；容器本身不算"可见"，
 * 只报真正有字、有面、有边或替换元素的那一层，并只报最外层。
 */
function marginIssues(stage, pageRect, scale) {
  if (!pageRect || Math.abs((scale || 1) - 1) > 0.02) return [];
  if (pageRect.width < PAGE_MARGIN * 2 + 200 || pageRect.height < PAGE_MARGIN * 2 + 200) return [];
  if (stage.classList?.contains('vk-stage') || stage.hasAttribute?.('data-allow-void') || stage.closest?.('[data-allow-void]')) return [];
  const out = [];
  const seen = new Set();
  const covered = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (seen.has(p)) return true;
    return false;
  };
  const W = pageRect.width;
  const H = pageRect.height;
  for (const el of stage.querySelectorAll('*')) {
    if (el === stage) continue;
    if (el.closest('template, svg, .katex, .vk-page-bleed')) continue;
    if (el.closest(OVERLAY_SEL)) continue;
    if (el.matches('.vk-page-inner, .vk-page-bd, .vk-page-hd, .vk-page-ft')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (!visibleBox(el)) continue;
    const box = [r.left - pageRect.left, r.top - pageRect.top, r.right - pageRect.left, r.bottom - pageRect.top];
    const over = Math.max(
      PAGE_MARGIN - box[0],
      PAGE_MARGIN - box[1],
      box[2] - (W - PAGE_MARGIN),
      box[3] - (H - PAGE_MARGIN)
    );
    if (over <= 1) continue;
    if (covered(el)) continue;
    seen.add(el);
    out.push({
      type: 'margin',
      el,
      what: `内容越出 120 边距 ${Math.round(over)}px：${labelOf(el)}`,
      box: box.map((v) => Math.round(v)),
    });
  }
  return out;
}

/**
 * 从元素到文档根的累计 scaleX。
 *
 * getBoundingClientRect / Range 量到的是祖先 transform 之后的结果，
 * 而 computed font-size 是没缩放的。连排页把每帧缩到 0.5 时，
 * 直接拿"缩放后的行宽 ÷ 未缩放字号"会把正常的一行算成孤行。
 * 只乘 scale：旋转/斜切不该改变"这一行有几个字"的判断。
 */
function cumulativeScaleX(el) {
  let scale = 1;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const t = getComputedStyle(n).transform;
    if (t && t !== 'none') {
      const m = t.match(/^matrix(?:3d)?\(([^)]+)\)$/);
      if (m) {
        const p = m[1].split(',').map(Number);
        const sx = Math.hypot(p[0] || 0, p[1] || 0);
        if (sx > 0) scale *= sx;
      }
    }
    if (n === document.documentElement) break;
  }
  return scale || 1;
}

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
    const inOverlay = !!el.closest('vk-edge, vk-pin, vk-ring, vk-annotate, vk-note');
    const inSideNav = !!el.closest('[data-side-nav]');
    const inPageChrome = !!el.closest('.vk-page-hd, .vk-page-ft');
    const inBleed = !!el.closest('.vk-page-bleed');
    const pageScaffold = el.matches('.vk-page-inner, .vk-page-bd, .vk-page-hd, .vk-page-ft, .vk-page-bleed');

    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    // 出血层只收图/面：正文放进去会绕过安全区，直接报。
    if (hasText && inBleed) out.push({ type: 'bleed-text', what: clip(el.textContent || el.tagName) });
    const isMeta = !!(el.closest && (el.closest('[data-meta]') || el.closest('[ink="muted"]')));
    // 数据区 = 等宽字体。颜色在这里是编码（字符串绿、运算符蓝、地址灰），
    // 全推到 7:1 会让代码块变成一片深灰；所以按 AA 4.5 走。
    const inData = /mono/i.test(cs.fontFamily);
    const isSup = !!(el.closest && el.closest('vk-inline[variant="sup"], vk-inline[variant="sub"]'));
    if (hasText && opaque(el) && !isSup && !inOverlay) {
      const fs = parseFloat(cs.fontSize);
      // caption 是硬地板（28），data-meta 也不能破：元数据只放宽对比度与句长，不放宽字号。
      if (fs < MIN_FONT) out.push({ type: 'font', what: clip(el.className || el.tagName), fs });
      if (!isMeta && fs < CONTENT_FONT) {
        const text = (el.textContent || '').replace(/\s+/g, '');
        const isSentence = /[\u4e00-\u9fff]/.test(text) && text.length > 12;
        if (isSentence) out.push({ type: 'font-content', what: clip(text.slice(0, 18)), fs });
      }
      const fg = parse(cs.color);
      if (fg) {
        const cr = ratio(fg, bgOf(el));
        // 分档：标注 4.5 / 数据区 4.5 / 大字 4.5 / 正文 7。
        const need = isMeta ? MUTED_RATIO : inData ? DATA_RATIO : fs >= LARGE_FONT ? LARGE_RATIO : MIN_RATIO;
        if (cr < need) out.push({ type: 'contrast', what: clip(el.className || el.tagName), cr: +cr.toFixed(2), need });
      }
    }

    if (!inSideNav && !inOverlay && (r.left < -4 || r.top < -4 || r.right > pageRect.right + 4 || r.bottom > pageRect.bottom + 4)) {
      if (!covered(el, overSeen)) {
        overSeen.add(el);
        out.push({
          type: 'overflow',
          el,
          what: clip(el.className || el.tagName),
          box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
        });
      }
    }

    if (safeRect && !inOverlay && !inSideNav && !inPageChrome && !pageScaffold && !inBleed) {
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
          el,
          what: clip(el.className || el.tagName),
          box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
        });
      }
    }

    const ox = !inOverlay && !inBleed && (cs.overflowX === 'hidden' || cs.overflowX === 'clip');
    const oy = !inOverlay && !inBleed && (cs.overflowY === 'hidden' || cs.overflowY === 'clip');
    if (ox && el.scrollWidth > el.clientWidth + 3) {
      out.push({ type: 'clip', el, what: clip(el.className || el.tagName), sw: el.scrollWidth, cw: el.clientWidth });
    }
    if (oy && el.scrollHeight > el.clientHeight + 3) {
      out.push({ type: 'clip-y', el, what: clip(el.className || el.tagName), sh: el.scrollHeight, ch: el.clientHeight });
    }
    // 组件宿主的内容溢出：即使 overflow 是 visible，也意味着"盒子被压扁、内容被盖住"。
    //
    // 但字形墨迹天然比行盒高一点点（120px 字 132 盒 / 138 墨迹），那不是被压扁。
    // 只有"溢出超过盒高 20% 且至少 6px"才算真的塞不下。
    const isHost = el.tagName.startsWith('VK-') && !OVERLAYS.has(el.tagName.toLowerCase());
    const explicitClip = el.getAttribute('overflow') === 'clip' || el.hasAttribute('data-allow-overflow');
    const slack = Math.max(6, el.clientHeight * 0.2);
    if (isHost && !inOverlay && !inBleed && !explicitClip && cs.overflowY === 'visible' && el.scrollHeight - el.clientHeight > slack) {
      out.push({ type: 'content-clip', el, what: clip(el.className || el.tagName), sh: el.scrollHeight, ch: el.clientHeight });
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

  // 同级块重叠：覆盖层（edge/pin/ring/spotlight）是显式覆盖，不算；
  // 手摆的绝对定位块也算——canvas 里的坐标是作者写的，重叠要报。
  const box = safe || stage;
  const containers = [box, ...box.querySelectorAll('vk-canvas')];
  for (const container of containers) {
    const kids = [...container.children].filter((el) => {
      if (OVERLAYS.has(el.tagName.toLowerCase())) return false;
      if (el.hasAttribute('data-vk-overlay')) return false;
      if (el.getClientRects().length === 0) return false;
      if (getComputedStyle(el).display === 'none') return false;
      return true;
    });
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect();
        const b = kids[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 4 && h > 4) {
          // 声明了 elevation 的元素之间允许叠层，但每次放行都记账，回归时能看见。
          const elevated = kids[i].closest('[elevation]') || kids[j].closest('[elevation]');
          if (elevated) {
            out.push({
              type: 'layer',
              what: `已豁免：${clip(kids[i].className || kids[i].tagName)} 压在 ${clip(
                kids[j].className || kids[j].tagName
              )} 上（elevation）`,
            });
            continue;
          }
          out.push({
            type: 'overlap',
            what: `${clip(kids[i].className || kids[i].tagName)} × ${clip(kids[j].className || kids[j].tagName)}`,
            size: [Math.round(w), Math.round(h)],
          });
        }
      }
    }
  }

  // 对照的两张图必须同比例：不同比例时"一半对一半"是假的。
  for (const cmp of stage.querySelectorAll('vk-compare[data-mismatch]')) {
    out.push({ type: 'compare-mismatch', what: clip(cmp.className || 'vk-compare') });
  }

  // 覆盖层压住正文：批注泡这类"画在别人身上"的东西，压住字就是错。
  // 13.x 把 pin/ring/edge 当"显式覆盖"整体排除了，于是第 10 站的批注泡盖住标题，
  // 门禁仍然说"干净"——这条就是补那个盲区。只查真正有底的泡，线条类不算。
  for (const pin of stage.querySelectorAll('vk-pin, vk-annotate[data-mode="note"]')) {
    const bubble = pin.querySelector('.vk-pin-bd') || pin;
    const pr = bubble.getBoundingClientRect();
    if (pr.width < 4 || pr.height < 4) continue;
    for (const t of stage.querySelectorAll('vk-text, p, h1, h2, h3, li')) {
      if (pin.contains(t)) continue;
      if (!(t.textContent || '').trim()) continue;
      const b = t.getBoundingClientRect();
      if (b.width < 4 || b.height < 4) continue;
      const w = Math.min(pr.right, b.right) - Math.max(pr.left, b.left);
      const h = Math.min(pr.bottom, b.bottom) - Math.max(pr.top, b.top);
      if (w <= 4 || h <= 4) continue;
      const cover = (w * h) / (b.width * b.height);
      if (h > b.height * 0.4 && w > 60) {
        out.push({ type: 'overlay-text', what: clip(bubble.className || 'vk-pin'), target: clip(t.className || t.tagName), cover: +cover.toFixed(2) });
      }
    }
  }

  // 底部空带：这一页下半空了多少。
  //
  // 只测量，不判定：一整集里"每帧下半空一半"是分镜问题，不是组件问题，
  // 但作者需要一个数字才会去改。量的是「最低的一点墨到安全区底边」，
  // 不是"最大空块"——标题右侧的空白也会算成空块，那是正常版面，
  // 而这里要回答的是一个具体问题：内容到底沉到多高就没东西了。
  //
  // 跳过的两种页：vk-stage（组件标本台，只摆一个元件）与
  // 标了 data-allow-void 的纸（文献页/图版，空白是版式的一部分）。
  const voidExempt = stage.classList?.contains('vk-stage') || stage.hasAttribute?.('data-allow-void') || stage.closest?.('[data-allow-void]');
  if (safeRect && safeRect.height > 0 && !voidExempt) {
    const band = bottomGap(safe || stage, safeRect);
    if (band >= safeRect.height * 0.25) {
      out.push({
        type: 'void',
        what: `底部空 ${band}px（安全区 ${Math.round((band / safeRect.height) * 100)}%）`,
        box: [0, Math.round(safeRect.height - band), Math.round(safeRect.width), band],
        fix: '主角再大一档 / vk-page align="center" / 补一条撑住下半页的物证',
      });
    }
  }

  // 空帧：一个组件都没渲染出来、或整页只剩背景时，上面所有检查都会沉默——
  // 因为没有任何东西可以不合格。这一条把"没画面"从"没问题"里分出来。
  //
  // 例外是"故意空"的页：标本台（.vk-stage）、文献页/图版（data-allow-void）。
  // 它们本来就只有一个元件或大片留白，拿空帧去拦它是错的。
  if (!voidExempt) {
    const body = stage.querySelector('.vk-page-bd') || stage;
    const chars = (body.innerText || '').replace(/\s+/g, '').length;
    const media = [...body.querySelectorAll('img, svg, canvas, vk-img, vk-canvas, vk-figure')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 80 && r.height > 80;
    }).length;
    if (chars < 12 && media === 0) {
      out.push({
        type: 'empty',
        what: `可见文字 ${chars} 字、没有图`,
        chars,
        fix: '组件没渲染出来？检查脚本是否加载、预编译是否过期',
      });
    }
  }

  // 空数据组件：列表 / 步骤 / 表格没有条目时是 0 高度，整页检查都会沉默——
  // 画面上看起来"这里没东西"，观众不知道是漏写还是本来如此。
  const EMPTY_COMPONENTS = {
    'vk-table': ['tr', '这个表还没有行：在 <table> 里写 <tr><td>…</td></tr>'],
    'vk-list': ['li', '列表还没有条目：把每一项写成 <li>…</li> 子节点'],
    'vk-steps': ['li', '步骤还没有条目：把每一步写成 <li>…</li> 子节点'],
  };
  for (const [tag, [child, fix]] of Object.entries(EMPTY_COMPONENTS)) {
    for (const el of stage.querySelectorAll(tag)) {
      if (el.closest('template')) continue;
      if (getComputedStyle(el).display === 'none') continue;
      if (!el.querySelector(child)) out.push({ type: 'empty-component', what: tag, fix });
    }
  }

  // 组件级溢出（Frame 原语）：内容比盒子宽/高。
  if (typeof window !== 'undefined' && typeof window.vk?.auditOverflow === 'function') {
    for (const a of window.vk.auditOverflow(stage)) {
      // vk-bytes 的十六进制是逐格排的：整块 .vk-bd 的宽度溢出不等于"文本超出单元格"。
      // 它由下面的逐格测量单独判（真放不下时报"格太窄"），这里不重复报。
      if (a.tag === 'vk-bytes') continue;
      let host = null;
      try {
        host = a.sel ? stage.querySelector(a.sel) : null;
      } catch {
        /* 选择器可能只是描述性的 */
      }
      out.push({ type: 'audit-overflow', el: host, what: `${a.tag} ${a.sel}`, sw: a.sw, cw: a.cw, sh: a.sh, ch: a.ch });
    }
  }

  // w 是硬宽：量出来必须等于写的数字（容忍 1.5px）。
  // 覆盖层除外：vk-pin 的 w 量的是气泡 .vk-pin-bd，宿主本身铺满整页。
  for (const el of stage.querySelectorAll('[w]')) {
    if (el.closest('vk-edge, vk-pin, vk-ring, vk-annotate, vk-note')) continue;
    const raw = (el.getAttribute('w') || '').trim();
    if (!/^\d+(?:\.\d+)?$/.test(raw)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const want = Number(raw);
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

  // 内容比单元格宽、又没有裁切：这是"撞字"的普遍形态，比盒子越界更隐蔽。
  for (const el of stage.querySelectorAll('*')) {
    if (el.closest('svg') || el.closest('.vk-page-bleed') || el.closest('.katex')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.display === 'inline') continue;
    if (cs.whiteSpace !== 'nowrap' || cs.overflowX !== 'visible') continue;
    if (el.clientWidth < 8) continue;
    if (el.scrollWidth > el.clientWidth + 3) {
      out.push({ type: 'collision', what: clip(el.className || el.tagName), sw: el.scrollWidth, cw: el.clientWidth });
    }
  }

  // 条本身放不下时，值列其实仍是完整的：不要再报"文本超出单元格"。
  // 作者能做的是换行（每行一条）或者改 ratio——把这句直接写进报告。
  for (const el of stage.querySelectorAll('.vk-bars')) {
    if (el.closest('.vk-page-bleed')) continue;
    if (el.clientWidth < 8) continue;
    if (el.scrollWidth > el.clientWidth + 3) {
      out.push({ type: 'narrow', el, what: 'vk-bars', sw: el.scrollWidth, cw: el.clientWidth });
    }
  }

  // 字节窗按「行」量，但行内是逐格排的：只有真的连半行都放不下（或行比容器宽）
  // 才报"格太窄"。400px 的窄卡里字节会自己换行，不该被当成撞字。
  for (const el of stage.querySelectorAll('vk-bytes')) {
    if (el.closest('.vk-page-bleed')) continue;
    let hit = null;
    for (const row of el.querySelectorAll('.vk-bytes-row')) {
      if (row.clientWidth < 8) continue;
      const cell = row.querySelector('.vk-bytes-x i');
      const cols = el.getAttribute('cols') === '4' ? 4 : 8;
      const cellW = cell ? cell.getBoundingClientRect().width : 0;
      // 8 列至少放得下 4 格、4 列至少 2 格：再窄就成"标签列"了，读不出字节行。
      const need = cellW ? Math.ceil(cols / 2) * cellW : 0;
      if (row.scrollWidth > row.clientWidth + 3 || (need > 0 && need > row.clientWidth + 1)) {
        hit = row;
        break;
      }
    }
    if (hit) out.push({ type: 'narrow', el, what: 'vk-bytes', sw: Math.round(hit.scrollWidth), cw: hit.clientWidth });
  }

  // 孤行：多行文本的最后一行少于 4 个汉字宽，读起来像排版事故。
  for (const el of stage.querySelectorAll('vk-text, .r-title-sub, .r-callout-bd, .vk-list li')) {
    if (el.closest('[data-meta]') || el.closest('svg')) continue;
    const text = (el.textContent || '').replace(/\s+/g, '').trim();
    if (text.length < 12) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize) || 40;
    // 行盒与行距都是缩放后的像素；判断"几个字"时要把祖先 scale 除回去。
    const scale = cumulativeScaleX(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2);
    if (rects.length < 2) continue;
    const rows = [];
    for (const r of rects) {
      // 同一行的判定也用缩放后的字高，否则缩得太小时两行会被并成一行。
      const row = rows.find((x) => Math.abs(x.top - r.top) < fs * scale * 0.6);
      if (row) {
        row.left = Math.min(row.left, r.left);
        row.right = Math.max(row.right, r.right);
      } else rows.push({ top: r.top, left: r.left, right: r.right });
    }
    if (rows.length < 2) continue;
    const last = rows[rows.length - 1];
    const chars = (last.right - last.left) / (fs * scale);
    if (chars < 3.2) out.push({ type: 'orphan', what: clip(text.slice(0, 18)), chars: +chars.toFixed(1) });
  }

  // pin 之间互相压住：auto 只选边，不承诺避让。
  const pinBoxes = [...stage.querySelectorAll('.vk-pin-bd')].map((el) => el.getBoundingClientRect());
  for (let i = 0; i < pinBoxes.length; i++) {
    for (let j = i + 1; j < pinBoxes.length; j++) {
      const a = pinBoxes[i];
      const b = pinBoxes[j];
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4) {
        out.push({ type: 'pin-overlap', what: '两个 pin 气泡重叠' });
      }
    }
  }

  // 一帧最多一处焦点蓝。焦点是 region，不是 node：
  // 五个高亮字节、两行表格、一段圈选都只算 1 处。
  // 旧实现的手维护并集里写着 `.vk-cell.is-hl` / `.vk-byte.is-hl`，而 DOM 发的是
  // data-state / data-hl —— 所以 07 帧的五个字节、cells 的 current 从来没被数过。
  const focusNodes = focusRegions(stage);
  if (focusNodes.length > 1) out.push({ type: 'blue', count: focusNodes.length, what: '一帧出现多处焦点' });

  /* ------------------------------------------------- 批次 G/H：五条硬审计
     这几条不是"事故"，是设计规则：一页只有一个答案、一块"重"、一页只用语义图标、
     页眉讲工序不讲文件名、内容永远在 120 边距里。它们都能被 `vk check` 打印，
     gate 与测试读同一份判定（数值只有这里一处）。 */

  // H1 强调色 ≤ 1：只数"答案级"的 tone="focus"（vk-text / vk-panel）。
  // vk-label / vk-icon 是导航与符号，不算强调；err / warn 是反例/警告，也不占这个名额。
  const accents = accentAnswers(stage);
  if (accents.length > 1) {
    out.push({
      type: 'accent',
      el: accents[1],
      count: accents.length,
      what: `一页出现 ${accents.length} 处强调色（tone="focus" 的答案级元素）`,
    });
  }

  // G3 / H2 深色块 ≤ 1：一页只能有一块"重"。识别按底色亮度走，
  // 所以 vk-panel variant="dark"、深色终端/字节窗、作者自己的 .vk-bg-dark 都算。
  const darks = darkRegions(stage);
  if (darks.length > 1) {
    out.push({
      type: 'dark',
      el: darks[1],
      count: darks.length,
      what: `一页最多一块深色区域，它应该是本页唯一的"重"（本页 ${darks.length} 块）`,
    });
  }

  // H3 图标白名单（运行期兜底）：构建期已经拦过 <vk-icon>，这里拦"直接改 DOM"的页面。
  for (const icon of iconIssues(stage)) out.push(icon);

  // H4 页眉不许含文件名 / 页号：kicker 讲"工序到哪了"。
  for (const h of headerIssues(stage)) out.push(h);

  // H5 内容必须在 120 边距内：交付页的硬边距（覆盖层与出血层不算内容）。
  for (const m of marginIssues(stage, pageRect, cumulativeScaleX(stage))) out.push(m);

  // 预编译/素材状态。
  const special = [];
  if (stage.querySelector('[data-vk-unknown]')) special.push(`未知图标：${stage.querySelector('[data-vk-unknown]').dataset.vkUnknown}`);
  if (stage.querySelector('[data-vk-stale]')) special.push('有组件缺少数据或数据已过期（data-vk-stale）');
  if (stage.querySelector('[data-vk-parsed]')) special.push('源码被浏览器解析（漏转义）');
  if (stage.querySelector('[data-vk-error]')) special.push('有元件渲染失败');
  if (
    stage.querySelector(
      'vk-img[data-error], vk-compare[data-error], vk-figure[data-error], .vk-fig-win[data-error]'
    )
  )
    special.push('图片加载失败');

  // 容量类问题：父级的 safe / overflow 往往只是子级裁切连带出来的。
  // 只报最里层根因，并给一个可执行的改法；不要让人先去修一个不存在的裁切。
  const CAP = new Set(['safe', 'overflow', 'clip', 'clip-y', 'content-clip', 'audit-overflow']);
  const capIssues = out.filter((x) => x.el && CAP.has(x.type));
  for (const x of capIssues) {
    const child = capIssues.find((y) => y !== x && x.el !== y.el && x.el.contains(y.el));
    if (child) x.cascadeOf = child.what || child.type;
  }
  const issues = out
    .filter((x) => !x.cascadeOf)
    .map(({ el, ...rest }) => {
      const fix = fixFor(rest, safeRect);
      return fix ? { ...rest, fix } : rest;
    });

  return { issues, special };
}

/** 容量问题的下一步：只给可执行的旋钮，不替作者做审美判断。 */
function fixFor(x, safeRect) {
  if (x.type === 'content-clip') return `差 ${x.sh - x.ch}px：先试 gap 降一档 / mass="compact" / 删 1 条`;
  if (x.type === 'clip-y') return `差 ${x.sh - x.ch}px：先试 long="wrap" / mass="compact"`;
  if (x.type === 'clip') return `差 ${x.sw - x.cw}px：先试 long="wrap" / 删字符`;
  if (x.type === 'audit-overflow') return `差 ${Math.max(x.sw - x.cw, x.sh - x.ch)}px：先试 long="wrap" / mass="compact" / 删 1 行`;
  if (x.type === 'narrow') {
    if (x.what === 'vk-bytes') {
      return '格太窄：减少 cols（改用 4 列）或关掉 ascii / 换宽容器；不要继续压字';
    }
    return '格太窄：改成每行一条（换行），或改 ratio / 缩短标签；不要继续压值列';
  }
  if (x.type === 'overflow') return '先删内容或降一档间距；不要缩字';
  // ---- 批次 G/H：五条设计规则的"下一步" ----
  if (x.type === 'accent')
    return '强调色只留给唯一的答案：其余改成 ink="secondary" 或去掉 tone；反例/警告用 tone="err" / tone="warn"（它们不算第二处强调色）';
  if (x.type === 'dark')
    return '只留一块深色：其余改成 variant="inset" / plain，或把那一块移到下一页；深色是"重"，一页只能砸一次';
  if (x.type === 'icon')
    return `图标只表达"成立 / 注意 / 不成立 / 方向"，不是装饰；可用：${ICON_WHITELIST_HINT}`;
  if (x.type === 'header')
    return '页眉讲"工序到哪了"：用 index/total/section（工序 3/5 · 汇编）；文件名放进内容块，页号交给帧编号';
  if (x.type === 'margin')
    return '内缩到 120 边距：删内容 / 降一档间距；页眉页脚也要落在 120 以内（覆盖层不受此限）';
  if (x.type === 'safe' && x.box && safeRect) {
    const [l, t, r, b] = x.box;
    const over = Math.max(safeRect.left - l, t - safeRect.top, r - safeRect.right, b - safeRect.bottom);
    return `超出 ${Math.round(over)}px：先试 title 降一档 / gap 降一档 / 删 1 行`;
  }
  return null;
}

/**
 * 多页审计：一个文档里有 N 张 vk-page 时逐页查。
 *
 * `auditPage` 只看第一张 page —— 审阅页（16 帧拼一页）因此只测了第 1 帧。
 * 这里给每页带 index / id，CLI 才能把问题归因到具体帧。
 */
export function auditPages(root = document) {
  const stages = [...(root.querySelectorAll?.('.vk-page, .vk-stage') || [])];
  if (!stages.length) return { pages: [], issues: [], special: [] };
  const pages = stages.map((stage, i) => {
    const r = auditPage(stage);
    return { index: i, id: stage.id || '', issues: r.issues, special: r.special };
  });
  return {
    pages,
    issues: pages.flatMap((p) => p.issues.map((x) => ({ ...x, page: p.index, pageId: p.id }))),
    special: pages.flatMap((p) => p.special.map((s) => `#${p.index + 1} ${p.id ? '#' + p.id + ' ' : ''}${s}`)),
  };
}

/**
 * 镜头度量：给「这一帧作为一张图是否成立」提供数字。
 *
 * 只测量、不判定 —— 阈值要等一整集/一整册的分布出来再定。
 *   contentTop    第一块内容（标题块之后）的 ink 顶
 *   contentBottom 内容 ink 底
 *   focus         焦点元素数（钴蓝/聚光/当前行）
 *   inkRatio      非白像素占比（需要截图，这里给不到，由 CLI 补）
 */
export function metrics(root = document) {
  const stages = [...(root.querySelectorAll?.('.vk-page, .vk-stage') || [])];
  return stages.map((stage, i) => {
    const safe = safeBox(stage);
    const sr = safe.getBoundingClientRect();
    const kids = [...(safe.children || [])].filter((el) => el.getBoundingClientRect().height > 0);
    // 内容底 = 最后一个可见块；14.0 没有 vk-title 了，标题就是普通的块。
    let first = kids.find((el) => !el.matches?.('[data-vk-overlay]')) || kids[0];
    const fr = first?.getBoundingClientRect();
    // 覆盖层不算内容：vk-edge 的 svg 铺满整页，把它算进来"内容底"永远是 1080。
    const rects = [...safe.querySelectorAll('*')]
      .filter((el) => !el.closest('svg') && !el.closest('vk-edge, vk-pin, vk-ring, vk-annotate, vk-note, [data-vk-overlay]'))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.height > 0 && r.width > 0);
    const maxBottom = rects.length ? Math.max(...rects.map((r) => r.bottom)) : sr.bottom;
    const maxRight = rects.length ? Math.max(...rects.map((r) => r.right)) : sr.right;
    const focus = focusRegions(stage).length;
    return {
      index: i,
      id: stage.id || '',
      safeH: Math.round(sr.height),
      contentTop: fr ? Math.round(fr.top - sr.top) : null,
      contentBottom: Math.round(maxBottom - sr.top),
      contentLeft: fr ? Math.round(fr.left - sr.left) : null,
      contentRight: Math.round(maxRight - sr.left),
      focus,
      blocks: kids.length,
    };
  });
}

function safeBox(stage) {
  return stage.querySelector?.('.vk-page-bd') || stage.querySelector?.('.vk-stage') || stage;
}

const PARSE_RGB = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
};

/**
 * 底部空带：内容最低的一点墨到安全区底边还有多少。
 *
 * 只量一件事——"这页是不是一半空着"。什么算墨：
 *   · 文字（用 Range 取行盒，不看块级盒子；段落不会因为盒子高就算满）
 *   · 替换元素（img / canvas / video / svg）
 *   · 有面的块（背景色或背景图）
 *   · 只有边框的块（按边框算，框里是空的不算墨）
 * 覆盖层（聚光/圈选/连线）不算：那是"压暗"，不是内容。
 */
function bottomGap(holder, sr) {
  let inkBottom = 0;
  const mark = (left, top, right, bottom) => {
    if (right - left < 0.5 || bottom - top < 0.5) return;
    const b = Math.min(bottom, sr.bottom) - sr.top;
    if (b > inkBottom) inkBottom = b;
  };

  for (const el of holder.querySelectorAll('*')) {
    if (el.hasAttribute?.('data-vk-overlay')) continue;
    if (el.closest?.('vk-edge, vk-pin, vk-ring, vk-annotate, vk-note')) continue;
    if (el.closest?.('svg')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (parseFloat(cs.opacity) < 0.15) continue;

    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) mark(r.left, r.top, r.right, r.bottom);
    }

    const tag = el.tagName;
    const replaced = tag === 'IMG' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'svg';
    const bg = PARSE_RGB(cs.backgroundColor);
    const hasBg = (bg && bg.a > 0.06) || (cs.backgroundImage && cs.backgroundImage !== 'none');
    const bw = (s) => parseFloat(cs[s]) || 0;
    const hasBorder = bw('borderBottomWidth') >= 1 && (PARSE_RGB(cs.borderBottomColor)?.a || 0) > 0.05;

    if (replaced || hasBg || hasBorder) {
      const r = el.getBoundingClientRect();
      mark(r.left, r.top, r.right, r.bottom);
    }
  }

  return Math.round(Math.max(0, sr.height - inkBottom));
}

/**
 * 焦点 = 一组「现在讲这里」的 region，不是一串 CSS 类。
 *
 * 同一个意思今天有十余种写法（current / state=current / data-hl / tone=focus / ring /
 * spotlight / tree-row[data-current] …），每种由各自的组件实现。这里把它们收进一份
 * 可数的清单，让审计与跨帧度量说同一种话。
 *
 * 三条归一规则：
 *   · 连续的高亮字节（一段 0–4）算 1 个 region，不是 5 个；
 *   · 被另一个 region 包住的元素不重复计数（格子套在圈里）；
 *   · 聚光的目标算 1 个 focus，其余退后算 context（context 不计数）。
 */
export function focusRegions(stage) {
  const found = new Set();
  const add = (el) => {
    if (el) found.add(el);
  };
  // 覆盖层自己身上的 data-tone（ring 的 SVG 默认 tone="focus"）不是"画面上的焦点"，
  // 它是画法。只数作者/姿态落在内容上的标记。
  const inOverlay = (el) => !!el?.closest?.('[data-vk-overlay]');
  // 标签（kicker/chip/badge）是导航，不是"看这里"：它说明这页讲什么，
  // 不该占本帧的注意力。否则给 kicker 上一层语义色就会被算成第二个焦点，
  // 和真正的答案抢位置——作者只好要么不给标签上色、要么把答案的颜色去掉。
  const inLabel = (el) => !!el?.closest?.('vk-label');
  const addInk = (el) => {
    if (el && !inOverlay(el) && !inLabel(el)) found.add(el);
  };

  for (const el of stage.querySelectorAll('[data-vk-focus]')) addInk(el);
  // 注意力只有两个来源：作者写的 act="focus"，以及运行期落到元素上的 data-act / data-tone。
  // 13.0 这里只认 [tone="focus"]，于是 pose 给块级元素上的焦点（data-tone）永远数不到——
  // CSS 把字涂蓝、审计说"只有一处焦点"。
  for (const el of stage.querySelectorAll('[data-act="focus"], [tone="focus"], [data-tone="focus"]')) addInk(el);
  for (const el of stage.querySelectorAll('.vk-line.is-hl, .vk-asm-row.is-hl')) add(el);
  // 一段高亮字节 = 一个 region：按容器归一，而不是按字节
  for (const el of stage.querySelectorAll('.vk-byte[data-hl="1"], .vk-byte-c[data-hl="1"]')) {
    add(el.closest('.vk-bytes-row') || el.closest('.vk-bytes') || el);
  }
  for (const el of stage.querySelectorAll(
    '.vk-cell[data-state="current"], .vk-tree-row[data-current], .vk-step[data-state="current"], .vk-tl-item[data-state="current"], .vk-bit-row[data-state="current"], .vk-bar[data-state="current"], tr[data-state="current"], li[data-state="current"]'
  ))
    addInk(el);
  // 圈选本身就是「看这里」：一个 ring 算一个焦点 region。
  // 但如果它圈的就是已经算过的焦点（聚光目标 / 高亮行），不再重复计数。
  for (const el of stage.querySelectorAll('vk-ring, vk-annotate[data-mode="circle"]')) {
    const expr = el.getAttribute('for') || '';
    const anchor = expr ? resolveAnchor(stage, expr, el) : null;
    if (anchor?.el && found.has(anchor.el)) continue;
    add(el);
  }

  // 相邻同款行合成一个 region：两行表格、五个高亮字节都只算「一处」。
  for (const el of [...found]) {
    if (!(el instanceof HTMLElement)) continue;
    const prev = el.previousElementSibling;
    if (prev && found.has(prev) && prev.className === el.className) found.delete(el);
  }

  // 去掉被更外层 region 包含的重复项
  const out = [];
  for (const el of found) {
    let dup = false;
    for (const other of found) {
      if (other === el) continue;
      if (other.contains(el)) {
        dup = true;
        break;
      }
    }
    if (!dup) out.push(el);
  }
  return out;
}

export function installAudit(VK) {
  // 阈值表也给出去：门禁在浏览器里跑时读它，而不是各自抄一份数字。
  VK.limits = LIMITS;
  VK.auditPage = auditPage;
  VK.auditPages = auditPages;
  VK.metrics = metrics;
  VK.focusRegions = focusRegions;
}






