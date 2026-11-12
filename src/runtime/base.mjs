/**
 * v19 · 运行期底座
 * ----------------------------------------------------------------------------
 * 构建期已经把所有能算的几何算完了。运行期只做四件事：
 *   1. 等字体与图片真正就绪，并等到布局不再变化（不是猜 32ms）
 *   2. 代码窗按窗宽缩字号，缩到底线为止
 *   3. 关系图的节点测量与连线
 *   4. 标注的锚点解析与画线
 *
 * 组件只有一种 DOM 形状：宿主 > 构建期写好的静态内容。运行期不重建内容。
 */

export const VK = ((typeof window !== 'undefined' ? window : globalThis).vk ||= {});
VK.version = typeof __VK_VERSION__ !== 'undefined' ? __VK_VERSION__ : 'dev';

const HAS_DOM = typeof document !== 'undefined';
const Base = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

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
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fin);
    setTimeout(fin, 32);
  });

/* ---------------------------------------------------------------- 读属性 */
export function attrRaw(el, name) {
  const v = el.getAttribute(name);
  return v == null || v === '' ? null : v;
}
export const attrText = (el, name, fallback = '') => attrRaw(el, name) ?? fallback;
export const attrBool = (el, name) => el.hasAttribute(name);
export const attrNum = (el, name, fallback = 0) => {
  const v = attrRaw(el, name);
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function warn(el, message) {
  const key = message.slice(0, 60);
  el._warned ||= new Set();
  if (el._warned.has(key)) return;
  el._warned.add(key);
  console.warn(`[vk] <${el.localName}> ${message}`, el);
}

/* ---------------------------------------------------------------- 几何 */
export const rectOf = (el) => el.getBoundingClientRect();

/** 墨迹矩形：元素里「真正有字」的那一块。圈一行代码时，行盒很宽，字只有一小段。 */
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
        ? { left: Math.min(out.left, r.left), top: Math.min(out.top, r.top), right: Math.max(out.right, r.right), bottom: Math.max(out.bottom, r.bottom) }
        : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
  }
  if (!out) return base;
  return { left: out.left, top: out.top, right: out.right, bottom: out.bottom, width: out.right - out.left, height: out.bottom - out.top };
}

/* ---------------------------------------------------------------- 锚点
   只认三种部件：窗口里的第 N 行、第 N 个单元、某个元素的某一边。 */
const cssEscape = (s) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&'));

function safeQuery(root, sel, owner) {
  try {
    return root.querySelector(sel);
  } catch {
    warn(owner, `"${sel}" 不是有效选择器`);
    return null;
  }
}

/** #id / #id@line:3 / #id@item:2 / #id@bit:5 / #id@side:left，或任意 CSS 选择器。 */
export function resolveAnchor(root, expr, owner) {
  const rawExpr = String(expr ?? '').trim();
  if (!rawExpr) return null;
  if (rawExpr.startsWith('#') && rawExpr.includes('@')) {
    const [head, ...rest] = rawExpr.split('@');
    const host = safeQuery(root, head, owner);
    if (!host) return null;
    const [part, ...args] = rest.join('@').split(':');
    const arg = (args[0] || '').trim();
    if (part === 'line') {
      const el = host.querySelector(`[data-vk-line="${cssEscape(arg)}"]`);
      return el ? { el, rect: inkRect(el.querySelector('.vk-lc') || el), side: null } : null;
    }
    if (part === 'item') {
      const el = host.querySelector(`[data-vk-item="${cssEscape(arg)}"]`);
      return el ? { el, rect: inkRect(el), side: null } : null;
    }
    if (part === 'bit') {
      const el = host.querySelector(`[data-vk-bit="${cssEscape(arg)}"]`);
      return el ? { el, rect: inkRect(el), side: null } : null;
    }
    if (part === 'side') {
      const r = host.getBoundingClientRect();
      const side = arg;
      if (!['top', 'right', 'bottom', 'left'].includes(side)) return null;
      const rect = {
        left: side === 'left' ? r.left : side === 'right' ? r.right : r.left + r.width / 2,
        top: side === 'top' ? r.top : side === 'bottom' ? r.bottom : r.top + r.height / 2,
        width: 0,
        height: 0,
      };
      return { el: host, rect, side, box: r };
    }
    return null;
  }
  const el = safeQuery(root, rawExpr, owner);
  return el ? { el, rect: el.getBoundingClientRect(), side: null } : null;
}

/* ---------------------------------------------------------------- 布局循环 */
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
    pending = 0;
    clearTimeout(timer);
    layout();
  };
  pending = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : 1;
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
  }

  connectedCallback() {
    if (!HAS_DOM) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.isConnected && this._paint(), { once: true });
      return;
    }
    this._paint();
  }

  disconnectedCallback() {
    PLACE.delete(this);
    EDGES.delete(this);
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
      this.paint?.();
      this._painted = true;
      if (this.place) PLACE.add(this);
      if (this.draw) EDGES.add(this);
      VK.invalidate();
    } catch (e) {
      this.fail(e);
    }
  }

  fail(e) {
    this.dataset.vkError = '1';
    (VK._errors ||= []).push({ el: this, error: e });
    console.error(`[vk] <${this.localName}> 渲染失败：${e?.message || e}`, e);
  }
}

export function define(tag, ctor) {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

/* ---------------------------------------------------------------- 就绪
   等到布局不再变化，而不是「等两帧」。字体/图片失败要显形，不静默回退。 */
const signature = () => {
  const parts = [];
  for (const el of document.querySelectorAll('vk-page, vk-page *')) {
    const r = el.getBoundingClientRect();
    parts.push(`${Math.round(r.left * 2)},${Math.round(r.top * 2)},${Math.round(r.width * 2)},${Math.round(r.height * 2)}`);
  }
  return parts.join('|');
};

VK.layout = layout;

VK.ready = async () => {
  if (!HAS_DOM) return true;
  if (document.readyState === 'loading') {
    await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }
  // 字体：加载失败也要显形（audit 会读这个标记）。
  await document.fonts?.ready;
  const families = ['Inter', 'JetBrains Mono', 'Noto Sans SC'];
  VK._fonts = families.map((f) => ({ family: f, ok: document.fonts?.check?.(`400 16px "${f}"`) ?? true }));
  await Promise.all([...document.images].map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));

  let prev = '';
  for (let i = 0; i < 10; i++) {
    layout();
    await nextFrame();
    const now = signature();
    if (now === prev) break;
    prev = now;
  }
  layout();
  await nextFrame();
  document.documentElement.setAttribute('data-vk-ready', '');
  return true;
};


