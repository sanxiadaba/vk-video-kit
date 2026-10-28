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
    .filter(Boolean);
}

function rootOf(el) {
  return el.closest('vk-canvas, vk-page, [data-vk-frame]') || el.parentElement;
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
    const host = rootOf(this);
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
    return this.getAttribute('tone') || 'accent';
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
    const width = numAttr(this, 'width', { min: 1, max: 12, fallback: 4 });
    this._svg.style.setProperty('--vk-ring-w', width + 'px');
    if (this.hasAttribute('dash')) this._svg.dataset.dash = '1';
    else delete this._svg.dataset.dash;
    const shape = this.getAttribute('variant') || 'ellipse';

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

export class VkSpotlight extends VkOverlay {
  draw() {
    const f = this._frame();
    if (!f || !this._svg) return;
    this._svg.replaceChildren();
    const targets = anchorsOf(this, f.host);
    if (!targets.length) {
      this._warnOnce('target', '找不到 for 目标，聚光没有画');
      return;
    }
    this.style.zIndex = String(numAttr(this, 'z', { min: 0, max: 99, fallback: 30 }));
    const dim = numAttr(this, 'dim', { min: 0, max: 1, fallback: 0.72 });
    const feather = numAttr(this, 'feather', { min: 0, max: 120, fallback: 24 });
    const shape = this.getAttribute('variant') === 'ellipse' ? 'ellipse' : 'rect';
    const maskId = `${this._uid}-m`;
    const filterId = `${this._uid}-f`;
    const defs = tag('defs');
    if (feather > 0) {
      const filter = tag('filter', { id: filterId, x: '-25%', y: '-25%', width: '150%', height: '150%' });
      filter.append(tag('feGaussianBlur', { stdDeviation: feather / 2 }));
      defs.append(filter);
    }
    const mask = tag('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: f.w, height: f.h });
    mask.append(tag('rect', { x: 0, y: 0, width: f.w, height: f.h, fill: 'white' }));
    const holes = tag('g', feather > 0 ? { filter: `url(#${filterId})` } : {});
    for (const a of targets) {
      const b = this._box(a.rect, f.host, f.hr);
      const pad = 10;
      if (shape === 'ellipse') {
        holes.append(tag('ellipse', { cx: b.cx, cy: b.cy, rx: b.w / 2 + pad, ry: b.h / 2 + pad, fill: 'black' }));
      } else {
        holes.append(tag('rect', { x: b.x - pad, y: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2, rx: 12, fill: 'black' }));
      }
    }
    mask.append(holes);
    defs.append(mask);
    this._svg.append(defs);
    const outline = tag('g', { class: 'vk-spotlight-ring' });
    for (const a of targets) {
      const b = this._box(a.rect, f.host, f.hr);
      const pad = 10;
      if (shape === 'ellipse') {
        outline.append(tag('ellipse', { cx: b.cx, cy: b.cy, rx: b.w / 2 + pad, ry: b.h / 2 + pad }));
      } else {
        outline.append(tag('rect', { x: b.x - pad, y: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2, rx: 12 }));
      }
    }
    this._svg.append(
      tag('rect', {
        x: 0,
        y: 0,
        width: f.w,
        height: f.h,
        fill: '#ffffff',
        opacity: dim,
        mask: `url(#${maskId})`,
      })
    );
    this._svg.append(outline);
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
    this._bd.dataset.emphasis = this.getAttribute('emphasis') || 'soft';
    this._bd.dataset.size = this.getAttribute('size') || 'body';
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
      this._warnOnce('target', '没有 for 目标，也没有 x/y 坐标，批注停在左上角');
      left = 8;
      top = 8;
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
