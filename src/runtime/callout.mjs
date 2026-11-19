/**
 * v27 · 标注
 * ----------------------------------------------------------------------------
 * 形状由构建期写回 data-as（note / mark / arrow / measure / jump），运行期只读。
 * 标注由三件组成，形状跟着目标走：
 *   标记  词/块用框，行用墨下一条，行段与 item 组用右侧括号
 *   连接  从标记右缘水平走到文字，杆 8，尖离文字 32（指盒子才贴边）
 *   文字  卡片外的一句话，与标记同高；永远不进卡片、不压代码
 *   跳转  同一段代码里行到行：走代码窗右侧的竖向通道
 *
 * 锚点：#id / #id@line:3 / #id@line:3-4 / #id@item:1-3 / #id@bit:5 /
 *       #id@text:词 / #id@side:right。
 */
import { VkElement, define, resolveAnchor, anchorFail } from './base.mjs';
import { mk, clamp } from '../shared/svg.mjs';
import { ANN, ARROW, port, headPolygon } from '../shared/connector.mjs';
import { CANVAS } from '../vocab.mjs';

/* 标注是覆盖层，但不许出画布版心：所有右向锚点的上限。 */
const CONTENT_RIGHT = CANVAS.w - CANVAS.marginX;

const COMPONENT = 'vk-code, vk-board, vk-graph, vk-dir, vk-math, vk-seq, vk-card, vk-img, vk-text';

/* jump 的通道几何：窗边外 32 起，多条各让 16，最多 3 道。 */
const JUMP = { channel: 32, lane: 16, lanes: 3, headMin: 28, stub: 12, labelGap: 12 };

/* 词的边界：一个 mark 常常只是 token 的一截（a[i] 里的 i）。
   框要套得住整个 token，才不吃进隔壁的括号。 */
const TOKEN_CH = /[A-Za-z0-9_[\]().;]/;
function locate(root, offset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.textContent.length;
    if (pos + len >= offset) return { node: n, offset: offset - pos };
    pos += len;
  }
  return null;
}
/** 词的边界：mark 常常只是 token 的一截（a[i] 里的 i），框要套住整个 token。 */
function tokenRect(el) {
  const root = el.closest('.vk-lc') || el.parentNode;
  if (!root) return el.getBoundingClientRect();
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEndBefore(el);
  const start = before.toString().length;
  const full = root.textContent || '';
  let a = start;
  let b = start + (el.textContent || '').length;
  while (a > 0 && TOKEN_CH.test(full[a - 1])) a--;
  while (b < full.length && TOKEN_CH.test(full[b])) b++;
  const s = locate(root, a);
  const e = locate(root, b);
  if (!s || !e) return el.getBoundingClientRect();
  const range = document.createRange();
  range.setStart(s.node, s.offset);
  range.setEnd(e.node, e.offset);
  const r = range.getBoundingClientRect();
  return r.width || r.height ? r : el.getBoundingClientRect();
}

const rect = (r, origin) => ({
  left: r.left - origin.left,
  top: r.top - origin.top,
  right: r.right - origin.left,
  bottom: r.bottom - origin.top,
  width: r.width,
  height: r.height,
});
const cx = (r) => r.left + r.width / 2;
const cy = (r) => r.top + r.height / 2;

/** 相对坐标下的一组 rect 取并集。 */
const unionRel = (rects) => {
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
  if (!Number.isFinite(left)) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  return { left, top, right, bottom, width: right - left, height: bottom - top };
};

/** 标记的几何：量阶段只算形状，写阶段才落笔。 */
const boxOf = (r) => ({ left: r.left - ANN.boxPad, top: r.top - ANN.boxPadY, right: r.right + ANN.boxPad, bottom: r.bottom + ANN.boxPadY });

/** 标记画完后的外沿：注记的箭头从这里出发。 */
const markExtent = (g) => {
  if (g.kind === 'bracket') {
    const right = Math.max(...g.rects.map((r) => r.right));
    const top = Math.min(...g.rects.map((r) => r.top)) - ANN.barGap;
    const bottom = Math.max(...g.rects.map((r) => r.bottom)) + ANN.barGap;
    const x = Math.min(right + ANN.bracket, CONTENT_RIGHT - 8);
    return { cy: (top + bottom) / 2, right: x, left: x - ANN.arm, top, bottom };
  }
  if (g.kind === 'bar') {
    const bars = g.rects.map((r) => ({ tmp: r, y: r.bottom + ANN.barGap + ANN.bar / 2 }));
    const last = bars[bars.length - 1];
    return {
      cy: (last.tmp.top + last.tmp.bottom) / 2,
      left: Math.min(...bars.map((b) => b.tmp.left)) - ANN.over,
      right: Math.max(...bars.map((b) => b.tmp.right)) + ANN.over,
      top: bars[0].y - ANN.bar / 2,
      bottom: last.y + ANN.bar / 2,
    };
  }
  const b = g.box;
  return { cy: (b.top + b.bottom) / 2, right: b.right, left: b.left, top: b.top, bottom: b.bottom };
};

/** 自动端口：有正面空隙就直连；空隙太短就绕到上/下/左/右，避免箭头贴脸。 */
function autoSides(a, b) {
  const hRight = b.left - a.right;
  const hLeft = a.left - b.right;
  const vBottom = b.top - a.bottom;
  const vTop = a.top - b.bottom;
  const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);

  if (hRight > 0 && overlapY > 0) return hRight >= 160 ? ['right', 'left'] : a.top > 96 ? ['top', 'top'] : ['bottom', 'bottom'];
  if (hLeft > 0 && overlapY > 0) return hLeft >= 160 ? ['left', 'right'] : a.top > 96 ? ['top', 'top'] : ['bottom', 'bottom'];
  if (vBottom > 0 && overlapX > 0) return vBottom >= 100 ? ['bottom', 'top'] : a.left > 96 ? ['left', 'left'] : ['right', 'right'];
  if (vTop > 0 && overlapX > 0) return vTop >= 100 ? ['top', 'bottom'] : a.left > 96 ? ['left', 'left'] : ['right', 'right'];
  return Math.abs(cx(b) - cx(a)) >= Math.abs(cy(b) - cy(a)) ? (cx(b) >= cx(a) ? ['right', 'left'] : ['left', 'right']) : cy(b) >= cy(a) ? ['bottom', 'top'] : ['top', 'bottom'];
}

/* 目标入线点：落在目标边、与起点同高（不在目标跨度内就取最近的有效高度）。 */
function targetEntry(b, ts, start, gap = ARROW.tipGap) {
  if (ts === 'left' || ts === 'right') {
    const y = clamp(start.y, b.top + 12, b.bottom - 12);
    return { x: ts === 'left' ? b.left - gap : b.right + gap, y, u: { x: ts === 'left' ? 1 : -1, y: 0 } };
  }
  const x = clamp(start.x, b.left + 12, b.right - 12);
  return { x, y: ts === 'top' ? b.top - gap : b.bottom + gap, u: { x: 0, y: ts === 'top' ? 1 : -1 } };
}

/* 连接件：直连；错位时 90° 折；跑道不够（run < 最短跑道）返回 tight，
   由调用方改成「引线 + 点」，绝不把箭头画回源里。 */
function connectorPath(a, b, fs, ts, startOverride, gap) {
  const start = startOverride || port(a, fs);
  const t = targetEntry(b, ts, start, gap);
  const base = { x: t.x - t.u.x * ARROW.length, y: t.y - t.u.y * ARROW.length };
  const run = (base.x - start.x) * t.u.x + (base.y - start.y) * t.u.y;
  if (run < ARROW.minRun) return { tight: true, start, tip: t, u: t.u };
  const horiz = t.u.x !== 0;
  const perp = horiz ? Math.abs(base.y - start.y) : Math.abs(base.x - start.x);
  let d;
  if (perp < 2) {
    d = `M ${start.x} ${start.y} L ${base.x} ${base.y}`;
  } else {
    const mid = horiz ? (start.x + base.x) / 2 : (start.y + base.y) / 2;
    d = horiz
      ? `M ${start.x} ${start.y} L ${mid} ${start.y} L ${mid} ${base.y} L ${base.x} ${base.y}`
      : `M ${start.x} ${start.y} L ${start.x} ${mid} L ${base.x} ${mid} L ${base.x} ${base.y}`;
  }
  return { tight: false, d, start, base, tip: t, u: t.u, mid: { x: (start.x + base.x) / 2, y: (start.y + base.y) / 2 } };
}

/** 锚点表达式里的 #id 部分（jump 分道只看它落在哪个代码窗）。 */
const anchorHost = (page, expr) => {
  const raw = String(expr ?? '').trim();
  if (!raw.startsWith('#')) return null;
  const at = raw.indexOf('@');
  try {
    return page.querySelector(at > 0 ? raw.slice(0, at) : raw);
  } catch {
    return null;
  }
};

export class VkCallout extends VkElement {
  static __observed = ['data-as', 'target', 'from', 'to', 'label'];

  paint() {
    if (!this._svg) {
      this.classList.add('vk-co');
      this._svg = mk('svg', { class: 'vk-co-svg', 'aria-hidden': 'true' });
      this.appendChild(this._svg);
      this._label = document.createElement('div');
      this._label.className = 'vk-co-label';
      this._label.hidden = true;
      this.appendChild(this._label);
      this._note = document.createElement('div');
      this._note.className = 'vk-co-note';
      this._note.hidden = true;
      this.appendChild(this._note);
    }
    if (!this._noteTook) {
      const text = [...this.childNodes].filter(
        (n) => n.nodeType === 3 || (n.nodeType === 1 && !n.classList?.contains('vk-co-svg') && !n.classList?.contains('vk-co-label') && !n.classList?.contains('vk-co-note'))
      );
      for (const n of text) this._note.appendChild(n);
      this._noteTook = true;
    }
  }

  /* 写：只摆显隐与文字，让注记/标签在量之前就有尺寸。 */
  prepare() {
    if (!this._svg) this.paint();
    this._anchorErrors = [];
    this.removeAttribute('data-vk-anchor-missing');
    this.removeAttribute('data-vk-anchor-error');
    this.removeAttribute('data-vk-tight');
    this.removeAttribute('data-vk-side');
    const mode = this.getAttribute('data-as') || 'note';
    if (mode === 'note') {
      this._note.hidden = false;
      this._note.style.maxWidth = `${Math.max(200, ANN.gutter - ANN.standoff - 8)}px`;
    } else {
      this._note.hidden = true;
    }
    const label = this.getAttribute('label');
    if (label && (mode === 'measure' || mode === 'arrow' || mode === 'jump')) {
      this._label.textContent = label;
      this._label.hidden = false;
    } else {
      this._label.hidden = true;
    }
  }

  /* 读：锚点 + 所有需要的 rect / 宽高，一次收齐；不写任何样式。 */
  measure() {
    const page = this.closest('vk-page');
    this._m = null;
    if (!page) return;
    const origin = page.getBoundingClientRect();
    const mode = this.getAttribute('data-as') || 'note';
    const m = { origin, mode, ops: [], marks: [], missing: false, side: null, tight: false, note: null, label: null };
    this._m = m;

    if (mode === 'mark' || mode === 'note') {
      /* target 可以是一串目标：「这行代码写进那一格」是一个故事，不是两个焦点。 */
      const exprs = String(this.getAttribute('target') || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const targets = exprs.map((e) => resolveAnchor(page, e, this));
      if (!exprs.length || targets.some((t) => !t)) {
        m.missing = true;
        return;
      }
      m.marks = targets.map((t) => this.measureMark(t, origin));
      if (m.marks.some((g) => g.tight)) m.tight = true;
      if (mode === 'mark') return;
      this.measureNote(page, origin, targets[0], m);
      return;
    }

    const from = resolveAnchor(page, this.getAttribute('from'), this);
    const to = resolveAnchor(page, this.getAttribute('to'), this);
    if (!from || !to) {
      m.missing = true;
      return;
    }
    if (mode === 'measure') return this.measureDistance(page, origin, from, to, m);
    if (mode === 'jump') return this.measureJump(page, origin, from, to, m);
    return this.measureArrow(page, origin, from, to, m);
  }

  /** 标记的形状跟着目标走：词套一个框，行划一道，行段/item 组用右括号，块用框。 */
  measureMark(t, origin) {
    const rel = (r) => rect(r, origin);
    /* 词：套住整个 token 的框。闭合才说得清「这一个」，也才不会吃进隔壁括号。 */
    if (t.el.matches('.vk-mark')) return { kind: 'word', box: boxOf(rel(tokenRect(t.el))) };

    const rects = (t.rects && t.rects.length ? t.rects : [t.rect]).map(rel);
    const isLine = t.el.matches('.vk-line, .vk-arow');
    /* 行段、item 组：一只括号把整组箍成一块——两行不是两次单行标注。
       组横跨两栏时括号没有意义，退化成一只包住所有的框，并报 tight。 */
    if (rects.length > 1 && (isLine || t.kind === 'item')) {
      const sameColumn = t.kind !== 'item' || rects.every((r) => Math.abs(r.left - rects[0].left) < 8);
      if (sameColumn) return { kind: 'bracket', rects };
      return { kind: 'box', box: boxOf(unionRel(rects)), tight: true };
    }
    /* 行：墨迹下面一条。 */
    if (isLine) return { kind: 'bar', rects };
    /* 块 / 单个 item / @text：一个框；多个 rect 取并集，不只框第一个。 */
    return { kind: 'box', box: boxOf(unionRel(rects)) };
  }

  /** 写：把量好的标记落成路径。返回外沿给注记连线用。 */
  drawMark(g) {
    if (g.kind === 'bracket') {
      const e = markExtent(g);
      const arm = ANN.arm;
      this._svg.appendChild(mk('path', { class: 'vk-co-bracket', d: `M ${e.right - arm} ${e.top} L ${e.right} ${e.top} L ${e.right} ${e.bottom} L ${e.right - arm} ${e.bottom}` }));
      return e;
    }
    if (g.kind === 'bar') {
      for (const r of g.rects) {
        const y = r.bottom + ANN.barGap + ANN.bar / 2;
        this._svg.appendChild(mk('rect', { class: 'vk-co-bar', x: r.left - ANN.over, y: y - ANN.bar / 2, width: r.right - r.left + ANN.over * 2, height: ANN.bar }));
      }
      return markExtent(g);
    }
    const b = g.box;
    this._svg.appendChild(mk('rect', { class: 'vk-co-box', x: b.left, y: b.top, width: b.right - b.left, height: b.bottom - b.top, rx: ANN.boxR }));
    return markExtent(g);
  }

  /* 注记：读注栏、正文带、起点件与目标行的尺寸。 */
  measureNote(page, origin, target, m) {
    const mark = markExtent(m.marks[0]);
    const bw = this._note.offsetWidth;
    const bh = this._note.offsetHeight;
    const ncs = getComputedStyle(this._note);
    /* 箭头对齐第一行，不是整块的中心。两行注记居中时，箭头会落在两行之间，
       看起来像字压在箭头上。 */
    const firstLine = (parseFloat(ncs.paddingTop) || 0) + (parseFloat(ncs.lineHeight) || 0) / 2;
    const body = page.querySelector('.vk-body');
    const bodyRect = body ? rect(body.getBoundingClientRect(), origin) : { left: 24, top: 24, right: origin.width - 24, bottom: origin.height - 24 };
    const head = page.querySelector('vk-head, .vk-head');
    const safeTop = Math.max(bodyRect.top, head ? head.getBoundingClientRect().bottom - origin.top + 16 : 24);
    const safeBottom = origin.height - 24;
    const owner = target.el.closest(COMPONENT) || target.el;
    const ob = rect(owner.getBoundingClientRect(), origin);
    const arrowY = mark.cy;
    const gutterLeft = bodyRect.right - ANN.gutter;

    /* 出线口：行从「这一行的末尾」出；词/块从「画出来的框」外面出。
       mark 是字墨迹，框还向外扩 boxPad/boxPadY；从墨迹起杆会落在框里面。 */
    const isLine = target.el.matches('.vk-line');
    const lineR = isLine ? rect(target.rect, origin) : null;
    const portX = lineR ? Math.max(mark.right, lineR.right + ARROW.clear) : mark.right + 16;

    let side = 'right';
    let nx = gutterLeft + ANN.standoff;
    let ny = mark.cy - firstLine;
    if (nx + bw > bodyRect.right || portX > gutterLeft - 8) {
      side = 'bottom';
      nx = bodyRect.left;
      ny = ob.bottom + ANN.standoff;
    }
    /* 右注记的横线不能跨过另一块正文：否则箭头会压在中间那块文字上。 */
    if (side === 'right') {
      const x1 = portX;
      const x2 = nx - ARROW.textGap;
      const blocks = [...page.querySelectorAll('.vk-body > *, vk-flow > *')].filter((el) => {
        if (el === this || el.contains(this) || el.contains(target.el)) return false;
        if (el.closest('.vk-co')) return false;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      });
      const crosses = blocks.some((el) => {
        const r = rect(el.getBoundingClientRect(), origin);
        return r.width > 1 && r.height > 1 && arrowY > r.top - 8 && arrowY < r.bottom + 8 && x2 > r.left - 8 && x1 < r.right + 8;
      });
      if (crosses) {
        side = 'bottom';
        nx = bodyRect.left;
        ny = ob.bottom + ANN.standoff;
      }
    }
    if (side === 'bottom') ny = ob.bottom + ANN.standoffY;
    if (side === 'bottom' && ny + bh > safeBottom) {
      side = 'top';
      ny = ob.top - ANN.standoffY - bh;
    }
    if (side !== 'right') nx = clamp(nx, bodyRect.left, Math.max(bodyRect.left, bodyRect.right - bw));
    ny = clamp(ny, safeTop, Math.max(safeTop, safeBottom - bh));
    m.side = side;
    m.note = { left: nx, top: ny };

    /* 连接：从出线口到文字；头长按可用净空缩短。 */
    let start;
    let tip;
    let u;
    if (side === 'right') {
      start = { x: portX, y: arrowY };
      tip = { x: nx - ARROW.textGap, y: arrowY };
      u = { x: 1, y: 0 };
    } else if (side === 'bottom') {
      const sx = clamp((mark.left + mark.right) / 2, nx + 24, nx + bw - 24);
      start = { x: sx, y: mark.bottom + 16 };
      tip = { x: sx, y: ny - ARROW.textGap };
      u = { x: 0, y: 1 };
    } else {
      const sx = clamp((mark.left + mark.right) / 2, nx + 24, nx + bw - 24);
      start = { x: sx, y: mark.top - 16 };
      tip = { x: sx, y: ny + bh + ARROW.textGap };
      u = { x: 0, y: -1 };
    }
    const run = (tip.x - start.x) * u.x + (tip.y - start.y) * u.y;
    if (run < ARROW.length + ARROW.minRun) {
      m.tight = true;
      m.ops.push({ tag: 'line', attrs: { class: 'vk-co-line', x1: start.x, y1: start.y, x2: tip.x, y2: tip.y } });
      return;
    }
    const base = { x: tip.x - u.x * ARROW.length, y: tip.y - u.y * ARROW.length };
    m.ops.push({ tag: 'line', attrs: { class: 'vk-co-line', x1: start.x, y1: start.y, x2: base.x, y2: base.y } });
    m.ops.push({ tag: 'polygon', attrs: { class: 'vk-co-head', points: headPolygon(tip, u.x, u.y) } });
  }

  /* 量度：量两个目标的同一条边，标出距离。 */
  measureDistance(page, origin, from, to, m) {
    const fr = rect(from.rect, origin);
    const tr = rect(to.rect, origin);
    const horizontal = Math.abs(cx(fr) - cx(tr)) >= Math.abs(cy(fr) - cy(tr));
    const standoff = 48;
    const labelText = this.getAttribute('label');
    /* 量的是「同一条边到同一条边」：两条延长线落在两个目标的同一个相对位置，
       读数才是两者之间的距离，而不是两个中心之间的猜谜。 */
    let a;
    let b;
    let extA;
    let extB;
    let below = false;
    let left = false;
    const reserve = labelText ? 200 : 0;
    const headEl = page.querySelector('vk-head, .vk-head');
    const topLimit = Math.max(24, headEl ? headEl.getBoundingClientRect().bottom - origin.top + 24 : 24);
    if (horizontal) {
      let y = Math.min(fr.top, tr.top) - standoff;
      if (y - (labelText ? 56 : 0) < topLimit) {
        y = Math.max(fr.bottom, tr.bottom) + standoff;
        below = true;
      }
      a = { x: fr.left, y };
      b = { x: tr.left, y };
      extA = { x: a.x, y: below ? fr.bottom : fr.top };
      extB = { x: b.x, y: below ? tr.bottom : tr.top };
    } else {
      let x = Math.max(fr.right, tr.right) + standoff;
      if (x + reserve > origin.width - 24) {
        x = Math.min(fr.left, tr.left) - standoff;
        left = true;
      }
      a = { x, y: fr.top };
      b = { x, y: tr.top };
      extA = { x: left ? fr.left : fr.right, y: a.y };
      extB = { x: left ? tr.left : tr.right, y: b.y };
    }
    m.ops.push({ tag: 'path', attrs: { class: 'vk-co-lead', d: `M ${extA.x} ${extA.y} L ${a.x} ${a.y}` } });
    m.ops.push({ tag: 'path', attrs: { class: 'vk-co-lead', d: `M ${extB.x} ${extB.y} L ${b.x} ${b.y}` } });
    m.ops.push({ tag: 'path', attrs: { class: 'vk-co-line', d: `M ${a.x} ${a.y} L ${b.x} ${b.y}` } });
    if (horizontal) {
      m.ops.push({ tag: 'path', attrs: { class: 'vk-co-line', d: `M ${a.x} ${a.y - ANN.tick / 2} L ${a.x} ${a.y + ANN.tick / 2}` } });
      m.ops.push({ tag: 'path', attrs: { class: 'vk-co-line', d: `M ${b.x} ${b.y - ANN.tick / 2} L ${b.x} ${b.y + ANN.tick / 2}` } });
    } else {
      m.ops.push({ tag: 'path', attrs: { class: 'vk-co-line', d: `M ${a.x - ANN.tick / 2} ${a.y} L ${a.x + ANN.tick / 2} ${a.y}` } });
      m.ops.push({ tag: 'path', attrs: { class: 'vk-co-line', d: `M ${b.x - ANN.tick / 2} ${b.y} L ${b.x + ANN.tick / 2} ${b.y}` } });
    }
    if (labelText) {
      const lw = this._label.offsetWidth;
      const lh = this._label.offsetHeight;
      /* 数值压在量度线上（纸底把线断开），像图纸上的尺寸标注。 */
      const lx = horizontal ? (a.x + b.x) / 2 - lw / 2 : left ? Math.min(a.x, b.x) - lw - 16 : Math.max(a.x, b.x) + 16;
      const ly = horizontal ? a.y - lh / 2 : (a.y + b.y) / 2 - lh / 2;
      m.label = { left: clamp(lx, 8, origin.width - lw - 8), top: clamp(ly, 8, origin.height - lh - 8) };
    }
  }

  /* 指针：起终点都从「端口/入线点」模型来；跑道不够就退化成引线 + 点。 */
  measureArrow(page, origin, from, to, m) {
    const fr = rect(from.rect, origin);
    const tr = rect(to.rect, origin);
    let fs = from.side;
    let ts = to.side;
    if (!fs || !ts) {
      const [afs, ats] = autoSides(fr, tr);
      fs = fs || afs;
      ts = ts || ats;
    }
    const start = from.port
      ? { x: from.port.x - origin.left + from.port.n.x * ARROW.clear, y: from.port.y - origin.top + from.port.n.y * ARROW.clear }
      : port(fr, fs);
    /* 指盒子：尖贴边（2）；指文字：退回 32，不然像贴在字上。 */
    const toText = !!to.el.closest('vk-text');
    const c = connectorPath(fr, tr, fs, ts, start, toText ? ARROW.textGap : ARROW.tipGap);
    if (c.tight) {
      m.tight = true;
      m.ops.push({ tag: 'line', attrs: { class: 'vk-co-line', x1: c.start.x, y1: c.start.y, x2: c.tip.x, y2: c.tip.y } });
      m.ops.push({ tag: 'circle', attrs: { class: 'vk-co-dot', cx: c.tip.x, cy: c.tip.y, r: ANN.dot / 2 } });
    } else {
      m.ops.push({ tag: 'path', attrs: { class: 'vk-co-line', d: c.d } });
      m.ops.push({ tag: 'polygon', attrs: { class: 'vk-co-head', points: headPolygon(c.tip, c.u.x, c.u.y) } });
    }

    const labelText = this.getAttribute('label');
    if (!labelText) return;
    const lw = this._label.offsetWidth;
    const lh = this._label.offsetHeight;
    /* 标签住在「源件的右边」到「箭头根部」之间那段空白的上方：
       不压线（线是连续的），也不贴箭尖（不然和终点那句话连成一行）。 */
    const vertical = Math.abs(c.tip.x - c.start.x) < Math.abs(c.tip.y - c.start.y) - 2;
    let lx;
    let ly;
    if (vertical) {
      lx = c.tip.x + 24;
      ly = c.tip.y - lh / 2;
    } else {
      const rightward = c.tip.x >= c.start.x;
      const owner = from.el.closest(COMPONENT);
      const ob = owner ? rect(owner.getBoundingClientRect(), origin) : null;
      const a0 = rightward ? Math.max(c.start.x, ob ? ob.right + 16 : c.start.x) : c.tip.x + ARROW.length + 16;
      const b0 = rightward ? c.tip.x - ARROW.length - 16 : Math.min(c.start.x, ob ? ob.left - 16 : c.start.x);
      lx = b0 - a0 > lw ? a0 : rightward ? c.tip.x - lw - ARROW.length - 24 : c.tip.x + ARROW.length + 24;
      /* 指文字：抬到那块字的上沿之上，别和第一行贴成一行；指盒子：杆上方 24。 */
      ly = c.tip.y - lh - 16;
      if (ly < 8) ly = c.tip.y + 24;
    }
    m.label = { left: clamp(lx, 24, origin.width - lw - 24), top: clamp(ly, 8, origin.height - lh - 8) };
  }

  /* 跳转：同一段代码里行到行。两端都在同一个 vk-code 才画；
     线走代码窗右侧的竖向通道，横 → 竖 → 横，标签在竖直段外侧。 */
  measureJump(page, origin, from, to, m) {
    const code = from.el.closest('vk-code');
    if (!code || code !== to.el.closest('vk-code')) {
      anchorFail(this, 'jump 的两端要在同一个 <vk-code> 里');
      m.missing = true;
      return;
    }
    const frameEl = code.querySelector('.vk-frame') || code;
    const frame = rect(frameEl.getBoundingClientRect(), origin);
    const lane = this.jumpLane(page, code);
    /* 通道留在窗内 40px：贴着框画会被读成第二条边框。 */
    const channelX = Math.min(frame.right - 40 + lane * JUMP.lane, CONTENT_RIGHT - 8);

    const fr = rect(from.rect, origin);
    const tr = rect(to.rect, origin);
    const y0 = cy(fr);
    const y1 = cy(tr);
    /* 箭头指目标行的右端；头长按通道到目标的余量缩短，保证竖段之后还有一小段横线。 */
    const tipX = Math.min(tr.right + ARROW.tipGap, channelX - JUMP.stub - JUMP.headMin);
    const headLen = Math.min(ARROW.length, channelX - JUMP.stub - tipX);
    const baseX = tipX + headLen;
    const points = [
      { x: fr.right + ARROW.clear, y: y0 },
      { x: channelX, y: y0 },
      { x: channelX, y: y1 },
      { x: baseX, y: y1 },
    ];
    m.ops.push({ tag: 'path', attrs: { class: 'vk-co-line vk-co-jump', d: points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') } });
    m.ops.push({ tag: 'polygon', attrs: { class: 'vk-co-head', points: headPolygon({ x: tipX, y: y1 }, -1, 0, headLen, (ARROW.base * headLen) / ARROW.length) } });

    const label = this.getAttribute('label');
    if (!label) return;
    const lw = this._label.offsetWidth;
    const midY = (y0 + y1) / 2;
    let lx = channelX - JUMP.labelGap;
    let anchor = 'end';
    /* 通道已经贴着画布右缘时，字改到竖段里侧，免得被裁掉。 */
    if (lx + lw > origin.width - 8) {
      lx = channelX - JUMP.labelGap;
      anchor = 'end';
    }
    /* 标签压在起点那一行的上方：读作「从这一行跳走」，不再落在竖段中点。 */
    m.label = { x: lx, y: clamp(y0 - 28, 16, origin.height - 16), anchor, svg: true };
  }

  /** 同一代码窗里的 jump 按文档顺序分道，每道 +16，最多 3 道。 */
  jumpLane(page, code) {
    let lane = 0;
    for (const el of page.querySelectorAll('vk-callout')) {
      if (el === this) break;
      if (el.getAttribute('data-as') !== 'jump') continue;
      const host = anchorHost(page, el.getAttribute('from'));
      if (host && host.closest('vk-code') === code) lane++;
    }
    return Math.min(lane, JUMP.lanes - 1);
  }

  /* 写：只落笔，不再读。 */
  draw() {
    const m = this._m;
    if (!m) return;
    const { origin } = m;
    this._svg.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`);
    this._svg.setAttribute('width', origin.width);
    this._svg.setAttribute('height', origin.height);
    this._svg.replaceChildren();
    this._label.hidden = true;
    this._note.hidden = m.mode !== 'note' || m.missing;
    if (m.side) this.setAttribute('data-vk-side', m.side);
    if (m.tight) this.setAttribute('data-vk-tight', '1');
    if (m.missing) this.setAttribute('data-vk-anchor-missing', '1');
    const errs = (this._anchorErrors || []).join('；');
    if (errs) this.setAttribute('data-vk-anchor-error', errs);
    if (m.missing) return;

    for (const g of m.marks) this.drawMark(g);
    for (const op of m.ops) this._svg.appendChild(mk(op.tag, op.attrs));

    if (m.note) {
      this._note.style.left = `${m.note.left}px`;
      this._note.style.top = `${m.note.top}px`;
    }
    if (!m.label) return;
    if (m.label.svg) {
      const t = mk('text', {
        class: 'vk-co-label vk-co-jump-label',
        x: m.label.x,
        y: m.label.y,
        'text-anchor': m.label.anchor,
        'dominant-baseline': 'middle',
      });
      t.textContent = this.getAttribute('label') || '';
      this._svg.appendChild(t);
    } else {
      this._label.hidden = false;
      this._label.style.left = `${m.label.left}px`;
      this._label.style.top = `${m.label.top}px`;
    }
  }
}

define('vk-callout', VkCallout);
