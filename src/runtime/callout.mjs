/**
 * v24 · 标注
 * ----------------------------------------------------------------------------
 * 标注不是“画在别人身上的一层装饰”，而是一套连接件：
 *   端口 → 出线空隙 → 直角路由 → 箭头 → 标签板
 *
 * 统一几何（与 seq/graph 共用同一套连接件语言）：
 *   线宽 6，箭头长 28 / 宽 14，端口空隙 12，目标间隙 4，拐角 16。
 *
 * 锚点：#id / #id@line:3 / #id@line:3-4 / #id@item:2 / #id@bit:5 / #id@side:left。
 */
import { VkElement, define, resolveAnchor } from './base.mjs';

const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const GAP = 10;
const TIP_GAP = 4;
const HEAD = 32;
const HEAD_W = 16;
const CORNER = 16;
const TICK = 20;

const COMPONENT = 'vk-code, vk-cells, vk-bytes, vk-bits, vk-table, vk-list, vk-dir, vk-graph, vk-timeline, vk-steps, vk-bars, vk-seq, vk-card, vk-img, vk-text';

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
      this._svg.appendChild(mk('rect', { class: 'vk-co-ring', x: r.left - pad, y: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2, rx: 8 }));
      return;
    }

    if (mode === 'note') {
      const t = resolveAnchor(page, this.getAttribute('for'), this);
      if (!t) return missing();
      const r = rel(t.rect);
      const gap = 24;
      this._note.hidden = false;
      const bw = this._note.offsetWidth;
      const bh = this._note.offsetHeight;

      /* 气泡不许盖字：先按「压到多少字的面积」排，面积相同再按离目标远近排。 */
      const owner = t.el.closest(COMPONENT) || t.el;
      const ob = rel(owner.getBoundingClientRect());
      const obstacles = [ob];
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
      const body = page.querySelector('.vk-body');
      const safeBottom = body ? body.getBoundingClientRect().bottom - origin.top - 8 : origin.height - 8;

      /* 行锚点的 note 一律贴在同一条线的右侧，短实线直连；不参与碰撞投票。 */
      if (t.el.matches('.vk-line')) {
        const nx = ob.right + gap;
        const ny = cy(r) - bh / 2;
        if (nx + bw <= origin.width - 8 && ny >= 8 && ny + bh <= safeBottom) {
          this._note.style.left = `${nx}px`;
          this._note.style.top = `${ny}px`;
          this._svg.appendChild(mk('line', { class: 'vk-co-lead', x1: r.right, y1: cy(r), x2: nx, y2: cy(r) }));
          this._svg.appendChild(mk('circle', { class: 'vk-co-dot', cx: r.right, cy: cy(r), r: 6 }));
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
        for (const o of obstacles) {
          const w = Math.min(box.left + box.width, o.right) - Math.max(box.left, o.left);
          const h = Math.min(box.top + box.height, o.bottom) - Math.max(box.top, o.top);
          if (w > 0 && h > 0) overlap += w * h;
        }
        const outX = Math.max(0, 8 - c.x) + Math.max(0, c.x + bw - (origin.width - 8));
        const outY = Math.max(0, 8 - c.y) + Math.max(0, c.y + bh - safeBottom);
        const dist = Math.hypot(c.x + bw / 2 - tx, c.y + bh / 2 - ty);
        const key = [overlap + (outX + outY) * bh * 10, dist];
        if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) best = { ...c, key };
      }
      const x = clamp(Math.max(best.x, t.el.matches('.vk-line') && best.x > ob.left ? ob.right + gap : best.x), 8, origin.width - bw - 8);
      const y = clamp(best.y, 8, safeBottom - bh);
      this._note.style.left = `${x}px`;
      this._note.style.top = `${y}px`;
      const bubble = { left: x, top: y, right: x + bw, bottom: y + bh, width: bw, height: bh };
      const [as, bs] = autoSides(bubble, r);
      const a = sourcePoint(bubble, as);
      const b = targetTip(r, bs);
      this._svg.appendChild(mk('line', { class: 'vk-co-lead', x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      this._svg.appendChild(mk('circle', { class: 'vk-co-dot', cx: b.x, cy: b.y, r: 6 }));
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
      let a;
      let b;
      let extA;
      let extB;
      if (horizontal) {
        let y = Math.min(fr.top, tr.top) - standoff;
        let below = false;
        if (y < 24) {
          y = Math.max(fr.bottom, tr.bottom) + standoff;
          below = true;
        }
        a = { x: (fr.left + fr.right) / 2, y };
        b = { x: (tr.left + tr.right) / 2, y };
        extA = { x: a.x, y: below ? fr.bottom : fr.top };
        extB = { x: b.x, y: below ? tr.bottom : tr.top };
      } else {
        let x = Math.max(fr.right, tr.right) + standoff;
        let left = false;
        if (x > origin.width - 24) {
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
      const label = this.getAttribute('label');
      if (label) {
        this._label.hidden = false;
        this._label.textContent = label;
        const lw = this._label.offsetWidth;
        const lh = this._label.offsetHeight;
        const lx = horizontal ? (a.x + b.x) / 2 - lw / 2 : Math.max(a.x, b.x) + 16;
        const ly = horizontal ? a.y - lh - 12 : (a.y + b.y) / 2 - lh / 2;
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
      const lx = horizontal ? mx - lw / 2 : mx + 16;
      const ly = horizontal ? my - lh - 12 : my - lh / 2;
      this._label.style.left = `${clamp(lx, 8, origin.width - lw - 8)}px`;
      this._label.style.top = `${clamp(ly, 8, origin.height - lh - 8)}px`;
    }
  }
}

define('vk-callout', VkCallout);
