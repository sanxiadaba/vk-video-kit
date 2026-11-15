/**
 * v25 · 标注
 * ----------------------------------------------------------------------------
 * 标注不是“画在别人身上的一层装饰”，而是一套连接件：
 *   端口 → 出线空隙 → 直角路由 → 箭头 → 标签板
 *
 * 统一几何（与 seq/graph 共用同一套连接件语言）：
 *   杆 8，箭头长 44 / 底宽 32，端口空隙 12，目标间隙 2，拐角 16。
 *
 * 锚点：#id / #id@line:3 / #id@line:3-4 / #id@item:2 / #id@bit:5 / #id@side:left。
 */
import { VkElement, define, resolveAnchor, inkRect, textRight } from './base.mjs';
import { CONN, ANN, ARROW, port, tip, headPolygon } from '../shared/connector.mjs';

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

/* 点 p 到矩形 b 的最近点。 */
function nearest(b, p) {
  return { x: clamp(p.x, b.left, b.right), y: clamp(p.y, b.top, b.bottom) };
}

function sourceUnit(side) {
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'left') return { x: -1, y: 0 };
  if (side === 'top') return { x: 0, y: -1 };
  return { x: 0, y: 1 };
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
      /* 锚点已经是墨迹框：圈统一外扩 12，不再按行盒贴边。 */
      const pad = 8;
      this._svg.appendChild(mk('rect', { class: 'vk-co-ring', x: r.left - pad, y: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2, rx: 24 }));
      return;
    }

    if (mode === 'note') {
      const t = resolveAnchor(page, this.getAttribute('for'), this);
      if (!t) return missing();
      const r = rel(t.rect);
      const isWord = t.el.matches('.vk-mark');
      this._note.hidden = false;
      const bw = this._note.offsetWidth;
      const bh = this._note.offsetHeight;

      /* 安全区是正文版心，不是画布。 */
      const body = page.querySelector('.vk-body');
      const bodyRect = body ? rel(body.getBoundingClientRect()) : { left: 24, top: 24, right: origin.width - 24, bottom: origin.height - 24 };
      const head = page.querySelector('[data-vk="head"]');
      const safeTop = Math.max(bodyRect.top, head ? head.getBoundingClientRect().bottom - origin.top + 8 : 24);
      const safeBottom = Math.min(bodyRect.bottom, origin.height - 24);
      const owner = t.el.closest(COMPONENT) || t.el;
      const ob = rel(owner.getBoundingClientRect());
      const lineEl = t.el.closest('.vk-line');

      /* 1) 圈：贴目标墨迹，外扩 8，圆角 24。词圈词、行圈行。 */
      const ring = { left: r.left - ANN.ring, top: r.top - ANN.ring, right: r.right + ANN.ring, bottom: r.bottom + ANN.ring };
      this._svg.appendChild(
        mk('rect', { class: 'vk-co-ring', x: ring.left, y: ring.top, width: ring.right - ring.left, height: ring.bottom - ring.top, rx: ANN.ringR })
      );

      /* 2) 文字：行尾 +88，垂直中心落在圈的下沿；放不下才翻到卡片左侧。 */
      const textEnd = lineEl ? textRight(lineEl) - origin.left : r.right;
      let nx = textEnd + ANN.standoff;
      let side = 1;
      if (nx + bw > bodyRect.right) {
        nx = ob.left - ANN.standoff - bw;
        side = -1;
      }
      const arrowY = ring.bottom;
      const ny = clamp(arrowY - bh / 2, safeTop, safeBottom - bh);
      this._note.style.left = `${nx}px`;
      this._note.style.top = `${ny}px`;

      /* 3) 箭头：从圈的下沿水平走到文字，尖落在文字的左/右缘。 */
      const tip = side === 1 ? { x: nx, y: arrowY } : { x: nx + bw, y: arrowY };
      const u = side === 1 ? { x: 1, y: 0 } : { x: -1, y: 0 };
      const base = { x: tip.x - u.x * ARROW.length, y: tip.y - u.y * ARROW.length };
      const startX = side === 1 ? ring.right : ring.left;
      this._svg.appendChild(mk('line', { class: 'vk-co-line', x1: startX, y1: arrowY, x2: base.x, y2: base.y }));
      this._svg.appendChild(mk('polygon', { class: 'vk-co-head', points: headPolygon(tip, u.x, u.y) }));
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
        const ly = horizontal ? (below ? Math.max(a.y, b.y) + 16 : a.y - lh - 16) : (a.y + b.y) / 2 - lh / 2;
        this._label.style.left = `${clamp(lx, 8, origin.width - lw - 8)}px`;
        this._label.style.top = `${clamp(ly, 8, origin.height - lh - 8)}px`;
      }
      return;
    }

    /* arrow：起终点都从「端口/入线点」模型来；跑道不够就退化成引线 + 点。 */
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
    this.removeAttribute('data-vk-tight');
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
      const lw0 = this._label.offsetWidth;
      const lh0 = this._label.offsetHeight;
      this._label.hidden = false;
      this._label.textContent = label;
      const lw = this._label.offsetWidth || lw0;
      const lh = this._label.offsetHeight || lh0;
      /* 标签放在箭杆上方 16；纵向箭头放右侧。 */
      const ys = [c.start.y, c.tip.y, c.base ? c.base.y : c.tip.y];
      const xs = [c.start.x, c.tip.x, c.base ? c.base.x : c.tip.x];
      const vertical = Math.abs(c.tip.x - c.start.x) < Math.abs(c.tip.y - c.start.y) - 2;
      let lx;
      let ly;
      if (vertical) {
        lx = (c.start.x + c.tip.x) / 2 + 16;
        ly = (Math.min(...ys) + Math.max(...ys)) / 2 - lh / 2;
      } else {
        lx = (Math.min(...xs) + Math.max(...xs)) / 2 - lw / 2;
        ly = Math.min(...ys) - lh - 16;
        if (ly < 8) ly = Math.max(...ys) + 16;
      }
      this._label.style.left = `${clamp(lx, 24, origin.width - lw - 24)}px`;
      this._label.style.top = `${clamp(ly, 8, origin.height - lh - 8)}px`;
    }
  }
}

define('vk-callout', VkCallout);
