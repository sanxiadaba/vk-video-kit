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
    const host = hostOf(this);
    if (!host) return null;
    // 契约宿主 / 普通页面里，包含块不一定是定位元素；补一个 relative，绝对坐标才有基准。
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const hr = host.getBoundingClientRect();
    if (hr.width < 1 || hr.height < 1) return null;
    const w = Math.round(host.offsetWidth) || Math.round(hr.width);
    const h = Math.round(host.offsetHeight) || Math.round(hr.height);
    if (this._svg.getAttribute('viewBox') !== `0 0 ${w} ${h}`) {
      this._svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this._svg.setAttribute('width', '100%');
      this._svg.setAttribute('height', '100%');
      this._svg.setAttribute('preserveAspectRatio', 'none');
    }
    return { host, hr, w, h };
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

export function defineOverlays() {
  define('vk-ring', VkRing);
  define('vk-spotlight', VkSpotlight);
  define('vk-pin', VkPin);
}


