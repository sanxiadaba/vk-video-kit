/**
 * L4 关系层：一个组件，四种形态。
 *
 *   <vk-annotate mode="arrow" from="#a@side:right" to="#b@side:left" label="编译">
 *   <vk-annotate mode="circle" for="#cells@byte:5" ring="ellipse" double>
 *   <vk-annotate mode="note" note="bubble" for="#code@line:7">这里越界</vk-annotate>
 *   <vk-annotate mode="badge" for="#code@line:7" n="1"></vk-annotate>
 *
 * 旧标签 vk-edge / vk-pin / vk-ring 是别名：同一个类，`static legacy` 把 mode
 * 固定在 arrow / note / circle，读的仍然是旧词表（variant / stroke / arrow / cap…）。
 * 所以旧页面的 DOM、坐标、CSS 全部照旧；合并只发生在"谁在画"这一层。
 *
 * 隐藏的镜头没有盒子，直接不画；覆盖层只挂在包含块上，不改布局。
 */
import { VK, EDGES, VkElement, define, numAttr, resolveAnchor, takeSlot, fillSlot } from './base.mjs';
import {
  autoSide,
  connectorGeometry,
  labelSpot,
  pathLength,
  roundedPath,
  tipOpenPath,
  tipPath,
  visualToLocal,
} from './geometry.mjs';

const NS = 'http://www.w3.org/2000/svg';
/** 双圈的内环半径（外圈是 _ringConfig().pad）。 */
const RING_INNER = 2;
/** 编号点钉进目标时的内距：目标左上角 + 12px（手机上一眼能看清它贴着哪一块）。 */
const BADGE_INSET = 12;
const tag = (name, attrs = {}) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

/* ------------------------------------------------------------------ 共用 */

function positioned(el) {
  // 覆盖层是 position:absolute；包含块是最近的定位祖先。
  let p = el.parentElement;
  while (p && getComputedStyle(p).position === 'static') p = p.parentElement;
  return p || document.body;
}

/**
 * 覆盖层挂在谁身上 —— 坐标系只有两个正确答案。
 *
 *   vk-canvas 里：画布就是坐标系。它有 transform/overflow，覆盖层必须跟着它一起动。
 *   纸里：整张纸才是坐标系。不能挂在 .vk-page-inner 上 —— 那一层只有 1680 宽，
 *         遮罩的 viewBox 会跟着一起缩，结果只盖住内容区，两侧 120 安全区留白。
 */
function hostOf(el) {
  if (el.parentElement?.closest?.('vk-canvas')) return positioned(el);
  const page = el.parentElement?.closest?.('.vk-page');
  if (page) {
    if (el.parentElement !== page) page.appendChild(el);
    return page;
  }
  return positioned(el);
}

function stageOf(el) {
  const host = hostOf(el);
  if (!host) return null;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const hr = host.getBoundingClientRect();
  if (hr.width < 1 || hr.height < 1) return null;
  return {
    host,
    hr,
    w: Math.round(host.offsetWidth) || Math.round(hr.width),
    h: Math.round(host.offsetHeight) || Math.round(hr.height),
  };
}

/** 坐标目标：`to="320,180"` 是相对包含块左上角的像素点。 */
const POINT_RE = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/**
 * 一个端点：CSS 选择器 / #id@part:arg / x,y 坐标。
 * 坐标必须是"包含块里的点"，所以按 host 的盒子换算成视觉 rect，后面的
 * visualToLocal 再换回来；和锚点的走线共用同一套几何。
 */
function anchorOf(host, expr, owner) {
  const raw = String(expr || '').trim();
  const m = raw.match(POINT_RE);
  if (m) {
    const hr = host.getBoundingClientRect();
    const x = Number(m[1]);
    const y = Number(m[2]);
    return { el: host, rect: { left: hr.left + x, top: hr.top + y, width: 0, height: 0 }, side: null, point: true };
  }
  return resolveAnchor(host, raw, owner);
}

/** `for="a;b"` 的多目标（圈选与压暗共用）。 */
function anchorsOf(el, host) {
  return (el.getAttribute('for') || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((expr) => anchorOf(host, expr, el))
    // 隐藏 / 零尺寸的目标没有可画的盒子；不要把它画到 (0,0)。
    .filter((a) => a && a.el && a.el.getClientRects().length);
}

/**
 * 压暗：目标之外全部退后。vk-ring 的 variant="dim" 走这一条，vk-annotate
 * 的 circle 形态不暴露它（圈选是"画一圈"，压暗是另一件事，旧标签留着）。
 */
/**
 * 压暗：目标之外全部退后。旧 vk-ring 的 variant="dim" 走这一条（别名保留），
 * vk-annotate 的 circle 形态不暴露它（圈选是"画一圈"，压暗是另一件事）。
 */
export function applyDim(self) {
  const host = hostOf(self);
  if (!host) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const hr = host.getBoundingClientRect();
  if (hr.width < 1 || hr.height < 1) return;
  // 上一轮退后的兄弟要还原，否则重复渲染会越叠越暗
  for (const el of self._dimmed || []) el.style.removeProperty('opacity');
  self._dimmed = [];

  const targets = anchorsOf(self, host);
  if (!targets.length) {
    self._warnOnce('target', '找不到 for 目标，聚光没有生效');
    return;
  }
  self.style.zIndex = String(numAttr(self, 'z', { min: 0, max: 99, fallback: 30 }));
  const dim = numAttr(self, 'dim', { min: 0, max: 1, fallback: 0.45 });
  const keepSel = (self.getAttribute('keep') || '').split(';').map((s) => s.trim()).filter(Boolean);
  const keep = new Set();
  for (const sel of keepSel) {
    try {
      for (const el of host.querySelectorAll(sel)) keep.add(el);
    } catch {
      /* 选择器写错就当没写，不炸页面 */
    }
  }
  const targetEls = new Set(targets.map((t) => t.el));
  const skip = (el) => el.hasAttribute('data-vk-overlay') || el.matches('vk-edge, vk-pin, vk-ring, vk-annotate');
  const kept = (el) => skip(el) || keep.has(el) || [...keep].some((k) => el.contains(k));

  const seen = new Set();
  for (const a of targets) {
    let node = a.el;
    while (node && node !== host && node.parentElement) {
      for (const sib of node.parentElement.children) {
        if (sib === node || sib.contains(a.el) || seen.has(sib) || kept(sib)) continue;
        // 兄弟里还装着别的目标（多目标聚光）就也留着
        if ([...targetEls].some((t) => sib.contains(t))) continue;
        seen.add(sib);
        sib.style.opacity = String(dim);
        self._dimmed.push(sib);
      }
      node = node.parentElement;
    }
  }
  // 目标自身挂上 focus 姿态，让审计与度量看得见
  for (const el of targetEls) el.setAttribute('data-vk-focus', '');
  self._targets = targetEls;
}

/* ------------------------------------------------------------------ 组件 */

export class VkAnnotate extends VkElement {
  static watchSource = false;
  static frame = false;
  // note 形态的槽：搬节点，不序列化 HTML（与旧 vk-pin 完全一致）。
  static slot = true;
  static slotHost = '.vk-pin-t';
  static renderedRoot = '.vk-edge-svg, .vk-ov-svg, .vk-pin-bd';

  connectedCallback() {
    super.connectedCallback?.();
    // 画布靠这个标记把覆盖层排除在 x/y 摆位之外；旧标签也带一份，无副作用。
    this.dataset.vkOverlay = '';
    EDGES.add(this);
  }

  /* ------------------------------------------------------------- 形态钩子 */

  _mode() {
    return this.getAttribute('mode') || 'arrow';
  }

  /** 连线的形状：新词 straight / ortho / curve；旧词 line 在别名的子类里折过来。
   *  默认 curve：一条线的价值是"指过去"，不是画三个直角。折线是旧 vk-edge 的相貌，
   *  新标签要么直线、要么一条顺滑的弯，不再默认给人看"管道"。 */
  _shape() {
    const v = this.getAttribute('shape') || 'curve';
    return v === 'straight' || v === 'ortho' ? v : 'curve';
  }

  _dashOn() {
    // 枚举写作 dashed；历史写法（只有属性、没有值）也当虚线。
    const v = this.getAttribute('dash');
    return v === 'dashed' || v === '' ? v !== null : false;
  }

  _widthPx() {
    const w = numAttr(this, 'width', { min: 1, max: 24, fallback: NaN });
    return Number.isFinite(w) ? w : null;
  }

  _head() {
    const v = this.getAttribute('head') || 'arrow';
    return v === 'dot' || v === 'none' ? v : 'arrow';
  }

  _ringFigure() {
    const v = this.getAttribute('ring') || 'ellipse';
    return v === 'rect' ? 'rect' : 'ellipse';
  }

  _double() {
    return this.hasAttribute('double');
  }

  _num() {
    return parseInt(this.getAttribute('n') || '0', 10) || 0;
  }

  _noteForm(mode) {
    if (mode === 'badge') return 'badge';
    const v = this.getAttribute('note') || 'bubble';
    return v === 'label' || v === 'badge' ? v : 'bubble';
  }

  _tone(mode) {
    return this.getAttribute('tone') || (mode === 'circle' ? 'focus' : mode === 'arrow' ? 'neutral' : 'info');
  }

  /** 状态镜像：四种形态共用一套规范化值，CSS 与契约都读它。 */
  _syncState(mode) {
    if (this.constructor.legacy) return;
    const d = this.dataset;
    d.mode = mode;
    d.shape = this._shape();
    d.dash = this._dashOn() ? 'dashed' : 'solid';
    d.head = this._head();
    d.ring = this._ringFigure();
    d.double = this._double() ? '2' : '1';
    d.note = this._noteForm(mode);
    d.size = this.getAttribute('size') || 'body';
    d.strength = this.getAttribute('strength') || 'soft';
    d.n = String(this._num());
    // arrow 的缩放比例也镜像到宿主上：契约读它，不猜 CSS。
    if (mode === 'arrow') d.arrowScale = String(numAttr(this, 'arrow-scale', { min: 0.02, max: 0.6, fallback: 0.12 }));
    else delete d.arrowScale;
    // side 是 note 的显式落点；arrow 形态也把请求值镜像出来，契约能读到"改了就变"。
    const sideRaw = (this.getAttribute('side') || 'auto').trim();
    d.side = ['top', 'right', 'bottom', 'left'].includes(sideRaw) ? sideRaw : 'auto';
  }

  /* --------------------------------------------------------------- 生命周期 */

  render() {
    const mode = this._mode();
    this._syncState(mode);
    // 第一次渲染没有壳可拆：拆了会把作者写的文字一起扔掉。
    if (this._modeNow !== undefined && this._modeNow !== mode) {
      this._resetShell();
    }
    this._modeNow = mode;
    if (mode === 'arrow') this._renderArrow();
    else if (mode === 'circle') this._renderCircle();
    else this._renderNote(mode);
    EDGES.add(this);
    VK._invalidate();
  }

  /** 换形态：先保住作者内容，再拆掉上一形态的外壳。 */
  _collectSlot() {
    const keep = [];
    // 上一形态已经收进槽的节点（note 的文字在 .vk-pin-t 里）先搬出来。
    for (const n of this._slotNodes || []) {
      if (n.parentNode) n.parentNode.removeChild(n);
      keep.push(n);
    }
    for (const n of [...this.childNodes]) {
      if (n.nodeType === 3) {
        if (n.textContent.trim()) keep.push(n);
        continue;
      }
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'SCRIPT') continue;
      if (n.matches?.('.vk-edge-svg, .vk-edge-label, .vk-ov-svg, .vk-pin-bd')) continue;
      keep.push(n);
    }
    for (const n of keep) n.parentNode?.removeChild(n);
    this._slotNodes = keep;
    return keep;
  }

  _resetShell() {
    // 换形态：先把作者内容收回槽里（它们是 note 的文字），再拆外壳。
    this._collectSlot();
    this.replaceChildren();
    this._svg = null;
    this._path = null;
    this._tip = null;
    this._tip2 = null;
    this._cap = null;
    this._label = null;
    this._bd = null;
    this._n = null;
    this._t = null;
    this._mounted = false;
  }

  draw() {
    if (!this.isConnected) return;
    const mode = this._mode();
    if (mode === 'arrow') this._drawArrow();
    else if (mode === 'circle') this._drawCircle();
    else this._drawNote(mode);
  }

  /* ------------------------------------------------------------------ arrow */

  /** 连线配置。旧标签在子类里覆盖这一个方法，其余画法完全共用。 */
  _arrowConfig() {
    const cs = getComputedStyle(this);
    const num = (name, fallback) => parseFloat(cs.getPropertyValue(name)) || fallback;
    const head = this._head();
    return {
      from: this.getAttribute('from'),
      // for 是「要标注谁」，arrow 形态把它当终点用；显式 to 优先。
      to: this.getAttribute('to') || this.getAttribute('for'),
      shape: this._shape(),
      dash: this._dashOn(),
      width: this._widthPx(),
      head: { end: head === 'arrow', start: false, dot: head === 'dot' ? 'end' : null, style: 'solid', size: num('--vk-edge-tip', 18) },
      // arrow 的箭头按「所在容器高 × arrow-scale」缩放（夹 28–64），线宽 = 尺寸 × 0.1（≥2）。
      // 旧标签 vk-edge 在自己的 _arrowConfig 里覆盖整套，不读这两个值，逐像素不动。
      scale: numAttr(this, 'arrow-scale', { min: 0.02, max: 0.6, fallback: 0.12 }),
      scaled: true,
      gap: numAttr(this, 'gap-px', { min: 0, max: 240, fallback: num('--vk-edge-gap', 32) }),
      bend: 0,
      tension: 0.42,
      r: num('--vk-edge-r', 16),
      via: null,
      fromSide: null,
      toSide: null,
      labelDx: 0,
      labelDy: 0,
      z: numAttr(this, 'z', { min: 0, max: 99, fallback: 20 }),
    };
  }

  _renderArrow() {
    if (!this._svg) {
      this._svg = document.createElementNS(NS, 'svg');
      this._svg.setAttribute('class', 'vk-edge-svg');
      // 纸色"垫层"：先画一条更粗的白线，箭头就从任何底色上浮起来。
      // 只有新标签有——旧 vk-edge 的逐像素不变是硬约定。
      if (!this.constructor.legacy) {
        this._halo = document.createElementNS(NS, 'path');
        this._halo.setAttribute('class', 'vk-edge-halo');
      }
      this._path = document.createElementNS(NS, 'path');
      this._path.setAttribute('class', 'vk-edge-path');
      this._tip = document.createElementNS(NS, 'path');
      this._tip.setAttribute('class', 'vk-edge-tip');
      this._tip2 = document.createElementNS(NS, 'path');
      this._tip2.setAttribute('class', 'vk-edge-tip');
      this._cap = document.createElementNS(NS, 'circle');
      this._cap.setAttribute('class', 'vk-edge-cap');
      this._cap.setAttribute('r', '5');
      this._svg.append(...(this._halo ? [this._halo] : []), this._path, this._tip, this._tip2, this._cap);
      this.appendChild(this._svg);
    }
    // arrow-label 是「中轴挂一个词」的新写法；旧页的 label 仍然有效，新词优先。
    const label = this.getAttribute('arrow-label') || this.getAttribute('label');
    if (label && !this._label) {
      this._label = document.createElement('span');
      this._label.className = 'vk-edge-label vk-annot-label';
      this.appendChild(this._label);
    }
    if (this._label) {
      this._label.textContent = label || '';
      // 新词走 tag 档（36 / .08em）；旧 label 保持原来的 body 档，旧页不变。
      // data-meta 让 36px 的词按「标注」判对比度，而不是按正文地板。
      const isArrowLabel = !!this.getAttribute('arrow-label');
      this._label.toggleAttribute('data-arrow-label', isArrowLabel);
      this._label.toggleAttribute('data-meta', isArrowLabel);
    }
    this._svg.dataset.head = this._head();
    // 和旧 vk-edge 一样：画线交给 layout（EDGES），render 只准备外壳。
  }

  _drawArrow() {
    if (!this._svg) this._renderArrow();
    // 每次重画先清空：端点被删掉时不能留下上一帧的线。
    this._path?.setAttribute('d', '');
    this._tip?.setAttribute('d', '');
    this._tip2?.setAttribute('d', '');
    if (this._cap) this._cap.style.display = 'none';
    if (this._label) {
      this._label.textContent = this.getAttribute('arrow-label') || this.getAttribute('label') || '';
      const isArrowLabel = !!this.getAttribute('arrow-label');
      this._label.toggleAttribute('data-arrow-label', isArrowLabel);
      this._label.toggleAttribute('data-meta', isArrowLabel);
    }

    // 覆盖层是 position:absolute；坐标基准是最近的定位祖先，
    // 不是语义宿主（vk-page 的正文在 1680px 的 .vk-page-inner 里）。
    let host = this.parentElement;
    while (host && getComputedStyle(host).position === 'static') host = host.parentElement;
    if (!host) host = document.body;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    // 隐藏的镜头/模板不参与布局：没有盒子就不画，也不报警。
    if (!host.getClientRects().length) return;

    const cfg = this._arrowConfig();
    // 箭头尺寸按所在容器的高度算：容器越高，箭头越大；夹在 28–64，
    // 线宽跟着箭头走（×0.1，最小 2px）。作者显式写 width 时仍以 width 为准。
    if (cfg.scaled) {
      const hostH = host.offsetHeight || host.getBoundingClientRect().height || 1080;
      const size = Math.max(28, Math.min(64, hostH * cfg.scale));
      cfg.head.size = size;
      if (cfg.width == null) cfg.width = Math.max(2, size * 0.1);
      this.dataset.arrowSize = String(Math.round(size * 10) / 10);
    }
    const fromA = anchorOf(host, cfg.from, this);
    const toA = anchorOf(host, cfg.to, this);
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
    this.style.zIndex = String(cfg.z);

    const cs = getComputedStyle(this);
    const shape = cfg.shape === 'straight' ? 'line' : cfg.shape;

    let [s1, s2] = autoSide(a, b);
    if (fromA.side) s1 = fromA.side;
    if (toA.side) s2 = toA.side;
    let forced = false;
    if (cfg.fromSide && cfg.fromSide !== 'auto') {
      s1 = cfg.fromSide;
      forced = true;
    }
    if (cfg.toSide && cfg.toSide !== 'auto') {
      s2 = cfg.toSide;
      forced = true;
    }

    let g = connectorGeometry({ from: a, to: b, s1, s2, shape, gap: cfg.gap, bend: cfg.bend, r: cfg.r, tension: cfg.tension });

    // 作者显式写的路径点：先直连再圆角，箭头方向按最后一段算。
    if (cfg.via) {
      const pts = cfg.via
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
        g.d = roundedPath(all, cfg.r);
      } else {
        this._warnOnce('via', '的 via 不是 x,y;x,y 坐标，已忽略');
      }
    }

    // 强制边如果背对目标，线会先穿出自己的盒子：不静默接受，退回自动选边
    if (forced && crossesOwnBox(g.points, a, b)) {
      this._warnOnce('side', '的 from-side / to-side 指向盒子内部，已退回自动选边');
      this.dataset.sideFallback = '';
      [s1, s2] = autoSide(a, b);
      g = connectorGeometry({ from: a, to: b, s1, s2, shape, gap: cfg.gap, bend: cfg.bend, r: cfg.r, tension: cfg.tension });
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
    if (this._halo) this._halo.setAttribute('d', g.d);

    // 线宽 / 箭头尺寸 / 半角都来自令牌：几何与样式必须是同一份数字
    const num = (name, fallback) => parseFloat(cs.getPropertyValue(name)) || fallback;
    const arrowStyle = cfg.head.style;
    let tipSize = cfg.head.size;
    if (cfg.scaled) {
      // 箭头和线宽同比：头太小会读成"线上的一个点"。
      // 6 倍（夹 34…72）是"线末端带一个尖"的比例，缩到 780 也认得出方向。
      const lineW = cfg.width ?? Math.max(2, num('--vk-edge-w', 4));
      const head = Math.max(34, Math.min(72, lineW * 6));
      // 头不能比最后一段直线还长：终点前只剩 12px 时，头会盖住整个弯。
      const before = g.points[g.points.length - 2] || g.points[0];
      const lastRun = Math.hypot(g.tip.x - before.x, g.tip.y - before.y);
      tipSize = Math.max(24, Math.min(head, lastRun * 1.05));
    }
    if (arrowStyle === 'thin') tipSize *= 0.8;
    const tipHalf = num('--vk-edge-tip-angle', 0.42);
    const tip = arrowStyle === 'open' ? tipOpenPath : tipPath;

    this._tip.setAttribute('data-style', arrowStyle);
    this._tip2.setAttribute('data-style', arrowStyle);
    this._tip.setAttribute('d', cfg.head.end ? tip(g.tip.x, g.tip.y, g.tip.angle, tipSize, tipHalf) : '');

    // 起点的箭头朝外：方向由第一段的切线反推
    const p0 = g.points[0];
    const p1 = g.points[1] || p0;
    const back = Math.atan2(p0.y - p1.y, p0.x - p1.x);
    this._tip2.setAttribute('d', cfg.head.start ? tip(p0.x, p0.y, back, tipSize, tipHalf) : '');

    // 圆点端点：箭头表示"流向"，圆点表示"就是这个"。
    const dot = cfg.head.dot;
    if (dot) {
      const at = dot === 'end' ? { x: g.tip.x, y: g.tip.y } : { x: p0.x, y: p0.y };
      const r = Math.max(14, num('--vk-edge-cap', 10) / 2);
      this._cap.setAttribute('cx', at.x);
      this._cap.setAttribute('cy', at.y);
      this._cap.setAttribute('r', r);
      this._cap.style.display = '';
    } else {
      this._cap.style.display = 'none';
    }

    // 线宽：新标签可以写 width；旧标签没有这个属性，CSS 令牌说了算。
    if (cfg.width != null) {
      this._path.style.strokeWidth = cfg.width + 'px';
      this._tip.style.strokeWidth = cfg.width + 'px';
      this._tip2.style.strokeWidth = cfg.width + 'px';
      if (this._halo) this._halo.style.strokeWidth = cfg.width + 6 + 'px';
    } else {
      this._path.style.strokeWidth = '';
      this._tip.style.strokeWidth = '';
      this._tip2.style.strokeWidth = '';
      if (this._halo) this._halo.style.strokeWidth = '';
    }
    if (cfg.dash) this._svg.dataset.dash = '1';
    else delete this._svg.dataset.dash;

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
      if (len < 0.5) {
        this._warnOnce('same-point', '的起点和终点落在同一点（0px）：线没有长度，标签改贴在锚点上');
      }
      const spot =
        (shape === 'ortho' ? labelSpot(g.points, lw, lh) : null) ||
        g.label || { x: g.points[0].x, y: g.points[0].y, dir: 'v', tight: true };
      const W = host.offsetWidth || w;
      const H = host.offsetHeight || h;
      let d = spot.dir || 'h';
      if (d === 'v' && spot.x + 16 + lw > W) d = 'v-left';
      else if (d === 'h' && spot.y - 8 - lh < 0) d = 'h-below';
      else if (d === 'h' && spot.y + 8 + lh > H) d = 'h-above';
      this._label.dataset.dir = d;
      if (spot.tight) this._label.dataset.tight = '';
      else delete this._label.dataset.tight;
      this._label.style.left = spot.x + cfg.labelDx + 'px';
      this._label.style.top = spot.y + cfg.labelDy + 'px';
    }
  }

  /* ----------------------------------------------------------------- circle */

  _ringConfig() {
    const cs = getComputedStyle(this);
    const num = (name, fallback) => parseFloat(cs.getPropertyValue(name)) || fallback;
    return {
      figure: this._ringFigure(),
      pad: 12,
      width: this._widthPx() ?? num('--vk-ring-w', 4),
      dash: this._dashOn(),
      z: numAttr(this, 'z', { min: 0, max: 99, fallback: 40 }),
      double: this._double(),
      tone: this._tone('circle'),
    };
  }

  _renderCircle() {
    this._mount();
    this.style.zIndex = String(numAttr(this, 'z', { min: 0, max: 99, fallback: 40 }));
    this.draw();
  }

  _circleShape(figure, b, pad, extraClass = '') {
    if (figure === 'rect') {
      return tag('rect', {
        x: b.x - pad,
        y: b.y - pad,
        width: b.w + pad * 2,
        height: b.h + pad * 2,
        rx: 12,
        class: 'vk-ring-shape' + extraClass,
      });
    }
    if (figure === 'underline') {
      return tag('line', {
        x1: b.x - pad,
        y1: b.y + b.h + pad,
        x2: b.x + b.w + pad,
        y2: b.y + b.h + pad,
        class: 'vk-ring-shape' + extraClass,
      });
    }
    if (figure === 'bracket') {
      const y = b.y + b.h + pad;
      return tag('path', {
        d: `M ${b.x - pad} ${y} L ${b.x - pad} ${y + 12} L ${b.x + b.w + pad} ${y + 12} L ${b.x + b.w + pad} ${y}`,
        class: 'vk-ring-shape' + extraClass,
        fill: 'none',
      });
    }
    return tag('ellipse', {
      cx: b.cx,
      cy: b.cy,
      rx: b.w / 2 + pad,
      ry: b.h / 2 + pad,
      class: 'vk-ring-shape' + extraClass,
    });
  }

  _drawCircle() {
    const cfg = this._ringConfig();
    // 圈选与压暗本来就是一件事的两种长相：都是"看这里"，一个画框、一个压暗兄弟。
    // 压暗只在旧 vk-ring 的 variant="dim" 上存在。
    if (cfg.figure === 'dim') {
      applyDim(this);
      return;
    }
    if (this._frame() === null) return;
    if (!this._svg) return;
    this._svg.replaceChildren();
    const targets = anchorsOf(this, this._svgHost || this._frameHost);
    if (!targets.length) {
      this._warnOnce('target', '找不到 for 目标，圈选没有画');
      return;
    }
    this._svg.dataset.tone = cfg.tone;
    this.style.zIndex = String(cfg.z);
    this._svg.style.setProperty('--vk-ring-w', cfg.width + 'px');
    if (cfg.dash) this._svg.dataset.dash = '1';
    else delete this._svg.dataset.dash;

    for (const a of targets) {
      const b = this._box(a.rect, this._frameHost, this._frameRect);
      // 圈选 = 目标矩形 + pad，但不许越出目标自己的容器：一行代码的 rect 把
      // 行号沟也算进去了，pad 会把椭圆推到代码框外面（"圈比比框还宽"）。
      const outer = this._ringBox(a, b, cfg.pad);
      this._svg.append(this._circleShape(cfg.figure, outer, 0));
      if (cfg.double) {
        // 内外两圈：外圈 12px，内圈 2px。内环从外环缩进去量（不是另算一次目标 + 2），
        // 两圈才同心——否则贴边收紧时圆心会各偏几像素。
        const d = cfg.pad - RING_INNER;
        this._svg.append(
          this._circleShape(cfg.figure, insetBox(outer, d), 0, ' vk-annot-ring-inner')
        );
      }
    }
  }

  /**
   * 圈选的外框：目标矩形 + pad，再 clamp 进"目标自己的容器"（父元素）与画布。
   *
   * 两条边只在有富余时才收：clamp 不会把圈夹到目标里面——贴边写到底也不会圈不住。
   */
  _ringBox(a, b, pad) {
    let x0 = b.x - pad;
    let y0 = b.y - pad;
    let x1 = b.x + b.w + pad;
    let y1 = b.y + b.h + pad;
    const host = this._frameHost;
    const hr = this._frameRect;
    if (host && hr) {
      const limits = [{ x: 0, y: 0, w: host.offsetWidth, h: host.offsetHeight }];
      const parent = a.el && a.el !== host ? a.el.parentElement : null;
      if (parent && parent !== host) limits.push(visualToLocal(parent.getBoundingClientRect(), hr, host.offsetWidth));
      for (const L of limits) {
        if (!(L.w > 0) || !(L.h > 0)) continue;
        x0 = Math.max(x0, Math.min(L.x, b.x));
        y0 = Math.max(y0, Math.min(L.y, b.y));
        x1 = Math.min(x1, Math.max(L.x + L.w, b.x + b.w));
        y1 = Math.min(y1, Math.max(L.y + L.h, b.y + b.h));
      }
    }
    const w = x1 - x0;
    const h = y1 - y0;
    return { x: x0, y: y0, w, h, cx: x0 + w / 2, cy: y0 + h / 2 };
  }

  /* ------------------------------------------------------------------- note */

  _noteConfig(mode) {
    const cs = getComputedStyle(this);
    const num = (name, fallback) => parseFloat(cs.getPropertyValue(name)) || fallback;
    const form = this._noteForm(mode);
    const rawSide = (this.getAttribute('side') || 'auto').trim();
    const side = NOTE_SIDES.has(rawSide) ? rawSide : 'auto';
    if (rawSide !== side) {
      this._warnOnce('side', `的 side="${rawSide}" 不认识，按 auto 处理（可用：top / right / bottom / left / auto）`);
    }
    return {
      form,
      tone: this._tone(mode),
      gap: numAttr(this, 'gap-px', { min: 0, max: 240, fallback: 24 }),
      width: this._noteWidth(),
      z: numAttr(this, 'z', { min: 0, max: 99, fallback: 60 }),
      // x/y 与旧 vk-pin 同语义：覆盖层坐标，给了就不再自动找位置。
      x: numAttr(this, 'x', { min: -4000, max: 4000, fallback: NaN }),
      y: numAttr(this, 'y', { min: -4000, max: 4000, fallback: NaN }),
      side,
      leader: this.getAttribute('leader') || 'elbow',
      size: this.getAttribute('size') || 'body',
      strength: this.getAttribute('strength') || 'soft',
      n: this._num() || (form === 'badge' ? 1 : 0),
      text: null,
    };
  }

  /** 气泡宽度：老 vk-pin 的 w 在子类里覆盖；新标签按内容自适到 360。 */
  _noteWidth() {
    return null;
  }

  _mountNote() {
    if (this._mounted) return;
    this._mounted = true;
    this.style.position = 'absolute';
    this.style.inset = '0';
    this.style.pointerEvents = 'none';
    this.style.overflow = 'visible';
    this._uid = 'vk' + Math.random().toString(36).slice(2, 9);
    const nodes = this._slotNodes || this._collectSlot();
    const svg = tag('svg', { class: 'vk-ov-svg', 'aria-hidden': 'true' });
    const bd = document.createElement('div');
    bd.className = 'vk-pin-bd vk-annot-note';
    const n = document.createElement('span');
    n.className = 'vk-pin-n';
    n.setAttribute('data-meta', '');
    n.hidden = true;
    const t = document.createElement('div');
    t.className = 'vk-pin-t';
    bd.append(n, t);
    this.append(svg, bd);
    fillSlot(t, nodes);
    this._svg = svg;
    this._bd = bd;
    this._n = n;
    this._t = t;
  }

  /** 旧 vk-pin 的 _mount 与这里等价：同一个 DOM、同一套类名。 */
  _mount() {
    if (this._mounted) return;
    this._mounted = true;
    this.style.position = 'absolute';
    this.style.inset = '0';
    this.style.pointerEvents = 'none';
    this.style.overflow = 'visible';
    this._uid = 'vk' + Math.random().toString(36).slice(2, 9);
    this._svg = tag('svg', { class: 'vk-ov-svg', 'aria-hidden': 'true' });
    this.appendChild(this._svg);
  }

  _renderNote(mode) {
    this._mountNote();
    const cfg = this._noteConfig(mode);
    this.style.zIndex = String(cfg.z);
    this._bd.dataset.tone = cfg.tone;
    this._bd.dataset.variant = cfg.form;
    this._bd.dataset.note = cfg.form;
    this._bd.dataset.strength = cfg.strength;
    this._bd.dataset.size = cfg.size;
    this._svg.dataset.tone = cfg.tone;

    // 编号先落定，再量宽度：带编号的气泡比不带编号的宽一圈，
    // 先量后填会把编号挤到第二行——这正是"短批注折成三行"的来源之一。
    const n = cfg.n;
    this._n.hidden = !(n > 0);
    this._n.textContent = n > 0 ? String(n) : '';
    // 批注只有一句话：w 太窄时它会折成三行，读起来像诗，不像注。
    // 先量"一行到底要多少"，再按内容加宽到 cap 为止；比 w 窄就不动。
    // cap 跟着字阶走（40px 字 → 360，和引入变量之前一致）；下限固定 160：
    // 再窄就只是"一枚编号 + 一个词"，作者写的 w 应该赢。
    const fs = parseFloat(getComputedStyle(this._bd).fontSize) || 40;
    const cap = Math.round(fs * 9);
    const floor = 160;
    this._bd.style.width = 'max-content';
    const natural = Math.ceil(this._bd.getBoundingClientRect().width);
    const w = cfg.width ?? cap;
    const fitted = Math.min(900, Math.max(floor, Math.max(w, Math.min(natural, cap))));
    this._bd.style.width = fitted + 'px';
    this.draw();
    EDGES.add(this);
    VK._invalidate();
  }

  /** 自动避让要躲开哪些字：新标签把代码行也算正文；旧 vk-pin 保持原查询。 */
  _avoidTextSelector() {
    return 'vk-text, p, h1, h2, h3, li, .vk-line, .vk-src, .vk-asm-row';
  }

  _drawNote(mode) {
    const f = this._frame();
    if (!f || !this._bd) return;
    const cfg = this._noteConfig(mode);
    this._svg.replaceChildren();
    const bd = this._bd;
    bd.style.display = '';
    bd.style.left = bd.style.top = '';
    const bw = bd.offsetWidth || 360;
    const bh = bd.offsetHeight || 120;
    const targetExpr = this.getAttribute('for') || '';
    const target = anchorOf(f.host, targetExpr, this);
    let left = cfg.x;
    let top = cfg.y;
    let anchor = null;
    let side = cfg.side;
    let targetBox = null;
    let pinned = false;

    if (target) {
      anchor = this._box(target.rect, f.host, f.hr);
      targetBox = {
        left: anchor.x,
        top: anchor.y,
        right: anchor.x + anchor.w,
        bottom: anchor.y + anchor.h,
      };
      // 编号点钉在目标里：它指的就是"这一块"，坐标 = 目标左上角 + 内距。
      // 写了 @side: / side= 的仍按指定侧放到外面（旧 vk-pin 的摆放不再改动）。
      pinned = cfg.form === 'badge' && !target.side && cfg.side === 'auto' && !Number.isFinite(cfg.x) && !Number.isFinite(cfg.y);
      if (pinned) {
        const room = (Math.min(anchor.w, anchor.h) - Math.min(bw, bh)) / 2;
        const inset = Math.max(0, Math.min(BADGE_INSET, room));
        left = clampInto(anchor.x + inset, anchor.x, anchor.x + anchor.w - bw);
        top = clampInto(anchor.y + inset, anchor.y, anchor.y + anchor.h - bh);
      } else if (!Number.isFinite(left) || !Number.isFinite(top)) {
        // 自动选边：先算四个候选位置，再按"压住多少字 / 是否穿过目标"排序。
        if (side === 'auto') {
          // 正文矩形的坐标系是 viewport，候选位置是包含块局部坐标：
          // 画布不一定从 (0,0) 开始，两者混用会把"避让"算到别的地方。
          const localRect = (el) => {
            const p = visualToLocal(el.getBoundingClientRect(), f.hr, f.host.offsetWidth);
            return { left: p.x, top: p.y, right: p.x + p.w, bottom: p.y + p.h };
          };
          const texts = [...f.host.querySelectorAll(this._avoidTextSelector())]
            .filter((el) => !el.closest('vk-pin, vk-annotate') && (el.textContent || '').trim())
            .map(localRect);
          const spots = {
            right: [anchor.x + anchor.w + cfg.gap, anchor.cy - bh / 2],
            left: [anchor.x - cfg.gap - bw, anchor.cy - bh / 2],
            bottom: [anchor.cx - bw / 2, anchor.y + anchor.h + cfg.gap],
            top: [anchor.cx - bw / 2, anchor.y - cfg.gap - bh],
          };
          const order = ['right', 'bottom', 'left', 'top'];
          let bestClean = null;
          let bestCleanScore = Infinity;
          let bestAny = order[0];
          let bestAnyScore = Infinity;
          for (const key of order) {
            const [x, y] = spots[key];
            const clean = noteSpotClean(key, x, y, bw, bh, anchor, targetBox, f);
            const score = noteSpotScore(x, y, bw, bh, texts, targetBox, f);
            if (clean && score < bestCleanScore) {
              bestClean = key;
              bestCleanScore = score;
            }
            if (score < bestAnyScore) {
              bestAny = key;
              bestAnyScore = score;
            }
          }
          if (bestClean) {
            side = bestClean;
          } else {
            // 四个方向都会压住目标 / 把引线送进目标：说清楚，再退到压字最少的一侧。
            this._warnOnce(
              'note-fit',
              '的批注找不到既避开正文、又不让引线穿过目标的位置：已选压字最少的一侧。缩小批注、给目标周围留白，或显式写 side / x / y'
            );
            side = bestAny;
          }
        }
        const [x, y] = {
          right: [anchor.x + anchor.w + cfg.gap, anchor.cy - bh / 2],
          left: [anchor.x - cfg.gap - bw, anchor.cy - bh / 2],
          bottom: [anchor.cx - bw / 2, anchor.y + anchor.h + cfg.gap],
          top: [anchor.cx - bw / 2, anchor.y - cfg.gap - bh],
        }[side] || [anchor.cx - bw / 2, anchor.y - cfg.gap - bh];
        left = x;
        top = y;
      }
    } else if (!Number.isFinite(left) || !Number.isFinite(top)) {
      this._warnOnce('target', '没有 for 目标，也没有 x/y 坐标，批注不画');
      bd.style.display = 'none';
      return;
    }

    left = Math.round(Math.max(8, Math.min(f.w - bw - 8, left)));
    top = Math.round(Math.max(8, Math.min(f.h - bh - 8, top)));
    bd.style.left = left + 'px';
    bd.style.top = top + 'px';

    // 编号点就在目标里，没有"从泡到目标"的引线可画：再画就是一条穿进目标的短线。
    if (!anchor || cfg.leader === 'none' || pinned) return;
    // 引线必须落在目标边上，而不是目标中心：从边上出线，线就不会横穿目标行。
    // 显式 side 优先；x/y 或夹取把气泡挪到别处时，按最近的一侧重新选出口。
    let leadSide = side;
    if (leadSide === 'auto') leadSide = nearestNoteSide(left, top, bw, bh, anchor);
    if (targetBox) {
      const probe = noteLeaderPoints(leadSide, left, top, bw, bh, anchor, false);
      if (noteCrossesRect(probe.points, targetBox)) leadSide = nearestNoteSide(left, top, bw, bh, anchor);
    }
    const leader = noteLeaderPoints(leadSide, left, top, bw, bh, anchor, cfg.leader === 'straight');
    this._svg.append(tag('path', { d: leader.d, class: 'vk-pin-leader', fill: 'none', 'data-side': leadSide }));
    // 端点圆点：r=9（缩到 780 还有 3.7px）。6 在手机上只剩一粒灰，看不出"就是这里"。
    this._svg.append(tag('circle', { cx: leader.ex, cy: leader.ey, r: 9, class: 'vk-pin-dot' }));
  }
}

const NOTE_SIDES = new Set(['auto', 'top', 'right', 'bottom', 'left']);

/** 夹进 [lo, hi]；区间反了（目标比标注还小）就取 lo——坐标至少还在目标里。 */
function clampInto(v, lo, hi) {
  return hi < lo ? lo : Math.max(lo, Math.min(hi, v));
}

/** 盒子里缩 d 像素（同心）：双圈的内环用同一个圆心。 */
function insetBox(b, d) {
  const w = Math.max(0, b.w - d * 2);
  const h = Math.max(0, b.h - d * 2);
  return { x: b.x + d, y: b.y + d, w, h, cx: b.cx, cy: b.cy };
}

/** 气泡与目标的矩形是否有实质重叠（>4px 才算，避免边框贴边误判）。 */
function noteOverlap(x, y, w, h, r) {
  const ox = Math.min(x + w, r.right) - Math.max(x, r.left);
  const oy = Math.min(y + h, r.bottom) - Math.max(y, r.top);
  return ox > 4 && oy > 4 ? ox * oy : 0;
}

/** 出画面积：出画的位置不可能是"干净"的。 */
function noteOutside(x, y, w, h, f) {
  const outX = Math.max(0, -x) + Math.max(0, x + w - f.w);
  const outY = Math.max(0, -y) + Math.max(0, y + h - f.h);
  return outX + outY;
}

/** 候选位置压住多少字 + 压住目标多少；压目标是硬伤，权重远高于普通正文。 */
function noteSpotScore(x, y, bw, bh, texts, targetBox, f) {
  let area = 0;
  for (const t of texts) area += noteOverlap(x, y, bw, bh, t);
  if (targetBox) area += noteOverlap(x, y, bw, bh, targetBox) * 8;
  return area + noteOutside(x, y, bw, bh, f) * 400;
}

/**
 * 「干净」= 不出画、不压目标、引线不穿过目标。
 * 正文压字只影响排序，不算脏：批注在密集页面里总要压一点，否则会误报。
 */
function noteSpotClean(side, x, y, bw, bh, anchor, targetBox, f) {
  if (noteOutside(x, y, bw, bh, f) > 0.5) return false;
  if (noteOverlap(x, y, bw, bh, targetBox) > 0) return false;
  return !noteCrossesRect(noteLeaderPoints(side, x, y, bw, bh, anchor, false).points, targetBox);
}

/** 气泡相对目标在哪个方向；显式 x/y 与夹取之后用它挑最近的边。 */
function nearestNoteSide(left, top, bw, bh, anchor) {
  if (top + bh <= anchor.y) return 'top';
  if (top >= anchor.y + anchor.h) return 'bottom';
  if (left + bw <= anchor.x) return 'left';
  if (left >= anchor.x + anchor.w) return 'right';
  const gap = {
    top: anchor.y - (top + bh),
    bottom: top - (anchor.y + anchor.h),
    left: anchor.x - (left + bw),
    right: left - (anchor.x + anchor.w),
  };
  return Object.keys(gap).sort((a, b) => gap[b] - gap[a])[0];
}

/** 引线：从气泡边到目标边。折线只在目标之外拐弯，因此不会穿过目标矩形。 */
function noteLeaderPoints(side, left, top, bw, bh, anchor, straight) {
  const bx = left + bw / 2;
  const by = top + bh / 2;
  let sx;
  let sy;
  let ex;
  let ey;
  if (side === 'top') {
    sx = bx;
    sy = top + bh;
    ex = anchor.cx;
    ey = anchor.y;
  } else if (side === 'bottom') {
    sx = bx;
    sy = top;
    ex = anchor.cx;
    ey = anchor.y + anchor.h;
  } else if (side === 'left') {
    sx = left + bw;
    sy = by;
    ex = anchor.x;
    ey = anchor.cy;
  } else {
    sx = left;
    sy = by;
    ex = anchor.x + anchor.w;
    ey = anchor.cy;
  }
  let points;
  if (straight) {
    points = [
      [sx, sy],
      [ex, ey],
    ];
  } else if (side === 'top' || side === 'bottom') {
    const mid = (sy + ey) / 2;
    points = [
      [sx, sy],
      [sx, mid],
      [ex, mid],
      [ex, ey],
    ];
  } else {
    const mid = (sx + ex) / 2;
    points = [
      [sx, sy],
      [mid, sy],
      [mid, ey],
      [ex, ey],
    ];
  }
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'} ${Math.round(x)} ${Math.round(y)}`).join(' ');
  return { points, d, ex, ey };
}

/** 折线是否从矩形内部穿过（边界不算：引线本来就该落在边上）。 */
function noteCrossesRect(points, rect) {
  const inside = (x, y) => x > rect.left + 2 && x < rect.right - 2 && y > rect.top + 2 && y < rect.bottom - 2;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    for (let k = 1; k <= 20; k++) {
      const t = k / 20;
      if (inside(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
    }
  }
  return false;
}

/**
 * 折线有没有从盒子里穿过去（强制 side 写反时的症状）。
 * 旧 vk-edge 的实现，一字未动。
 */
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

/* ------------------------------------------------------------------ 定位帧 */

/**
 * 覆盖层的坐标系：为 circle / note 准备 stage，并把结果缓存在实例上。
 * 旧实现直接调 _frame()，这里保持同名行为。
 */
VkAnnotate.prototype._frame = function _frame() {
  if (!this._svg) return null;
  const f = stageOf(this);
  if (!f) return null;
  const { w, h } = f;
  if (this._svg.getAttribute('viewBox') !== `0 0 ${w} ${h}`) {
    this._svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this._svg.setAttribute('width', '100%');
    this._svg.setAttribute('height', '100%');
    this._svg.setAttribute('preserveAspectRatio', 'none');
  }
  // 圈选用：anchors 必须相对同一坐标系解析。
  this._svgHost = f.host;
  this._frameHost = f.host;
  this._frameRect = f.hr;
  return f;
};

VkAnnotate.prototype._box = function _box(rect, host, hr) {
  const b = visualToLocal(rect, hr, host.offsetWidth);
  return { ...b, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
};

/* ------------------------------------------------------------------ 注册 */

export function defineAnnotate() {
  define('vk-annotate', VkAnnotate);
}
