/**
 * v27 · 运行期底座
 * ----------------------------------------------------------------------------
 * 构建期已经把所有能算的几何算完了。运行期只做四件事：
 *   1. 等字体与图片真正就绪，并等到布局不再变化
 *   2. 关系图的节点测量与连线
 *   3. 标注的锚点解析与画线
 *   4. 标题带锁高：同一文档里所有帧共用最高的一条标题带
 *
 * 组件只有一种 DOM 形状：宿主 > 构建期写好的静态内容。运行期不重建内容。
 * 变体只读 data-as（构建期写回），不再有 mode。
 */

import { inRange } from '../shared/range.mjs';

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

export function warn(el, message) {
  if (!el) {
    console.warn(`[vk] ${message}`);
    return;
  }
  const key = message.slice(0, 60);
  el._warned ||= new Set();
  if (el._warned.has(key)) return;
  el._warned.add(key);
  console.warn(`[vk] <${el.localName}> ${message}`, el);
}

/* ---------------------------------------------------------------- 几何 */
const union = (rects) => {
  let out = null;
  for (const r of rects) {
    if (!r || (r.width < 0.5 && r.height < 0.5)) continue;
    out = out
      ? { left: Math.min(out.left, r.left), top: Math.min(out.top, r.top), right: Math.max(out.right, r.right), bottom: Math.max(out.bottom, r.bottom) }
      : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }
  if (!out) return null;
  return { ...out, width: out.right - out.left, height: out.bottom - out.top };
};

/** 墨迹矩形：元素里「真正有字」的那一块。圈一行代码时，行盒很宽，字只有一小段。 */
export function inkRect(el) {
  const base = el.getBoundingClientRect();
  const rects = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width >= 0.5 && r.height >= 0.5) rects.push(r);
  }
  return union(rects) || base;
}

/* ---------------------------------------------------------------- 锚点
   只认：#id、#id@line:3、#id@line:3-4、#id@item:2、#id@item:1-3、
         #id@bit:5、#id@text:词、#id@side:right。
   解析只读：出错先记在 owner 上，等写阶段再落到属性（见 anchorFail）。 */
function safeQuery(root, sel, owner) {
  try {
    return root.querySelector(sel);
  } catch {
    warn(owner, `"${sel}" 不是有效选择器`);
    return null;
  }
}

/** 记一条锚点失败；返回 null 方便 `return anchorFail(...)`。 */
export function anchorFail(owner, message) {
  if (owner) {
    const list = (owner._anchorErrors ||= []);
    if (!list.includes(message)) list.push(message);
    warn(owner, `ANCHOR ${message}`);
  }
  return null;
}

const rectOf = (el) => {
  /* 行按「代码文字」取墨迹：行号不算目标，圈也不该把行号圈进去。 */
  if (el.matches('.vk-mark')) return inkRect(el);
  if (el.matches('.vk-line, .vk-arow')) {
    const lc = el.querySelector('.vk-lc');
    return lc ? inkRect(lc) : inkRect(el);
  }
  return el.getBoundingClientRect();
};

/** 按行号/项号/位号取一组元素；一行段或一组 item 会返回多个 rect。 */
const pick = (host, attr, args, kind) => {
  const els = [...host.querySelectorAll(`[${attr}]`)].filter((el) => inRange(Number(el.getAttribute(attr)), args));
  if (!els.length) return null;
  const rects = els.map(rectOf);
  return { el: els[0], rect: union(rects) || els[0].getBoundingClientRect(), rects, side: null, kind };
};

/** @text: 可能命中多个元素（同一个词被高亮切成几段）：取第一个作 el，返回全部 rect。 */
const pickText = (host, arg) => {
  const els = [...host.querySelectorAll('[data-vk-text]')].filter((el) => el.getAttribute('data-vk-text') === arg);
  if (!els.length) return null;
  const rects = els.map(rectOf);
  return { el: els[0], rect: union(rects) || els[0].getBoundingClientRect(), rects, side: null, kind: 'text' };
};

export function resolveAnchor(root, expr, owner) {
  const raw = String(expr ?? '').trim();
  if (!raw) return anchorFail(owner, '锚点是空的');
  const at = raw.indexOf('@');
  if (raw.startsWith('#') && at > 0) {
    const host = safeQuery(root, raw.slice(0, at), owner);
    if (!host) return anchorFail(owner, `${raw} 找不到目标 ${raw.slice(0, at)}`);
    /* 一个锚点可以带多段：#c@line:2@side:right。 */
    const parts = raw
      .slice(at + 1)
      .split('@')
      .map((p) => {
        const i = p.indexOf(':');
        return i < 0 ? { name: p.trim(), arg: '' } : { name: p.slice(0, i).trim(), arg: p.slice(i + 1).trim() };
      });
    let target = { el: host, rect: host.getBoundingClientRect(), side: null };
    let lineEl = null;
    let side = null;
    for (const { name, arg } of parts) {
      if (name === 'line' || name === 'item' || name === 'bit') {
        const attr = name === 'line' ? 'data-vk-line' : name === 'item' ? 'data-vk-item' : 'data-vk-bit';
        const hit = pick(host, attr, arg, name);
        if (!hit) return anchorFail(owner, `${raw} 没命中：<${host.localName}> 里没有 ${name}:${arg}`);
        target = hit;
        if (name === 'line') lineEl = hit.el;
      } else if (name === 'text') {
        const hit = pickText(host, arg);
        if (!hit) {
          const avail = [...new Set([...host.querySelectorAll('[data-vk-text]')].map((el) => el.getAttribute('data-vk-text')))];
          return anchorFail(
            owner,
            `${raw} 没命中：<${host.localName}> 里没有 data-vk-text="${arg}"` + (avail.length ? `；可用：${avail.join(' / ')}` : '；这一件里没有 @text 锚点')
          );
        }
        target = hit;
      } else if (name === 'side') {
        if (!['top', 'right', 'bottom', 'left'].includes(arg)) return anchorFail(owner, `${raw} 的 side 不认识（可用 top / right / bottom / left）`);
        side = arg;
      } else {
        return anchorFail(owner, `${raw} 的 @${name} 不认识（可用 line / item / bit / text / side）`);
      }
    }
    /* 行 + 边：矩形仍取行的墨迹（圈/注记要用完整矩形）；
       箭头端口另给一个「件在这一行高度上的边点」，两者分离。 */
    if (side && lineEl) {
      const comp = host.getBoundingClientRect();
      const lr = inkRect(lineEl);
      const cx0 = (lr.left + lr.right) / 2;
      const cy0 = (lr.top + lr.bottom) / 2;
      const n = side === 'right' ? { x: 1, y: 0 } : side === 'left' ? { x: -1, y: 0 } : side === 'bottom' ? { x: 0, y: 1 } : { x: 0, y: -1 };
      const point = {
        x: side === 'left' ? comp.left : side === 'right' ? comp.right : cx0,
        y: side === 'top' ? comp.top : side === 'bottom' ? comp.bottom : cy0,
      };
      target = { el: lineEl, rect: lr, rects: target.rects || [lr], side, port: { ...point, n } };
    } else if (side) {
      target = { ...target, side };
    }
    return target;
  }
  const el = safeQuery(root, raw, owner);
  return el ? { el, rect: el.getBoundingClientRect(), side: null } : anchorFail(owner, `${raw} 找不到目标`);
}

/* ---------------------------------------------------------------- 布局循环 */
export const PLACE = (VK._place ||= new Set());
export const EDGES = (VK._edges ||= new Set());

const safe = (el, phase) => {
  try {
    el[phase]?.();
  } catch (e) {
    el.fail?.(e);
  }
};

/* 标题带锁高：同一文档里所有帧共用最高的一条标题带，视频不跳。
   没有 head 的帧写 0，免得继承到别人的值。 */
function lockHead() {
  const pages = [...document.querySelectorAll('vk-page')];
  if (!pages.length) return;
  const heads = pages.map((p) => p.querySelector('vk-head, .vk-head'));
  const heights = heads.map((h) => (h ? h.getBoundingClientRect().height : 0));
  const max = Math.max(0, ...heights);
  const value = `${Math.round(max * 100) / 100}px`;
  pages.forEach((p, i) => {
    p.style.setProperty('--vk-head-lock', heights[i] > 0 ? value : '0px');
  });
}

/**
 * 一次布局 = 读段 + 写段。
 *   prepare  写：只摆显隐与文字（注记/标签要先可见才量得到宽高）
 *   measure  读：把 rect / 尺寸一次收齐，不写任何样式
 *   place / draw  写：只按量好的数落笔
 * 读与写之间不夹样式写入，强制同步布局只发生一次。
 */
export function layout() {
  if (!HAS_DOM) return;
  const all = new Set();
  for (const set of [PLACE, EDGES]) {
    for (const el of set) {
      if (el.isConnected) all.add(el);
      else set.delete(el);
    }
  }
  for (const el of all) safe(el, 'prepare');
  for (const el of all) safe(el, 'measure');
  for (const el of all) if (PLACE.has(el)) safe(el, 'place');
  for (const el of all) if (EDGES.has(el)) safe(el, 'draw');
  lockHead();
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
    /* 可见失败：CSS 给 [data-vk-error] 上描边，这里再补一块字，截图里也找得到。 */
    if (!this._failMark) {
      const span = document.createElement('span');
      span.className = 'vk-missing';
      span.textContent = `渲染失败：${e?.message || e}`;
      this.appendChild(span);
      this._failMark = span;
    }
  }
}

export function define(tag, ctor) {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

/* ---------------------------------------------------------------- 就绪
   等到版式不再变化：只量 stage 与会被运行期改动的件，不做全树比对。 */
const signature = () => {
  const parts = [];
  for (const el of document.querySelectorAll('.vk-stage, .vk-gstage, .vk-co-note')) {
    const r = el.getBoundingClientRect();
    parts.push(`${Math.round(r.top)},${Math.round(r.height)},${Math.round(r.width)}`);
  }
  return parts.join('|');
};

VK.layout = layout;

VK.ready = async () => {
  if (!HAS_DOM) return true;
  if (document.readyState === 'loading') {
    await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }
  await document.fonts?.ready;
  const families = ['Inter', 'JetBrains Mono', 'Noto Sans SC'];
  /* 用这个字体真正要渲染的字去问：默认的探测文本是空格，
     而中文字体的 unicode-range 切片里没有空格，不同版本会给出不同答案。 */
  VK._fonts = families.map((family) => {
    const canCheck = typeof document !== 'undefined' && document.fonts && typeof document.fonts.check === 'function';
    if (!canCheck) return { family, ok: true };
    const probe = family === 'Noto Sans SC' ? '中' : 'A';
    return { family, ok: [400, 500, 600].some((w) => document.fonts.check(`${w} 16px "${family}"`, probe)) };
  });
  await Promise.all([...document.images].map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));

  let prev = '';
  for (let i = 0; i < 5; i++) {
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
