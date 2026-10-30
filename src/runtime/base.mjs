/* ============================================================================
   runtime · base
   ----------------------------------------------------------------------------
   唯一真源。dist/vk.js、dist/vk.esm.js 由 tools/build.mjs 生成，不要改产物。

   四条不可动摇的约定：
   · 组件把作者写的纯文本变成拟真界面，作者只写内容
   · 动画是叠加层，CSS 静止态就是最终帧
   · 时间轴只依赖时间，可任意 seek
   · vk.ready() 之后一切都就位：字体、图片、布局、连线
   ========================================================================== */

import { TAGS, TAG_NAMES, observedOf } from '../registry.mjs';
import { DENSITY_ALIAS, MASS_TAGS, TIER_ALIAS } from '../shared/tier-alias.mjs';
import { dedent, expandLeadingTabs, hash32, indexSet, lineSet, langKey, langLabel } from '../shared/code.mjs';
import { applyFrame, auditOverflow } from './frame.mjs';
import { wrapCharRange } from './code-utils.mjs';

export { TAGS, TAG_NAMES, dedent, expandLeadingTabs, hash32, indexSet, lineSet, langKey, langLabel };

const ROOT = typeof window !== 'undefined' ? window : globalThis;
const HAS_DOM = typeof document !== 'undefined';
const Base = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

/**
 * 等一帧。rAF 在后台标签页 / display:none 的 iframe 里会被暂停，
 * 只等它会让 vk.ready() 和 layout 永久挂起；setTimeout 是所有环境的底线。
 */
export function nextFrame() {
  return new Promise((resolve) => {
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      resolve();
    };
    if (typeof requestAnimationFrame === 'function' && !document.hidden) requestAnimationFrame(fin);
    setTimeout(fin, 32);
  });
}

export const VK = (ROOT.vk = ROOT.vk || {});
VK.version = typeof __VK_VERSION__ !== 'undefined' ? __VK_VERSION__ : 'dev';
VK._defs = new Set();
VK._errors = [];
VK._tags = TAG_NAMES;

/* ------------------------------------------------------------------ utils */

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 只允许 CSS object-position 的字符；分号/花括号不能进 style。 */
export const safePosition = (v) => (/^[\w.%\s-]+$/.test(v || '') ? v : '50% 50%');

/** 读一个数字属性：非数字/越界按范围截断并警告，别让 NaN 和负数进布局。 */
export function numAttr(el, name, { min = -Infinity, max = Infinity, fallback = 0 } = {}) {
  const raw = el.getAttribute(name);
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    el._warnOnce?.(`range:${name}`, `的 ${name}="${raw}" 不是数字，按 ${fallback} 处理`);
    return fallback;
  }
  if (n < min || n > max) {
    const v = Math.min(max, Math.max(min, n));
    el._warnOnce?.(`range:${name}`, `的 ${name}="${raw}" 超出 ${min}…${max}，按 ${v} 处理`);
    return v;
  }
  return n;
}

/** 源码只从 textContent 取 —— innerHTML 解析会把 `List<String>` 变成 `List<string>` */
export const textSource = (el) => el.textContent.replace(/\r\n?/g, '\n');

/** 构建期把真实文件的源码放进 data-vk-src；它是机器数据，不是作者手写的第二份。 */
export function precompiledSource(el) {
  const s = el.querySelector(':scope > script[data-vk-src]');
  if (!s) return null;
  try {
    const text = JSON.parse(s.textContent).text;
    return typeof text === 'string' ? text : null;
  } catch {
    return null;
  }
}

/** 作者漏了转义时明确警告，不静默吞掉 */
export function warnIfParsed(el) {
  const junk = [...el.children].filter(
    (c) =>
      !(
        c.tagName === 'SCRIPT' &&
        (c.hasAttribute('data-vk-hl') ||
          c.hasAttribute('data-vk-hl-diff') ||
          c.hasAttribute('data-vk-src') ||
          c.hasAttribute('data-vk-source') ||
          c.hasAttribute('data-vk-asm') ||
          c.hasAttribute('data-vk-tree'))
      )
  );
  if (!junk.length) return false;
  el.dataset.vkParsed = '1';
  console.warn(
    `[vk] <${el.tagName.toLowerCase()}> 里出现了 HTML 元素。源码里的 "<" 必须写成 "&lt;"，否则会被浏览器解析掉。`,
    el
  );
  return true;
}

/* --------------------------------------------------------------- 安全查询 */

/** 作者写的选择器不能把整个 layout 拖垮。 */
export function safeQuery(root, sel, owner) {
  if (!root || !sel) return null;
  try {
    return root.querySelector(sel);
  } catch {
    owner?._warnOnce?.('selector', `的 ${sel} 不是有效选择器`);
    return null;
  }
}

/* ------------------------------------------------------------- 关系层寻址 */

/** 内部件锚点：part -> 属性名。编号一律 0 起（代码行除外，用源文件行号）。 */
const ANCHOR_ATTR = {
  line: 'data-line',
  cell: 'data-cell',
  byte: 'data-byte',
  bit: 'data-bit',
  field: 'data-field',
  addr: 'data-addr',
  event: 'data-event',
  lane: 'data-lane',
  row: 'data-row',
  node: 'data-node-path',
  step: 'data-step',
  item: 'data-item',
};

const cssEscape = (s) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&'));

/**
 * `for` / `from` / `to` 的解析：CSS 选择器，或 `#id@part:arg`。
 * 后者能被构建期静态校验，是"AI 写错了却看起来没事"的唯一拦法。
 */
export function resolveTarget(root, expr, owner) {
  if (!root || !expr) return null;
  const raw = String(expr).trim();
  const at = raw.indexOf('@');
  if (raw.startsWith('#') && at > 1) {
    const id = raw.slice(1, at);
    const [part, ...args] = raw.slice(at + 1).split(':');
    const host = safeQuery(root, `#${cssEscape(id)}`, owner);
    if (!host) {
      owner?._warnOnce?.(`target:${id}`, `找不到 #${id}`);
      return null;
    }
    if (part === 'line' || part === 'char') {
      const lineNo = (args[0] || '').trim();
      const lineEl = host.querySelector(
        `.vk-line[data-line="${cssEscape(lineNo)}"], [data-vk-part="line"][data-line="${cssEscape(lineNo)}"]`
      );
      if (!lineEl) {
        owner?._warnOnce?.(`target:${id}:${lineNo}`, `#${id} 没有第 ${lineNo} 行`);
        return null;
      }
      if (part === 'line') return lineEl;
      const [s, e] = (args[1] || '').split('-').map((n) => parseInt(n, 10));
      if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
        owner?._warnOnce?.(`target:${id}:range`, `#${id} 的字符区间 "${args[1] || ''}" 不合法（应为 起-止）`);
        return lineEl;
      }
      return wrapCharRange(lineEl.querySelector('.vk-src'), s, e, 'vk-char', `x${lineNo}`) || lineEl;
    }
    const attr = ANCHOR_ATTR[part];
    if (!attr) {
      owner?._warnOnce?.(
        `target:${id}:${part}`,
        `#${id} 不支持 @${part}；支持 ${Object.keys(ANCHOR_ATTR).join(' / ')}`
      );
      return null;
    }
    const want = args.join(':');
    const el = host.querySelector(`[${attr}="${cssEscape(want)}"]`);
    if (!el) {
      owner?._warnOnce?.(`target:${id}:${part}:${want}`, `#${id} 没有 ${part}="${want}"`);
      return null;
    }
    return el;
  }
  return safeQuery(root, raw, owner);
}

/* --------------------------------------------------------- 几何锚点（P2） */

const SIDES = new Set(['top', 'right', 'bottom', 'left']);
const clampPct = (n) => Math.max(0, Math.min(100, n));

/**
 * 关系锚点：`#id@point:x%,y%` / `#id@side:top` / `#id@region:x%,y%,w%,h%`，
 * 或原有的 `#id@part:arg` 与 CSS 选择器。
 *
 * 返回 `{ el, rect, side }`：rect 是视觉坐标里的 DOMRect 形状，side 是显式指定的贴边。
 * 百分比一律相对目标自己的盒子：盒子改了尺寸，锚点跟着走。
 */
export function resolveAnchor(root, expr, owner) {
  const raw = String(expr || '').trim();
  const at = raw.indexOf('@');
  if (raw.startsWith('#') && at > 1) {
    const part = raw.slice(at + 1).split(':')[0];
    if (part === 'point' || part === 'side' || part === 'region') {
      const id = raw.slice(1, at);
      const host = safeQuery(root, `#${cssEscape(id)}`, owner);
      if (!host) {
        owner?._warnOnce?.(`target:${id}`, `找不到 #${id}`);
        return null;
      }
      const r = host.getBoundingClientRect();
      const args = raw.slice(at + part.length + 2);
      if (part === 'side') {
        const side = args.trim();
        if (!SIDES.has(side)) {
          owner?._warnOnce?.(`target:${id}:side`, `#${id} 的 @side 只能是 top / right / bottom / left`);
          return null;
        }
        const rect = { left: r.left, top: r.top, width: 0, height: 0 };
        if (side === 'right') rect.left = r.right;
        if (side === 'bottom') rect.top = r.bottom;
        if (side === 'left' || side === 'right') rect.top = r.top + r.height / 2;
        else rect.left = r.left + r.width / 2;
        return { el: host, rect, side };
      }
      const nums = args.split(',').map((s) => parseFloat(s));
      const want = part === 'point' ? 2 : 4;
      if (nums.length !== want || nums.some((n) => !Number.isFinite(n))) {
        owner?._warnOnce?.(`target:${id}:${part}`, `#${id} 的 @${part} 需要 ${want} 个数字（0–100，可带 %）`);
        return null;
      }
      const [x, y, w = 0, h = 0] = nums.map(clampPct);
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
  }
  const el = resolveTarget(root, raw, owner);
  return el ? { el, rect: el.getBoundingClientRect(), side: null } : null;
}

/* ---------------------------------------------------------------- 读取源码 */

/** 没有构建也没有 dev server 时，至少把 src 文件读出来显示纯文本 */
const pendingSources = new Set();

export function fetchSource(el) {
  const src = el.getAttribute('src');
  if (!src || typeof fetch !== 'function') return;
  const token = (el._srcToken = (el._srcToken || 0) + 1);
  el._abort?.abort();
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  el._abort = ctrl;
  el._loading = true;
  let url;
  try {
    url = new URL(src, document.baseURI).href;
  } catch {
    el._loading = false;
    return;
  }
  const p = fetch(url, { signal: ctrl?.signal })
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then((t) => {
      if (el._srcToken !== token || el.getAttribute('src') !== src) return;
      el._loading = false;
      el._fetched = true;
      el.onFetched?.(t);
      el.paint();
    })
    .catch((e) => {
      if (e?.name === 'AbortError') {
        if (el._srcToken === token) el._loading = false;
        return;
      }
      el._loading = false;
      el._warnOnce?.('fetch', `读取 ${src} 失败：${e.message}。构建时跑 npx vk build 把源码内联。`);
    })
    .finally(() => {
      clearTimeout(timer);
      if (el._abort === ctrl) el._abort = null;
      pendingSources.delete(p);
    });
  const timer = setTimeout(() => {
    if (el._srcToken !== token) return;
    el._loading = false;
    el._warnOnce?.('fetch', `读取 ${src} 超时（8s）。构建时跑 npx vk build 把源码内联。`);
    ctrl?.abort();
  }, 8000);
  pendingSources.add(p);
}

/* --------------------------------------------------------------- 值层迁移 */

export function normalizeTier(el) {
  // 体量：旧词 density（compact/normal/loose）与旧的内在本 size 都并进 mass。
  const tag = el.tagName?.toLowerCase();
  if (MASS_TAGS.has(tag)) {
    if (!el.hasAttribute('mass')) {
      const d = el.getAttribute('density'); // 旧词，只在别名层读
      if (d && DENSITY_ALIAS[d]) {
        el.setAttribute('mass', DENSITY_ALIAS[d]);
        el._warnOnce?.('mass', `的 density="${d}" 已退役，请写成 mass="${DENSITY_ALIAS[d]}"`);
      } else {
        const s = el.getAttribute('size');
        if (s === 'compact' || s === 'normal' || s === 'hero') {
          el.setAttribute('mass', s);
          el._warnOnce?.('mass', `的 size="${s}" 是内在体量，请写成 mass="${s}"`);
        }
      }
    }
  }
  // 旧档名（display-2xl / display-xl / display / heading / meta）连上 DOM 的第一刻折成新名，
  // 后面所有环节（CSS、契约、文档、类型）就只认一套词。别名表在 shared/tier-alias.mjs。
  const v = el.getAttribute?.('size');
  const next = v && TIER_ALIAS[v];
  if (!next) return;
  el.setAttribute('size', next);
  el._warnOnce?.('tier', `的 size="${v}" 已在 13.0 改名，请写成 size="${next}"`);
}

/**
 * 行宽：作者写的是「一行几个字」，不是像素。
 *
 *   measure="20"   一行最多 20 个字（1em = 一个汉字宽，所以随字号自动缩放）
 *   measure="none" 不限，铺满容器
 *   不写           按字号档的默认行宽（CSS 里的 --vk-measure-*）
 *
 * 中英混排时 ch 不等于汉字宽，所以这里用 em 而不是 ch：一汉字 ≈ 1em。
 */
export function applyMeasure(el) {
  const v = el.getAttribute?.('measure');
  if (v === null) return;
  if (v === 'none') {
    el.style.maxWidth = 'none';
    return;
  }
  // 旧写法（label / body / subhead / title / hero）保留：它们的意思是「按那一档的行宽」，
  // 直接引用 token，行为和 12.x 一致。
  if (['label', 'body', 'subhead', 'title', 'hero'].includes(v)) {
    el.style.maxWidth = `var(--vk-measure-${v})`;
    return;
  }
  const n = Number(v);
  if (Number.isInteger(n) && n >= 8 && n <= 60) el.style.maxWidth = n + 'em';
  else el._warnOnce?.('measure', `的 measure="${v}" 只能是 none、8–60 的整数（一行几个字）或旧档名（label/body/subhead/title/hero）`);
}

/* --------------------------------------------------------------- 生命周期 */

/**
 * 组件基类。
 * · 属性变了就重渲染 —— React 里改 props 画面会跟着变
 * · 子节点被整体替换时重新取源，局部改动忽略并警告
 * · 单个元件抛错不再拖垮全局 layout / ready
 */
export class VkElement extends Base {
  static get observedAttributes() {
    return this.__observed || [];
  }

  constructor() {
    super();
    this._done = false;
    this._rendering = false;
    this._mo = null;
    this._warned = new Set();
    this._srcToken = 0;
    this._loading = false;
    this._abort = null;
    this._paintScheduled = false;
    this._placeRegistered = false;
    this._dirty = false;
    this._dirtyAttrs = [];
  }

  connectedCallback() {
    // 值层迁移：旧档名（display-2xl / heading / meta …）在连上 DOM 的第一刻折成 13.0 的七个名字。
    // 折完再往下走，所以 CSS、文档、契约都只认一套词。
    normalizeTier(this);
    applyMeasure(this);
    this._registerPlace();
    if (this._done) {
      this._attachObserver();
      if (this._dirty) {
        const pending = this._dirtyAttrs.slice();
        this._dirty = false;
        this._dirtyAttrs = [];
        for (const [name, value] of pending) this.onAttr?.(name, value);
        this._schedulePaint();
      }
      VK._invalidate();
      return;
    }
    if (!HAS_DOM) return;
    if (document.readyState === 'loading') {
      this._defer();
      return;
    }
    this._init();
  }

  _defer() {
    if (this._boot) return;
    this._boot = () => {
      this._boot = null;
      if (!this.isConnected || this._done) return;
      this._init();
    };
    document.addEventListener('DOMContentLoaded', this._boot, { once: true });
  }

  _init() {
    if (this._done) return;
    try {
      this.capture?.();
      this.paint();
    } catch (e) {
      this._fail(e);
    }
    this._done = true;
    this._attachObserver();
  }

  _attachObserver() {
    if (!this.constructor.watchSource || this._mo) return;
    this._mo = new MutationObserver((records) => {
      if (this._rendering) return;
      // 父级只关心"作者直接改了宿主"，不关心子组件自己的内部重绘。
      const relevant = records.filter((r) => this._isOwnMutation(r.target));
      if (!relevant.length) return;
      const root = this.constructor.renderedRoot;
      if (root && this.querySelector(root)) {
        if (this.constructor.slot && this.adoptExtras()) return;
        if (!this.hasExtras()) return;
        this._warnOnce('mutation', '的 DOM 被局部修改，已忽略。请整体替换 textContent / innerHTML。');
        return;
      }
      try {
        this.capture?.();
        this.paint();
      } catch (e) {
        this._fail(e);
      }
    });
    this._observe();
  }

  _observe() {
    this._mo?.observe(this, { childList: true, characterData: true, subtree: true });
  }

  /** 这次改动是不是"宿主自己的"，而不是后代自定义元素的内部实现。 */
  _isOwnMutation(target) {
    let n = target;
    while (n && n !== this) {
      if (n.nodeType === 1 && n.tagName.length > 3 && n.tagName.startsWith('VK-')) return false;
      n = n.parentNode;
    }
    return n === this;
  }

  /**
   * 槽组件在首次渲染后，作者又往宿主里追加了节点：
   * 直接并入槽容器，不重绘整棵子树（重绘会搬走已有的节点）。
   */
  hasExtras() {
    const rootSel = this.constructor.renderedRoot;
    return [...this.childNodes].some((n) => {
      if (n.nodeType === 3) return !!n.textContent.trim();
      if (n.nodeType !== 1) return false;
      if (n.tagName === 'SCRIPT' || n.tagName === 'SVG') return false;
      try {
        return !(rootSel && n.matches(rootSel));
      } catch {
        return true;
      }
    });
  }

  adoptExtras() {
    const slotSel = this.constructor.slotHost;
    const rootSel = this.constructor.renderedRoot;
    if (!slotSel) return false;
    const host = this.querySelector(slotSel);
    if (!host) return false;
    const extras = [...this.childNodes].filter((n) => {
      if (n.nodeType === 3) return !!n.textContent.trim();
      if (n.nodeType !== 1) return false;
      if (n.tagName === 'SCRIPT' || n.tagName === 'SVG') return false;
      try {
        return !(rootSel && n.matches(rootSel));
      } catch {
        return true;
      }
    });
    if (!extras.length) return false;
    for (const n of extras) host.append(n);
    VK._invalidate();
    return true;
  }

  disconnectedCallback() {
    if (this._boot) {
      document.removeEventListener('DOMContentLoaded', this._boot);
      this._boot = null;
    }
    this._loading = false;
    this._mo?.disconnect();
    this._mo = null;
    this._unregisterPlace();
    EDGES.delete(this);
    // 注意：这里**不 abort** fetch。
    // 槽组件搬运节点（remove + append）会触发一次 disconnect/connect；
    // 如果在这里 abort，正在读的 src 会被掐死，重连后又因为 _done 不再重取。
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._done || oldValue === newValue) return;
    // 行宽是纯样式，不重建子树，属性一变就立刻重算。
    if (name === 'measure') applyMeasure(this);
    if (!this.isConnected) {
      this._dirty = true;
      this._dirtyAttrs.push([name, newValue]);
      return;
    }
    try {
      this.onAttr?.(name, newValue);
      this._schedulePaint();
    } catch (e) {
      this._fail(e);
    }
  }

  /** 同一 tick 内多个属性变化只重绘一次。 */
  _schedulePaint() {
    if (this._paintScheduled) return;
    this._paintScheduled = true;
    queueMicrotask(() => {
      this._paintScheduled = false;
      if (this.isConnected) this.paint();
      else this._dirty = true;
    });
  }

  paint() {
    if (typeof this.render !== 'function') return;
    this._rendering = true;
    this._mo?.disconnect();
    try {
      this.render();
      // 模板里的缩进空白会在自定义元素里生成额外的行盒（实测多出 32px 高度）
      for (const n of [...this.childNodes]) {
        if (n.nodeType === 3 && !n.textContent.trim()) n.remove();
      }
      // Frame：w/h/x/y 由共享原语统一应用；纯 CSS 组件跳过。
      if (this.constructor.frame !== false) applyFrame(this);
    } catch (e) {
      this._fail(e);
    } finally {
      this._rendering = false;
      this._observe();
      this._mo?.takeRecords();
    }
    this._registerPlace();
    VK._invalidate();
  }

  _registerPlace() {
    if (this._placeRegistered || !this.hasAttribute('data-vk-place')) return;
    this._placeRegistered = true;
    PLACE.add(this);
  }

  _unregisterPlace() {
    if (!this._placeRegistered) return;
    this._placeRegistered = false;
    PLACE.delete(this);
  }

  _warnOnce(key, message) {
    if (this._warned.has(key)) return;
    this._warned.add(key);
    console.warn(`[vk] <${this.tagName.toLowerCase()}> ${message}`, this);
  }

  _fail(e) {
    this.dataset.vkError = '1';
    if (VK._errors.length > 100) VK._errors.shift();
    VK._errors.push({ el: this, error: e, at: Date.now() });
    console.error(`[vk] <${this.tagName.toLowerCase()}> 渲染失败：${e?.message || e}`, e);
  }

  /** 预编译缺失 / 过期时警告一次 */
  stale(reason) {
    this.dataset.vkStale = '1';
    if (this._loading) return;
    this._warnOnce('stale', `${reason}。运行 npx vk build 生成预编译数据。`);
  }
}

/* ---------------------------------------------------------------- 布局 */

export const PLACE = new Set();
export const EDGES = new Set();

export function layout() {
  if (!HAS_DOM) return;
  // 第一次排一次全页，之后只排注册过的 dirty 元素。
  if (!PLACE.size && !EDGES.size) {
    for (const el of document.querySelectorAll('[data-vk-place]')) PLACE.add(el);
    for (const el of document.querySelectorAll('vk-edge')) EDGES.add(el);
  }
  // 需要排版的画布先摆，连线才有东西可量
  for (const el of PLACE) {
    if (!el.isConnected) {
      PLACE.delete(el);
      continue;
    }
    if (!el.getClientRects().length) continue;
    try {
      el.place?.();
    } catch (e) {
      el._fail?.(e);
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
      el._fail?.(e);
    }
  }
}

let rafPending = 0;
let rafTimer = 0;
VK._invalidate = () => {
  if (rafPending) return;
  const run = () => {
    if (!rafPending) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafPending);
    clearTimeout(rafTimer);
    rafPending = 0;
    layout();
  };
  if (typeof requestAnimationFrame === 'function' && !document.hidden) rafPending = requestAnimationFrame(run);
  // 后台标签页 / 隐藏 iframe 里 rAF 会被暂停，不能让 layout 永远不跑。
  rafTimer = setTimeout(run, 64);
  if (!rafPending) rafPending = -1;
};

/** 公开 API：手动重排一次（类型里有声明，就必须真的存在） */
VK.layout = layout;
VK.auditOverflow = auditOverflow;

/** 渲染器的等待点 */
VK.ready = async () => {
  if (!HAS_DOM) return true;
  if (document.readyState === 'loading') {
    await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }
  if (typeof customElements !== 'undefined') {
    await Promise.all([...VK._defs].map((n) => customElements.whenDefined(n)));
  }

  const tags = TAG_NAMES.join(',');
  const unready = () =>
    [...document.querySelectorAll(tags)].some((el) => el.isConnected && typeof el.paint === 'function' && !el._done);

  // 一次快照不够：元素会在 whenDefined 之后的微任务里升级，
  // 嵌套组件/晚到 fetch 也可能在 ready 之后才开始。等到连续两帧都安静为止。
  const deadline = Date.now() + 15000;
  let quiet = 0;
  while (Date.now() < deadline) {
    const pending = pendingSources.size;
    const pendingEls = unready();
    await nextFrame();
    if (!pending && !pendingEls && !pendingSources.size && !unready()) {
      quiet++;
      if (quiet >= 2) break;
    } else {
      quiet = 0;
    }
  }
  const timedOut = Date.now() >= deadline;
  if (timedOut) {
    document.documentElement.setAttribute('data-vk-ready', 'timeout');
    console.warn('[vk] ready 超时：仍有组件或源码没有就绪');
  }

  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
  await withTimeout(document.fonts?.ready || Promise.resolve(), 8000);
  await withTimeout(
    Promise.all([...document.images].map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))),
    8000
  );
  await nextFrame();
  layout();
  await nextFrame();
  layout();
  if (!timedOut) document.documentElement.setAttribute('data-vk-ready', '');
  return !timedOut;
};

/* -------------------------------------------------------------- 注册 */

export const plain = () => class extends Base {};

/**
 * 登记一个标签。
 * observed 属性从 registry 取 —— 不再手写第二份清单。
 */
export function define(tag, ctor) {
  const def = TAGS[tag];
  if (!def) throw new Error(`[vk] 未注册的标签：${tag}`);
  ctor.__observed = observedOf(tag);
  VK._defs.add(tag);
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

/** 给测试与调试用 */
VK._internals = { dedent, hash32, indexSet, lineSet, expandLeadingTabs };

/* ------------------------------------------------------------------ 插槽 */

/**
 * 容器组件的内容槽。
 *
 * 关键：**移动节点，不序列化 HTML**。
 * 如果先读 innerHTML 再重渲染，子组件可能已经渲染完，读到的就是渲染结果，
 * 于是把「已经变成窗口的代码块」当成源码再渲染一遍。移动节点没有这个问题，
 * 而且保留元素身份 —— 重渲染不会让子组件的状态丢失。
 */
export function takeSlot(el) {
  const rootSel = el.constructor.renderedRoot;
  const stillRendered = !rootSel || !!el.querySelector(rootSel);
  if (!el._slotNodes || !stillRendered) {
    el._slotNodes = [...el.childNodes].filter((n) => {
      if (n.nodeType !== 1) return n.nodeType === 3 && n.textContent.trim() ? true : false;
      return !(n.tagName === 'SCRIPT');
    });
  } else {
    // 作者在渲染后又直接追加了内容：把它并入槽，而不是静默丢掉。
    const extras = [...el.childNodes].filter((n) => {
      if (n.nodeType === 3) return !!n.textContent.trim();
      if (n.nodeType !== 1) return false;
      if (n.tagName === 'SCRIPT' || n.tagName === 'SVG') return false;
      try {
        return !(rootSel && n.matches(rootSel));
      } catch {
        return true;
      }
    });
    for (const n of extras) if (!el._slotNodes.includes(n)) el._slotNodes.push(n);
  }
  for (const n of el._slotNodes) if (n.parentNode) n.parentNode.removeChild(n);
  return el._slotNodes;
}

/** 把槽节点塞进宿主元素 */
export function fillSlot(host, nodes) {
  for (const n of nodes || []) host.appendChild(n);
  return host;
}

if (HAS_DOM && document.fonts?.ready) document.fonts.ready.then(() => layout());







