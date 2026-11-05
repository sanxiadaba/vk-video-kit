/* ============================================================================
   v17 · 运行期底座
   ----------------------------------------------------------------------------
   三件事：属性怎么读（spec）、画布怎么量（stage）、关系怎么指（anchor）。
   组件只有一种 DOM 形状：宿主 > .vk-hd? + .vk-bd > 作者内容。
   ========================================================================== */

import { GAP, CANVAS } from '../vocab.mjs';
import { TAGS, attrsOf, observedOf } from '../schema.mjs';

const HAS_DOM = typeof document !== 'undefined';
const Base = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

export const VK = ((typeof window !== 'undefined' ? window : globalThis).vk ||= {});
VK.version = typeof __VK_VERSION__ !== 'undefined' ? __VK_VERSION__ : 'dev';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const nextFrame = () =>
  new Promise((done) => {
    let fired = false;
    const fin = () => {
      if (fired) return;
      fired = true;
      done();
    };
    if (typeof requestAnimationFrame === 'function' && !document.hidden) requestAnimationFrame(fin);
    setTimeout(fin, 32);
  });

/* ---------------------------------------------------------------- 读属性 */

const specOf = (el, name) => TAGS[el.localName] && attrsOf(el.localName)[name];

export function attrRaw(el, name) {
  const v = el.getAttribute(name);
  return v == null || v === '' ? null : v;
}

export function attrText(el, name, fallback = '') {
  const v = attrRaw(el, name);
  return v == null ? fallback : v;
}

export function attrBool(el, name) {
  return el.hasAttribute(name);
}

export function attrEnum(el, name, fallback) {
  const v = attrRaw(el, name);
  if (v == null) return specOf(el, name)?.default ?? fallback;
  const spec = specOf(el, name);
  if (spec?.values && !spec.values.includes(v)) {
    warn(el, `${name}="${v}" 不在词表里（${spec.values.join(' / ')}），按 ${spec.default ?? fallback} 处理`);
    return spec.default ?? fallback;
  }
  return v;
}

/** 数字：范围只从 schema 读，组件里不再各写一份 clamp。 */
export function attrNum(el, name, fallback = 0) {
  const v = attrRaw(el, name);
  const spec = specOf(el, name);
  if (v == null) return spec?.default ?? fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    warn(el, `${name}="${v}" 不是数字`);
    return spec?.default ?? fallback;
  }
  const min = spec?.min ?? -Infinity;
  const max = spec?.max ?? Infinity;
  if (n < min || n > max) {
    const c = Math.min(max, Math.max(min, n));
    warn(el, `${name}="${v}" 超出 ${min}…${max}，按 ${c} 处理`);
    return c;
  }
  return n;
}

/** 索引：1 起，-1 = 没有当前。 */
export function attrIndex(el, name, fallback = -1) {
  const n = attrNum(el, name, fallback);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** 行段："4-6" / "4,7,9" / "4-"（到底）。返回 1 起的行号 Set 或 null。 */
export function attrLines(el, name) {
  const v = attrRaw(el, name);
  if (v == null) return null;
  const out = new Set();
  for (const piece of v.split(',')) {
    const tok = piece.trim();
    if (!tok) continue;
    const m = tok.match(/^(\d+)\s*(?:-\s*(\d+)?)?$/);
    if (!m) continue;
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]) || from + 200;
    for (let i = from; i <= to; i++) out.add(i);
  }
  return out;
}

/** 间距：档名或像素。 */
export function attrSpace(el, name, fallback) {
  const v = attrRaw(el, name);
  const def = specOf(el, name)?.default ?? fallback;
  return spaceCss(v == null ? def : v);
}

export function spaceCss(raw) {
  const text = String(raw ?? '').trim().toLowerCase();
  if (!text) return '';
  if (text === 'none' || text === '0') return '0px';
  if (text in GAP) return `${GAP[text]}px`;
  const n = Number(text.replace(/px$/, ''));
  return Number.isFinite(n) ? `${n}px` : '';
}

export function readData(el) {
  const s = el.querySelector(':scope > script[data-vk]');
  if (!s) return null;
  try {
    return JSON.parse(s.textContent);
  } catch {
    return null;
  }
}

export function warn(el, message) {
  const key = message.slice(0, 60);
  el._warned ||= new Set();
  if (el._warned.has(key)) return;
  el._warned.add(key);
  console.warn(`[vk] <${el.localName}> ${message}`, el);
}

/* ---------------------------------------------------------------- 画布 */

export function stageOf(el) {
  return el.closest?.('.vk-stage') || document.querySelector('.vk-stage');
}

export function stageScale(stageEl) {
  const r = stageEl.getBoundingClientRect();
  return stageEl.offsetWidth ? r.width / stageEl.offsetWidth : 1;
}

/**
 * 墨迹矩形：元素里"真正有字"的那一块。
 * 圈一行代码时，行盒是 1680 宽，字只有 400 —— 圈要照着字走。
 */
export function inkRect(el) {
  const base = el.getBoundingClientRect();
  let out = null;
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width < 0.5 || r.height < 0.5) continue;
      out = out
        ? {
            left: Math.min(out.left, r.left),
            top: Math.min(out.top, r.top),
            right: Math.max(out.right, r.right),
            bottom: Math.max(out.bottom, r.bottom),
          }
        : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
  }
  if (!out) return base;
  return { left: out.left, top: out.top, right: out.right, bottom: out.bottom, width: out.right - out.left, height: out.bottom - out.top };
}

/* ---------------------------------------------------------------- 锚点 */

const PARTS = ['line', 'cell', 'byte', 'bit', 'addr', 'step', 'event', 'lane', 'row', 'node', 'item'];

const cssEscape = (s) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&'));

export function resolveTarget(root, expr, owner) {
  const raw = String(expr ?? '').trim();
  if (!raw || !root) return null;
  const at = raw.indexOf('@');
  if (raw.startsWith('#') && at > 1) {
    const id = raw.slice(1, at);
    const [part, ...args] = raw.slice(at + 1).split(':');
    const host = safeQuery(root, `#${cssEscape(id)}`, owner);
    if (!host) return null;
    if (part === 'line') {
      const n = (args[0] || '').trim();
      return host.querySelector(`[data-vk-line="${cssEscape(n)}"]`) || null;
    }
    if (!PARTS.includes(part)) {
      warn(owner, `不支持 @${part}；可用 ${PARTS.join(' / ')}`);
      return null;
    }
    const want = args.join(':');
    return host.querySelector(`[data-vk-${part}="${cssEscape(want)}"]`) || null;
  }
  return safeQuery(root, raw, owner);
}

export function safeQuery(root, sel, owner) {
  try {
    return root.querySelector(sel);
  } catch {
    warn(owner, `"${sel}" 不是有效选择器`);
    return null;
  }
}

export function resolveAnchor(root, expr, owner) {
  const raw = String(expr ?? '').trim();
  const at = raw.indexOf('@');
  if (raw.startsWith('#') && at > 1) {
    const part = raw.slice(at + 1).split(':')[0];
    if (part === 'point' || part === 'side' || part === 'region') {
      const id = raw.slice(1, at);
      const host = safeQuery(root, `#${cssEscape(id)}`, owner);
      if (!host) return null;
      const r = host.getBoundingClientRect();
      const argsRaw = raw.slice(at + part.length + 2);
      if (part === 'side') {
        const side = argsRaw.trim();
        if (!['top', 'right', 'bottom', 'left'].includes(side)) return null;
        const rect = { left: r.left, top: r.top, width: 0, height: 0 };
        if (side === 'right') rect.left = r.right;
        if (side === 'bottom') rect.top = r.bottom;
        if (side === 'left' || side === 'right') rect.top = r.top + r.height / 2;
        else rect.left = r.left + r.width / 2;
        return { el: host, rect, side };
      }
      const args = argsRaw.split(',').map((s) => parseFloat(s));
      if (args.some((n) => !Number.isFinite(n))) return null;
      const [x, y, w = 0, h = 0] = args.map((n) => Math.max(0, Math.min(100, n)));
      const rect =
        part === 'point'
          ? { left: r.left + (r.width * x) / 100, top: r.top + (r.height * y) / 100, width: 0, height: 0 }
          : {
              left: r.left + (r.width * x) / 100,
              top: r.top + (r.height * y) / 100,
              width: (r.width * w) / 100,
              height: (r.height * h) / 100,
            };
      return { el: host, rect, side: null };
    }
    if (part === 'line') {
      const el = resolveTarget(root, raw, owner);
      if (!el) return null;
      return { el, rect: inkRect(el), side: null };
    }
  }
  const el = resolveTarget(root, raw, owner);
  return el ? { el, rect: el.getBoundingClientRect(), side: null } : null;
}

/* ---------------------------------------------------------------- 子节点 */

export function takeSlot(el) {
  if (el._slot) return el._slot;
  el._slot = [...el.childNodes].filter((n) => {
    if (n.nodeType === 3) return !!n.textContent.trim();
    if (n.nodeType !== 1) return false;
    return n.tagName !== 'SCRIPT' && !n.hasAttribute('data-vk');
  });
  return el._slot;
}

export function fillSlot(host, nodes) {
  for (const n of nodes || []) host.appendChild(n);
  return host;
}

/* ---------------------------------------------------------------- 布局 */

export const PLACE = (VK._place ||= new Set());
export const EDGES = (VK._edges ||= new Set());

export function layout() {
  if (!HAS_DOM) return;
  for (const el of PLACE) {
    if (!el.isConnected) {
      PLACE.delete(el);
      continue;
    }
    try {
      el.place?.();
    } catch (e) {
      el.fail?.(e);
    }
  }
  for (const el of EDGES) {
    if (!el.isConnected) {
      EDGES.delete(el);
      continue;
    }
    try {
      el.draw?.();
    } catch (e) {
      el.fail?.(e);
    }
  }
}

let pending = 0;
let timer = 0;
VK.invalidate = () => {
  if (pending) return;
  const run = () => {
    if (!pending) return;
    if (pending > 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(pending);
    clearTimeout(timer);
    pending = 0;
    layout();
  };
  pending = typeof requestAnimationFrame === 'function' && !document.hidden ? requestAnimationFrame(run) : 1;
  timer = setTimeout(run, 64);
};

/* ---------------------------------------------------------------- 基类 */

export class VkElement extends Base {
  static get observedAttributes() {
    return this.__observed || [];
  }

  constructor() {
    super();
    this._painted = false;
    this._paintQueued = false;
    this._warned = new Set();
    this._slot = null;
    this._place = false;
  }

  connectedCallback() {
    if (!HAS_DOM) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.isConnected && this._paint(), { once: true });
      return;
    }
    this._paint();
  }

  attributeChangedCallback(name, oldV, newV) {
    if (oldV === newV || !this._painted || !this.isConnected) return;
    if (this._paintQueued) return;
    this._paintQueued = true;
    queueMicrotask(() => {
      this._paintQueued = false;
      if (this.isConnected) this._paint();
    });
  }

  _paint() {
    try {
      this.render?.();
      this.frame();
      this._painted = true;
      if (this.place) this.registerPlace();
      if (this.draw) this.registerEdge();
      VK.invalidate();
    } catch (e) {
      this.fail(e);
    }
  }

  registerPlace() {
    if (this._place) return;
    this._place = true;
    PLACE.add(this);
  }

  registerEdge() {
    EDGES.add(this);
  }

  fail(e) {
    this.dataset.vkError = '1';
    (VK._errors ||= []).push({ el: this, error: e });
    console.error(`[vk] <${this.localName}> 渲染失败：${e?.message || e}`, e);
  }

  stale(what) {
    this.dataset.vkStale = '1';
    warn(this, `${what}。运行 vk render 重新生成。`);
  }

  /** 画布子项：w / h / x / y / z 的**唯一**写者。 */
  frame() {
    const host = this.parentElement;
    if (!host || host.localName !== 'vk-canvas') return;
    if (this.hasAttribute('z')) this.style.zIndex = String(attrNum(this, 'z'));
    if (this.hasAttribute('x')) this.style.left = `${attrNum(this, 'x')}px`;
    if (this.hasAttribute('y')) this.style.top = `${attrNum(this, 'y')}px`;
    if (this.hasAttribute('w')) this.style.width = `${attrNum(this, 'w')}px`;
    if (this.hasAttribute('h')) this.style.height = `${attrNum(this, 'h')}px`;
    this.style.position = 'absolute';
  }
}

export function define(tag, ctor) {
  if (!TAGS[tag]) throw new Error(`[vk] 未注册的标签：${tag}`);
  ctor.__observed = observedOf(tag);
  (VK._defs ||= new Set()).add(tag);
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

/* ---------------------------------------------------------------- 就绪 */

VK.layout = layout;

VK.ready = async () => {
  if (!HAS_DOM) return true;
  if (document.readyState === 'loading') {
    await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }
  const tags = Object.keys(TAGS).join(',');
  const deadline = Date.now() + 15000;
  let quiet = 0;
  while (Date.now() < deadline) {
    const unready = [...document.querySelectorAll(tags)].some((el) => el.isConnected && !el._painted);
    await nextFrame();
    if (!unready && ![...document.querySelectorAll(tags)].some((el) => el.isConnected && !el._painted)) {
      if (++quiet >= 2) break;
    } else quiet = 0;
  }
  await document.fonts?.ready;
  await Promise.all([...document.images].map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
  await nextFrame();
  layout();
  await nextFrame();
  layout();
  const ok = Date.now() < deadline;
  document.documentElement.setAttribute('data-vk-ready', ok ? '' : 'timeout');
  return ok;
};

export { CANVAS };
