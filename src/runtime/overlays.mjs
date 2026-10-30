/**
 * L4 覆盖层：圈选 / 聚光 / 批注气泡。
 *
 * 三个标签都只画在包含块上，不改布局：
 *   <vk-ring for="#cells@byte:5" shape="ellipse" tone="err"></vk-ring>
 *   <vk-spotlight for="#code@line:7" dim="0.72"></vk-spotlight>
 *   <vk-pin for="#cells@cell:2" side="right" n="1">这里越界</vk-pin>
 *
 * 放进 vk-canvas 或 vk-page 正文；目标用 #id@part:arg 寻址。
 * 隐藏的镜头没有盒子，直接不画——和 vk-edge 一样。
 */
import { VK, EDGES, VkElement, define, numAttr, resolveAnchor, takeSlot, fillSlot } from './base.mjs';
import { visualToLocal } from './geometry.mjs';

const NS = 'http://www.w3.org/2000/svg';
const tag = (name, attrs = {}) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

function anchorsOf(el, host) {
  return (el.getAttribute('for') || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((expr) => resolveAnchor(host, expr, el))
    // 隐藏 / 零尺寸的目标没有可画的盒子；不要把它画到 (0,0)。
    .filter((a) => a && a.el && a.el.getClientRects().length);
}

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
 *         遮罩的 viewBox 会跟着一起缩，结果只盖住内容区，两侧 120 安全区留白
 *         （旧实现正是这样，实测第 9 帧的遮罩是一条灰带而不是整页压暗）。
 *         所以纸里的覆盖层直接挪成 .vk-page 的子节点，坐标就是 0..1920 / 0..1080。
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

/**
 * 舞台 = 覆盖层的坐标系。唯一一份。
 *
 * 为什么要折一次 offsetHeight：`vk-canvas` 这个自定义元素本身没有高度
 * （高在里面的 .vk-canvas 上），offsetHeight 是 0。谁拿它当"舞台高"去夹位置，
 * 结果就是所有覆盖层都被夹到顶上——放大镜的面板因此长期贴在画布顶边。
 */
function stageOf(el) {
  const host = hostOf(el);
  if (!host) return null;
  // 契约宿主 / 普通页面里，包含块不一定是定位元素；补一个 relative，绝对坐标才有基准。
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

/**
 * 目标自己那张图。放大镜不写 src 时用它——否则面板里会放一张跟目标无关的图，
 * 读者看到的"放大"其实是另一件事。
 */
function imageOf(el) {
  if (!el) return '';
  const own = (n) => (n.getAttribute?.('src') || '').trim();
  if (el.matches?.('vk-img, img')) return own(el);
  const inner = el.querySelector?.('vk-img, img');
  if (inner) return own(inner);
  const bg = getComputedStyle(el).backgroundImage || '';
  const m = /url\("?([^")]+)"?\)/.exec(bg);
  return m ? m[1] : '';
}

class VkOverlay extends VkElement {
  static frame = false;
  static watchSource = false;

  connectedCallback() {
    super.connectedCallback?.();
    EDGES.add(this);
  }

  render() {
    this._mount();
    this.draw();
    EDGES.add(this);
    VK._invalidate();
  }

  _mount() {
    if (this._mounted) return;
    this._mounted = true;
    this.style.position = 'absolute';
    this.style.inset = '0';
    this.style.pointerEvents = 'none';
    this.style.overflow = 'visible';
    this.dataset.vkOverlay = '';
    this._uid = 'vk' + Math.random().toString(36).slice(2, 9);
    this._svg = tag('svg', { class: 'vk-ov-svg', 'aria-hidden': 'true' });
    this.appendChild(this._svg);
  }

  _frame() {
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
    return f;
  }

  _box(rect, host, hr) {
    const b = visualToLocal(rect, hr, host.offsetWidth);
    return { ...b, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
  }

  _tone() {
    // 圈选默认是焦点（钴蓝），不是标注（石墨）：圈本身就是「看这里」。
    return this.getAttribute('tone') || 'focus';
  }

  draw() {
    this._svg?.replaceChildren();
  }
}

/* ------------------------------------------------------------------ ring */

export class VkRing extends VkOverlay {
  draw() {
    const f = this._frame();
    if (!f || !this._svg) return;
    this._svg.replaceChildren();
    const targets = anchorsOf(this, f.host);
    if (!targets.length) {
      this._warnOnce('target', '找不到 for 目标，圈选没有画');
      return;
    }
    this._svg.dataset.tone = this._tone();
    this.style.zIndex = String(numAttr(this, 'z', { min: 0, max: 99, fallback: 40 }));
    const pad = numAttr(this, 'pad-px', { min: 0, max: 80, fallback: 8 });
    const width = numAttr(this, 'stroke', { min: 1, max: 12, fallback: 4 });
    this._svg.style.setProperty('--vk-ring-w', width + 'px');
    if (this.hasAttribute('dash')) this._svg.dataset.dash = '1';
    else delete this._svg.dataset.dash;
    const shape = this.getAttribute('variant') || 'rect';

    for (const a of targets) {
      const b = this._box(a.rect, f.host, f.hr);
      if (shape === 'rect') {
        this._svg.append(
          tag('rect', {
            x: b.x - pad,
            y: b.y - pad,
            width: b.w + pad * 2,
            height: b.h + pad * 2,
            rx: 12,
            class: 'vk-ring-shape',
          })
        );
      } else if (shape === 'underline') {
        this._svg.append(
          tag('line', {
            x1: b.x - pad,
            y1: b.y + b.h + pad,
            x2: b.x + b.w + pad,
            y2: b.y + b.h + pad,
            class: 'vk-ring-shape',
          })
        );
      } else if (shape === 'bracket') {
        const y = b.y + b.h + pad;
        this._svg.append(
          tag('path', {
            d: `M ${b.x - pad} ${y} L ${b.x - pad} ${y + 12} L ${b.x + b.w + pad} ${y + 12} L ${b.x + b.w + pad} ${y}`,
            class: 'vk-ring-shape',
            fill: 'none',
          })
        );
      } else {
        this._svg.append(
          tag('ellipse', {
            cx: b.cx,
            cy: b.cy,
            rx: b.w / 2 + pad,
            ry: b.h / 2 + pad,
            class: 'vk-ring-shape',
          })
        );
      }
    }
  }
}

/* -------------------------------------------------------------- spotlight */

/**
 * 聚光 = 语境（context）控制器，不是一块遮罩。
 *
 * 13.0 之前它画一张盖满整页的半透明矩形：白纸上压暗变成灰板，白幕又等于没画，
 * 而且它自己还画一圈描边——和 vk-ring 输出同一圈像素。
 *
 * 现在的语义只有一句话：**目标这条路径保持原样，其它兄弟逐层退后**。
 * 做法是从目标往上走到纸，每层把"不是当前节点、也不包含目标"的兄弟设成 dim 透明度。
 * 不画任何图形，所以：白纸不会变灰、字不会被压糊、和 ring 不再是同一个东西。
 */
export class VkSpotlight extends VkOverlay {
  draw() {
    const f = this._frame();
    if (!f || !this._svg) return;
    this._svg.replaceChildren();
    // 上一轮退后的兄弟要还原，否则重复渲染会越叠越暗
    for (const el of this._dimmed || []) el.style.removeProperty('opacity');
    this._dimmed = [];

    const targets = anchorsOf(this, f.host);
    if (!targets.length) {
      this._warnOnce('target', '找不到 for 目标，聚光没有生效');
      return;
    }
    this.style.zIndex = String(numAttr(this, 'z', { min: 0, max: 99, fallback: 30 }));
    const dim = numAttr(this, 'dim', { min: 0, max: 1, fallback: 0.45 });
    const keepSel = (this.getAttribute('keep') || '').split(';').map((s) => s.trim()).filter(Boolean);
    const keep = new Set();
    for (const sel of keepSel) {
      try {
        for (const el of f.host.querySelectorAll(sel)) keep.add(el);
      } catch {
        /* 选择器写错就当没写，不炸页面 */
      }
    }
    const targetEls = new Set(targets.map((t) => t.el));
    const skip = (el) => el.hasAttribute('data-vk-overlay') || el.matches('vk-edge, vk-pin, vk-ring, vk-spotlight');
    const kept = (el) => skip(el) || keep.has(el) || [...keep].some((k) => el.contains(k));

    const seen = new Set();
    for (const a of targets) {
      let node = a.el;
      while (node && node !== f.host && node.parentElement) {
        for (const sib of node.parentElement.children) {
          if (sib === node || sib.contains(a.el) || seen.has(sib) || kept(sib)) continue;
          // 兄弟里还装着别的目标（多目标聚光）就也留着
          if ([...targetEls].some((t) => sib.contains(t))) continue;
          seen.add(sib);
          sib.style.opacity = String(dim);
          this._dimmed.push(sib);
        }
        node = node.parentElement;
      }
    }
    // 目标自身挂上 focus 姿态，让审计与度量看得见
    for (const el of targetEls) el.setAttribute('data-vk-focus', '');
    this._targets = targetEls;
  }
}

/* ------------------------------------------------------------------- pin */

export class VkPin extends VkOverlay {
  static slot = true;
  static slotHost = '.vk-pin-t';
  static renderedRoot = '.vk-pin-bd';

  _mount() {
    if (this._mounted) return;
    this._mounted = true;
    this.style.position = 'absolute';
    this.style.inset = '0';
    this.style.pointerEvents = 'none';
    this.style.overflow = 'visible';
    this.dataset.vkOverlay = '';
    this._uid = 'vk' + Math.random().toString(36).slice(2, 9);
    const nodes = takeSlot(this);
    const svg = tag('svg', { class: 'vk-ov-svg', 'aria-hidden': 'true' });
    const bd = document.createElement('div');
    bd.className = 'vk-pin-bd';
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

  render() {
    this._mount();
    this.style.zIndex = String(numAttr(this, 'z', { min: 0, max: 99, fallback: 60 }));
    this._bd.dataset.tone = this._tone();
    this._bd.dataset.variant = this.getAttribute('variant') === 'dot' ? 'dot' : 'bubble';
    this._bd.dataset.emphasis = this.getAttribute('emphasis') || 'soft';
    this._bd.dataset.size = this.getAttribute('size') || 'body';
    this._svg.dataset.tone = this._tone();
    const w = numAttr(this, 'w', { min: 160, max: 900, fallback: 360 });
    this._bd.style.width = w + 'px';
    const n = parseInt(this.getAttribute('n') || '0', 10);
    this._n.hidden = !(n > 0);
    this._n.textContent = n > 0 ? String(n) : '';
    this.draw();
    EDGES.add(this);
    VK._invalidate();
  }

  draw() {
    const f = this._frame();
    if (!f || !this._bd) return;
    this._svg.replaceChildren();
    const bd = this._bd;
    bd.style.display = '';
    bd.style.left = bd.style.top = '';
    const bw = bd.offsetWidth || 360;
    const bh = bd.offsetHeight || 120;
    const gap = numAttr(this, 'gap-px', { min: 0, max: 240, fallback: 24 });
    const target = resolveAnchor(f.host, this.getAttribute('for') || '', this);
    let left = numAttr(this, 'x', { min: -4000, max: 4000, fallback: NaN });
    let top = numAttr(this, 'y', { min: -4000, max: 4000, fallback: NaN });
    let anchor = null;

    if (target) {
      anchor = this._box(target.rect, f.host, f.hr);
      if (!Number.isFinite(left) || !Number.isFinite(top)) {
        let side = this.getAttribute('side') || 'auto';
        if (side === 'auto') {
          const rightRoom = f.w - (anchor.x + anchor.w);
          const leftRoom = anchor.x;
          const bottomRoom = f.h - (anchor.y + anchor.h);
          if (rightRoom >= bw + gap) side = 'right';
          else if (leftRoom >= bw + gap) side = 'left';
          else if (bottomRoom >= bh + gap) side = 'bottom';
          else side = 'top';
        }
        if (side === 'right') {
          left = anchor.x + anchor.w + gap;
          top = anchor.cy - bh / 2;
        } else if (side === 'left') {
          left = anchor.x - gap - bw;
          top = anchor.cy - bh / 2;
        } else if (side === 'bottom') {
          left = anchor.cx - bw / 2;
          top = anchor.y + anchor.h + gap;
        } else {
          left = anchor.cx - bw / 2;
          top = anchor.y - gap - bh;
        }
      }
    } else if (!Number.isFinite(left) || !Number.isFinite(top)) {
      this._warnOnce('target', '没有 for 目标，也没有 x/y 坐标，批注不画');
      bd.style.display = 'none';
      return;
    }

    left = Math.max(8, Math.min(f.w - bw - 8, left));
    top = Math.max(8, Math.min(f.h - bh - 8, top));
    bd.style.left = Math.round(left) + 'px';
    bd.style.top = Math.round(top) + 'px';

    if (!anchor || this.getAttribute('leader') === 'none') return;
    // 气泡哪一边离目标近，就从哪一边出线；线只做"归属"，不做方向。
    const bx = left + bw / 2;
    const by = top + bh / 2;
    const sx = bx < anchor.cx ? left + bw : left;
    const sy = by;
    const ex = anchor.cx;
    const ey = anchor.cy;
    const straight = this.getAttribute('leader') === 'straight';
    const d = straight
      ? `M ${sx} ${sy} L ${ex} ${ey}`
      : sx <= ex
        ? `M ${sx} ${sy} L ${Math.round((sx + ex) / 2)} ${sy} L ${Math.round((sx + ex) / 2)} ${ey} L ${ex} ${ey}`
        : `M ${sx} ${sy} L ${Math.round((sx + ex) / 2)} ${sy} L ${Math.round((sx + ex) / 2)} ${ey} L ${ex} ${ey}`;
    this._svg.append(tag('path', { d, class: 'vk-pin-leader', fill: 'none' }));
    this._svg.append(tag('circle', { cx: ex, cy: ey, r: 6, class: 'vk-pin-dot' }));
  }
}


/* ----------------------------------------------------------------- loupe */

/**
 * 放大镜：把目标图上的某一小块放大给人看。
 * 它不复制图，只把同一张图按 zoom 放大后平移到面板里——
 * 所以放大出来的像素和原图是同一份，不会糊。
 *
 * 两件事必须同时成立，读者才知道"放大的是哪一块"：
 *   ① 面板不压在它要放大的那一块上（side 默认 auto，挑放得下的那一侧）；
 *   ② 目标上留一个圈，圈住的正好是面板里那一块（spot，默认开）。
 */
export class VkLoupe extends VkElement {
  static frame = false;
  static watchSource = false;

  connectedCallback() {
    super.connectedCallback?.();
    EDGES.add(this);
  }

  /**
   * 舞台还没排出来时（画布刚连上、图片还没解码）先别画，等下一帧再来。
   * 覆盖层只在连上 DOM 的那一刻被调一次，没人会替它补画，
   * 所以"量不到就不画"必须自带重试。
   */
  _retry() {
    this._retries = (this._retries || 0) + 1;
    if (this._retries > 60) return;
    const again = () => {
      if (this.isConnected) this.draw();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(again);
    else setTimeout(again, 16);
  }

  render() {
    this.style.position = 'absolute';
    this.style.inset = '0';
    this.style.pointerEvents = 'none';
    this.dataset.vkOverlay = '';
    this.draw();
    EDGES.add(this);
    VK._invalidate();
  }

  _clear() {
    for (const sel of ['.vk-loupe', '.vk-loupe-spot', '.vk-loupe-l']) {
      this.querySelector(sel)?.remove();
    }
  }

  draw() {
    const f = stageOf(this);
    if (!f) {
      this._retry();
      return;
    }
    const target = anchorsOf(this, f.host)[0];
    this._retries = 0;
    if (!target) {
      // 目标没了（写错 id / 被藏起来）：把画过的撤掉，别留一个过期的面板。
      this._clear();
      this._warnOnce('target', '找不到 for 目标，放大镜没有画');
      return;
    }
    // 不写 src 就放大目标自己那张图：放大镜指向谁就放大谁。
    // 手写 src 只留给"目标只是占位、真图在别处"的那种情况。
    const src = this.getAttribute('src') || imageOf(target.el);
    if (!src) {
      this._clear();
      this._warnOnce('src', '放大镜缺 src：目标不是图，也没有写 src');
      return;
    }

    const t = visualToLocal(target.rect, f.hr, f.host.offsetWidth);
    const at = (this.getAttribute('point') || '50%,50%').split(',').map((v) => parseFloat(v));
    const fx = Math.min(100, Math.max(0, Number.isFinite(at[0]) ? at[0] : 50)) / 100;
    const fy = Math.min(100, Math.max(0, Number.isFinite(at[1]) ? at[1] : 50)) / 100;

    const size = numAttr(this, 'size', { min: 80, max: 640, fallback: 240 });
    const zoom = numAttr(this, 'zoom', { min: 1.2, max: 8, fallback: 2.4 });
    const gap = numAttr(this, 'gap-px', { min: 0, max: 200, fallback: 24 });
    const z = numAttr(this, 'z', { min: 0, max: 99, fallback: 50 });
    const side = this.getAttribute('side') || 'auto';
    const shape = this.getAttribute('variant') || 'circle';

    // 面板放在目标的哪一侧。auto = 挑第一个放得下的边，都放不下就挑最宽的那边。
    const room = {
      right: f.w - (t.x + t.w) - gap,
      left: t.x - gap,
      bottom: f.h - (t.y + t.h) - gap,
      top: t.y - gap,
    };
    let pick = side;
    if (pick === 'auto') {
      pick = ['right', 'left', 'bottom', 'top'].find((k) => room[k] >= size) || null;
      if (!pick) {
        const widest = ['right', 'left', 'bottom', 'top'].sort((a, b) => room[b] - room[a])[0];
        pick = widest;
      }
    }
    let left;
    let top;
    if (pick === 'left') {
      left = t.x - gap - size;
      top = t.y + t.h / 2 - size / 2;
    } else if (pick === 'top') {
      left = t.x + t.w / 2 - size / 2;
      top = t.y - gap - size;
    } else if (pick === 'bottom') {
      left = t.x + t.w / 2 - size / 2;
      top = t.y + t.h + gap;
    } else if (pick === 'inside') {
      left = t.x + t.w - size - gap;
      top = t.y + gap;
    } else {
      left = t.x + t.w + gap;
      top = t.y + t.h / 2 - size / 2;
    }
    left = Math.max(0, Math.min(f.w - size, left));
    top = Math.max(0, Math.min(f.h - size, top));

    // 放大后在目标本地坐标系里的像素位置；让它落在面板正中
    const bgW = t.w * zoom;
    const bgH = t.h * zoom;
    const px = fx * bgW;
    const py = fy * bgH;

    // 圈住被放大的那一块。直径 = 面板直径 / zoom，和面板里看到的范围一致；
    // 太小就看不见，太大就盖住半张图，两头都要管住。
    const d = Math.round(Math.min(Math.max(24, size / zoom), Math.min(t.w, t.h) * 0.9));
    let spot = this.querySelector('.vk-loupe-spot');
    if (this.getAttribute('spot') === 'none') {
      spot?.remove();
      spot = null;
    } else {
      if (!spot) {
        spot = document.createElement('div');
        spot.className = 'vk-loupe-spot';
        this.appendChild(spot);
      }
      spot.style.left = Math.round(t.x + fx * t.w - d / 2) + 'px';
      spot.style.top = Math.round(t.y + fy * t.h - d / 2) + 'px';
      spot.style.width = d + 'px';
      spot.style.height = d + 'px';
      spot.style.zIndex = String(Math.max(1, z - 1));
    }

    const panel = this.querySelector('.vk-loupe') || document.createElement('div');
    panel.className = 'vk-loupe';
    panel.dataset.shape = shape;
    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
    panel.style.width = size + 'px';
    panel.style.height = size + 'px';
    panel.style.backgroundImage = `url("${src.replace(/"/g, '')}")`;
    panel.style.backgroundSize = `${Math.round(bgW)}px ${Math.round(bgH)}px`;
    panel.style.backgroundPosition = `${Math.round(size / 2 - px)}px ${Math.round(size / 2 - py)}px`;
    panel.style.zIndex = String(z);
    if (!panel.parentElement) this.appendChild(panel);

    // 标注是面板的兄弟，不是子元素：面板要 overflow:hidden 裁圆形，标注得在外面才不被裁。
    let cap = this.querySelector('.vk-loupe-l');
    const label = this.getAttribute('label');
    if (label) {
      if (!cap) {
        cap = document.createElement('div');
        cap.className = 'vk-loupe-l';
        this.appendChild(cap);
      }
      cap.textContent = label;
      // 标注跟着面板走，但要夹在舞台里——面板贴边时标注不能跑出去。
      // 而且它是文字：纸两侧各 120 的安全区必须留出来，不能跟着面板贴到纸边。
      // 宽度量真的，不假设"大概 196"。
      const half = Math.max(60, (cap.offsetWidth || 196) / 2);
      const inset = f.w >= 1600 ? 120 : 8;
      const cx = Math.min(f.w - inset - half, Math.max(inset + half, left + size / 2));
      // 面板下面放不下就翻到上面去，宁可换边也不压住图。
      const below = top + size + 8;
      const cy = below + 40 > f.h ? top - 40 : below;
      cap.style.left = Math.round(cx) + 'px';
      cap.style.top = Math.round(cy) + 'px';
      cap.style.transform = 'translateX(-50%)';
    } else if (cap) cap.remove();
  }
}

export function defineOverlays() {
  define('vk-ring', VkRing);
  define('vk-spotlight', VkSpotlight);
  define('vk-pin', VkPin);
  define('vk-loupe', VkLoupe);
}



