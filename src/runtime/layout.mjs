import { VK, EDGES, numAttr, VkElement, define, plain, resolveAnchor } from './base.mjs';
import { autoSide, connectorGeometry, labelSpot, pathLength, roundedPath, tipOpenPath, tipPath, visualToLocal } from './geometry.mjs';

/* ------------------------------------------------------------------ 摆位 */

export class VkCanvas extends VkElement {
  static watchSource = false;
  static frame = false;

  onAttr(name) {
    if (name === 'grid') this._grid();
  }

  _grid() {
    const g = numAttr(this, 'grid', { min: 0, max: 192, fallback: 0 });
    if (g > 0) {
      this.style.setProperty('--vk-grid', g + 'px');
      this.dataset.grid = '1';
    } else {
      this.removeAttribute('data-grid');
      this.style.removeProperty('--vk-grid');
    }
  }

  render() {
    this._grid();
    this.dataset.vkPlace = '';
    VK._invalidate();
  }

  place() {
    const kids = [...this.children].filter((el) => el.tagName.toLowerCase() !== 'svg');
    if (!kids.length) return;

    const nodes = kids.filter((el) => el.tagName !== 'VK-EDGE' && !el.hasAttribute('data-vk-overlay'));
    const sizes = new Map();
    // 先批量写位置，再批量读尺寸：循环里写读交替会让每个子元素各触发一次强制布局。
    for (const el of nodes) {
      el.style.position = 'absolute';
      el.style.left = '0px';
      el.style.top = '0px';
    }
    for (const el of nodes) sizes.set(el, { w: el.offsetWidth, h: el.offsetHeight });

    const box = { w: 0, h: 0 };
    // 只保留 free：子节点自己声明坐标。
    for (const el of nodes) {
      const s = sizes.get(el);
      const x = numAttr(el, 'x', { min: -1920, max: 1920, fallback: 0 });
      const y = numAttr(el, 'y', { min: -1080, max: 1080, fallback: 0 });
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      box.w = Math.max(box.w, x + s.w);
      box.h = Math.max(box.h, y + s.h);
    }

    // pad-px：子节点是绝对定位的，padding 不会自动内缩；手动平移，宽度再补回两侧。
    const pad = numAttr(this, 'pad-px', { min: 0, max: 200, fallback: 0 });
    if (pad) {
      for (const el of nodes) {
        el.style.left = (parseFloat(el.style.left) || 0) + pad + 'px';
        el.style.top = (parseFloat(el.style.top) || 0) + pad + 'px';
      }
    }
    this.style.padding = '0';

    const hasW = this.hasAttribute('w');
    const hasH = this.hasAttribute('h');
    const wAttr = hasW ? numAttr(this, 'w', { min: 48, max: 1920, fallback: 0 }) : 0;
    const hAttr = hasH ? numAttr(this, 'h', { min: 48, max: 1080, fallback: 0 }) : 0;
    const contentW = Math.max(48, Math.ceil(box.w) + pad * 2);
    const contentH = Math.max(48, Math.ceil(box.h) + pad * 2);
    this.style.width = (hasW ? wAttr : contentW) + 'px';
    this.style.height = (hasH ? hAttr : contentH) + 'px';
    this.style.minWidth = hasW ? wAttr + 'px' : '';

    // 连线由 base.layout 在全部画布摆完后统一画；这里不重复画。
  }
}

/* ------------------------------------------------------------------ 连线 */

/** 折线有没有从盒子里穿过去（强制 side 写反时的症状） */
function crossesOwnBox(pts, a, b) {
  const inside = (p, r) => p.x > r.x + 2 && p.x < r.x + r.w - 2 && p.y > r.y + 2 && p.y < r.y + r.h - 2;
  for (let i = 1; i < pts.length; i++) {
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      const p = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
      if (inside(p, a) || inside(p, b)) return true;
    }
  }
  return false;
}

export class VkEdge extends VkElement {
  static watchSource = false;
  static frame = false;

  connectedCallback() {
    super.connectedCallback?.();
    EDGES.add(this);
  }

  render() {
    if (!this._svg) {
      this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this._svg.setAttribute('class', 'vk-edge-svg');
      this._path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this._path.setAttribute('class', 'vk-edge-path');
      this._tip = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this._tip.setAttribute('class', 'vk-edge-tip');
      this._tip2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this._tip2.setAttribute('class', 'vk-edge-tip');
      this._cap = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      this._cap.setAttribute('class', 'vk-edge-cap');
      this._cap.setAttribute('r', '5');
      this._svg.append(this._path, this._tip, this._tip2, this._cap);
      this.appendChild(this._svg);
    }
    EDGES.add(this);
    const label = this.getAttribute('label');
    if (label && !this._label) {
      this._label = document.createElement('span');
      this._label.className = 'vk-edge-label';
      this.appendChild(this._label);
    }
    if (this._label) this._label.textContent = label || '';
    VK._invalidate();
  }

  draw() {
    if (!this._svg) this.render();
    // 每次重画先清空：端点被删掉时不能留下上一帧的线。
    this._path?.setAttribute('d', '');
    this._tip?.setAttribute('d', '');
    this._tip2?.setAttribute('d', '');
    if (this._cap) this._cap.style.display = 'none';
    if (this._label) this._label.textContent = this.getAttribute('label') || '';

    // 覆盖层是 position:absolute；坐标基准是最近的定位祖先，
    // 不是语义宿主（vk-page 的正文在 1680px 的 .vk-page-inner 里）。
    let host = this.parentElement;
    while (host && getComputedStyle(host).position === 'static') host = host.parentElement;
    if (!host) host = document.body;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    // 隐藏的镜头/模板不参与布局：没有盒子就不画，也不报警。
    if (!host.getClientRects().length) return;

    const fromA = resolveAnchor(host, this.getAttribute('from'), this);
    const toA = resolveAnchor(host, this.getAttribute('to'), this);
    if (!fromA || !toA) {
      if (host.getClientRects().length) this._warnOnce('endpoint', '找不到 from/to 目标，连线已清空');
      return;
    }
    if (!fromA.el.getClientRects().length || !toA.el.getClientRects().length) return;

    // 坐标基准必须是 canvas 自己：SVG 是 inset:0 铺在 canvas 上的，
    // 用 offsetParent 会把 canvas 在页面里的偏移整段加进路径。
    const hr = host.getBoundingClientRect();
    if (hr.width < 1 || hr.height < 1) return;
    const toLocal = (r) => {
      const p = visualToLocal(r, hr, host.offsetWidth);
      return { x: p.x, y: p.y, w: p.w, h: p.h, cx: p.x + p.w / 2, cy: p.y + p.h / 2 };
    };
    const a = toLocal(fromA.rect);
    const b = toLocal(toA.rect);

    // edge 的 svg 覆盖整个包含块
    this.style.position = 'absolute';
    this.style.inset = '0';
    this.style.pointerEvents = 'none';
    this.style.zIndex = String(numAttr(this, 'z', { min: 0, max: 99, fallback: 20 }));

    const cs0 = getComputedStyle(this);
    const numOf = (name, fallback) => parseFloat(cs0.getPropertyValue(name)) || fallback;
    const gap = numAttr(this, 'gap-px', { min: 0, max: 200, fallback: numOf('--vk-edge-gap', 32) });
    const bend = numAttr(this, 'bend', { min: -200, max: 200, fallback: 0 });
    const r = numOf('--vk-edge-r', 16);
    const shape = this.getAttribute('variant') || 'ortho';
    const tension = numAttr(this, 'tension', { min: 5, max: 120, fallback: 42 }) / 100;

    let [s1, s2] = autoSide(a, b);
    if (fromA.side) s1 = fromA.side;
    if (toA.side) s2 = toA.side;
    const fs = this.getAttribute('from-side');
    const ts = this.getAttribute('to-side');
    let forced = false;
    if (fs && fs !== 'auto') {
      s1 = fs;
      forced = true;
    }
    if (ts && ts !== 'auto') {
      s2 = ts;
      forced = true;
    }

    let g = connectorGeometry({ from: a, to: b, s1, s2, shape, gap, bend, r, tension });

    // 作者显式写的路径点：先直连再圆角，箭头方向按最后一段算。
    const viaRaw = this.getAttribute('via');
    if (viaRaw) {
      const pts = viaRaw
        .split(';')
        .map((part) => part.split(',').map((n) => Number(n.trim())))
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
        .map(([x, y]) => ({ x, y }));
      if (pts.length) {
        const start = g.points[0];
        const end = g.points[g.points.length - 1];
        const all = [start, ...pts, end];
        const prev = pts[pts.length - 1] || start;
        g.points = all;
        g.tip = { ...g.tip, x: end.x, y: end.y, angle: Math.atan2(end.y - prev.y, end.x - prev.x) };
        g.d = roundedPath(all, r);
      } else {
        this._warnOnce('via', '的 via 不是 x,y;x,y 坐标，已忽略');
      }
    }

    // 强制边如果背对目标，线会先穿出自己的盒子：不静默接受，退回自动选边
    if (forced && crossesOwnBox(g.points, a, b)) {
      this._warnOnce('side', '的 from-side / to-side 指向盒子内部，已退回自动选边');
      this.dataset.sideFallback = '';
      [s1, s2] = autoSide(a, b);
      g = connectorGeometry({ from: a, to: b, s1, s2, shape, gap, bend, r, tension });
    } else {
      delete this.dataset.sideFallback;
    }

    const w = Math.round(host.offsetWidth) || 1920;
    const h = Math.round(host.offsetHeight) || 1080;
    this._svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this._svg.setAttribute('width', '100%');
    this._svg.setAttribute('height', '100%');
    this._svg.setAttribute('preserveAspectRatio', 'none');

    this._path.setAttribute('d', g.d);

    // 线宽 / 箭头尺寸 / 半角都来自令牌：几何与样式必须是同一份数字
    const cs = getComputedStyle(this);
    const num = (name, fallback) => parseFloat(cs.getPropertyValue(name)) || fallback;
    const arrowStyle = this.getAttribute('arrow-style') || 'solid';
    const arrowSize = numAttr(this, 'arrow-size', { min: 8, max: 48, fallback: num('--vk-edge-tip', 18) });
    const tipSize = arrowStyle === 'thin' ? arrowSize * 0.72 : arrowSize;
    const tipHalf = num('--vk-edge-tip-angle', 0.42);
    const tip = arrowStyle === 'open' ? tipOpenPath : tipPath;

    const arrow = this.getAttribute('arrow') || 'end';
    const showEnd = arrow === 'end' || arrow === 'both';
    const showStart = arrow === 'start' || arrow === 'both';
    this._tip.setAttribute('data-style', arrowStyle);
    this._tip2.setAttribute('data-style', arrowStyle);
    this._tip.setAttribute('d', showEnd ? tip(g.tip.x, g.tip.y, g.tip.angle, tipSize, tipHalf) : '');

    // 起点的箭头朝外：方向由第一段的切线反推
    const p0 = g.points[0];
    const p1 = g.points[1] || p0;
    const back = Math.atan2(p0.y - p1.y, p0.x - p1.x);
    this._tip2.setAttribute('d', showStart ? tip(p0.x, p0.y, back, tipSize, tipHalf) : '');

    // 圆点锚点：指引线的起点。箭头表示"流向"，圆点表示"就是这个"。
    if (this.getAttribute('cap') === 'dot') {
      const r = Math.max(14, num('--vk-edge-cap', 10) / 2);
      this._cap.setAttribute('cx', p0.x);
      this._cap.setAttribute('cy', p0.y);
      this._cap.setAttribute('r', r);
      this._cap.style.display = '';
    } else {
      this._cap.style.display = 'none';
    }

    // 两节点之间的净空太小 → 箭头会读成噪点。报告出来，别让它悄悄出现。
    const len = pathLength(g.points);
    const minGap = num('--vk-edge-min', 48);
    if (len < minGap && !this.hasAttribute('data-allow-short')) {
      this._warnOnce(
        'short',
        `只有 ${Math.round(len)}px，短于 ${minGap}px：箭头会糊成一点。把两个节点拉开，或改用 label 说明关系`
      );
    }
    this.dataset.short = len < minGap ? '' : undefined;
    if (len >= minGap) delete this.dataset.short;

    if (this._label) {
      // 标签位置按「标签真实宽度 + 段长」算，不能先挑最长段再硬塞
      const lw = this._label.offsetWidth || 120;
      const lh = this._label.offsetHeight || 44;
      const spot = (shape === 'ortho' ? labelSpot(g.points, lw, lh) : null) || g.label;
      const W = host.offsetWidth || w;
      const H = host.offsetHeight || h;
      let d = spot.dir || 'h';
      if (d === 'v' && spot.x + 16 + lw > W) d = 'v-left';
      else if (d === 'h' && spot.y - 8 - lh < 0) d = 'h-below';
      else if (d === 'h' && spot.y + 8 + lh > H) d = 'h-above';
      this._label.dataset.dir = d;
      if (spot.tight) this._label.dataset.tight = '';
      else delete this._label.dataset.tight;
      const dx = numAttr(this, 'label-dx', { min: -400, max: 400, fallback: 0 });
      const dy = numAttr(this, 'label-dy', { min: -200, max: 200, fallback: 0 });
      this._label.style.left = spot.x + dx + 'px';
      this._label.style.top = spot.y + dy + 'px';
    }
  }
}

/* ---------------------------------------------------------------- 网格 */
export class VkGrid extends VkElement {
  static watchSource = false;

  render() {
    // 两条路：cols="1..6" 是等分份数（求解器可判定）；tracks 是真轨道（fr / auto，禁 px）。
    const tracks = (this.getAttribute('tracks') || '').trim();
    if (tracks) {
      this.style.gridTemplateColumns = tracks;
      return;
    }
    // 分份只认 1–6：离散份数是求解器可判定的前提，任意 track list 会在构建期被拦。
    if (this.style.gridTemplateColumns) this.style.gridTemplateColumns = '';
  }
}

/* ---------------------------------------------------------------- 注册 */

export function defineLayout() {
  define('vk-canvas', VkCanvas);
  define('vk-edge', VkEdge);
  // L2 流：纯 CSS + Frame；每个标签一个独立构造器（customElements 不允许复用同一构造器）
  const flow = () => class extends VkElement {
    static watchSource = false;
    render() {}
  };
  define('vk-stack', flow());
  define('vk-row', flow());
  define('vk-grid', VkGrid);
}
