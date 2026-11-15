/**
 * v25 · 标注
 * ----------------------------------------------------------------------------
 * 标注只有三件，缺一不成标注：
 *   标记  目标墨迹下方一条钴蓝实心横条（词、行、行段都只有这一种）
 *   连接  从标记右端水平走到文字，杆 8，箭头落在文字左缘
 *   文字  卡片外的一句话，与标记同高；永远不进卡片、不压代码
 *
 * 锚点：#id / #id@line:3 / #id@line:3-4 / #id@item:2 / #id@bit:5 / #id@side:left。
 */
import { VkElement, define, resolveAnchor, inkRect } from './base.mjs';
import { CONN, ANN, ARROW, port, headPolygon } from '../shared/connector.mjs';

const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const COMPONENT = 'vk-code, vk-board, vk-graph, vk-dir, vk-math, vk-seq, vk-card, vk-img, vk-text';

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

/** 圆角折线：每个拐点用 16px 二次曲线收一下。 */
function roundedPath(points, r = ARROW.corner) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const prev = points[i - 1];
    const next = points[i + 1];
    const v1 = { x: p.x - prev.x, y: p.y - prev.y };
    const v2 = { x: next.x - p.x, y: next.y - p.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = { x: p.x - (v1.x / l1) * rr, y: p.y - (v1.y / l1) * rr };
    const b = { x: p.x + (v2.x / l2) * rr, y: p.y + (v2.y / l2) * rr };
    d += ` L ${a.x} ${a.y} Q ${p.x} ${p.y} ${b.x} ${b.y}`;
  }
  const last = points[points.length - 1];
  return d + ` L ${last.x} ${last.y}`;
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

/* 目标入线点：落在目标边、与起点同高（不在目标跨度内就取最近的有效高度）。
   返回 tip 与行进方向 u。 */
function targetEntry(b, ts, start) {
  if (ts === 'left' || ts === 'right') {
    const y = clamp(start.y, b.top + 12, b.bottom - 12);
    return { x: ts === 'left' ? b.left - ARROW.tipGap : b.right + ARROW.tipGap, y, u: { x: ts === 'left' ? 1 : -1, y: 0 } };
  }
  const x = clamp(start.x, b.left + 12, b.right - 12);
  return { x, y: ts === 'top' ? b.top - ARROW.tipGap : b.bottom + ARROW.tipGap, u: { x: 0, y: ts === 'top' ? 1 : -1 } };
}

/* 连接件：直连；错位时 90° 折一次。跑道不够（run < 最短跑道）返回 tight，
   由调用方改成「引线 + 点」，绝不把箭头画回源里。 */
function connectorPath(a, b, fs, ts, startOverride) {
  const start = startOverride || port(a, fs);
  const t = targetEntry(b, ts, start);
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

export class VkCallout extends VkElement {
  static __observed = ['mode', 'for', 'from', 'to', 'label'];

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

  /** 标记的形状跟着目标走：词套一个框，行划一道，行段用右括号，块用框。 */
  drawMark(t, rel) {
    const isWord = t.el.matches('.vk-mark');
    const isLine = t.el.matches('.vk-line');
    const boxOf = (r) => ({ left: r.left - ANN.boxPad, top: r.top - ANN.boxPadY, right: r.right + ANN.boxPad, bottom: r.bottom + ANN.boxPadY });

    /* 词：套住整个 token 的框。闭合才说得清「这一个」，也才不会吃进隔壁括号。 */
    if (isWord) {
      const box = boxOf(rel(tokenRect(t.el)));
      this._svg.appendChild(
        mk('rect', { class: 'vk-co-box', x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top, rx: ANN.boxR })
      );
      return { cy: (box.top + box.bottom) / 2, right: box.right, left: box.left, top: box.top, bottom: box.bottom };
    }

    const rects = (t.rects && t.rects.length ? t.rects : [t.rect]).map(rel);

    /* 行段：右侧一只括号，把 N 行箍成一块——两行不是两次单行标注。 */
    if (isLine && rects.length > 1) {
      const right = Math.max(...rects.map((r) => r.right));
      const top = rects[0].top - ANN.barGap;
      const bottom = rects[rects.length - 1].bottom + ANN.barGap;
      const x = right + ANN.bracket;
      const arm = ANN.arm + ANN.over;
      this._svg.appendChild(mk('path', { class: 'vk-co-bracket', d: `M ${x - arm} ${top} L ${x} ${top} L ${x} ${bottom} L ${x - arm} ${bottom}` }));
      return { cy: (top + bottom) / 2, right: x, left: x - arm, top, bottom };
    }

    /* 行：墨迹下面一条。 */
    if (isLine) {
      const bars = rects.map((r) => ({
        left: r.left - ANN.over,
        right: r.right + ANN.over,
        y: r.bottom + ANN.barGap + ANN.bar / 2,
        cy: (r.top + r.bottom) / 2,
      }));
      for (const b of bars) {
        this._svg.appendChild(mk('rect', { class: 'vk-co-bar', x: b.left, y: b.y - ANN.bar / 2, width: b.right - b.left, height: ANN.bar }));
      }
      const last = bars[bars.length - 1];
      return { cy: last.cy, right: last.right, left: bars[0].left, top: bars[0].y - ANN.bar / 2, bottom: last.y + ANN.bar / 2 };
    }

    /* 块：一个框。闭合才说得清「这一块」，开线只能指「这里」。 */
    const box = boxOf(rects[0]);
    this._svg.appendChild(
      mk('rect', { class: 'vk-co-box', x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top, rx: ANN.boxR })
    );
    return { cy: (box.top + box.bottom) / 2, right: box.right, left: box.left, top: box.top, bottom: box.bottom };
  }

  draw() {
    const page = this.closest('vk-page');
    if (!page) return;
    const origin = page.getBoundingClientRect();
    this._svg.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`);
    this._svg.setAttribute('width', origin.width);
    this._svg.setAttribute('height', origin.height);
    this._svg.replaceChildren();
    this._label.hidden = true;
    this._note.hidden = true;
    this.removeAttribute('data-vk-anchor-missing');
    this.removeAttribute('data-vk-tight');

    const mode = this.getAttribute('mode') || 'note';
    const rel = (r) => rect(r, origin);
    const missing = () => this.setAttribute('data-vk-anchor-missing', '1');

    /* ---------------------------------------------------------------- 标记 */
    if (mode === 'mark' || mode === 'note') {
      const t = resolveAnchor(page, this.getAttribute('for'), this);
      if (!t) return missing();
      const mark = this.drawMark(t, rel);
      if (mode === 'mark') return;

      /* 文字：注栏里的一列。正文已经让出这一列，所以它可以比目标宽得多。 */
      this._note.hidden = false;
      this._note.style.maxWidth = `${Math.max(200, ANN.gutter - ANN.standoff - 8)}px`;
      const bw = this._note.offsetWidth;
      const bh = this._note.offsetHeight;
      const body = page.querySelector('.vk-body');
      const bodyRect = body ? rel(body.getBoundingClientRect()) : { left: 24, top: 24, right: origin.width - 24, bottom: origin.height - 24 };
      const head = page.querySelector('[data-vk="head"]');
      const safeTop = Math.max(bodyRect.top, head ? head.getBoundingClientRect().bottom - origin.top + 16 : 24);
      const safeBottom = Math.min(bodyRect.bottom, origin.height - 24);
      const owner = t.el.closest(COMPONENT) || t.el;
      const ob = rel(owner.getBoundingClientRect());
      const arrowY = mark.cy;
      const gutterLeft = bodyRect.right - ANN.gutter;

      /* 出线口：行从「这一行的末尾」出，词/块/行段从标记自己的右缘出。 */
      const isLine = t.el.matches('.vk-line');
      const lineR = isLine ? rel(inkRect(t.el)) : null;
      const portX = lineR ? Math.max(mark.right, lineR.right + ARROW.clear) : mark.right;
      const portLeft = lineR ? Math.min(mark.left, lineR.left - ARROW.clear) : mark.left;

      let side = 'right';
      let nx = gutterLeft + ANN.standoff;
      let ny = arrowY - bh / 2;
      if (nx + bw > bodyRect.right || portX > gutterLeft - 8) {
        side = 'bottom';
        nx = bodyRect.left;
        ny = ob.bottom + ANN.standoff;
      }
      if (side === 'bottom' && ny + bh > safeBottom) {
        side = 'top';
        ny = ob.top - ANN.standoff - bh;
      }
      if (side !== 'right') nx = clamp(nx, bodyRect.left, Math.max(bodyRect.left, bodyRect.right - bw));
      ny = clamp(ny, safeTop, Math.max(safeTop, safeBottom - bh));
      this._note.style.left = `${nx}px`;
      this._note.style.top = `${ny}px`;

      /* 连接：从出线口水平到文字左缘，箭头尖落在文字上。 */
      let start;
      let tip;
      let u;
      if (side === 'right') {
        start = { x: portX, y: arrowY };
        tip = { x: nx - ARROW.tipGap, y: arrowY };
        u = { x: 1, y: 0 };
      } else if (side === 'left') {
        start = { x: portLeft, y: arrowY };
        tip = { x: nx + bw + ARROW.tipGap, y: arrowY };
        u = { x: -1, y: 0 };
      } else if (side === 'bottom') {
        const sx = clamp((mark.left + mark.right) / 2, nx + 24, nx + bw - 24);
        start = { x: sx, y: mark.bottom + 6 };
        tip = { x: sx, y: ny - ARROW.tipGap };
        u = { x: 0, y: 1 };
      } else {
        const sx = clamp((mark.left + mark.right) / 2, nx + 24, nx + bw - 24);
        start = { x: sx, y: mark.top - 6 };
        tip = { x: sx, y: ny + bh + ARROW.tipGap };
        u = { x: 0, y: -1 };
      }
      const run = (tip.x - start.x) * u.x + (tip.y - start.y) * u.y;
      if (run < ARROW.length + ARROW.minRun) {
        this.setAttribute('data-vk-tight', '1');
        this._svg.appendChild(mk('line', { class: 'vk-co-line', x1: start.x, y1: start.y, x2: tip.x, y2: tip.y }));
        return;
      }
      const base = { x: tip.x - u.x * ARROW.length, y: tip.y - u.y * ARROW.length };
      this._svg.appendChild(mk('line', { class: 'vk-co-line', x1: start.x, y1: start.y, x2: base.x, y2: base.y }));
      this._svg.appendChild(mk('polygon', { class: 'vk-co-head', points: headPolygon(tip, u.x, u.y) }));
      return;
    }

    /* ---------------------------------------------------------------- 量度 */
    if (mode === 'measure') {
      const from = resolveAnchor(page, this.getAttribute('from'), this);
      const to = resolveAnchor(page, this.getAttribute('to'), this);
      if (!from || !to) return missing();
      const fr = rel(from.rect);
      const tr = rel(to.rect);
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
      const headEl = page.querySelector('[data-vk="head"]');
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
      this._svg.appendChild(mk('path', { class: 'vk-co-lead', d: `M ${extA.x} ${extA.y} L ${a.x} ${a.y}` }));
      this._svg.appendChild(mk('path', { class: 'vk-co-lead', d: `M ${extB.x} ${extB.y} L ${b.x} ${b.y}` }));
      this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${a.x} ${a.y} L ${b.x} ${b.y}` }));
      if (horizontal) {
        this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${a.x} ${a.y - ANN.tick / 2} L ${a.x} ${a.y + ANN.tick / 2}` }));
        this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${b.x} ${b.y - ANN.tick / 2} L ${b.x} ${b.y + ANN.tick / 2}` }));
      } else {
        this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${a.x - ANN.tick / 2} ${a.y} L ${a.x + ANN.tick / 2} ${a.y}` }));
        this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${b.x - ANN.tick / 2} ${b.y} L ${b.x + ANN.tick / 2} ${b.y}` }));
      }
      if (labelText) {
        this._label.hidden = false;
        this._label.textContent = labelText;
        const lw = this._label.offsetWidth;
        const lh = this._label.offsetHeight;
        /* 数值压在量度线上（纸底把线断开），像图纸上的尺寸标注：
           线只要 30 的净空，不必再为标签留一整行。 */
        const lx = horizontal ? (a.x + b.x) / 2 - lw / 2 : left ? Math.min(a.x, b.x) - lw - 16 : Math.max(a.x, b.x) + 16;
        const ly = horizontal ? a.y - lh / 2 : (a.y + b.y) / 2 - lh / 2;
        this._label.style.left = `${clamp(lx, 8, origin.width - lw - 8)}px`;
        this._label.style.top = `${clamp(ly, 8, origin.height - lh - 8)}px`;
      }
      return;
    }

    /* ---------------------------------------------------------------- 指针
       arrow：起终点都从「端口/入线点」模型来；跑道不够就退化成引线 + 点。 */
    const from = resolveAnchor(page, this.getAttribute('from'), this);
    const to = resolveAnchor(page, this.getAttribute('to'), this);
    if (!from || !to) return missing();
    const fr = rel(from.rect);
    const tr = rel(to.rect);
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
    const c = connectorPath(fr, tr, fs, ts, start);
    if (c.tight) {
      this.setAttribute('data-vk-tight', '1');
      this._svg.appendChild(mk('line', { class: 'vk-co-line', x1: c.start.x, y1: c.start.y, x2: c.tip.x, y2: c.tip.y }));
      this._svg.appendChild(mk('circle', { class: 'vk-co-dot', cx: c.tip.x, cy: c.tip.y, r: ANN.dot / 2 }));
    } else {
      this._svg.appendChild(mk('path', { class: 'vk-co-line', d: c.d }));
      this._svg.appendChild(mk('polygon', { class: 'vk-co-head', points: headPolygon(c.tip, c.u.x, c.u.y) }));
    }

    const label = this.getAttribute('label');
    if (label) {
      this._label.hidden = false;
      this._label.textContent = label;
      const lw = this._label.offsetWidth;
      const lh = this._label.offsetHeight;
      /* 标签贴着箭头尖：横箭头放在箭杆上方、头的后面；竖箭头放在头右侧。 */
      const vertical = Math.abs(c.tip.x - c.start.x) < Math.abs(c.tip.y - c.start.y) - 2;
      let lx;
      let ly;
      if (vertical) {
        lx = c.tip.x + 24;
        ly = c.tip.y - lh / 2;
      } else {
        const rightward = c.tip.x >= c.start.x;
        lx = rightward ? c.tip.x - lw - 24 : c.tip.x + 24;
        ly = c.tip.y - lh - 31;
        if (ly < 8) ly = c.tip.y + 12;
      }
      this._label.style.left = `${clamp(lx, 24, origin.width - lw - 24)}px`;
      this._label.style.top = `${clamp(ly, 8, origin.height - lh - 8)}px`;
    }
  }
}

define('vk-callout', VkCallout);




