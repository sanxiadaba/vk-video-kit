/**
 * v19 · 关系图
 * ----------------------------------------------------------------------------
 * 节点是构建期写好的 <li> → .vk-gnode；边写在节点上（after="父id"）。
 * 三种布局：row（链表 / 队列）、tree（递归树 / 堆）、layered（DAG：git、依赖、时序）。
 *
 * 为什么在运行期算：节点宽度要等字体真正加载后才能量准；构建期猜宽度会让
 * 连线永远差几个像素。
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

const GAP = () => 72;

export class VkGraph extends VkElement {
  static __observed = ['layout', 'direction', 'edge', 'gap'];

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
    const gap = Number(this.getAttribute('gap') || 0) || GAP();

    const sizes = nodes.map((n) => ({ w: n.offsetWidth, h: n.offsetHeight }));
    const byId = new Map(nodes.map((n, i) => [n.dataset.id, i]));
    const parents = nodes.map((n) => (n.dataset.after ? n.dataset.after.split(/\s+/).filter(Boolean) : []));

    /* 层级：从没有父的节点开始 BFS；有环就退化成按 DOM 顺序。 */
    const depth = new Array(nodes.length).fill(null);
    const queue = [];
    nodes.forEach((n, i) => {
      if (!parents[i].length) {
        depth[i] = 0;
        queue.push(i);
      }
    });
    let guard = 0;
    while (queue.length && guard++ < nodes.length * 4) {
      const i = queue.shift();
      for (let j = 0; j < nodes.length; j++) {
        if (!parents[j].some((p) => byId.get(p) === i)) continue;
        const d = depth[i] + 1;
        if (depth[j] == null || d > depth[j]) {
          depth[j] = d;
          queue.push(j);
        }
      }
    }
    nodes.forEach((_, i) => {
      if (depth[i] == null) depth[i] = 0;
    });

    const pos = new Array(nodes.length);
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
    } else {
      /* tree / layered：同一层的节点按 DOM 顺序排，父节点居中在孩子上方（或左侧）。 */
      const layers = new Map();
      nodes.forEach((_, i) => {
        const d = depth[i];
        if (!layers.has(d)) layers.set(d, []);
        layers.get(d).push(i);
      });
      const maxDepth = Math.max(...layers.keys());
      // 叶子顺序：后序，保证父节点落在孩子的中间。
      const order = [];
      const seen = new Set();
      const post = (i) => {
        if (seen.has(i)) return;
        seen.add(i);
        const kids = nodes.map((_, j) => j).filter((j) => parents[j].some((p) => byId.get(p) === i));
        for (const k of kids) post(k);
        order.push(i);
      };
      nodes.forEach((_, i) => {
        if (!parents[i].length) post(i);
      });
      nodes.forEach((_, i) => {
        if (!seen.has(i)) order.push(i);
      });
      const slot = new Map(order.map((i, k) => [i, k]));
      const maxW = Math.max(...sizes.map((s) => s.w));
      const maxH = Math.max(...sizes.map((s) => s.h));
      for (const [d, list] of layers) {
        for (const i of list) {
          const k = slot.get(i) ?? 0;
          if (layout === 'tree') {
            pos[i] = { x: k * (maxW + gap), y: d * (maxH + gap * 0.7), w: sizes[i].w, h: sizes[i].h };
          } else {
            pos[i] = { x: d * (maxW + gap), y: k * (maxH + gap * 0.55), w: sizes[i].w, h: sizes[i].h };
          }
        }
      }
      if (layout === 'tree') {
        // 父节点居中到孩子的平均位置。
        for (let d = maxDepth; d >= 0; d--) {
          for (const i of layers.get(d) || []) {
            const kids = nodes.map((_, j) => j).filter((j) => parents[j].some((p) => byId.get(p) === i));
            if (!kids.length) continue;
            const cx = kids.reduce((s, k) => s + pos[k].x + pos[k].w / 2, 0) / kids.length;
            pos[i].x = Math.max(0, cx - pos[i].w / 2);
          }
        }
      }
    }

    /* 平移坐标到左上角，留 8px 边距。 */
    const minX = Math.min(...pos.map((p) => p.x));
    const minY = Math.min(...pos.map((p) => p.y));
    pos.forEach((p) => {
      p.x = p.x - minX + 8;
      p.y = p.y - minY + 8;
    });
    const W = Math.max(...pos.map((p) => p.x + p.w)) + 8;
    const H = Math.max(...pos.map((p) => p.y + p.h)) + 8;

    nodes.forEach((n, i) => {
      n.style.left = `${pos[i].x + pos[i].w / 2}px`;
      n.style.top = `${pos[i].y + pos[i].h / 2}px`;
    });
    this._stage.style.width = `${W}px`;
    this._stage.style.height = `${H}px`;
    this.style.height = `${H}px`;

    /* 连线 */
    const svg = this._svg;
    if (!svg) return;
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    if (this.getAttribute('edge') === 'none') return;

    const edgeGroup = mk('g');
    nodes.forEach((n, j) => {
      for (const ref of parents[j]) {
        const i = byId.get(ref);
        if (i == null) {
          warn(this, `after="${ref}" 找不到节点`);
          continue;
        }
        const a = pos[i];
        const b = pos[j];
        const aCx = a.x + a.w / 2;
        const aCy = a.y + a.h / 2;
        const bCx = b.x + b.w / 2;
        const bCy = b.y + b.h / 2;
        const horiz = Math.abs(bCx - aCx) >= Math.abs(bCy - aCy);
        let p1;
        let p2;
        let d;
        let ang;
        if (horiz) {
          p1 = { x: bCx > aCx ? a.x + a.w : a.x, y: aCy };
          p2 = { x: bCx > aCx ? b.x : b.x + b.w, y: bCy };
          const mx = (p1.x + p2.x) / 2;
          d = `M ${p1.x} ${p1.y} L ${mx} ${p1.y} L ${mx} ${p2.y} L ${p2.x} ${p2.y}`;
          ang = p2.x >= mx ? 0 : Math.PI;
        } else {
          p1 = { x: aCx, y: bCy > aCy ? a.y + a.h : a.y };
          p2 = { x: bCx, y: bCy > aCy ? b.y : b.y + b.h };
          const my = (p1.y + p2.y) / 2;
          d = `M ${p1.x} ${p1.y} L ${p1.x} ${my} L ${p2.x} ${my} L ${p2.x} ${p2.y}`;
          ang = p2.y >= my ? Math.PI / 2 : -Math.PI / 2;
        }
        const current = n.dataset.state === 'current' || (nodes[i].dataset.state === 'current');
        edgeGroup.appendChild(mk('path', { class: 'vk-edge', d, 'data-current': current ? '1' : null }));
        // 箭头
        const L = 22;
        const Wd = 11;
        const b1 = { x: p2.x - L * Math.cos(ang), y: p2.y - L * Math.sin(ang) };
        const b2 = { x: b1.x - Wd * Math.sin(ang), y: b1.y + Wd * Math.cos(ang) };
        const b3 = { x: b1.x + Wd * Math.sin(ang), y: b1.y - Wd * Math.cos(ang) };
        edgeGroup.appendChild(mk('polygon', { class: 'vk-edge-head', points: `${p2.x},${p2.y} ${b2.x},${b2.y} ${b3.x},${b3.y}`, 'data-current': current ? '1' : null }));
      }
    });
    svg.appendChild(edgeGroup);
  }
}

define('vk-graph', VkGraph);
