import {
  inkRect,
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

/** 件的"看得见的那一块"：窗口类画在 .vk-win 里，宿主本身是 1680 宽的透明块。 */
const visibleBox = (el) => el?.querySelector?.(':scope > .vk-win') || el;

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
    // 版心（画布减去外边距）：气泡要落在版心里，跟内容一个边界。
    const scs = getComputedStyle(stage);
    const safe = {
      x: Number.parseFloat(scs.paddingLeft) || 0,
      y: Number.parseFloat(scs.paddingTop) || 0,
      r: W - (Number.parseFloat(scs.paddingRight) || 0),
      b: H - (Number.parseFloat(scs.paddingBottom) || 0),
    };
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
    // 颜色交给 --vk-tone：深色页会把它换成亮一档的同语义色，写死在这里就换不动。
const stroke = 'var(--vk-tone, var(--vk-info))';

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
    // @side 锚点是零尺寸点；法线要用「盒子」算，不能拿点算。
    const boxOf = (anchor) => {
      const r = anchor.rect;
      if (r.width >= 4 && r.height >= 4) return local(r);
      const el = anchor.el;
      if (el) return local(visibleBox(el).getBoundingClientRect());
      return local(r);
    };
    const A = boxOf(a);
    const B = boxOf(b);
    const p1 = this._borderPoint(A, B);
    const p2 = this._borderPoint(B, A);
    const shape = attrEnum(this, 'shape', 'curve');
    const gap = 24;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const s = { x: p1.x + ux * gap, y: p1.y + uy * gap };
    const e = { x: p2.x - ux * gap, y: p2.y - uy * gap };

    let d;
    let tail = { x: s.x - e.x, y: s.y - e.y };
    if (shape === 'straight') d = `M${s.x} ${s.y} L${e.x} ${e.y}`;
    else if (shape === 'ortho') {
      const mid = (s.x + e.x) / 2;
      d = `M${s.x} ${s.y} L${mid} ${s.y} L${mid} ${e.y} L${e.x} ${e.y}`;
      tail = { x: mid - e.x, y: 0 };
    } else {
      // 曲线要「贴着边出、贴着边进」：控制点沿边的法线走，而不是沿弦垂直偏移。
      const normal = (rect, p) => {
        const dx = p.x - (rect.x + rect.w / 2);
        const dy = p.y - (rect.y + rect.h / 2);
        return Math.abs(dx) / Math.max(rect.w / 2, 1) >= Math.abs(dy) / Math.max(rect.h / 2, 1)
          ? { x: Math.sign(dx) || 1, y: 0 }
          : { x: 0, y: Math.sign(dy) || 1 };
      };
      const n1 = normal(A, p1);
      const n2 = normal(B, p2);
      const sx = p1.x + n1.x * gap;
      const sy = p1.y + n1.y * gap;
      const ex = p2.x + n2.x * gap;
      const ey = p2.y + n2.y * gap;
      const room = Math.abs(n1.x) ? Math.abs(ex - sx) : Math.abs(ey - sy);
      const bow = Math.max(48, Math.min(280, len * 0.38, room * 0.45));
      const c1 = { x: sx + n1.x * bow, y: sy + n1.y * bow };
      const c2 = { x: ex + n2.x * bow, y: ey + n2.y * bow };
      d = `M${sx} ${sy} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${ex} ${ey}`;
      tail = { x: ex - c2.x, y: ey - c2.y };
    }

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'vk-arrow');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', '4');
    path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path);

    const ang = Math.atan2(tail.y, tail.x);
    const tip = document.createElementNS(NS, 'path');
    const size = 40;
    const half = 0.5;
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

    // 保底宽度：一行至少 5 个汉字。8 个太宽——短注解会撑成一大块，
    // 挤压它自己的落位空间（右侧、左侧就放不下了）。
    const minW = 5 * 48;
    const maxW = Math.min(720, W - 48);
    box.style.maxWidth = `${maxW}px`;
    box.style.minWidth = `${Math.min(minW, maxW)}px`;
    const bw = Math.min(maxW, Math.max(minW, box.offsetWidth));
    const bh = box.offsetHeight;

    const gap = this.hasAttribute('gap') ? Number.parseFloat(attrSpace(this, 'gap', 'normal')) || 96 : 96;
    const sideAttr = attrEnum(this, 'side', 'auto');
    // 版心（画布减去外边距）：气泡要落在版心里，跟内容一个边界。
    const scs = getComputedStyle(stage);
    const safe = {
      x: Number.parseFloat(scs.paddingLeft) || 0,
      y: Number.parseFloat(scs.paddingTop) || 0,
      r: stage.offsetWidth - (Number.parseFloat(scs.paddingRight) || 0),
      b: stage.offsetHeight - (Number.parseFloat(scs.paddingBottom) || 0),
    };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    /**
     * 气泡贴着**目标所属的那一块**放，引线指向具体的那一行。
     * 否则目标是一行代码时，四个候选位置全在代码窗里面。
     */
    const owner = a.el.closest('vk-code, vk-box, vk-cells, vk-table, vk-tree, vk-term, vk-diff, vk-img, vk-list, vk-steps') || a.el;
    const ob = local(visibleBox(owner).getBoundingClientRect());

    // 障碍物只算"看得见"的件：stack / grid / canvas 是透明容器，把它们算进去会把整帧封死。
    const obstacles = [...stage.querySelectorAll(
      'vk-code, vk-box, vk-cells, vk-text, vk-label, vk-table, vk-list, vk-term, vk-diff, vk-tree, vk-steps, vk-bars, vk-timeline, vk-img, vk-math, vk-asm, vk-compare'
    )]
      .filter((el) => !el.contains(this) && !this.contains(el) && !owner.contains(el) && el !== owner)
      .map((el) => {
        // 文字是满宽块但墨迹只占左边一小段：障碍物按墨迹算。
        const q = /^vk-(text|label)$/.test(el.tagName.toLowerCase()) ? inkRect(el) || el.getBoundingClientRect() : el.getBoundingClientRect();
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
        left: clamp(c0.left, safe.x + 8, Math.max(safe.x + 8, safe.r - bw - 8)),
        top: clamp(c0.top, safe.y + 8, Math.max(safe.y + 8, safe.b - bh - 8)),
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

    // 引线：从气泡边缘连到目标的**容器**边缘（不是字的中间），
    // 否则线会横穿正在讲的那行代码。
    const from = { x: spot.left, y: spot.top, w: bw, h: bh };
    const p1 = this._borderPoint(from, ob);
    let p2;
    if (owner === a.el) {
      p2 = this._borderPoint(r, from);
    } else {
      // 目标在窗口里：引线落在窗口边缘「对齐那一行」的位置，不穿进正文。
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const below = from.y > ob.y + ob.h / 2;
      const right = from.x > ob.x + ob.w / 2;
      const vertical = Math.abs(from.y + from.h / 2 - (ob.y + ob.h / 2)) > Math.abs(from.x + from.w / 2 - (ob.x + ob.w / 2));
      p2 = vertical
        ? { x: Math.min(Math.max(cx, ob.x + 4), ob.x + ob.w - 4), y: below ? ob.y + ob.h + 16 : ob.y - 16 }
        : { x: right ? ob.x + ob.w + 16 : ob.x - 16, y: Math.min(Math.max(cy, ob.y + 4), ob.y + ob.h - 4) };
    }
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(p1.x));
    line.setAttribute('y1', String(p1.y));
    line.setAttribute('x2', String(p2.x));
    line.setAttribute('y2', String(p2.y));
    line.setAttribute('class', 'vk-note-leader');
    line.setAttribute('stroke', 'var(--vk-ink-2)');
    line.setAttribute('stroke-width', 'var(--vk-line-w-strong)');
    line.setAttribute('stroke-linecap', 'round');
    if (dist >= 24) this._svg.appendChild(line);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', String(p2.x));
    dot.setAttribute('cy', String(p2.y));
    dot.setAttribute('r', '12');
    dot.setAttribute('fill', 'var(--vk-ink-2)');
    this._svg.appendChild(dot);
  }

  _badge(local) {
    const a = this._target();
    if (!a) return;
    const r = local(a.rect);
    const stage = stageOf(this);
    if (!stage) return;
    const W = stage.clientWidth;
    // 编号点贴着**目标本身**：贴窗口会把"第 2 格"标到整块的边上。
    // 圆点是 44px、以锚点为中心，所以要再让半个点。
    const owner = a.el.closest('vk-code, vk-term, vk-diff, vk-box, vk-cells, vk-tree, vk-asm, vk-bytes') || a.el;
    const ob = r;
    const dot = document.createElement('div');
    dot.className = 'vk-callout-bd vk-callout-badge';
    dot.textContent = this._text || '1';
    // 圆点是 44px 且以锚点为中心：锚点要再往外让半个点，否则会压在字上。
    const half = 22;
    const right = ob.x + ob.w + half + 8;
    const left = ob.x - half - 8;
    const fitRight = right + half <= W - 4;
    dot.style.left = `${fitRight ? right : left}px`;
    dot.style.top = `${r.y + r.h / 2}px`;
    this._root.appendChild(dot);
    void esc;
  }
}

export function defineCallout() {
  define('vk-callout', VkCallout);
}

