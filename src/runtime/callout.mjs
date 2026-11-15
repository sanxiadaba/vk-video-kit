/**
 * v25 · 标注
 * ----------------------------------------------------------------------------
 * 标注不是“画在别人身上的一层装饰”，而是一套连接件：
 *   端口 → 出线空隙 → 直角路由 → 箭头 → 标签板
 *
 * 统一几何（与 seq/graph 共用同一套连接件语言）：
 *   线宽 6，箭头长 28 / 宽 14，端口空隙 12，目标间隙 4，拐角 16。
 *
 * 锚点：#id / #id@line:3 / #id@line:3-4 / #id@item:2 / #id@bit:5 / #id@side:left。
 */
import { VkElement, define, resolveAnchor, inkRect, textRight } from './base.mjs';
import { CONN, ANN } from '../shared/connector.mjs';

const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const GAP = CONN.clear;
const TIP_GAP = CONN.tip;
const HEAD = CONN.head;
const HEAD_W = CONN.headW;
const CORNER = CONN.corner;
const TICK = 20;

const COMPONENT = 'vk-code, vk-board, vk-graph, vk-dir, vk-math, vk-seq, vk-card, vk-img, vk-text';

/** 圆角折线：每个拐点用 16px 二次曲线收一下。 */
function roundedPath(points, r = CORNER) {
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

const sourcePoint = (r, side) => {
  if (side === 'right') return { x: r.right + GAP, y: cy(r) };
  if (side === 'left') return { x: r.left - GAP, y: cy(r) };
  if (side === 'bottom') return { x: cx(r), y: r.bottom + GAP };
  return { x: cx(r), y: r.top - GAP };
};
const targetTip = (r, side) => {
  if (side === 'right') return { x: r.right + TIP_GAP, y: cy(r) };
  if (side === 'left') return { x: r.left - TIP_GAP, y: cy(r) };
  if (side === 'bottom') return { x: cx(r), y: r.bottom + TIP_GAP };
  return { x: cx(r), y: r.top - TIP_GAP };
};
const targetUnit = (side) => {
  if (side === 'left') return { x: 1, y: 0 };
  if (side === 'right') return { x: -1, y: 0 };
  if (side === 'top') return { x: 0, y: 1 };
  return { x: 0, y: -1 };
};

/** 从外一点射向矩形：落在边界上的点 + 4px 外推。词很小的时候，这比「取某一边的中点」准得多。 */
function edgeTip(r, from) {
  const cxx = r.left + r.width / 2;
  const cyy = r.top + r.height / 2;
  const dx = from.x - cxx;
  const dy = from.y - cyy;
  const tx = dx ? r.width / 2 / Math.abs(dx) : Infinity;
  const ty = dy ? r.height / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  const px = cxx + dx * t;
  const py = cyy + dy * t;
  const len = Math.hypot(dx, dy) || 1;
  return { x: px + (dx / len) * 4, y: py + (dy / len) * 4 };
}

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

/** 量度用：优先正对的两条边。 */
function measureSides(a, b) {
  const hRight = b.left - a.right;
  const hLeft = a.left - b.right;
  const vBottom = b.top - a.bottom;
  const vTop = a.top - b.bottom;
  if (hRight >= 0) return ['right', 'left'];
  if (hLeft >= 0) return ['left', 'right'];
  if (vBottom >= 0) return ['bottom', 'top'];
  if (vTop >= 0) return ['top', 'bottom'];
  return autoSides(a, b);
}

function pointsFor(a, b, fs, ts) {
  const start = sourcePoint(a, fs);
  const tip = targetTip(b, ts);
  const u = targetUnit(ts);
  const base = { x: tip.x - u.x * HEAD, y: tip.y - u.y * HEAD };
  let points;
  const horiz = (fs === 'right' && ts === 'left') || (fs === 'left' && ts === 'right');
  const vert = (fs === 'bottom' && ts === 'top') || (fs === 'top' && ts === 'bottom');

  if (horiz) {
    if (Math.abs(start.y - base.y) < 2) points = [start, base];
    else if (Math.abs(start.y - base.y) <= 48) points = [start, base];
    else {
      const mid = (start.x + base.x) / 2;
      points = [start, { x: mid, y: start.y }, { x: mid, y: base.y }, base];
    }
  } else if (vert) {
    if (Math.abs(start.x - base.x) < 2) points = [start, base];
    else {
      const mid = (start.y + base.y) / 2;
      points = [start, { x: start.x, y: mid }, { x: base.x, y: mid }, base];
    }
  } else if (fs === 'top' && ts === 'top') {
    const routeY = Math.min(a.top, b.top) - GAP - 32;
    points = [start, { x: start.x, y: routeY }, { x: base.x, y: routeY }, base];
  } else if (fs === 'bottom' && ts === 'bottom') {
    const routeY = Math.max(a.bottom, b.bottom) + GAP + 32;
    points = [start, { x: start.x, y: routeY }, { x: base.x, y: routeY }, base];
  } else if (fs === 'left' && ts === 'left') {
    const routeX = Math.min(a.left, b.left) - GAP - 32;
    points = [start, { x: routeX, y: start.y }, { x: routeX, y: base.y }, base];
  } else if (fs === 'right' && ts === 'right') {
    const routeX = Math.max(a.right, b.right) + GAP + 32;
    points = [start, { x: routeX, y: start.y }, { x: routeX, y: base.y }, base];
  } else if (fs === 'right' || fs === 'left') {
    points = [start, { x: base.x, y: start.y }, base];
  } else {
    points = [start, { x: start.x, y: base.y }, base];
  }
  return { points, tip, base, u };
}

function headPolygon(tip, u) {
  const n = { x: -u.y, y: u.x };
  const bx = tip.x - u.x * HEAD;
  const by = tip.y - u.y * HEAD;
  const p2 = { x: bx - n.x * HEAD_W, y: by - n.y * HEAD_W };
  const p3 = { x: bx + n.x * HEAD_W, y: by + n.y * HEAD_W };
  return `${tip.x},${tip.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
}

function longestSegment(points) {
  let best = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (!best || len > best.len) best = { a, b, len };
  }
  return best;
}

export class VkCallout extends VkElement {
  static __observed = ['mode', 'for', 'from', 'to', 'label', 'tone'];

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
      const text = [...this.childNodes].filter((n) => n.nodeType === 3 || (n.nodeType === 1 && !n.classList?.contains('vk-co-svg') && !n.classList?.contains('vk-co-label') && !n.classList?.contains('vk-co-note')));
      for (const n of text) this._note.appendChild(n);
      this._noteTook = true;
    }
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

    const mode = this.getAttribute('mode') || 'arrow';
    const rel = (r) => rect(r, origin);
    const missing = () => this.setAttribute('data-vk-anchor-missing', '1');
    const boxOf = (anchor, coarse) => {
      const comp = coarse ? anchor.el.closest(COMPONENT) : null;
      const base = rel((comp || anchor.el).getBoundingClientRect());
      if (comp && anchor.el.matches('.vk-line, .vk-arow, .vk-drow')) {
        const line = rel(anchor.el.getBoundingClientRect());
        return { ...base, top: line.top, bottom: line.bottom };
      }
      return base;
    };

    if (mode === 'ring') {
      const t = resolveAnchor(page, this.getAttribute('for'), this);
      if (!t) return missing();
      const r = rel(t.rect);
      /* 行盒本身已包含行高，圈线贴着走；圈物件时才外扩 12。 */
      const pad = t.el.matches('.vk-line') ? 0 : 12;
      this._svg.appendChild(mk('rect', { class: 'vk-co-ring', x: r.left - pad, y: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2, rx: 24 }));
      return;
    }

    if (mode === 'note') {
      const t = resolveAnchor(page, this.getAttribute('for'), this);
      if (!t) return missing();
      const r = rel(t.rect);
      const gap = ANN.standoff;
      const isWord = t.el.matches('.vk-mark');
      this._note.hidden = false;
      const bw = this._note.offsetWidth;
      const bh = this._note.offsetHeight;

      /* 气泡不许盖字：先按「压到多少字的面积」排，面积相同再按离目标远近排。 */
      const body = page.querySelector('.vk-body');
      const safeBottom = body ? body.getBoundingClientRect().bottom - origin.top - 8 : origin.height - 8;
      /* note 不许压标题带：上边界是 head 的底，不是画布顶。 */
      const head = page.querySelector('[data-vk="head"]');
      const safeTop = head ? head.getBoundingClientRect().bottom - origin.top + 8 : 8;
      const owner = t.el.closest(COMPONENT) || t.el;
      const ob = rel(owner.getBoundingClientRect());
      const obstacles = [ob, ...(head ? [rel(head.getBoundingClientRect())] : [])];
      for (const el of page.querySelectorAll('vk-code .vk-line, vk-code .vk-dhunk, vk-text, .vk-title, .vk-lede, vk-table tr, vk-list li, .vk-step, .vk-bar, .vk-cell, .vk-bit, .vk-gnode, .vk-tl-i, .vk-node, .vk-brow')) {
        if (el.closest('vk-callout')) continue;
        const q = el.getBoundingClientRect();
        if (q.width > 2 && q.height > 2) obstacles.push(rel(q));
      }

      const place = (base, side) => {
        let x = cx(base) - bw / 2;
        let y = cy(base) - bh / 2;
        if (side === 'right') x = base.right + gap;
        else if (side === 'left') x = base.left - bw - gap;
        else if (side === 'bottom') y = base.bottom + gap;
        else if (side === 'top') y = base.top - bh - gap;
        return { x, y };
      };

      const sides = t.el.matches('.vk-line') ? ['bottom', 'right', 'left'] : ['right', 'left', 'bottom', 'top'];

      /* 代码行里的标注：标签放在这一行文字的右侧（同一条线），杆走行内下方/中线。 */
      const lineEl = t.el.closest('.vk-line');
      if (lineEl) {
        const lr = rel(lineEl.getBoundingClientRect());
        const runRight = textRight(lineEl) - origin.left;
        /* 整行标注：标签挂在环外（行盒右侧）；词标注：标签贴在这一行文字右侧。 */
        const isLineTarget = t.el.matches('.vk-line');
        const baseRight = isLineTarget ? lr.right : runRight;
        const nx = baseRight + ANN.standoff;
        const ny = clamp(cy(lr) - bh / 2, safeTop, safeBottom - bh);
        if (nx + bw <= origin.width - 8) {
          this._note.style.left = `${nx}px`;
          this._note.style.top = `${ny}px`;
          if (isWord) {
            /* 词：下括号（横线 + 两端向下的小竖线）；杆先沿字下方走到这一行文字之外，再上到标签。 */
            const by = r.bottom + ANN.bracketGap + 2;
            const x1 = r.left - 8;
            const x2 = r.right + 8;
            const tick = ANN.tick;
            this._svg.appendChild(
              mk('path', {
                class: 'vk-co-bracket',
                d: `M ${x1} ${by} L ${x1} ${by + tick} M ${x1} ${by} L ${x2} ${by} M ${x2} ${by} L ${x2} ${by + tick}`,
              })
            );
            const bendX = Math.min(nx, runRight + 24);
            this._svg.appendChild(mk('path', { class: 'vk-co-lead', d: `M ${x2} ${by} L ${bendX} ${by} L ${nx} ${cy(lr)}` }));
          } else {
            const px = baseRight;
            const py = cy(lr);
            this._svg.appendChild(mk('line', { class: 'vk-co-lead', x1: nx, y1: py, x2: px, y2: py }));
            this._svg.appendChild(mk('circle', { class: 'vk-co-dot', cx: px, cy: py, r: ANN.dot / 2 }));
          }
          return;
        }
      }

      const cands = [...sides.map((side) => ({ ...place(r, side), side })), ...sides.map((side) => ({ ...place(ob, side), side: `block-${side}` }))];
      const tx = cx(r);
      const ty = cy(r);
      let best = null;
      for (const c of cands) {
        const box = { left: c.x, top: c.y, width: bw, height: bh };
        let overlap = 0;
        obstacles.forEach((o, oi) => {
          const w = Math.min(box.left + box.width, o.right) - Math.max(box.left, o.left);
          const h = Math.min(box.top + box.height, o.bottom) - Math.max(box.top, o.top);
          /* 压自己的容器是最难看的：权重 ×10，优先挪到容器外。 */
          if (w > 0 && h > 0) overlap += w * h * (oi === 0 ? 10 : 1);
        });
        const outX = Math.max(0, 8 - c.x) + Math.max(0, c.x + bw - (origin.width - 8));
        const outY = Math.max(0, safeTop - c.y) + Math.max(0, c.y + bh - safeBottom);
        const dist = Math.hypot(c.x + bw / 2 - tx, c.y + bh / 2 - ty);
        const key = [overlap + (outX + outY) * bh * 10, dist];
        if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) best = { ...c, key };
      }
      const x = clamp(Math.max(best.x, t.el.matches('.vk-line') && best.x > ob.left ? ob.right + gap : best.x), 8, origin.width - bw - 8);
      const y = clamp(best.y, safeTop, safeBottom - bh);
      this._note.style.left = `${x}px`;
      this._note.style.top = `${y}px`;
      const bubble = { left: x, top: y, right: x + bw, bottom: y + bh, width: bw, height: bh };
      const [as] = autoSides(bubble, r);
      const a = sourcePoint(bubble, as);
      const b = edgeTip(r, a);
      this._svg.appendChild(mk('line', { class: 'vk-co-lead', x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      this._svg.appendChild(mk('circle', { class: 'vk-co-dot', cx: b.x, cy: b.y, r: ANN.dot / 2 }));
      return;
    }

    if (mode === 'measure') {
      const from = resolveAnchor(page, this.getAttribute('from'), this);
      const to = resolveAnchor(page, this.getAttribute('to'), this);
      if (!from || !to) return missing();
      const fr = rel(from.rect);
      const tr = rel(to.rect);
      const horizontal = Math.abs(cx(fr) - cx(tr)) >= Math.abs(cy(fr) - cy(tr));
      const standoff = 32;
      const labelText = this.getAttribute('label');
      /* 选边时把标签的位置也算进去：线放得下、标签放不下，等于没放下。 */
      const reserve = labelText ? 200 : 0;
      let a;
      let b;
      let extA;
      let extB;
      let below = false;
      let left = false;
      if (horizontal) {
        let y = Math.min(fr.top, tr.top) - standoff;
        if (y - (labelText ? 80 : 0) < 24) {
          y = Math.max(fr.bottom, tr.bottom) + standoff;
          below = true;
        }
        a = { x: (fr.left + fr.right) / 2, y };
        b = { x: (tr.left + tr.right) / 2, y };
        extA = { x: a.x, y: below ? fr.bottom : fr.top };
        extB = { x: b.x, y: below ? tr.bottom : tr.top };
      } else {
        let x = Math.max(fr.right, tr.right) + standoff;
        if (x + reserve > origin.width - 24) {
          x = Math.min(fr.left, tr.left) - standoff;
          left = true;
        }
        a = { x, y: (fr.top + fr.bottom) / 2 };
        b = { x, y: (tr.top + tr.bottom) / 2 };
        extA = { x: left ? fr.left : fr.right, y: a.y };
        extB = { x: left ? tr.left : tr.right, y: b.y };
      }
      this._svg.appendChild(mk('path', { class: 'vk-co-lead', d: `M ${extA.x} ${extA.y} L ${a.x} ${a.y}` }));
      this._svg.appendChild(mk('path', { class: 'vk-co-lead', d: `M ${extB.x} ${extB.y} L ${b.x} ${b.y}` }));
      this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${a.x} ${a.y} L ${b.x} ${b.y}` }));
      if (horizontal) {
        this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${a.x} ${a.y - TICK / 2} L ${a.x} ${a.y + TICK / 2}` }));
        this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${b.x} ${b.y - TICK / 2} L ${b.x} ${b.y + TICK / 2}` }));
      } else {
        this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${a.x - TICK / 2} ${a.y} L ${a.x + TICK / 2} ${a.y}` }));
        this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${b.x - TICK / 2} ${b.y} L ${b.x + TICK / 2} ${b.y}` }));
      }
      const label = labelText;
      if (label) {
        this._label.hidden = false;
        this._label.textContent = label;
        const lw = this._label.offsetWidth;
        const lh = this._label.offsetHeight;
        const lx = horizontal ? (a.x + b.x) / 2 - lw / 2 : left ? Math.min(a.x, b.x) - lw - 16 : Math.max(a.x, b.x) + 16;
        const ly = horizontal ? (below ? Math.max(a.y, b.y) + 12 : a.y - lh - 12) : (a.y + b.y) / 2 - lh / 2;
        this._label.style.left = `${clamp(lx, 8, origin.width - lw - 8)}px`;
        this._label.style.top = `${clamp(ly, 8, origin.height - lh - 8)}px`;
      }
      return;
    }

    /* arrow */
    const from = resolveAnchor(page, this.getAttribute('from'), this);
    const to = resolveAnchor(page, this.getAttribute('to'), this);
    if (!from || !to) return missing();
    const lineAnchor = from.el.matches('.vk-line') ? rel(from.el.getBoundingClientRect()) : null;
    const fr = lineAnchor
      ? (() => {
          const cb = rel((from.el.closest(COMPONENT) || from.el).getBoundingClientRect());
          return { ...cb, top: lineAnchor.top, bottom: lineAnchor.bottom };
        })()
      : boxOf(from, true);
    const tr = boxOf(to, true);
    const lineFrom = !!lineAnchor;
    const [fs, ts] = from.side && to.side
      ? [from.side, to.side]
      : lineFrom
        ? to.rect.top > from.rect.bottom
          ? ['bottom', 'top']
          : to.rect.left >= from.rect.right
            ? ['right', 'left']
            : ['left', 'right']
        : autoSides(fr, tr);
    const { points, tip, u } = pointsFor(fr, tr, fs, ts);
    this._svg.appendChild(mk('path', { class: 'vk-co-line', d: roundedPath(points) }));
    this._svg.appendChild(mk('polygon', { class: 'vk-co-head', points: headPolygon(tip, u) }));
    this._svg.appendChild(mk('circle', { class: 'vk-co-dot', cx: points[0].x, cy: points[0].y, r: 6 }));

    const label = this.getAttribute('label');
    if (label) {
      this._label.hidden = false;
      this._label.textContent = label;
      const lw = this._label.offsetWidth;
      const lh = this._label.offsetHeight;
      const seg = longestSegment(points) || { a: points[0], b: points[points.length - 1] };
      const horizontal = Math.abs(seg.b.x - seg.a.x) >= Math.abs(seg.b.y - seg.a.y);
      const mx = (seg.a.x + seg.b.x) / 2;
      const my = (seg.a.y + seg.b.y) / 2;
      const boxes = [...page.querySelectorAll(COMPONENT)].map((el) => rel(el.getBoundingClientRect()));
      const score = (x, y) => {
        let out = Math.max(0, 8 - x) + Math.max(0, x + lw - (origin.width - 8)) + Math.max(0, 8 - y) + Math.max(0, y + lh - (origin.height - 8));
        for (const b of boxes) {
          const w = Math.min(x + lw, b.right) - Math.max(x, b.left);
          const h = Math.min(y + lh, b.bottom) - Math.max(y, b.top);
          if (w > 0 && h > 0) out += (w * h) / 400;
        }
        return out;
      };
      const cands = horizontal
        ? [
            [mx - lw / 2, my - lh - 12],
            [mx - lw / 2, my + 12],
            [tip.x + 12, my - lh - 12],
            [tip.x - lw - 12, my - lh - 12],
            [tip.x + 12, my + 12],
            [tip.x - lw - 12, my + 12],
          ]
        : [
            [mx + 12, my - lh / 2],
            [mx - lw - 12, my - lh / 2],
            [mx + 12, tip.y - lh - 12],
            [mx + 12, tip.y + 12],
          ];
      let best = null;
      for (const [x, y] of cands) {
        const cx2 = clamp(x, 8, origin.width - lw - 8);
        const cy2 = clamp(y, 8, origin.height - lh - 8);
        const k = score(cx2, cy2);
        if (!best || k < best.k) best = { x: cx2, y: cy2, k };
      }
      this._label.style.left = `${best.x}px`;
      this._label.style.top = `${best.y}px`;
    }
  }
}

define('vk-callout', VkCallout);
