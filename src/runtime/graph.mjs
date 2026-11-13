/**
 * v23 · 关系图
 * ----------------------------------------------------------------------------
 * 节点是构建期写好的 .vk-gnode；边有两种写法：
 *   1. 简写：节点上 after="父id"（单亲、向后）
 *   2. 显式：<li from="a" to="b">边标</li>（可环、可双向、可带边标）
 *
 * 四种布局：
 *   row      一条链 / 队列
 *   tree     父在上、子在下（递归树、堆）
 *   layered  x = 深度，y = lane（git 的两条时间线靠 lane 固定）
 *   mesh     环形摆放（BFS/DFS、死锁、事件循环）
 */
import { VkElement, define, warn } from './base.mjs';

const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    el.setAttribute(k, String(v));
  }
  return el;
};

const GAP = () => 64;

/** 圆角折线：每个拐点用 12px 二次曲线收一下。 */
function roundedPath(points, r = 12) {
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

/** 从矩形中心沿 (dx,dy) 打到边框上的点。 */
function hit(cx, cy, w, h, dx, dy) {
  if (!dx && !dy) return { x: cx, y: cy };
  const tx = dx ? w / 2 / Math.abs(dx) : Infinity;
  const ty = dy ? h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

export class VkGraph extends VkElement {
  static __observed = ['layout', 'direction'];

  paint() {
    if (!this._stage) {
      this._stage = this.querySelector('.vk-gstage');
      this._svg = this.querySelector('.vk-gedges');
    }
  }

  place() {
    if (!this._stage) return;
    const nodes = [...this._stage.querySelectorAll('.vk-gnode')];
    if (!nodes.length) return;
    const layout = this.getAttribute('layout') || 'row';
    const dir = this.getAttribute('direction') || 'horizontal';
    const gapPx = parseFloat(getComputedStyle(this).getPropertyValue('--vk-gap'));
    const gap = Number.isFinite(gapPx) && gapPx > 0 ? gapPx : GAP();

    const sizes = nodes.map((n) => ({ w: n.offsetWidth, h: n.offsetHeight }));
    const byId = new Map(nodes.map((n, i) => [n.dataset.id, i]));

    /* 边：after 简写 + 显式 from/to。 */
    const links = [];
    nodes.forEach((n, j) => {
      for (const ref of (n.dataset.after || '').split(/\s+/).filter(Boolean)) {
        const i = byId.get(ref);
        if (i == null) warn(this, `after="${ref}" 找不到节点`);
        else links.push({ i, j, label: '', current: false, tone: '' });
      }
    });
    for (const def of this.querySelectorAll('.vk-gedge')) {
      const i = byId.get(def.dataset.from);
      const j = byId.get(def.dataset.to);
      if (i == null || j == null) {
        warn(this, `边 ${def.dataset.from} → ${def.dataset.to} 找不到节点`);
        continue;
      }
      links.push({ i, j, label: def.textContent.trim(), current: def.hasAttribute('current'), tone: def.getAttribute('data-tone') || '' });
    }

    /* 层级：从没有父的节点开始 BFS；环上的节点落在 0 层。 */
    const depth = new Array(nodes.length).fill(null);
    const queue = [];
    nodes.forEach((n, i) => {
      if (!links.some((l) => l.j === i)) {
        depth[i] = 0;
        queue.push(i);
      }
    });
    let guard = 0;
    while (queue.length && guard++ < nodes.length * 6) {
      const i = queue.shift();
      for (const l of links) {
        if (l.i !== i) continue;
        const d = depth[i] + 1;
        if (depth[l.j] == null || d > depth[l.j]) {
          depth[l.j] = d;
          queue.push(l.j);
        }
      }
    }
    nodes.forEach((_, i) => {
      if (depth[i] == null) depth[i] = 0;
    });

    const pos = new Array(nodes.length);
    const maxW = Math.max(...sizes.map((s) => s.w));
    const maxH = Math.max(...sizes.map((s) => s.h));

    if (layout === 'row') {
      let x = 0;
      nodes.forEach((_, i) => {
        if (dir === 'vertical') {
          pos[i] = { x: 0, y: x, w: sizes[i].w, h: sizes[i].h };
          x += sizes[i].h + gap;
        } else {
          pos[i] = { x, y: 0, w: sizes[i].w, h: sizes[i].h };
          x += sizes[i].w + gap;
        }
      });
    } else if (layout === 'mesh') {
      const n = nodes.length;
      const Rx = Math.max(420, Math.min(620, ((maxW + gap) * n) / (2 * Math.PI) * 1.4));
      const Ry = Math.max(180, Rx * 0.42);
      const cx = Rx + maxW / 2;
      const cy = Ry + maxH / 2;
      nodes.forEach((_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        pos[i] = {
          x: cx + Rx * Math.cos(a) - sizes[i].w / 2,
          y: cy + Ry * Math.sin(a) - sizes[i].h / 2,
          w: sizes[i].w,
          h: sizes[i].h,
        };
      });
    } else {
      /* tree / layered：同一层按 DOM 顺序排；layered 可用 lane 固定纵坐标。 */
      const layers = new Map();
      nodes.forEach((_, i) => {
        if (!layers.has(depth[i])) layers.set(depth[i], []);
        layers.get(depth[i]).push(i);
      });
      const order = [];
      const seen = new Set();
      const post = (i) => {
        if (seen.has(i)) return;
        seen.add(i);
        for (const l of links) if (l.i === i) post(l.j);
        order.push(i);
      };
      nodes.forEach((_, i) => {
        if (!links.some((l) => l.j === i)) post(i);
      });
      nodes.forEach((_, i) => {
        if (!seen.has(i)) order.push(i);
      });
      const slot = new Map(order.map((i, k) => [i, k]));
      const maxDepth = Math.max(...layers.keys(), 0);

      for (const [d, list] of layers) {
        for (const i of list) {
          const laneAttr = Number(nodes[i].dataset.lane);
          const lane = Number.isFinite(laneAttr) ? laneAttr : slot.get(i) ?? 0;
          if (layout === 'tree') {
            pos[i] = { x: lane * (maxW + gap), y: d * (maxH + gap * 0.8), w: sizes[i].w, h: sizes[i].h };
          } else {
            pos[i] = { x: d * (maxW + gap), y: lane * (maxH + gap * 0.55), w: sizes[i].w, h: sizes[i].h };
          }
        }
      }
      if (layout === 'tree') {
        for (let d = maxDepth; d >= 0; d--) {
          for (const i of layers.get(d) || []) {
            const kids = links.filter((l) => l.i === i).map((l) => l.j);
            if (!kids.length) continue;
            const cx = kids.reduce((s, k) => s + pos[k].x + pos[k].w / 2, 0) / kids.length;
            pos[i].x = Math.max(0, cx - pos[i].w / 2);
          }
        }
      }
    }

    /* 平移到左上角，留 8px 边距；内容比版心窄时居中。 */
    const minX = Math.min(...pos.map((p) => p.x));
    const minY = Math.min(...pos.map((p) => p.y));
    pos.forEach((p) => {
      p.x -= minX - 8;
      p.y -= minY - 8;
    });
    const W = Math.max(...pos.map((p) => p.x + p.w)) + 8;
    const H = Math.max(...pos.map((p) => p.y + p.h)) + 8;
    const viewW = Math.max(W, this.clientWidth || W);
    const offX = Math.round((viewW - W) / 2);
    pos.forEach((p) => {
      p.x += offX;
    });

    nodes.forEach((n, i) => {
      n.style.left = `${pos[i].x + pos[i].w / 2}px`;
      n.style.top = `${pos[i].y + pos[i].h / 2}px`;
    });
    this._stage.style.width = `${viewW}px`;
    this._stage.style.height = `${H}px`;
    this.style.height = `${H}px`;

    const svg = this._svg;
    if (!svg) return;
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${viewW} ${H}`);
    svg.setAttribute('width', viewW);
    svg.setAttribute('height', H);
    const group = mk('g');
    for (const l of links) {
      const a = pos[l.i];
      const b = pos[l.j];
      const aCx = a.x + a.w / 2;
      const aCy = a.y + a.h / 2;
      const bCx = b.x + b.w / 2;
      const bCy = b.y + b.h / 2;
      const current = l.current || nodes[l.j].hasAttribute('current') || nodes[l.i].hasAttribute('current');
      const tone = l.tone || '';

      let points;
      if (layout === 'tree') {
        const p1 = { x: aCx, y: a.y + a.h };
        const p2 = { x: bCx, y: b.y };
        const my = p1.y + (p2.y - p1.y) / 2;
        points = [p1, { x: p1.x, y: my }, { x: p2.x, y: my }, { x: p2.x, y: p2.y - 4 }];
      } else if (layout === 'layered') {
        const p1 = { x: a.x + a.w, y: aCy };
        const p2 = { x: b.x, y: bCy };
        const mx = p1.x + (p2.x - p1.x) / 2;
        points = [p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2];
      } else if (layout === 'mesh') {
        const dx = bCx - aCx;
        const dy = bCy - aCy;
        points = [hit(aCx, aCy, a.w, a.h, dx, dy), hit(bCx, bCy, b.w, b.h, -dx, -dy)];
      } else if (dir === 'vertical') {
        const p1 = { x: aCx, y: a.y + a.h };
        const p2 = { x: bCx, y: b.y };
        const my = p1.y + 36;
        points = [p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2];
      } else {
        const p1 = { x: a.x + a.w, y: aCy };
        const p2 = { x: b.x, y: bCy };
        const mx = p1.x + (p2.x - p1.x) / 2;
        points = [p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2];
      }

      const tipBase = points[points.length - 2];
      const p2 = points[points.length - 1];
      const dx = p2.x - tipBase.x;
      const dy = p2.y - tipBase.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const tip = { x: p2.x - ux * 4, y: p2.y - uy * 4 };
      const base = { x: tip.x - ux * 28, y: tip.y - uy * 28 };
      points[points.length - 1] = layout === 'tree' ? tip : base;

      group.appendChild(mk('path', { class: 'vk-edge', d: roundedPath(points, 12), 'data-current': current ? '1' : null, 'data-tone': tone || null }));
      const b2 = { x: base.x - 14 * uy, y: base.y + 14 * ux };
      const b3 = { x: base.x + 14 * uy, y: base.y - 14 * ux };
      if (layout !== 'tree') group.appendChild(mk('polygon', { class: 'vk-edge-head', points: `${tip.x},${tip.y} ${b2.x},${b2.y} ${b3.x},${b3.y}`, 'data-current': current ? '1' : null, 'data-tone': tone || null }));

      if (l.label) {
        const from = points[0];
        const lx = from.x + (p2.x - from.x) * 0.62;
        const ly = from.y + (p2.y - from.y) * 0.62;
        const nx = -(p2.y - from.y);
        const ny = p2.x - from.x;
        const nl = Math.hypot(nx, ny) || 1;
        const t = mk('text', { class: 'vk-edge-label', x: lx + (nx / nl) * 20, y: ly + (ny / nl) * 20, 'text-anchor': 'middle', style: 'font-size: var(--vk-fs-caption); font-family: var(--vk-font-sans)' });
        t.textContent = l.label;
        group.appendChild(t);
      }
    }
    svg.appendChild(group);
  }
}

define('vk-graph', VkGraph);
