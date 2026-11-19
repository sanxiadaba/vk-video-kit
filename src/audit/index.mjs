/**
 * v27 · 自检（体检单）
 * ----------------------------------------------------------------------------
 * 只陈述事实，不评分、不拦出图。分三层，互不影响：
 *
 *   硬错 issues（无论怎么画都错）
 *     没有画布 / 画布尺寸不对 / 组件渲染失败 / 资源没加载 / 文字被裁 /
 *     元素出画布 / 块与块重叠 / 标注指空 / 空帧
 *
 *   事实 health（作者自己判断）
 *     正文带多高、可用多高、内容多高、超出多少、上下余量、焦点几处、每个块多高、
 *     最小字号（正文/全部）、哪些字被裁、哪些图被拉伸、墨迹纵向越界、
 *     墨迹横向越过正文带、SVG 出画布或压住正文、代码窗最长行、图片比例/放大/alt
 *
 *   提示 hints（只是提醒，不是门禁）
 *     焦点多处 / 整句 caption / 留白过多 / 代码行太长 / 代码 mark 没被标注用到 /
 *     暗页上的浅色卡片 / 图片拉伸、过度放大、缺 alt
 *
 * 「放不下」只是事实：这里只报「内容 640，正文带 546，超出 94px」。
 * 容量、留白、焦点数都不拦，只报数；hint 不进 issues，不改 ok / fits / clean / exit。
 *
 * 性能：整页的 getComputedStyle 与 getBoundingClientRect 在 measure() 里一次收完，
 * 后面的每个函数只读缓存，不再为每个块重扫全树。
 */
import { CANVAS } from '../vocab.mjs';

const PAGE_W = CANVAS.w;
const PAGE_H = CANVAS.h;
const EPS = 4; /* 与 v26 一致：4px 以内当作视觉误差 */
const LIMIT = 30; /* 每类事实最多记多少条，避免 JSON 爆掉 */

/* ---------------------------------------------------------------- 小工具 */
const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const ownText = (el) => [...(el.childNodes || [])].some((n) => n.nodeType === 3 && String(n.nodeValue || '').trim());
const round = (n) => Math.round(n);
const round2 = (n) => Math.round(n * 100) / 100;

/** 这一笔属于哪一件：自身 id，其次是最近的 vk 宿主 id。
    不继续往 page 的 id 上爬——否则每一条没 id 的问题都会被标成帧名。 */
const idOf = (el) => {
  if (!el) return null;
  if (el.id) return el.id;
  const host = el.closest?.('[data-vk]');
  return (host && host !== el && host.localName !== 'vk-page' && host.id) || null;
};
/** 源码行号：v27 的代码行都带 data-vk-line。 */
const lineOf = (el) => el?.closest?.('[data-vk-line]')?.getAttribute('data-vk-line') || null;

/** 这一件「是什么」：优先变体（diff / bytes / cells），再组件（code / board）。 */
const vkOf = (el) => {
  if (!el?.getAttribute) return '';
  return (
    el.getAttribute('data-as') ||
    el.getAttribute('data-vk') ||
    el.closest('[data-as]')?.getAttribute('data-as') ||
    el.closest('[data-vk]')?.getAttribute('data-vk') ||
    el.localName
  );
};

const overlapX = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left);
const overlapY = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
const intersects = (a, b) => overlapX(a, b) > EPS && overlapY(a, b) > EPS;

const directionOf = (sides) => {
  const x = sides.includes('left') || sides.includes('right');
  const y = sides.includes('top') || sides.includes('bottom');
  return x && y ? 'xy' : x ? 'x' : 'y';
};

/* ---------------------------------------------------------------- 一次测量
   整页只走一次：样式与盒一次收齐。读段不再写样式，所以这里不会反复触发同步布局。
   墨迹矩形按需算（只有文本块要），结果也缓存，避免同一块被三四个检查各算一遍。 */
const textRects = (el) => {
  const out = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width >= 0.5 && r.height >= 0.5) out.push(r);
  }
  return out;
};

const unionRects = (rects) => {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const r of rects) {
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(left)) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
};

/** 与 src/runtime/base.mjs 的 inkRect 同一算法。自检单独打包（dist/audit.js），
    不 import 运行时：那会把整套自定义元素再注册一遍。 */
function measure(root) {
  const styles = new Map();
  const boxes = new Map();
  const all = [...root.querySelectorAll('*')];
  for (const el of all) {
    styles.set(el, getComputedStyle(el));
    boxes.set(el, el.getBoundingClientRect());
  }
  styles.set(root, getComputedStyle(root));
  boxes.set(root, root.getBoundingClientRect());
  const inks = new WeakMap();

  const m = {
    all,
    style: (el) => styles.get(el) || getComputedStyle(el),
    rect: (el) => boxes.get(el) || el.getBoundingClientRect(),
    shown(el) {
      const cs = m.style(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0;
    },
    ink(el) {
      if (inks.has(el)) return inks.get(el);
      const out = unionRects(textRects(el)) || m.rect(el);
      inks.set(el, out);
      return out;
    },
  };
  return m;
}

/** 所有「真的在页面上」的元素；绝对定位的标注层不在其中。 */
function visible(root, m) {
  const out = [];
  for (const el of m.all) {
    if (el.closest('.vk-co, svg, script, style, template, .katex-mathml, math')) continue;
    if (!m.shown(el)) continue;
    out.push(el);
  }
  return out;
}

/* ---------------------------------------------------------------- 硬错定位 */

/** 横向被裁：元素自己的内容比盒子宽，且它（或中间祖先）会裁掉。取最深的那个，不重复报祖先。 */
function clipped(root, m) {
  const hits = [];
  for (const el of visible(root, m)) {
    if (!textOf(el)) continue;
    const cs = m.style(el);
    const own =
      cs.overflowX === 'hidden' ||
      cs.overflowX === 'clip' ||
      cs.whiteSpace === 'nowrap' ||
      cs.whiteSpace === 'pre' ||
      /* 正常换行的叶子也可能被一个不可断的长词顶出去。 */
      (cs.overflowX === 'visible' && cs.whiteSpace === 'normal' && !el.children.length);
    /* 只看中间祖先：页面自己的 overflow:hidden 是画布边界，越界交给 outside。 */
    let anc = false;
    for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
      const ps = m.style(p);
      if (ps.overflowX === 'hidden' || ps.overflowX === 'clip') {
        anc = true;
        break;
      }
    }
    if (!own && !anc) continue;
    if (el.clientWidth <= 0) continue;
    if (el.scrollWidth <= el.clientWidth + EPS) continue;
    hits.push(el);
  }
  /* 注记是覆盖层，但它的字也会被右边缘裁掉。 */
  for (const el of root.querySelectorAll('.vk-co-note')) {
    if (el.hidden) continue;
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + EPS) hits.push(el);
  }
  return hits
    .filter((el) => !hits.some((other) => other !== el && el.contains(other)))
    .map((el) => ({
      vk: vkOf(el),
      id: idOf(el),
      line: lineOf(el),
      text: textOf(el).slice(0, 36),
      over: round(el.scrollWidth - el.clientWidth),
      side: 'right',
      direction: 'x',
    }));
}

/** 出画布：正文块、图节点、时间点、注记，全都量；坐标一律相对画布左上角。 */
function outside(root, body, origin, m) {
  const raw = [];
  const seen = new Set();
  const els = [
    ...(body ? [...body.children] : []),
    /* 候选集与 v26 相同：自检只补事实，不新增门禁（新类的越界由 svgOutside 记录）。 */
    ...root.querySelectorAll('[data-vk], .vk-lc, .vk-line, .vk-arow, .vk-gnode, .vk-tl-i, .vk-tl-label, .vk-tl-note, .vk-seq-row, .vk-cell, .vk-bit, .vk-co-note'),
  ];
  for (const el of els) {
    if (el === root || seen.has(el)) continue;
    seen.add(el);
    if (el.matches('vk-callout')) continue;
    if (el.closest('svg, .vk-co-svg, .vk-co-label, [bleed="all"]')) continue;
    if (!m.shown(el)) continue;
    const cs = m.style(el);
    if (cs.position === 'fixed') continue;
    const r = m.rect(el);
    if (r.width < 1 && r.height < 1) continue;
    const left = r.left - origin.left;
    const top = r.top - origin.top;
    const right = r.right - origin.left;
    const bottom = r.bottom - origin.top;
    const sides = [];
    if (left < -EPS) sides.push('left');
    if (right > PAGE_W + EPS) sides.push('right');
    if (top < -EPS) sides.push('top');
    if (bottom > PAGE_H + EPS) sides.push('bottom');
    if (!sides.length) continue;
    raw.push({
      el,
      vk: vkOf(el),
      id: idOf(el),
      item: el.getAttribute('data-vk-item') || null,
      line: lineOf(el),
      sides,
      over: round(Math.max(0, -left, right - PAGE_W, -top, bottom - PAGE_H)),
    });
    if (raw.length >= 120) break;
  }
  /* 同一条越界链只报最外层：宿主和它的每一行都出界时，只留宿主那一笔。 */
  const kept = raw.filter((o) => !raw.some((p) => p !== o && p.el.contains(o.el)));
  return kept.slice(0, LIMIT).map(({ el, ...rest }) => ({ ...rest, side: rest.sides.join('/'), direction: directionOf(rest.sides) }));
}

/** 块与块重叠：正文第一层、flow 的子项、注记；绝对定位的标注 host 不算。 */
function overlaps(body, root, m) {
  const list = body
    ? [...body.children].flatMap((el) => {
        if (el.getAttribute('data-vk') !== 'flow') return [el];
        if (el.hasAttribute('overlay')) return [el]; /* overlay 是有意叠放 */
        return [...el.children];
      })
    : [];
  const notes = [...root.querySelectorAll('.vk-co-note')].filter((n) => !n.hidden);
  const all = [...list, ...notes].filter((el) => {
    if (el.matches('vk-callout')) return false;
    if (el.matches('[bleed="all"]')) return false;
    const cs = m.style(el);
    return cs.position !== 'fixed' && m.rect(el).height > 1;
  });
  const info = (el) => ({ vk: vkOf(el), id: el.id || null, line: lineOf(el), item: el.getAttribute('data-vk-item') || null });
  const name = (el, i) =>
    el.id || el.getAttribute('data-vk-item') || el.getAttribute('data-vk-line') || el.closest('[data-as]')?.getAttribute('data-as') || el.closest('[data-vk]')?.getAttribute('data-vk') || `${el.localName}${i + 1}`;
  const out = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (all[i].contains(all[j]) || all[j].contains(all[i])) continue;
      const a = m.rect(all[i]);
      const b = m.rect(all[j]);
      if (!intersects(a, b)) continue;
      const ox = overlapX(a, b);
      const oy = overlapY(a, b);
      const ia = info(all[i]);
      const ib = info(all[j]);
      out.push({
        a: name(all[i], i),
        b: name(all[j], j),
        over: round(oy),
        overX: round(ox),
        id: ia.id,
        vk: ia.vk,
        line: ia.line,
        item: ia.item,
        id2: ib.id,
        vk2: ib.vk,
        line2: ib.line,
        side: 'body',
        direction: oy >= ox ? 'y' : 'x',
      });
      if (out.length >= LIMIT) return out;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- 事实 */

/** 图片：比例、放大倍数、alt。拉伸按「画框比例 vs 原图比例」算，fit 只作为说明。 */
function images(root, m) {
  const out = [];
  for (const img of root.querySelectorAll('vk-img img')) {
    const box = m.rect(img);
    const host = img.closest('vk-img');
    const fit = m.style(img).objectFit || 'fill';
    const nw = img.naturalWidth || 0;
    const nh = img.naturalHeight || 0;
    const src = img.getAttribute('src') || '';
    const bw = round(box.width);
    const bh = round(box.height);
    const boxAspect = box.height > 0 ? box.width / box.height : 0;
    const naturalAspect = nw > 0 && nh > 0 ? nw / nh : 0;
    const mismatch = naturalAspect > 0 && boxAspect > 0 ? Math.abs(boxAspect - naturalAspect) / naturalAspect : 0;
    const vector = /^data:image\/svg\+xml/i.test(src) || /\.svg(?:$|[?#])/i.test(src);
    const upscale = nw > 0 ? box.width / nw : null;
    out.push({
      src,
      id: host?.id || null,
      alt: img.getAttribute('alt') ?? '',
      natural: [nw, nh],
      box: [bw, bh],
      fit,
      aspect: round2(boxAspect),
      naturalAspect: round2(naturalAspect),
      mismatch: round2(mismatch),
      stretched: mismatch > 0.02,
      upscale: upscale == null ? null : round2(upscale),
      upscaleOver: upscale != null && upscale > 1.5,
      vector,
    });
  }
  return out;
}

/** 字号：minFont 是旧口径（全部可见叶子）；minProseFont 排除公式上下标与行号。
    注记是覆盖层上的「一句话」，仍与 v26 一样不计入。 */
function fontFacts(root, m) {
  let min = Infinity;
  let minProse = Infinity;
  const under56 = [];
  for (const el of m.all) {
    if (el.closest('.vk-co, svg')) continue;
    if (el.children.length) continue;
    const text = textOf(el).replace(/[\s\u200b\u200c\u200d]/g, '');
    if (!text) continue;
    if (!m.shown(el)) continue;
    const size = parseFloat(m.style(el).fontSize) || 0;
    if (!size) continue;
    if (size < min) min = size;
    /* 只排除公式的上下标（KaTeX 的 .msupsub / sup / sub）与代码行号；正文 prose 不含它们。 */
    const mathScript = !!el.closest('.msupsub, .katex sup, .katex sub');
    const lineNo = el.matches('.vk-ln') || !!el.closest('.vk-ln');
    if (!mathScript && !lineNo && size < minProse) minProse = size;
    if (size < 56 - 0.5 && under56.length < 8) under56.push({ text: text.slice(0, 24), size: round(size) });
  }
  return {
    min: Number.isFinite(min) ? round(min) : 0,
    minProse: Number.isFinite(minProse) ? round(minProse) : 0,
    under56,
  };
}

/** 焦点：按「故事」折叠，不数元素。
    · 同一个 bytes / bits 窗口算 1（hex 与 ascii 各画一遍、每个位各一格，都是一件事）
    · 同一个代码窗里的行段算 1（current="4-6" 是「这几行」，不是三处）
    · 图里「当前节点 + 它连着的边」算 1，边不重复计数
    · 宿主 vk-code / vk-dir 上的 current 是输入，不是渲染结果，排除 */
const storyKind = (el) => {
  const code = el.closest('vk-code');
  if (code) return code.getAttribute('data-as') || 'code';
  if (el.closest('.vk-gnode')) return 'node';
  if (el.matches('.vk-gedge') || el.closest('.vk-gedge')) return 'edge';
  if (el.closest('.vk-step')) return 'step';
  if (el.closest('.vk-bar')) return 'bar';
  if (el.closest('.vk-tl-i')) return 'timeline';
  if (el.closest('.vk-cell')) return 'cell';
  if (el.closest('.vk-fr')) return 'frame';
  if (el.closest('.vk-band-r')) return 'band';
  if (el.closest('.vk-seq-row')) return 'seq';
  if (el.closest('.vk-node')) return 'dir';
  if (el.closest('tr')) return 'row';
  if (el.closest('li')) return 'item';
  if (el.closest('[data-vk="text"]')) return 'text';
  return 'current';
};

function focus(root) {
  const raw = [...root.querySelectorAll('[current], .is-cur')].filter((el) => !el.closest('.vk-co'));
  const host = (el) =>
    el.matches('vk-code, vk-dir') || ((el.getAttribute('data-vk') === 'code' || el.getAttribute('data-vk') === 'dir') && el.hasAttribute('current'));
  const cur = raw.filter((el) => !host(el));
  const graphCurrent = new Set([...root.querySelectorAll('.vk-gnode[current]')].map((n) => n.dataset.id).filter(Boolean));
  const stories = [];
  const keys = new Set();
  const add = (key, el, kind, text) => {
    if (keys.has(key)) return;
    keys.add(key);
    stories.push({ el, kind, text: text !== undefined ? text : textOf(el).slice(0, 36) });
  };
  for (const el of cur) {
    const code = el.closest('vk-code');
    const as = code?.getAttribute('data-as');
    if (code && (as === 'bytes' || as === 'bits')) {
      add(code, code, as);
      continue;
    }
    if (el.matches('.vk-gedge')) {
      /* 边和它连着的当前节点是同一个故事。 */
      if (graphCurrent.has(el.dataset.from) || graphCurrent.has(el.dataset.to)) continue;
      add(el, el, 'edge', el.getAttribute('data-edge') || '');
      continue;
    }
    if (code) {
      add(code, code, as || 'code');
      continue;
    }
    if (el.matches('.vk-gnode')) {
      add(el, el, 'node');
      continue;
    }
    add(el, el, storyKind(el));
  }
  /* 同一故事里嵌套的只留外层（例如位域字段包着位格）。 */
  const top = stories.filter((s) => !stories.some((o) => o !== s && o.el.contains(s.el)));
  const kinds = [...new Set(top.map((s) => s.kind))];
  return {
    count: top.length,
    kind: !top.length ? null : kinds.length === 1 ? kinds[0] : 'mixed',
    targets: top.map((s) => ({
      vk: s.kind === 'node' || s.kind === 'edge' ? s.kind : vkOf(s.el),
      id: s.el.id || null,
      text: s.text,
    })),
  };
}

/** 墨迹越界：
    · textOverflowY  文本块墨迹底 − 块底；块被压扁时字会从下面露出来
    · bodyOverflowX  块/文本墨迹右侧 − .vk-body 内容右缘（注栏不算正文带；bleed 是有意的，排除） */
function inkFacts(root, body, blocks, rects, m) {
  const textOverflowY = [];
  const bodyOverflowX = [];
  if (!body) return { textOverflowY, bodyOverflowX };
  const bc = m.style(body);
  const br = m.rect(body);
  const bodyRight = br.right - (parseFloat(bc.paddingRight) || 0) - (parseFloat(bc.borderRightWidth) || 0);
  const seen = new Set();
  const list = blocks.map((el, i) => ({ el, r: rects[i] }));
  /* 卡片/流程里的 vk-text 不在 blocks 里，也要量：它才是「文本块」本体。 */
  for (const el of root.querySelectorAll('vk-text, .vk-title, .vk-lede, .vk-kick')) list.push({ el, r: m.rect(el) });
  for (const { el, r } of list) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (!m.shown(el)) continue;
    if (!textOf(el)) continue;
    const ink = m.ink(el);
    const overY = ink.bottom - r.bottom;
    if (overY > EPS && textOverflowY.length < LIMIT) {
      textOverflowY.push({ vk: vkOf(el), id: idOf(el), line: lineOf(el), text: textOf(el).slice(0, 36), over: round(overY), side: 'bottom', direction: 'y' });
    }
    if (el.hasAttribute('bleed') || el.closest('[bleed]')) continue;
    const overX = Math.max(ink.right, r.right) - bodyRight;
    if (overX > EPS && bodyOverflowX.length < LIMIT) {
      bodyOverflowX.push({ vk: vkOf(el), id: idOf(el), line: lineOf(el), text: textOf(el).slice(0, 36), over: round(overX), side: 'right', direction: 'x' });
    }
  }
  return { textOverflowY, bodyOverflowX };
}

/** 标注目标（含 from/to）覆盖到的宿主与它们的祖先：标记画在自己目标上不算「压住正文」。 */
function anchorExempt(root) {
  const set = new Set();
  const mark = (el) => {
    for (let n = el; n && n !== root; n = n.parentElement) set.add(n);
  };
  for (const co of root.querySelectorAll('vk-callout')) {
    for (const name of ['target', 'from', 'to']) {
      for (const expr of String(co.getAttribute(name) || '')
        .split(/\s+/)
        .filter(Boolean)) {
        if (!expr.startsWith('#')) continue;
        const at = expr.indexOf('@');
        const sel = at > 0 ? expr.slice(0, at) : expr;
        let el = null;
        try {
          el = root.querySelector(sel);
        } catch {
          el = null;
        }
        if (el) mark(el);
      }
    }
  }
  for (const g of root.querySelectorAll('vk-graph')) mark(g);
  return set;
}

/** getBBox → 画布坐标。SVG 的 viewBox 可能被缩放过，所以走 getScreenCTM，不手动猜。 */
function screenBox(el, origin) {
  let bb;
  try {
    bb = el.getBBox();
  } catch {
    return null;
  }
  if (!bb || (!bb.width && !bb.height)) return null;
  const ctm = el.getScreenCTM?.();
  if (!ctm) return null;
  const pts = [
    [bb.x, bb.y],
    [bb.x + bb.width, bb.y],
    [bb.x, bb.y + bb.height],
    [bb.x + bb.width, bb.y + bb.height],
  ].map(([x, y]) => ({ x: ctm.a * x + ctm.c * y + ctm.e, y: ctm.b * x + ctm.d * y + ctm.f }));
  const left = Math.min(...pts.map((p) => p.x)) - origin.left;
  const top = Math.min(...pts.map((p) => p.y)) - origin.top;
  const right = Math.max(...pts.map((p) => p.x)) - origin.left;
  const bottom = Math.max(...pts.map((p) => p.y)) - origin.top;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/** SVG 事实：所有 .vk-gedge-l 与 .vk-co-* 的包围盒，出画布或压住正文的记一笔。
    标记画在「自己的目标」上是有意的，exempt 里的块不算被压。 */
function svgFacts(root, body, blocks, m, origin, exempt) {
  if (!body) return [];
  const out = [];
  /* SVG 件走 getBBox；HTML 的 .vk-co-label（measure / arrow 的字）没有 getBBox，退回盒。 */
  const shapes = [
    ...root.querySelectorAll('.vk-co-svg > *'),
    ...root.querySelectorAll('.vk-gedges .vk-gedge-l'),
    ...[...root.querySelectorAll('.vk-co-label')].filter((el) => !el.closest('svg')),
  ];
  if (!shapes.length) return out;
  const br = m.rect(body);
  const bc = m.style(body);
  const bodyBox = {
    left: br.left,
    right: br.right - (parseFloat(bc.paddingRight) || 0) - (parseFloat(bc.borderRightWidth) || 0),
    top: br.top,
    bottom: br.bottom,
  };
  for (const el of shapes) {
    let box;
    if (typeof el.getBBox === 'function') box = screenBox(el, origin);
    else {
      const r = m.rect(el);
      box = { left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top, width: r.width, height: r.height };
    }
    if (!box || (!box.width && !box.height)) continue;
    const sides = [];
    if (box.left < -EPS) sides.push('left');
    if (box.right > PAGE_W + EPS) sides.push('right');
    if (box.top < -EPS) sides.push('top');
    if (box.bottom > PAGE_H + EPS) sides.push('bottom');
    const co = el.closest('vk-callout');
    const gHost = el.closest('vk-graph');
    let pressed = null;
    if (intersects(box, bodyBox)) {
      pressed = blocks.find((b) => !exempt.has(b) && intersects(box, m.rect(b))) || null;
      /* 图节点不是 body 的直接子项；标注压到别的节点上，也要记一笔。 */
      if (!pressed) pressed = [...root.querySelectorAll('.vk-gnode')].find((n) => !exempt.has(n) && intersects(box, m.rect(n))) || null;
    }
    if (!sides.length && !pressed) continue;
    const outOver = sides.length ? Math.max(0, -box.left, box.right - PAGE_W, -box.top, box.bottom - PAGE_H) : 0;
    const pressOver = pressed ? Math.min(overlapX(box, m.rect(pressed)), overlapY(box, m.rect(pressed))) : 0;
    out.push({
      vk: co ? co.getAttribute('data-as') || 'callout' : gHost ? gHost.getAttribute('data-as') || 'graph' : 'svg',
      part: el.getAttribute('class') || el.localName,
      id: co ? co.id || null : gHost ? gHost.id || null : null,
      sides,
      side: sides.length ? sides.join('/') : pressed ? 'body' : null,
      direction: sides.length ? directionOf(sides) : 'xy',
      over: round(Math.max(outOver, pressOver)),
      pressed: pressed ? (pressed.matches('.vk-gnode') ? 'node' : 'body') : null,
      pressedBy: pressed ? pressed.id || vkOf(pressed) : null,
    });
    if (out.length >= LIMIT) break;
  }
  return out;
}

/** flow 的列数；auto / 没写按 1 算。 */
function flowCols(flow) {
  if (!flow) return 1;
  const split = String(flow.getAttribute('split') || '').trim();
  if (split) return split.split(/\s+/).filter(Boolean).length;
  const cols = String(flow.getAttribute('cols') || '').trim();
  if (!cols || cols === 'auto') return 1;
  const n = Number(cols);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** 代码窗最长行：整幅上限 32，半栏上限 20。只量真正渲染出来的 .vk-lc。 */
function codeFacts(root, bodyWidth, m) {
  const byHost = new Map();
  for (const lc of root.querySelectorAll('.vk-lc')) {
    const code = lc.closest('vk-code');
    if (!code) continue;
    const text = (lc.textContent || '').replace(/\s+$/, '');
    const chars = [...text].length;
    const item = byHost.get(code) || { host: code, max: 0, line: null, text: '' };
    if (chars > item.max) {
      item.max = chars;
      item.line = lineOf(lc);
      item.text = text;
    }
    byHost.set(code, item);
  }
  const windows = [];
  let maxLineChars = 0;
  for (const [host, item] of byHost) {
    /* 半栏 = 它所在的那一栏不到 flow 的全宽；span 跨满时仍按整幅算。 */
    const flow = host.closest('[data-vk="flow"]');
    let half = bodyWidth > 0 && m.rect(host).width < bodyWidth * 0.7;
    if (flow && flowCols(flow) > 1) {
      const owner = [...flow.children].find((c) => c.contains(host));
      const span = Number(owner?.style?.getPropertyValue('--vk-span')) || 1;
      half = span < flowCols(flow);
    }
    windows.push({
      id: host.id || null,
      vk: host.getAttribute('data-as') || 'code',
      max: item.max,
      limit: half ? 20 : 32,
      half,
      line: item.line,
      text: item.text.slice(0, 48),
    });
    if (item.max > maxLineChars) maxLineChars = item.max;
  }
  return { maxLineChars, windows };
}

/** 代码里的 mark：只给 @text / @item 锚点用。没有 callout 指它，就没人看得见。 */
function itemIn(value, arg) {
  const v = Number(value);
  if (!Number.isFinite(v)) return false;
  const hit = String(arg).match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!hit) return false;
  const a = Number(hit[1]);
  const b = hit[2] ? Number(hit[2]) : a;
  return v >= Math.min(a, b) && v <= Math.max(a, b);
}

function markFacts(root) {
  const marks = [...root.querySelectorAll('.vk-mark')];
  if (!marks.length) return { marks: 0, unused: [] };
  const used = new Set();
  for (const co of root.querySelectorAll('vk-callout')) {
    for (const attr of ['target', 'from', 'to']) {
      for (const expr of String(co.getAttribute(attr) || '')
        .split(/\s+/)
        .filter(Boolean)) {
        if (!expr.startsWith('#')) continue;
        const at = expr.indexOf('@');
        if (at < 0) continue;
        let host = null;
        try {
          host = root.querySelector(expr.slice(0, at));
        } catch {
          host = null;
        }
        if (!host) continue;
        for (const part of expr.slice(at + 1).split('@')) {
          const colon = part.indexOf(':');
          if (colon < 0) continue;
          const name = part.slice(0, colon).trim();
          const arg = part.slice(colon + 1).trim();
          if (name !== 'text' && name !== 'item') continue;
          for (const mark of host.querySelectorAll('.vk-mark')) {
            if (name === 'text' && mark.getAttribute('data-vk-text') === arg) used.add(mark);
            if (name === 'item' && itemIn(mark.getAttribute('data-vk-item'), arg)) used.add(mark);
          }
        }
      }
    }
  }
  const unused = marks
    .filter((mark) => !used.has(mark))
    .slice(0, LIMIT)
    .map((mark) => ({
      vk: 'mark',
      id: idOf(mark),
      line: lineOf(mark),
      text: mark.getAttribute('data-vk-text') || textOf(mark),
      item: mark.getAttribute('data-vk-item') || null,
    }));
  return { marks: marks.length, unused };
}

/* 颜色：把卡片「解析后的背景」找出来——透明就继续往上找，直到有实底或到页。 */
function parseColor(value) {
  const hit = String(value).match(/rgba?\(([^)]+)\)/i);
  if (!hit) return null;
  const parts = hit[1]
    .split(/[,\s/]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}
const linear = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ({ r, g, b }) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

function resolvedBg(el, m) {
  for (let n = el; n; n = n.parentElement) {
    const cs = m.style(n);
    const color = parseColor(cs.backgroundColor);
    if (color && color.a > 0.5) return { ...color, css: cs.backgroundColor, target: n };
  }
  return null;
}

/** 暗页上的浅色卡片：亮度 > 0.6 会像一块发光的纸，抢正文。只报事实。 */
function surfaceFacts(root, m) {
  const theme = root.getAttribute('theme') || 'light';
  if (theme !== 'dark') return { dark: false, cards: [] };
  const cards = [];
  for (const card of root.querySelectorAll('vk-card, [data-vk="card"]')) {
    const bg = resolvedBg(card, m);
    if (!bg) continue;
    const lum = luminance(bg);
    if (lum <= 0.6) continue;
    cards.push({
      vk: 'card',
      id: card.id || null,
      surface: card.getAttribute('surface') || null,
      bg: bg.css,
      luminance: round2(lum),
    });
  }
  return { dark: true, cards };
}

/* ---------------------------------------------------------------- 入口 */
export function auditPage(stage) {
  const issues = [];
  const push = (code, message, fix, extra = {}) => issues.push({ code, message, fix, ...extra });

  const page = stage?.closest?.('vk-page');
  if (!page) return { ok: false, issues: [{ code: 'FRAME', message: '这一页没有 <vk-page>', fix: '把内容包进 <vk-page>…</vk-page>' }], health: null };

  /* 一次收齐样式与盒；后面全部读缓存。 */
  const m = measure(page);
  const pr = m.rect(page);
  if (round(pr.width) !== PAGE_W || round(pr.height) !== PAGE_H) {
    push('FRAME', `画布是 ${round(pr.width)}×${round(pr.height)}，不是 1920×1080`, '检查页面样式是否覆盖了 vk-page 的宽高', { direction: 'xy', side: 'canvas' });
  }

  for (const el of page.querySelectorAll('[data-vk-error]')) push('RENDER', `<${el.localName}> 渲染失败`, '看控制台里的 [vk] 错误；这是组件抛的，不是版式问题');

  const imgs = images(page, m);
  for (const img of page.querySelectorAll('vk-img img')) {
    if (img.complete && img.naturalWidth === 0) {
      const host = img.closest('vk-img');
      push('ASSET', `图片没加载：${img.getAttribute('src') || '(没有 src)'}`, host?.getAttribute('alt') ? `alt="${host.getAttribute('alt')}"` : '检查路径是否相对页面文件');
    }
  }
  /* 只有真的渲染了字，才要求字体；空帧/坏块不该报字体。 */
  const usedFamilies = new Set();
  for (const el of m.all) {
    if (!ownText(el)) continue;
    if (el.closest('.vk-missing')) continue;
    usedFamilies.add(m.style(el).fontFamily);
  }
  const usedFamily = [...usedFamilies].join(' ');
  for (const f of window.vk?._fonts || []) {
    if (!f.ok && usedFamily.includes(f.family)) push('ASSET', `字体没加载：${f.family}`, '跑一次 vk build 会重建字体；检查 dist/fonts 是否完整');
  }

  const anchorMissing = page.querySelectorAll('vk-callout[data-vk-anchor-missing]').length;
  for (const el of page.querySelectorAll('vk-callout[data-vk-anchor-missing]')) {
    const target = el.getAttribute('target') || el.getAttribute('from') || el.getAttribute('to') || '';
    push('ANCHOR', `标注指不到东西：${target}`, '锚点只认 #id / #id@line:3 / #id@item:2 / #id@bit:5 / #id@text:词 / #id@side:left', {
      id: el.id || null,
      vk: 'callout',
      line: lineOf(el),
      side: 'target',
      direction: 'xy',
    });
  }

  const body = stage.querySelector('.vk-body');
  const head = stage.querySelector('vk-head, [data-vk="head"]');

  const clips = clipped(page, m);
  for (const c of clips) {
    push('CLIPPED', `横向被裁：<${c.vk}>「${c.text}」多出 ${c.over}px`, '缩短这一行、拆帧，或给这一件更多宽度', c);
  }

  const outs = outside(page, body, pr, m);
  for (const o of outs) {
    push('OUTSIDE', `<${o.vk}> 出了画布（${o.sides.join('/')}，${o.over}px）`, '往版心里收；整帧铺满只给 vk-img bleed="all"', o);
  }

  const empty = !(head && textOf(head)) && (body ? !textOf(body) && !body.querySelector('img, vk-img') : true);
  if (empty && !page.querySelector('vk-img[bleed="all"]')) push('EMPTY', '这一帧没有内容', '写内容，或删掉这一帧');
  const overlapList = overlaps(body, page, m);
  for (const o of overlapList) {
    push('OVERLAP', `<${o.a}> 和 <${o.b}> 叠在一起（${o.over}px）`, '调节间距、换 flow 或拆帧；块与块不该重叠', o);
  }

  /* ---------------------------------------------------------------- 几何事实 */
  const bodyRect = body ? m.rect(body) : { top: 0, bottom: 0, left: 0, right: 0, height: 0 };
  const bodyH = body ? round(bodyRect.height) : 0;
  const bodyCs = body ? m.style(body) : null;
  const bodyWidth = body ? round(body.clientWidth - (parseFloat(bodyCs.paddingLeft) || 0) - (parseFloat(bodyCs.paddingRight) || 0)) : 0;

  /* 可用高：stage 内容高 − 标题带 − 一道 stage gap。
     place=center / bottom 时 .vk-body 是 flex 0 1 auto（缩到内容高），
     不能再拿 body 自己的高度当容量，否则 overflow 永远 0。 */
  const stageRect = m.rect(stage);
  const stageCs = m.style(stage);
  const stagePadTop = parseFloat(stageCs.paddingTop) || 0;
  const stagePadBottom = parseFloat(stageCs.paddingBottom) || 0;
  const stageGap = parseFloat(stageCs.rowGap) || parseFloat(stageCs.gap) || 0;
  const stageInnerTop = stageRect.top + stagePadTop + (parseFloat(stageCs.borderTopWidth) || 0);
  const stageInnerBottom = stageRect.bottom - stagePadBottom - (parseFloat(stageCs.borderBottomWidth) || 0);
  const stageAvailable = stageInnerBottom - stageInnerTop;
  const headH = head ? round(m.rect(head).height) : 0;
  /* center / bottom 里标题带会随内容一起移动，所以容量不能量「当前 head 底到 stage 底」，
     要用 stage 内容高 − head 高 − 一道 gap：内容是长高时整组会重新居中 / 顶上去。 */
  const bandAvailable = Math.max(0, round(stageAvailable - (headH > 0 ? headH + stageGap : 0)));
  /* 当前这一帧里正文实际占的那一段（标题带底 + gap 到 stage 底），余量按它算。 */
  const bandTop = headH > 0 ? m.rect(head).bottom + stageGap : stageInnerTop;
  const bandBottom = stageInnerBottom;

  const direct = body
    ? [...body.children].filter((el) => {
        if (el.matches('vk-callout')) return false;
        if (el.matches("vk-img[bleed='all']")) return false;
        const pos = m.style(el).position;
        return pos !== 'absolute' && pos !== 'fixed';
      })
    : [];

  /* flow 里再下一层：否则两个块并排时只报一个 flow 的高度。 */
  const blocks = direct.flatMap((el) => (el.getAttribute('data-vk') === 'flow' ? [...el.children] : [el]));
  const rects = blocks.map((el) => m.rect(el));
  const contentTop = rects.length ? Math.min(...rects.map((r) => r.top)) : bandTop;
  const contentBottom = rects.length ? Math.max(...rects.map((r) => r.bottom)) : bandTop;
  const contentH = rects.length ? round(contentBottom - contentTop) : 0;
  /* band / top 的 .vk-body 本来就撑满剩余高度（bodyH 就是可用高），沿用旧口径，
     免得浮点取整把「刚好放下」翻成 fits=false；center / bottom 才用算出来的可用高。 */
  const place = page.getAttribute('place') || 'band';
  const available = place === 'center' || place === 'bottom' ? bandAvailable : bodyH || bandAvailable;
  const overflow = Math.max(0, contentH - available);
  /* 没有内容时余量记 0（与 v26 一致），不要把整条空带算成余量。 */
  const slackTop = rects.length ? round(contentTop - bandTop) : 0;
  const slackBottom = rects.length ? round(bandBottom - contentBottom) : 0;

  const blockFacts = blocks.map((el, i) => {
    const r = rects[i];
    /* 不能只量固定类名：list/card 的 text 在 li/span 上，宿主自身是 16px。
       量所有真在显示文字的叶子，取最大字号。 */
    const leaves = [el, ...el.querySelectorAll('*')].filter((n) => {
      if (n.closest('.vk-co, svg')) return false;
      if (!ownText(n)) return false;
      return m.shown(n);
    });
    const sizes = leaves.map((n) => parseFloat(m.style(n).fontSize) || 0).filter(Boolean);
    const rowSel = el.getAttribute('data-as') === 'bytes' ? '.vk-brow' : el.getAttribute('data-as') === 'bits' ? '.vk-field' : '[data-vk-line], li, tr';
    return {
      vk: vkOf(el),
      id: el.id || null,
      h: round(r.height),
      top: round(r.top - bandTop),
      rows: el.querySelectorAll(rowSel).length,
      font: round(Math.max(...sizes, 0)),
      overflow: Math.max(0, round(r.bottom - bandBottom)),
    };
  });

  const f = focus(page);
  const fonts = fontFacts(page, m);
  const callouts = [...page.querySelectorAll('vk-callout')].map((el) => {
    const note = el.querySelector('.vk-co-note');
    const nr = note && !note.hidden ? m.rect(note) : null;
    const as = el.getAttribute('data-as') || 'note';
    return {
      as,
      mode: as, /* v26 字段，留一版兼容 */
      id: el.id || null,
      target: el.getAttribute('target'),
      from: el.getAttribute('from'),
      to: el.getAttribute('to'),
      label: el.getAttribute('label'),
      side: el.getAttribute('data-vk-side') || null,
      tight: el.hasAttribute('data-vk-tight'),
      anchorMissing: el.hasAttribute('data-vk-anchor-missing'),
      error: el.getAttribute('data-vk-anchor-error') || null,
      note: nr ? { left: round(nr.left - pr.left), top: round(nr.top - pr.top), w: round(nr.width), h: round(nr.height) } : null,
    };
  });

  const ink = inkFacts(page, body, blocks, rects, m);
  const exempt = anchorExempt(page);
  const svgOutside = svgFacts(page, body, blocks, m, pr, exempt);
  const code = codeFacts(page, bodyWidth, m);
  const marks = markFacts(page);
  const surfaces = surfaceFacts(page, m);
  const fillRaw = available > 0 ? contentH / available : 0;
  const fill = round2(fillRaw);

  /* ---------------------------------------------------------------- 提示
     只进 health.hints。hint 永远不改 ok / fits / clean / exit。 */
  const hints = [];
  const hint = (codeName, message, extra = {}) => hints.push({ code: codeName, severity: 'hint', message, ...extra });

  if (f.count > 1) {
    hint('FOCUS_MULTI', `一帧 ${f.count} 处焦点：${f.targets.map((t) => `<${t.vk}${t.id ? ` #${t.id}` : ''}>「${t.text}」`).join('、')}。一帧一件事，观众只该看一处`, {
      targets: f.targets,
    });
  }

  for (const el of page.querySelectorAll('vk-text, [data-vk="text"]')) {
    const text = textOf(el);
    if (!text) continue;
    const size = parseFloat(m.style(el).fontSize) || 0;
    if (Math.abs(size - 56) > 1) continue;
    const cn = (text.match(/[\u3400-\u9fff]/g) || []).length;
    const chars = [...text].length;
    if (cn > 12 || chars > 24) {
      hint('CAPTION_SENTENCE', `整句 caption（${round(size)}px，${cn} 个汉字 / ${chars} 字符）：「${text.slice(0, 40)}」。caption 是标签，不是句子`, {
        vk: 'text',
        id: idOf(el),
        line: lineOf(el),
        size: round(size),
        cn,
        chars,
      });
    }
  }

  if (contentH > 0 && available > 0 && fillRaw < 0.35) {
    hint('AIR_TOO_MUCH', `内容占可用高 ${round(fill * 100)}%（${contentH}/${available}），留白 ${round((1 - fill) * 100)}%：想更满就加内容或换 place`, {
      fill,
      content: contentH,
      available,
    });
  }

  for (const w of code.windows) {
    if (w.max <= w.limit) continue;
    hint('CODE_LONG_LINE', `代码窗（${w.half ? '半栏' : '整幅'}）最长一行 ${w.max} 字符，超过 ${w.limit}：「${w.text}」`, w);
  }

  for (const mk of marks.unused.slice(0, 8)) {
    hint('MARK_UNUSED', `代码里的 mark「${mk.text}」没有任何 callout 的 @text / @item 指向它；代码 mark 只是锚点，默认看不见`, mk);
  }

  for (const s of surfaces.cards) {
    hint('LIGHT_SURFACE_ON_DARK', `暗页上的卡片是浅色底（surface="${s.surface || 'auto'}"，亮度 ${s.luminance}，${s.bg}）：会像一块发光的纸，抢正文`, s);
  }

  for (const im of imgs) {
    if (im.stretched) {
      hint('IMG_STRETCHED', `图片画框 ${im.box[0]}×${im.box[1]}（${im.aspect}）与原图 ${im.natural[0]}×${im.natural[1]}（${im.naturalAspect}）差 ${round(im.mismatch * 100)}%：contain 会留边、cover 会裁切、fill 会变形`, {
        vk: 'img',
        id: im.id,
        box: im.box,
        natural: im.natural,
        fit: im.fit,
        mismatch: im.mismatch,
      });
    }
    if (!im.vector && im.upscaleOver) {
      hint('IMG_UPSCALE', `图片被放大 ${im.upscale}×（画框宽 ${im.box[0]}，原图宽 ${im.natural[0]}）：手机上会糊`, { vk: 'img', upscale: im.upscale });
    }
    if (!im.alt) {
      hint('IMG_NO_ALT', `图片没有 alt：${im.src.slice(0, 60)}`, { vk: 'img', src: im.src.slice(0, 80) });
    }
  }

  const tight = callouts.filter((c) => c.tight);
  if (tight.length) {
    hint('CALLOUT_TIGHT', `${tight.length} 条标注的跑道太短，已退化成引线 + 点或折角（tight 只是事实，画已经画了）`, {
      callouts: tight.map((c) => ({ as: c.as, id: c.id, side: c.side })),
    });
  }

  return {
    ok: issues.length === 0,
    fits: overflow === 0,
    issues,
    /* v27 的提示单独一条路：调用方愿意收就收，绝不并进 issues / ok。 */
    hints,
    /* 焦点故事：{count, kind, targets}；health.focus 仍保留数字兼容。 */
    focus: f,
    health: {
      head: headH,
      /* 正文带高度：body 是新名，band 留一版兼容。 */
      body: bodyH,
      band: bodyH,
      /* stage 可用高 − 标题带：place=center / bottom 时真正能放内容的高度。 */
      bandAvailable,
      bodyWidth,
      content: contentH,
      overflow,
      fill,
      slackTop,
      slackBottom,
      /* 焦点：focus 仍是数字（v26 兼容，值为故事数），故事明细在 focusDetail。 */
      focus: f.count,
      focusKind: f.kind,
      focusTargets: f.targets,
      focusDetail: f,
      callout: callouts.length,
      calloutTight: callouts.filter((c) => c.tight).length,
      callouts,
      /* 指空的标注：anchorMissing 是新名，anchors 留一版兼容。 */
      anchorMissing,
      anchors: anchorMissing,
      empty: !!empty,
      minFont: fonts.min,
      minProseFont: fonts.minProse,
      under56: fonts.under56,
      blocks: blockFacts,
      clipped: clips,
      outside: outs,
      overlaps: overlapList,
      images: imgs,
      /* 新增事实（都只进 facts，不进 issues） */
      textOverflowY: ink.textOverflowY,
      bodyOverflowX: ink.bodyOverflowX,
      svgOutside,
      maxLineChars: code.maxLineChars,
      codeWindows: code.windows,
      markWithoutCallout: marks.unused,
      marks: marks.marks,
      lightSurfaceOnDark: surfaces.cards,
      hints,
    },
  };
}

export function auditDocument() {
  return [...document.querySelectorAll('.vk-stage')].map((stage) => auditPage(stage));
}

if (typeof window !== 'undefined') {
  window.vkAudit = { page: auditPage, document: auditDocument };
}
