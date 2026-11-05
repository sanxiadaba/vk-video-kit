import {
  VkElement,
  define,
  attrEnum,
  attrText,
  attrSpace,
  resolveAnchor,
  stageOf,
  stageScale,
  esc,
  warn,
} from './base.mjs';

const NS = 'http://www.w3.org/2000/svg';

/**
 * vk-callout —— 画在别人身上的一层。
 *
 *   arrow  从一个锚点连到另一个锚点（直线 / 折线 / 曲线）
 *   ring   圈住目标：按**字的墨迹**取框，不按整行盒子
 *   note   带引线的注释气泡：自动选边、自动避让、保底宽度
 *   badge  目标角上的一枚编号点
 *
 * 它不改布局、不搬节点、不占焦点名额。
 */
export class VkCallout extends VkElement {
  render() {
    const raw = (attrText(this, 'label') || this.textContent || '').trim();
    if (raw) this._text = raw;
    if (!this._root) {
      const root = document.createElement('div');
      root.className = 'vk-callout';
      root.setAttribute('aria-hidden', 'true');
      this.replaceChildren(root);
      this._root = root;
    }
    const mode = attrEnum(this, 'mode', 'arrow');
    this.dataset.mode = mode;
    this._root.dataset.mode = mode;
    this._label = null;
    this._svg = this._root.querySelector('.vk-callout-svg');
    this.registerEdge();
    this.style.display = 'contents';
  }

  draw() {
    const stage = stageOf(this);
    if (!stage) return;
    const sr = stage.getBoundingClientRect();
    const scale = stageScale(stage);
    const W = stage.offsetWidth;
    const H = stage.offsetHeight;
    const local = (r) => ({
      x: (r.left - sr.left) / scale,
      y: (r.top - sr.top) / scale,
      w: r.width / scale,
      h: r.height / scale,
    });

    if (!this._svg) {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'vk-callout-svg');
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      this._root.prepend(svg);
      this._svg = svg;
    }
    const svg = this._svg;
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();
    this._root.querySelectorAll('.vk-callout-bd').forEach((n) => n.remove());

    const mode = this.dataset.mode;
    const tone = attrEnum(this, 'tone', 'info');
    svg.dataset.tone = tone;
    const stroke = { info: 'var(--vk-info)', focus: 'var(--vk-focus)', ok: 'var(--vk-ok)', warn: 'var(--vk-warn)', err: 'var(--vk-err)', neutral: 'var(--vk-ink-1)' }[tone] || 'var(--vk-info)';

    if (mode === 'arrow') this._arrow(svg, local, stroke, W, H);
    else if (mode === 'ring') this._ring(svg, local, stroke);
    else if (mode === 'note') this._note(local, W, H, tone);
    else if (mode === 'badge') this._badge(local);
  }

  _target() {
    const expr = attrText(this, 'for') || attrText(this, 'to');
    const stage = stageOf(this);
    if (!expr) {
      warn(this, '缺 for（要指向哪里）');
      return null;
    }
    const a = resolveAnchor(stage, expr, this);
    if (!a) warn(this, `找不到目标 ${expr}`);
    return a;
  }

  _arrow(svg, local, stroke, W, H) {
    const stage = stageOf(this);
    const fromExpr = attrText(this, 'from');
    const toExpr = attrText(this, 'to');
    if (!fromExpr || !toExpr) {
      warn(this, 'arrow 需要 from 和 to 两个锚点');
      return;
    }
    const a = resolveAnchor(stage, fromExpr, this);
    const b = resolveAnchor(stage, toExpr, this);
    if (!a || !b) return;
    const A = local(a.rect);
    const B = local(b.rect);
    const p1 = this._borderPoint(A, B);
    const p2 = this._borderPoint(B, A);
    const shape = attrEnum(this, 'shape', 'curve');
    const gap = 12;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const s = { x: p1.x + ux * gap, y: p1.y + uy * gap };
    const e = { x: p2.x - ux * gap, y: p2.y - uy * gap };

    let d;
    if (shape === 'straight') d = `M${s.x} ${s.y} L${e.x} ${e.y}`;
    else if (shape === 'ortho') {
      const mid = (s.x + e.x) / 2;
      d = `M${s.x} ${s.y} L${mid} ${s.y} L${mid} ${e.y} L${e.x} ${e.y}`;
    } else {
      const mx = (s.x + e.x) / 2;
      const my = (s.y + e.y) / 2;
      const bow = Math.min(120, len * 0.18);
      d = `M${s.x} ${s.y} Q${mx - uy * bow} ${my + ux * bow} ${e.x} ${e.y}`;
    }

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'vk-arrow');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', '4');
    path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path);

    const ang = Math.atan2(e.y - s.y, e.x - s.x);
    const tip = document.createElementNS(NS, 'path');
    const size = 22;
    const half = 0.42;
    tip.setAttribute(
      'd',
      `M${e.x} ${e.y} L${e.x - size * Math.cos(ang - half)} ${e.y - size * Math.sin(ang - half)} L${e.x - size * Math.cos(ang + half)} ${
        e.y - size * Math.sin(ang + half)
      } Z`
    );
    tip.setAttribute('fill', stroke);
    svg.appendChild(tip);

    if (this._text) {
      const box = document.createElement('div');
      box.className = 'vk-callout-bd vk-callout-label';
      box.textContent = this._text;
      box.style.left = `${(s.x + e.x) / 2}px`;
      box.style.top = `${(s.y + e.y) / 2}px`;
      this._root.appendChild(box);
    }
    void W;
    void H;
  }

  /** 从盒子中心向外，取边框上的交点。 */
  _borderPoint(box, toward) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const dx = toward.x + toward.w / 2 - cx;
    const dy = toward.y + toward.h / 2 - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const sx = dx ? (box.w / 2) / Math.abs(dx) : Infinity;
    const sy = dy ? (box.h / 2) / Math.abs(dy) : Infinity;
    const s = Math.min(sx, sy);
    return { x: cx + dx * s, y: cy + dy * s };
  }

  _ring(svg, local, stroke) {
    const a = this._target();
    if (!a) return;
    const r = local(a.rect);
    const padX = 18;
    const padY = 10;
    const shape = attrEnum(this, 'shape', 'curve'); // 未用：ring 的形状由宽高比决定
    void shape;
    const el = document.createElementNS(NS, 'rect');
    el.setAttribute('x', String(r.x - padX));
    el.setAttribute('y', String(r.y - padY));
    el.setAttribute('width', String(r.w + padX * 2));
    el.setAttribute('height', String(r.h + padY * 2));
    el.setAttribute('rx', String(Math.min(28, Math.min(r.w, r.h) / 2)));
    el.setAttribute('class', 'vk-ring');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', '4');
    el.setAttribute('stroke-linecap', 'round');
    svg.appendChild(el);
  }

  _note(local, W, H, tone) {
    const a = this._target();
    if (!a) return;
    const stage = stageOf(this);
    if (!stage) return;
    const sr = stage.getBoundingClientRect();
    const scale = stageScale(stage);
    const r = local(a.rect);
    const text = this._text;
    if (!text) {
      warn(this, 'note 没有文字');
      return;
    }

    const box = document.createElement('div');
    box.className = 'vk-callout-bd vk-callout-note';
    box.dataset.tone = tone;
    box.textContent = text;
    this._root.appendChild(box);

    // 保底宽度：一行至少 8 个汉字，否则宁可变宽。
    const minW = 8 * 48;
    const maxW = Math.min(720, W - 48);
    box.style.maxWidth = `${maxW}px`;
    box.style.minWidth = `${Math.min(minW, maxW)}px`;
    const bw = Math.min(maxW, Math.max(minW, box.offsetWidth));
    const bh = box.offsetHeight;

    const gap = Number.parseFloat(attrSpace(this, 'gap', 'normal')) || 32;
    const sideAttr = attrEnum(this, 'side', 'auto');
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    /**
     * 气泡贴着**目标所属的那一块**放，引线指向具体的那一行。
     * 否则目标是一行代码时，四个候选位置全在代码窗里面。
     */
    const owner = a.el.closest('vk-code, vk-box, vk-cells, vk-table, vk-tree, vk-term, vk-diff, vk-img, vk-list, vk-steps') || a.el;
    const ob = local(owner.getBoundingClientRect());

    const obstacles = [...stage.querySelectorAll('vk-code, vk-box, vk-cells, vk-text, vk-table, vk-list, vk-term, vk-diff, vk-tree, vk-steps, vk-bars, vk-timeline, vk-img, vk-math, vk-asm')]
      .filter((el) => !el.contains(this) && !this.contains(el) && !owner.contains(el) && el !== owner)
      .map((el) => {
        const q = el.getBoundingClientRect();
        return { x: (q.left - sr.left) / scale, y: (q.top - sr.top) / scale, w: q.width / scale, h: q.height / scale };
      });

    const overlap = (a) =>
      obstacles.reduce((sum, b) => {
        const w = Math.min(a.left + a.bw, b.x + b.w) - Math.max(a.left, b.x);
        const h = Math.min(a.top + a.bh, b.y + b.h) - Math.max(a.top, b.y);
        return sum + (w > 0 && h > 0 ? w * h : 0);
      }, 0);

    /**
     * 固定顺序 + 硬约束：先放目标下方，其次右侧、左侧、上方；
     * 第一个"既不压内容也不出界"的位置就赢。全都不满足时取压得最少的。
     * 不打分：打分会在极端情况下把气泡塞回目标身上。
     */
    const space = {
      bottom: { left: ob.x + ob.w / 2 - bw / 2, top: ob.y + ob.h + gap },
      right: { left: ob.x + ob.w + gap, top: ob.y + ob.h / 2 - bh / 2 },
      left: { left: ob.x - gap - bw, top: ob.y + ob.h / 2 - bh / 2 },
      top: { left: ob.x + ob.w / 2 - bw / 2, top: ob.y - gap - bh },
    };
    const order = sideAttr === 'auto' ? ['bottom', 'right', 'left', 'top'] : [sideAttr, ...['bottom', 'right', 'left', 'top'].filter((s) => s !== sideAttr)];

    let spot = null;
    let fallback = null;
    for (const side of order) {
      const c0 = space[side];
      const fit = {
        left: clamp(c0.left, 8, Math.max(8, W - bw - 8)),
        top: clamp(c0.top, 8, Math.max(8, H - bh - 8)),
        side,
        bw,
        bh,
      };
      const clean = Math.abs(fit.left - c0.left) < 2 && Math.abs(fit.top - c0.top) < 2;
      const cost = overlap(fit);
      if (!fallback || cost < fallback.cost) fallback = { ...fit, cost };
      if (clean && cost === 0) {
        spot = fit;
        break;
      }
    }
    if (!spot) spot = fallback;

    box.style.left = `${spot.left}px`;
    box.style.top = `${spot.top}px`;

    // 引线：从气泡边缘连到目标边缘。
    const from = { x: spot.left, y: spot.top, w: bw, h: bh };
    const p1 = this._borderPoint(from, r);
    const p2 = this._borderPoint(r, from);
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(p1.x));
    line.setAttribute('y1', String(p1.y));
    line.setAttribute('x2', String(p2.x));
    line.setAttribute('y2', String(p2.y));
    line.setAttribute('class', 'vk-note-leader');
    line.setAttribute('stroke', 'var(--vk-ink-3)');
    line.setAttribute('stroke-width', '2');
    this._svg.appendChild(line);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', String(p2.x));
    dot.setAttribute('cy', String(p2.y));
    dot.setAttribute('r', '6');
    dot.setAttribute('fill', 'var(--vk-ink-3)');
    this._svg.appendChild(dot);
  }

  _badge(local) {
    const a = this._target();
    if (!a) return;
    const r = local(a.rect);
    const dot = document.createElement('div');
    dot.className = 'vk-callout-bd vk-callout-badge';
    dot.textContent = this._text || '1';
    dot.style.left = `${r.x + r.w}px`;
    dot.style.top = `${r.y}px`;
    this._root.appendChild(dot);
    void esc;
  }
}

export function defineCallout() {
  define('vk-callout', VkCallout);
}
