/**
 * v19 · 标注
 * ----------------------------------------------------------------------------
 * 画在别人身上的一层，不改布局。四种形态：
 *   arrow  从一处指向另一处（直线 / 折线 / 曲线）
 *   ring   圈住目标的字（按墨迹取框，不按整行盒子）
 *   note   带引线的注释气泡，文字就是标签里的内容
 *   badge  编号点
 *
 * 锚点只认：#id、#id@line:3（窗口里第 3 行）、#id@item:2、#id@side:left。
 */
import { VkElement, define, resolveAnchor, inkRect, warn } from './base.mjs';

const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* 两个矩形之间最近的一对边中点。 */
function nearestSide(a, b) {
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

const overlapArea = (a, b) => {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
};

function pointOn(rect, side) {
  switch (side) {
    case 'top':
      return { x: rect.left + rect.width / 2, y: rect.top };
    case 'bottom':
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height };
    case 'left':
      return { x: rect.left, y: rect.top + rect.height / 2 };
    default:
      return { x: rect.left + rect.width, y: rect.top + rect.height / 2 };
  }
}

export class VkCallout extends VkElement {
  static __observed = ['mode', 'for', 'from', 'to', 'side', 'gap', 'shape', 'label', 'tone'];

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
    // 作者写的文字是 note 的内容：搬一次，不重复搬。
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
    const rel = (r) => ({ left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height });
    const missing = () => {
      this.setAttribute('data-vk-anchor-missing', '1');
    };

    if (mode === 'ring') {
      const t = resolveAnchor(page, this.getAttribute('for'), this);
      if (!t) return missing();
      const r = rel(t.rect);
      const pad = 10;
      const box = mk('rect', {
        class: 'vk-co-ring',
        x: r.left - pad,
        y: r.top - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
        rx: 18,
      });
      this._svg.appendChild(box);
      return;
    }

    if (mode === 'note') {
      const t = resolveAnchor(page, this.getAttribute('for'), this);
      if (!t) return missing();
      const r = rel(t.rect);
      const gap = Number(this.getAttribute('gap') || 32) || 32;
      this._note.hidden = false;
      const bw = this._note.offsetWidth;
      const bh = this._note.offsetHeight;

      /* 气泡不许盖字。候选位置分两圈：贴着目标那一行，和贴着它所属的件。
         先按「压到多少字的面积」排，面积相同再按离目标远近排。 */
      const owner = t.el.closest('vk-code, vk-surface, vk-tree, vk-table, vk-cells, vk-bits, vk-bytes, vk-list, vk-steps, vk-bars, vk-timeline, vk-graph, vk-img, vk-text') || t.el;
      const ob = rel(owner.getBoundingClientRect());
      const obstacles = [ob];
      for (const el of page.querySelectorAll('vk-code .vk-line, vk-code .vk-dhunk, vk-text, .vk-title, .vk-lede, vk-table tr, vk-list li, .vk-step, .vk-bar, .vk-cell, .vk-bit, .vk-gnode, .vk-tl-i, .vk-node, .vk-brow')) {
        if (el.closest('vk-callout')) continue;
        const q = el.getBoundingClientRect();
        if (q.width > 2 && q.height > 2) obstacles.push(rel(q));
      }

      const place = (base, side) => {
        let x = base.left + base.width / 2 - bw / 2;
        let y = base.top + base.height / 2 - bh / 2;
        if (side === 'right') x = base.left + base.width + gap;
        else if (side === 'left') x = base.left - bw - gap;
        else if (side === 'bottom') y = base.top + base.height + gap;
        else if (side === 'top') y = base.top - bh - gap;
        return { x, y };
      };

      const want = this.getAttribute('side') || 'auto';
      const sides = want === 'auto' ? ['right', 'left', 'bottom', 'top'] : [want];
      const wanted = sides.map((side) => ({ ...place(r, side), side }));
      const cands = [...wanted];
      for (const side of sides) cands.push({ ...place(ob, side), side: `block-${side}` });

      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let best = null;
      for (const c of cands) {
        const box = { left: c.x, top: c.y, width: bw, height: bh };
        let overlap = 0;
        for (const o of obstacles) overlap += overlapArea(box, o);
        const outX = Math.max(0, 8 - c.x) + Math.max(0, c.x + bw - (origin.width - 8));
        const outY = Math.max(0, 8 - c.y) + Math.max(0, c.y + bh - (origin.height - 8));
        const dist = Math.hypot(c.x + bw / 2 - cx, c.y + bh / 2 - cy);
        const key = [overlap + (outX + outY) * bh * 10, dist];
        if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) best = { ...c, key };
      }
      const x = clamp(best.x, 8, origin.width - bw - 8);
      const y = clamp(best.y, 8, origin.height - bh - 8);
      this._note.style.left = `${x}px`;
      this._note.style.top = `${y}px`;
      // 引线：从气泡最近的一点指向目标。
      const bubble = { left: x, top: y, width: bw, height: bh };
      const [a, b] = nearestSide(bubble, r);
      const from = { ...pointOn(bubble, a) };
      const to = { ...pointOn(r, b) };
      this._svg.appendChild(mk('line', { class: 'vk-co-lead', x1: from.x, y1: from.y, x2: to.x, y2: to.y }));
      this._svg.appendChild(mk('circle', { class: 'vk-co-dot', cx: to.x, cy: to.y, r: 6 }));
      return;
    }

    if (mode === 'measure') {
      const from = resolveAnchor(page, this.getAttribute('from'), this);
      const to = resolveAnchor(page, this.getAttribute('to'), this);
      if (!from || !to) return missing();
      const fr = rel(from.rect);
      const tr = rel(to.rect);
      const [fs, ts] = from.side && to.side ? [from.side, to.side] : nearestSide(fr, tr);
      const a = pointOn(fr, fs);
      const b = pointOn(tr, ts);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;
      const tick = 26;
      this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${a.x} ${a.y} L ${b.x} ${b.y}` }));
      this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${a.x - nx * tick} ${a.y - ny * tick} L ${a.x + nx * tick} ${a.y + ny * tick}` }));
      this._svg.appendChild(mk('path', { class: 'vk-co-line', d: `M ${b.x - nx * tick} ${b.y - ny * tick} L ${b.x + nx * tick} ${b.y + ny * tick}` }));
      const label = this.getAttribute('label');
      if (label) {
        this._label.hidden = false;
        this._label.textContent = label;
        const lw = this._label.offsetWidth;
        const lh = this._label.offsetHeight;
        this._label.style.left = `${clamp((a.x + b.x) / 2 - lw / 2, 8, origin.width - lw - 8)}px`;
        this._label.style.top = `${clamp((a.y + b.y) / 2 - lh / 2, 8, origin.height - lh - 8)}px`;
      }
      return;
    }

    /* arrow */
    const from = resolveAnchor(page, this.getAttribute('from'), this);
    const to = resolveAnchor(page, this.getAttribute('to'), this);
    if (!from || !to) return missing();
    const fr = rel(from.rect);
    const tr = rel(to.rect);
    const [fs, ts] = from.side && to.side ? [from.side, to.side] : nearestSide(fr, tr);
    const a = pointOn(fr, fs);
    const b = pointOn(tr, ts);
    const shape = this.getAttribute('shape') || 'curve';
    const trim = 10;
    const d = (() => {
      if (shape === 'straight') return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
      if (shape === 'ortho') {
        const horiz = fs === 'left' || fs === 'right';
        const mid = horiz ? { x: (a.x + b.x) / 2, y: a.y } : { x: a.x, y: (a.y + b.y) / 2 };
        const mid2 = horiz ? { x: mid.x, y: b.y } : { x: b.x, y: mid.y };
        return `M ${a.x} ${a.y} L ${mid.x} ${mid.y} L ${mid2.x} ${mid2.y} L ${b.x} ${b.y}`;
      }
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const bow = Math.min(160, len * 0.18);
      const cx = mx - (dy / len) * bow;
      const cy = my + (dx / len) * bow;
      return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
    })();
    this._svg.appendChild(mk('path', { class: 'vk-co-line', d, 'marker-end': '' }));
    // 箭头：按最后一段方向画一个实心三角。
    const prev = shape === 'ortho' ? { x: b.x + (b.x - a.x) * 0.001, y: b.y } : a;
    const ang = Math.atan2(b.y - prev.y, b.x - prev.x);
    const L = 22;
    const W = 11;
    const p1 = { x: b.x - L * Math.cos(ang), y: b.y - L * Math.sin(ang) };
    const p2 = { x: p1.x - W * Math.sin(ang), y: p1.y + W * Math.cos(ang) };
    const p3 = { x: p1.x + W * Math.sin(ang), y: p1.y - W * Math.cos(ang) };
    this._svg.appendChild(mk('polygon', { class: 'vk-co-head', points: `${b.x},${b.y} ${p2.x},${p2.y} ${p3.x},${p3.y}` }));
    // 端点小圆，让起点有落点
    this._svg.appendChild(mk('circle', { class: 'vk-co-dot', cx: a.x, cy: a.y, r: 6 }));

    const label = this.getAttribute('label');
    if (label) {
      this._label.hidden = false;
      this._label.textContent = label;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const lw = this._label.offsetWidth;
      const lh = this._label.offsetHeight;
      this._label.style.left = `${clamp(mx - lw / 2, 8, origin.width - lw - 8)}px`;
      this._label.style.top = `${clamp(my - lh / 2, 8, origin.height - lh - 8)}px`;
    }
    void trim;
  }
}

define('vk-callout', VkCallout);
