/**
 * v27 · 关系图
 * ----------------------------------------------------------------------------
 * 布局与层级都由构建期决定，运行期只测量、摆放、连线：
 *   宿主 data-as           row / tree / layered / mesh
 *   .vk-gnode data-depth   第几层（tree / layered）
 *   .vk-gnode data-lane    第几条泳道（layered）
 *   .vk-gnode data-after   父节点 id（单亲、向后）；边标在 data-edge
 *   .vk-gedge from/to      显式边（可环、可双向）；边标在 data-edge
 *
 * 标签只给坐标与 class，纸色描边交给 CSS（paint-order: stroke）。
 */
import { VkElement, define, warn } from './base.mjs';
import { mk, clamp, roundedPath } from '../shared/svg.mjs';
import { ARROW, CONN, headPolygon } from '../shared/connector.mjs';

/* 边标：沿法线外推 32；压到箭头或节点再退 16。 */
const LABEL = { offset: 56, retreat: 16 };

/** 从矩形中心沿 (dx,dy) 打到边框上的点。 */
function hit(cx, cy, w, h, dx, dy) {
  if (!dx && !dy) return { x: cx, y: cy };
  const tx = dx ? w / 2 / Math.abs(dx) : Infinity;
  const ty = dy ? h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

/** 两个矩形是否相交。 */
const overlap = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);

export class VkGraph extends VkElement {
  static __observed = ['data-as'];

  paint() {
    if (!this._stage) {
      this._stage = this.querySelector('.vk-gstage');
      this._svg = this.querySelector('.vk-gedges');
      this._graph = this.querySelector('.vk-graph');
    }
  }

  /** 构建期写回的布局名；老构建写在里面的 .vk-graph 上。 */
  layoutKind() {
    const known = new Set(['row', 'tree', 'layered', 'mesh']);
    const own = this.getAttribute('data-as');
    if (own && known.has(own) && own !== 'row') return own;
    const inner = this.querySelector('.vk-graph');
    const innerAs = inner?.getAttribute('data-as');
    if (innerAs && known.has(innerAs)) return innerAs;
    const innerLayout = inner?.getAttribute('data-layout');
    if (innerLayout && known.has(innerLayout)) return innerLayout;
    return 'row';
  }

  /* 读：节点尺寸、正文带高度、层/泳道、标签字号。不写样式。 */
  measure() {
    this._m = null;
    if (!this._stage) return;
    const nodes = [...this._stage.querySelectorAll('.vk-gnode')];
    if (!nodes.length) return;
    const layout = this.layoutKind();
    const bodyEl = this.closest('.vk-body');
    const legendEl = this.querySelector('.vk-glegend');
    const fs = parseFloat(getComputedStyle(this).getPropertyValue('--vk-fs-caption')) || 56;
    const depths = nodes.map((n) => {
      const v = n.getAttribute('data-depth');
      return v == null || v === '' ? null : Number(v) || 0;
    });
    if ((layout === 'tree' || layout === 'layered') && depths.some((d) => d == null)) {
      warn(this, '构建期没写 data-depth：层级会全部落在第 0 层');
    }

    /* 边：after 简写（标签在节点的 data-edge 上）+ 显式 from/to（标签在 data-edge 上）。 */
    const byId = new Map(nodes.map((n, i) => [n.dataset.id, i]));
    const links = [];
    nodes.forEach((n, j) => {
      for (const ref of (n.dataset.after || '').split(/\s+/).filter(Boolean)) {
        const i = byId.get(ref);
        if (i == null) warn(this, `after="${ref}" 找不到节点`);
        else links.push({ i, j, label: n.getAttribute('data-edge') || '', current: false, tone: '', merge: false });
      }
    });
    for (const def of this.querySelectorAll('.vk-gedge')) {
      const i = byId.get(def.dataset.from);
      const j = byId.get(def.dataset.to);
      if (i == null || j == null) {
        warn(this, `边 ${def.dataset.from} → ${def.dataset.to} 找不到节点`);
        continue;
      }
      links.push({ i, j, label: def.getAttribute('data-edge') || def.textContent.trim(), current: def.hasAttribute('current'), tone: def.getAttribute('data-tone') || '', merge: true });
    }

    this._m = {
      nodes,
      layout,
      links,
      dir: this.querySelector('.vk-graph')?.getAttribute('data-dir') || this.getAttribute('data-dir') || 'horizontal',
      sizes: nodes.map((n) => ({ w: n.offsetWidth, h: n.offsetHeight })),
      depths: depths.map((d) => d ?? 0),
      lanes: nodes.map((n) => Number(n.getAttribute('data-lane')) || 0),
      bodyH: bodyEl ? Math.max(0, bodyEl.clientHeight - (legendEl ? legendEl.offsetHeight + 12 : 0)) : 0,
      availW: Math.max(320, this.clientWidth || 1200),
      fs,
    };
  }

  /* 写：摆节点、连线、放边标。 */
  place() {
    const m = this._m;
    if (!m || !this._stage) return;
    const { nodes, sizes, links, depths, lanes, layout, dir, fs } = m;
    const pos = new Array(nodes.length);
    const maxW = Math.max(...sizes.map((s) => s.w), 1);
    const maxH = Math.max(...sizes.map((s) => s.h), 1);
    const pad = 8;
    let viewW = Math.min(m.availW, 1400);
    let H = maxH + pad * 2;

    if (layout === 'row') {
      if (dir === 'vertical') {
        /* 竖链的行距由可用高度算出来：宁可溢出报错，也不把节点压在一起。 */
        const availH = m.bodyH ? m.bodyH - 4 : 0;
        const gapY =
          nodes.length > 1 ? (availH > 0 ? Math.max(CONN.arrowGap, Math.min(128, Math.floor((availH - pad * 2 - nodes.length * maxH) / (nodes.length - 1)))) : CONN.minGap) : 0;
        nodes.forEach((_, i) => {
          pos[i] = { x: 0, y: i * (maxH + gapY) + (maxH - sizes[i].h) / 2, w: sizes[i].w, h: sizes[i].h };
        });
        viewW = maxW + pad * 2;
        H = nodes.length * maxH + (nodes.length - 1) * gapY + pad * 2;
      } else {
        const gapX = nodes.length > 1 ? Math.max(CONN.arrowGap, Math.min(160, (viewW - nodes.length * maxW) / (nodes.length - 1))) : 0;
        nodes.forEach((_, i) => {
          pos[i] = { x: i * (maxW + gapX) + (maxW - sizes[i].w) / 2, y: 0, w: sizes[i].w, h: sizes[i].h };
        });
        H = maxH + pad * 2;
        viewW = Math.max(viewW, nodes.length * maxW + (nodes.length - 1) * gapX + pad * 2);
      }
    } else if (layout === 'mesh') {
      viewW = Math.min(m.availW, 1100);
      H = m.bodyH ? Math.max(280, m.bodyH - 24) : 520;
      const n = nodes.length;
      const Rx = Math.max(160, (viewW - maxW - pad * 2) / 2);
      const Ry = Math.max(120, (H - maxH - pad * 2) / 2);
      const ccx = viewW / 2;
      const ccy = H / 2;
      nodes.forEach((_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        pos[i] = { x: ccx + Rx * Math.cos(a) - sizes[i].w / 2, y: ccy + Ry * Math.sin(a) - sizes[i].h / 2, w: sizes[i].w, h: sizes[i].h };
      });
    } else if (layout === 'layered') {
      viewW = Math.min(m.availW, 1200);
      H = m.bodyH ? Math.min(480, Math.max(240, m.bodyH - 4)) : 480;
      const maxDepth = Math.max(...depths, 0);
      const maxLane = Math.max(...lanes, 0);
      const colGap = maxDepth > 0 ? Math.max(CONN.arrowGap, (viewW - maxW - pad * 2) / maxDepth) : 0;
      const laneGap = maxLane > 0 ? (H - maxH - pad * 2) / maxLane : 0;
      nodes.forEach((_, i) => {
        pos[i] = {
          x: pad + depths[i] * colGap + (maxW - sizes[i].w) / 2,
          y: pad + lanes[i] * laneGap + (maxH - sizes[i].h) / 2,
          w: sizes[i].w,
          h: sizes[i].h,
        };
      });
    } else {
      /* tree：层级来自构建期，运行期只按层排、按可用高度压层距；父节点在子节点中点。 */
      viewW = Math.min(m.availW, 1200);
      const layers = new Map();
      nodes.forEach((_, i) => {
        if (!layers.has(depths[i])) layers.set(depths[i], []);
        layers.get(depths[i]).push(i);
      });
      const order = [];
      const seen = new Set();
      const post = (i) => {
        if (seen.has(i)) return;
        seen.add(i);
        for (const l of links.filter((x) => x.i === i)) post(l.j);
        order.push(i);
      };
      links.filter((l) => !links.some((x) => x.j === l.i)).forEach((l) => post(l.i));
      nodes.forEach((_, i) => {
        if (!seen.has(i)) order.push(i);
      });
      const slot = new Map(order.map((i, k) => [i, k]));
      const maxDepth = Math.max(...layers.keys(), 0);
      const gapX = 72;
      /* 层间距按可用高度算：三层树在 426 的正文带里也放得下，四层就老实溢出。 */
      const treeAvail = m.bodyH ? m.bodyH - pad * 2 : 0;
      const gapY = maxDepth > 0 ? (treeAvail > 0 ? Math.max(CONN.minGap, Math.min(maxDepth <= 1 ? 160 : 72, Math.floor((treeAvail - (maxDepth + 1) * maxH) / maxDepth))) : CONN.minGap) : 0;
      nodes.forEach((_, i) => {
        const lane = slot.get(i) ?? 0;
        pos[i] = { x: lane * (maxW + gapX), y: depths[i] * (maxH + gapY), w: sizes[i].w, h: sizes[i].h };
      });
      for (let d = maxDepth; d >= 0; d--) {
        for (const i of layers.get(d) || []) {
          const kids = links.filter((l) => l.i === i).map((l) => l.j);
          if (!kids.length) continue;
          const ccx = kids.reduce((s, k) => s + pos[k].x + pos[k].w / 2, 0) / kids.length;
          pos[i].x = Math.max(0, ccx - pos[i].w / 2);
        }
      }
      pos.forEach((p) => {
        p.y += pad;
      });
      H = Math.max(...pos.map((p) => p.y + p.h)) + pad;
    }

    /* 平移到左上角，留 pad；比目标窄时居中。 */
    const minX = Math.min(...pos.map((p) => p.x));
    const minY = Math.min(...pos.map((p) => p.y));
    pos.forEach((p) => {
      p.x -= minX - pad;
      p.y -= minY - pad;
    });
    const W = Math.max(...pos.map((p) => p.x + p.w)) + pad;
    H = Math.max(H, Math.max(...pos.map((p) => p.y + p.h)) + pad);
    viewW = Math.max(viewW, W);
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
    if (this._graph) {
      this._graph.style.width = `${viewW}px`;
      this._graph.style.marginInline = 'auto';
      this._graph.style.height = `${H}px`;
    }
    this.style.width = '100%';
    this.style.marginInline = '0';
    this.style.height = 'auto';

    const svg = this._svg;
    if (!svg) return;
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${viewW} ${H}`);
    svg.setAttribute('width', viewW);
    svg.setAttribute('height', H);
    const group = mk('g');
    svg.appendChild(group);
    const nodeRects = pos.map((p) => ({ left: p.x, top: p.y, right: p.x + p.w, bottom: p.y + p.h }));

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
        points = [p1, { x: p1.x, y: my }, { x: p2.x, y: my }, { x: p2.x, y: p2.y }];
      } else if (layout === 'layered') {
        if (Math.abs(a.x - b.x) < 2) {
          const upward = aCy > bCy;
          const p1 = upward ? { x: aCx, y: a.y } : { x: aCx, y: a.y + a.h };
          const p2 = upward ? { x: bCx, y: b.y + b.h } : { x: bCx, y: b.y };
          points = [p1, p2];
        } else {
          const p1 = { x: a.x + a.w, y: aCy };
          const p2 = { x: b.x, y: bCy };
          /* 分叉要贴着源节点拐下去：走中点会让分支看起来从中间那条边上长出来。 */
          const fork = p2.x > p1.x ? Math.min(40, (p2.x - p1.x) / 2) : 0;
          const mx = p1.x + fork;
          points = [p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2];
        }
      } else if (layout === 'mesh') {
        const dx = bCx - aCx;
        const dy = bCy - aCy;
        points = [hit(aCx, aCy, a.w, a.h, dx, dy), hit(bCx, bCy, b.w, b.h, -dx, -dy)];
      } else if (dir === 'vertical') {
        /* 竖链的箭头走盒子中线，从上一个盒子的下沿到下一个盒子的上沿。 */
        points = [{ x: aCx, y: a.y + a.h }, { x: bCx, y: b.y }];
      } else {
        points = [{ x: a.x + a.w, y: aCy }, { x: b.x, y: bCy }];
      }

      /* 尖端统一留 2px 净空；树没有箭头，终点直接落在节点边上。
         短边（< 88）画不出一个像样的头，退化成「线 + 点」。 */
      const tipBase = points[points.length - 2];
      const end = points[points.length - 1];
      const ddx = end.x - tipBase.x;
      const ddy = end.y - tipBase.y;
      const dlen = Math.hypot(ddx, ddy) || 1;
      const ux = ddx / dlen;
      const uy = ddy / dlen;
      const tip = { x: end.x - ux * CONN.tip, y: end.y - uy * CONN.tip };
      const base = { x: tip.x - ux * CONN.head, y: tip.y - uy * CONN.head };
      const tight = dlen < CONN.minEdge;
      const segEnd = layout === 'tree' || tight ? end : base;
      let arrowBox = null;

      group.appendChild(mk('path', { class: 'vk-edge', d: roundedPath(points, CONN.corner), 'data-current': current ? '1' : null, 'data-tone': tone || null }));
      if (layout !== 'tree') {
        if (tight) {
          const r = CONN.shaft * 1.25;
          group.appendChild(mk('circle', { class: 'vk-edge-dot', cx: tip.x, cy: tip.y, r, 'data-current': current ? '1' : null, 'data-tone': tone || null }));
          arrowBox = { left: tip.x - r, right: tip.x + r, top: tip.y - r, bottom: tip.y + r };
        } else {
          group.appendChild(mk('polygon', { class: 'vk-edge-head', points: headPolygon(tip, ux, uy), 'data-current': current ? '1' : null, 'data-tone': tone || null }));
          arrowBox = this.arrowBox(tip, ux, uy);
        }
      }

      if (l.label) this.placeLabel(group, l.label, points, arrowBox, nodeRects, viewW, H, fs);
    }
  }

  /** 箭头三角形的包围盒（与 headPolygon 同一组点）。 */
  arrowBox(tip, ux, uy) {
    const len = CONN.head;
    const half = CONN.headW / 2;
    const back = (ARROW.back * len) / ARROW.length;
    const tail = { x: tip.x - ux * len, y: tip.y - uy * len };
    const notch = { x: tip.x - ux * (len - back), y: tip.y - uy * (len - back) };
    const hx = -uy * half;
    const hy = ux * half;
    const xs = [tip.x, tail.x + hx, notch.x, tail.x - hx];
    const ys = [tip.y, tail.y + hy, notch.y, tail.y - hy];
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  }

  /** 标签挂在最长一段边上，沿法线外推；两侧、三档都试，放不下就不画。 */
  placeLabel(group, label, points, arrowBox, nodeRects, viewW, H, fs) {
    let best = null;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (!best || len > best.len) best = { a, b, len };
    }
    if (!best) return;
    const { a, b } = best;
    const w = this.textWidth(label, fs);
    const h = fs * 1.2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const fits = (box) =>
      box.left >= 8 && box.right <= viewW - 8 && box.top >= 8 && box.bottom <= H - 8 &&
      !(arrowBox && overlap(box, arrowBox)) && !nodeRects.some((r) => overlap(box, r));
    for (const off of [LABEL.offset, LABEL.offset + LABEL.retreat, LABEL.offset + LABEL.retreat * 2, 0]) {
      for (const sign of [1, -1]) {
        const cx = mx + nx * off * sign;
        const cy = my + ny * off * sign;
        const box = { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
        if (!fits(box)) continue;
        /* 纸色底板（不是字形描边）：线从底板后面过，字自己站得住。 */
        group.appendChild(mk('rect', {
          class: 'vk-gedge-l-plate',
          x: (cx - w / 2 - 8).toFixed(1),
          y: (cy - h / 2).toFixed(1),
          width: (w + 8).toFixed(1),
          height: h.toFixed(1),
        }));
        const t = mk('text', { class: 'vk-gedge-l', x: cx.toFixed(1), y: (cy + fs * 0.35).toFixed(1), 'text-anchor': 'middle' });
        t.textContent = label;
        group.appendChild(t);
        return;
      }
    }
    /* 放不下就不画：压着节点或箭头的字比没有更糟。audit 会把这条算进事实。 */
    group.setAttribute('data-label-hidden', String((Number(group.getAttribute('data-label-hidden')) || 0) + 1));
  }

  /** 估一行字的宽：全角算 1em，半角 0.56em。不读 DOM，也就不触发同步布局。 */
  textWidth(text, fs) {
    let units = 0;
    for (const ch of String(text)) units += ch.charCodeAt(0) > 0x2e80 ? 1 : 0.56;
    return Math.max(fs * 0.6, units * fs);
  }
}

define('vk-graph', VkGraph);
