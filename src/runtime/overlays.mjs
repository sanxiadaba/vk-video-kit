/**
 * L4 旧标签别名：vk-pin / vk-ring。
 *
 * 减法第一波：
 *   vk-pin  → vk-note kind="bubble"（同一个泡 + 引线，同一个 .vk-pin-bd）
 *   vk-ring → vk-box ring（描边强调不占布局；宿主仍铺满包含块、按 for 定位）
 *
 * 旧标签继续可用，构建期会给一条"已合并到 X，旧名保留"的迁移提示。
 *
 *   <vk-pin for="#cells@cell:2" side="right" n="1">这里越界</vk-pin>
 *   <vk-ring for="#code" variant="rect" pad-px="16" tone="info"></vk-ring>
 *   <vk-ring variant="dim" for="#code@line:7" dim="0.72" keep="vk-title"></vk-ring>
 */
import { EDGES, define, numAttr, resolveAnchor } from './base.mjs';
import { visualToLocal } from './geometry.mjs';
import { applyDim } from './annotate.mjs';
import { VkNote } from './note.mjs';
import { VkBox } from './elements.mjs';

/* ------------------------------------------------------------------- pin */

export class VkPin extends VkNote {
  static watchSource = false;

  connectedCallback() {
    super.connectedCallback?.();
    this.dataset.vkAlias = 'vk-note';
  }

  /** 旧标签只有气泡这一种形态。 */
  _kind() {
    return 'bubble';
  }

  /** 旧 vk-pin 的避让只认正文元素；保持原查询，避免像素漂移。 */
  _avoidTextSelector() {
    return 'vk-text, p, h1, h2, h3, li';
  }

  /** 旧词 variant="dot" 是"只留编号点"，对应 .vk-pin-bd[data-variant='dot']。 */
  _noteForm(mode) {
    return this.getAttribute('variant') === 'dot' ? 'dot' : 'bubble';
  }

  _noteConfig(mode) {
    const cfg = super._noteConfig(mode);
    cfg.form = this.getAttribute('variant') === 'dot' ? 'dot' : 'bubble';
    cfg.tone = this.getAttribute('tone') || 'info';
    cfg.strength = this.getAttribute('strength') || 'soft';
    cfg.size = this.getAttribute('size') || 'body';
    cfg.n = parseInt(this.getAttribute('n') || '0', 10);
    cfg.x = numAttr(this, 'x', { min: -4000, max: 4000, fallback: NaN });
    cfg.y = numAttr(this, 'y', { min: -4000, max: 4000, fallback: NaN });
    cfg.side = this.getAttribute('side') || 'auto';
    cfg.leader = this.getAttribute('leader') || 'elbow';
    cfg.z = numAttr(this, 'z', { min: 0, max: 99, fallback: 60 });
    cfg.gap = numAttr(this, 'gap', { min: 0, max: 240, fallback: 24 });
    return cfg;
  }
}

/* ------------------------------------------------------------------ ring */

/** tone → 环色 token；不写就是焦点色（"看这里"）。 */
const RING_TONE = {
  focus: 'var(--vk-focus)',
  info: 'var(--vk-info)',
  err: 'var(--vk-err)',
  ok: 'var(--vk-ok)',
  warn: 'var(--vk-warn)',
  neutral: 'var(--vk-ink-1)',
};

/**
 * 圈选：一块带环的面，按 for 贴到目标上。
 *
 * 它不再是另一个 SVG 形状库：几何就是"目标盒 + pad-px"的一个 box，
 * 环是 box 的描边（ring 的转义）。variant 只改圆角 / 只画哪条边。
 * variant="dim" 保留原行为（压暗兄弟，而不是画一个环）。
 */
export class VkRing extends VkBox {
  static watchSource = false;

  connectedCallback() {
    super.connectedCallback?.();
    this.dataset.vkAlias = 'vk-box';
    this.dataset.vkOverlay = '';
    EDGES.add(this);
  }

  _variant() {
    const v = this.getAttribute('variant') || 'rect';
    return ['ellipse', 'rect', 'underline', 'bracket', 'dim'].includes(v) ? v : 'rect';
  }

  render() {
    const variant = this._variant();
    this.dataset.variant = variant;
    // 压暗不画自己：它只改兄弟的 opacity（原 vk-ring variant="dim" 的能力）。
    this.style.display = variant === 'dim' ? 'none' : '';
    if (variant === 'dim') this.replaceChildren();
    EDGES.add(this);
  }

  draw() {
    if (!this.isConnected) return;
    const variant = this._variant();
    if (variant === 'dim') {
      applyDim(this);
      return;
    }
    const host = this._host();
    if (!host) return;
    const hr = host.getBoundingClientRect();
    if (hr.width < 1 || hr.height < 1) return;
    const expr = this.getAttribute('for') || '';
    const anchor = expr ? resolveAnchor(host, expr, this) : null;
    if (!anchor || !anchor.el || !anchor.el.getClientRects().length) {
      this.style.display = 'none';
      this._warnOnce('target', '找不到 for 目标，圈选没有画');
      return;
    }
    this.style.display = '';
    const b = visualToLocal(anchor.rect, hr, host.offsetWidth);
    const pad = numAttr(this, 'pad', { min: 0, max: 80, fallback: 8 });
    const stroke = numAttr(this, 'stroke', { min: 1, max: 12, fallback: 4 });
    const tone = RING_TONE[this.getAttribute('tone')] || RING_TONE.focus;
    const dash = this.hasAttribute('dash') ? 'dashed' : 'solid';
    const z = numAttr(this, 'z', { min: 0, max: 99, fallback: 40 });

    const s = this.style;
    s.position = 'absolute';
    s.boxSizing = 'border-box';
    s.zIndex = String(z);
    s.pointerEvents = 'none';
    s.border = '0';
    s.borderRadius = '0';
    // 一个环 = 一条描边；underline / bracket 只留一条边（原来是 SVG 线）。
    if (variant === 'underline' || variant === 'bracket') {
      const h = Math.max(12, pad);
      s.left = Math.round(b.x - pad) + 'px';
      s.top = Math.round(b.y + b.h + (variant === 'bracket' ? 0 : pad)) + 'px';
      s.width = Math.round(b.w + pad * 2) + 'px';
      s.height = h + 'px';
      s.borderTop = `${stroke}px ${dash} ${tone}`;
      s.borderBottom = variant === 'bracket' ? `${stroke}px ${dash} ${tone}` : '0';
    } else {
      s.left = Math.round(b.x - pad) + 'px';
      s.top = Math.round(b.y - pad) + 'px';
      s.width = Math.round(b.w + pad * 2) + 'px';
      s.height = Math.round(b.h + pad * 2) + 'px';
      s.border = `${stroke}px ${dash} ${tone}`;
      s.borderRadius = variant === 'ellipse' ? '50%' : '12px';
    }
  }

  /** 覆盖层的坐标系：画布 / 纸 / 最近的定位祖先（与 vk-annotate 一致）。 */
  _host() {
    if (this.parentElement?.closest?.('vk-canvas')) {
      let p = this.parentElement;
      while (p && getComputedStyle(p).position === 'static') p = p.parentElement;
      return p || document.body;
    }
    const page = this.parentElement?.closest?.('.vk-page');
    if (page) {
      if (this.parentElement !== page) page.appendChild(this);
      return page;
    }
    let host = this.parentElement;
    while (host && getComputedStyle(host).position === 'static') host = host.parentElement;
    if (!host) host = document.body;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    return host;
  }
}

export function defineOverlays() {
  define('vk-ring', VkRing);
  define('vk-pin', VkPin);
}
