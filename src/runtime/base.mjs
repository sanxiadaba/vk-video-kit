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

import { TAGS, TAG_NAMES, ALL_TAG_NAMES, observedOf } from '../registry.mjs';
import { DENSITY_ALIAS, MASS_TAGS, TIER_ALIAS } from '../shared/tier-alias.mjs';
import { FILL_BOOL, FILL_TAGS, MASS, SIZE_ALIAS, SIZE_TIERS, MASS_ALIAS, toneValue } from '../shared/vocab.mjs';
import {
  COLUMNS,
  COLUMN_ATTRS,
  DEPRECATED_ATTRS,
  parseColumns,
  serializeColumns,
  parseSpace,
  spaceCss,
  parseArrow,
  serializeArrow,
  serializeFlowArrow,
  parseFence,
  serializeFence,
  parseCounter,
  parseCompareLabels,
  serializeCompareLabels,
} from '../shared/vocab.mjs';
import { dedent, expandLeadingTabs, hash32, indexSet, lineSet, langKey, langLabel } from '../shared/code.mjs';
import { applyFrame, auditOverflow } from './frame.mjs';
import { wrapCharRange } from './code-utils.mjs';

export { TAGS, TAG_NAMES, ALL_TAG_NAMES, dedent, expandLeadingTabs, hash32, indexSet, lineSet, langKey, langLabel };

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
          c.hasAttribute('data-vk-term') ||
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

/**
 * 概念收敛的**运行期一半**：旧页连上 DOM 的第一刻，把旧名 / 旧值折成新词。
 *
 * 折完再往下走，所以组件、CSS、契约、文档都只认一套词。别名表只有一份，
 * 在 src/shared/vocab.mjs；这里只负责"落到属性上"，并给一条迁移提示（不拦构建）。
 *
 * 15.0 折的六件事：
 *   · tone 大小写 + 旧写法（accent / danger …）→ 六值；vk-pair 的 tone-a/b → tone="左,右"
 *   · fill 裸写（布尔）→ 填充组件上 cover、其它组件上 stretch（旧的 align-self: stretch）
 *   · line / active → current（当前项，1 起）
 *   · value-size / label-size / symbol-size → size（size 只表字号）
 *   · emphasis → strength；kind → variant；compare 的 mode → variant
 *   · label 的 anchor → side；note 的 place → side；label-a/b 与 asm 的四个列标题 → labels
 *
 * size 上的体量词（compact / normal / hero）**不再偷偷改写成 mass**：
 * 15.0 之前那段改写让 size 同时是字号、档位、体量，行为取决于标签与历史；
 * 现在只提示，让页面自己去写 mass。density（更老的词）仍然折成 mass。
 */
export function normalizeVocab(el) {
  const tag = el.tagName?.toLowerCase();
  const get = (name) => el.getAttribute?.(name);
  const warn = (key, msg) => el._warnOnce?.(key, msg);
  const fold = (from, to, map) => {
    const raw = get(from);
    if (raw == null) return;
    const next = map ? map(raw) : raw;
    el.removeAttribute(from);
    if (next == null) return next;
    if (get(to) == null) el.setAttribute(to, next);
    return next;
  };

  /* ---------------------------------------------------------------- tone */
  const toneRaw = get('tone');
  if (toneRaw != null) {
    const isPair = tag === 'vk-pair';
    const tokens = isPair ? toneRaw.split(',') : [toneRaw];
    const out = tokens.map((token) => {
      const text = token.trim();
      if (isPair && (text === '' || text.toLowerCase() === 'none')) return 'none';
      const r = toneValue(text);
      if (r.bad) return text; // 不认识的留给构建期报错；运行期不擅自改画面
      if (r.alias) warn(`tone:${text}`, `的 tone="${text}" 是旧写法，已映射成 tone="${r.value}"`);
      return r.value;
    });
    const next = isPair ? out.join(',') : out[0];
    if (next !== toneRaw) el.setAttribute('tone', next);
  }
  // vk-pair 的旧写法：tone-a / tone-b 各写一侧 → tone="左,右"（缺的一侧是 none）。
  if (get('tone-a') != null || get('tone-b') != null) {
    const a = (get('tone-a') ?? '').trim().toLowerCase() || 'none';
    const b = (get('tone-b') ?? '').trim().toLowerCase() || 'none';
    el.removeAttribute('tone-a');
    el.removeAttribute('tone-b');
    const fix = (v) => {
      if (v === 'none') return 'none';
      const r = toneValue(v);
      return r.value || 'none';
    };
    if (get('tone') == null) el.setAttribute('tone', `${fix(a)},${fix(b)}`);
    warn('tone:pair', `的 tone-a / tone-b 已并成 tone="左,右"，请写成 tone="${fix(a)},${fix(b)}"`);
  }

  /* ---------------------------------------------------------------- fill */
  const fillRaw = get('fill');
  if (fillRaw != null) {
    const value = fillRaw.trim().toLowerCase();
    const boolish = value === '' || ['true', 'false', 'on', 'off', 'yes', 'no'].includes(value);
    if (FILL_TAGS.has(tag)) {
      if (boolish) {
        const next = FILL_BOOL[value] || 'cover';
        el.setAttribute('fill', next);
        warn('fill', `的 fill 裸写是旧的布尔写法，已映射成 fill="${next}"`);
      } else if (value === 'width' || value === 'height' || value === 'stretch') {
        el.setAttribute('fill', 'cover');
        warn('fill', `的 fill="${value}" 是旧的铺满写法，已映射成 fill="cover"`);
      }
    } else {
      // 非填充组件：这里的 fill 一直是"铺满父容器的一条轴"（align-self: stretch）。
      el.removeAttribute('fill');
      el.setAttribute('stretch', '');
      warn(
        'fill:stretch',
        `的 fill 裸写是"铺满父容器"的旧布尔写法，15.0 起这个意思改叫 stretch；` +
          `要"填充"请只在 vk-img / vk-panel / vk-layer 上用 fill="none|cover|contain"`
      );
    }
  }

  /* ------------------------------------------------------ current / 行段 */
  for (const old of ['line', 'active']) {
    const raw = get(old);
    if (raw == null) continue;
    if (get('current') == null) el.setAttribute('current', raw);
    el.removeAttribute(old);
    warn(`current:${old}`, `的 ${old}="${raw}" 已并入 current（当前项，1 起）；请写成 current="${raw}"`);
  }

  /* ---------------------------------------------------------------- size */
  // value-size / label-size / symbol-size 是同一个概念（字号）的三个名字。
  for (const old of ['value-size', 'label-size', 'symbol-size']) {
    const raw = get(old);
    if (raw == null) continue;
    const mapped = SIZE_ALIAS[raw.trim()] || raw.trim();
    el.removeAttribute(old);
    if (get('size') == null) el.setAttribute('size', mapped);
    warn(`size:${old}`, `的 ${old}="${raw}" 已并入 size；请写成 size="${mapped}"（size 只表字号）`);
  }
  const sizeRaw = get('size');
  if (sizeRaw && MASS_TAGS.has(tag) && MASS.includes(sizeRaw.trim())) {
    // 不再偷偷把 size 改写成 mass：一个属性名只能有一个意思。
    warn(
      'size:mass',
      `的 size="${sizeRaw}" 是"体量"，不是字号；15.0 起请写 mass="${sizeRaw}"（size 只表字号，值会被忽略）`
    );
  }
  const tierNext = sizeRaw && SIZE_ALIAS[sizeRaw.trim()];
  if (tierNext) {
    el.setAttribute('size', tierNext);
    warn('size:tier', `的 size="${sizeRaw}" 已改名，请写成 size="${tierNext}"`);
  }
  // density：更老的体量词，仍折成 mass（这一条从 13.0 起就有）。
  const density = get('density');
  if (density && MASS_ALIAS[density.toLowerCase()] && get('mass') == null) {
    const next = MASS_ALIAS[density.toLowerCase()];
    el.setAttribute('mass', next);
    warn('mass', `的 density="${density}" 已退役，请写成 mass="${next}"`);
  }

  /* ------------------------------------------------------ 形态 / 强度 / 位置 */
  fold('emphasis', 'strength');
  // kind → variant 是旧名迁移；但 vk-scene 的 kind 是正式属性（五个讲解动作），
  // 不能被折成 variant。判据只有一条：声明面里真的有 kind 就不折。
  if (!TAGS[tag]?.attrs?.kind) fold('kind', 'variant');
  if (tag === 'vk-compare') fold('mode', 'variant');
  fold('anchor', 'side', (v) => ({ above: 'top', below: 'bottom' })[v.trim()] ?? v);
  fold('place', 'side', (v) => ({ br: 'bottom-right', bl: 'bottom-left', bottom: 'bottom' })[v.trim()] ?? v);

  /* ------------------------------------------------------------- 标签文字 */
  // 并排对照的两张图：label-a / label-b → labels="左|右"
  if (get('label-a') != null || get('label-b') != null) {
    const a = get('label-a') ?? '';
    const b = get('label-b') ?? '';
    el.removeAttribute('label-a');
    el.removeAttribute('label-b');
    if (get('labels') == null) el.setAttribute('labels', `${a}|${b}`);
    warn('labels:pair', `的 label-a / label-b 已并成 labels="左|右"，请写成 labels="${a}|${b}"`);
  }
  // 汇编四列的自定义标题：address-label / bytes-label / mnemonic-label / operands-label → labels
  if (tag === 'vk-asm' && ['address-label', 'bytes-label', 'mnemonic-label', 'operands-label'].some((n) => get(n) != null)) {
    const order = ['address-label', 'bytes-label', 'mnemonic-label', 'operands-label'];
    const parts = order.map((n) => get(n) ?? '');
    for (const n of order) el.removeAttribute(n);
    if (get('labels') == null) el.setAttribute('labels', parts.join('|'));
    warn('labels:asm', `的四个 *-label 已并成 labels="地址|机器码|指令|操作数"，请写成 labels="${parts.join('|')}"`);
  }
  // 连线标签的偏移：label-dx / label-dy → label-offset="dx,dy"
  if (get('label-dx') != null || get('label-dy') != null) {
    const dx = get('label-dx') ?? '0';
    const dy = get('label-dy') ?? '0';
    el.removeAttribute('label-dx');
    el.removeAttribute('label-dy');
    if (get('label-offset') == null) el.setAttribute('label-offset', `${dx},${dy}`);
    warn('label-offset', `的 label-dx / label-dy 已并成 label-offset="dx,dy"，请写成 label-offset="${dx},${dy}"`);
  }
  // code 的 numbering 已退役：行号一律是源文件行号。
  if (get('numbering') != null) {
    const raw = get('numbering');
    el.removeAttribute('numbering');
    warn('numbering', `的 numbering="${raw}" 已退役：行号只有一种基准 —— 源文件的真实行号`);
  }

  /* ------------------------------------------------ 15.2 列开关 → columns */
  // 七个别名（numbers / ascii / address / offsets / ruler / summary / labels）折成一个
  // columns；这份清单和默认列只有 vocab.COLUMNS 一份。
  if (COLUMNS[tag]) {
    const spec = COLUMNS[tag];
    const legacy = COLUMN_ATTRS.filter((name) => spec.all.includes(name) && get(name) != null);
    // asm 的 labels 是"标题段"：titles:地址|机器码|指令|操作数。
    const legacyTitles = tag === 'vk-asm' && get('labels') != null ? get('labels') : null;
    if (legacy.length || legacyTitles != null) {
      // 再折一次时（运行期动态改旧名 / 切预设）把旧值叠加在当前 columns 上：
      // columns 可能是上一次折叠的产物，也可能是作者写的；旧名是"现在这一次"的意图，优先。
      const parsed = parseColumns(tag, get('columns'));
      for (const name of legacy) {
        const raw = String(get(name) ?? '').trim().toLowerCase();
        if (raw === 'none' || raw === 'false') parsed.on.delete(name);
        else parsed.on.add(name);
      }
      if (legacyTitles != null) {
        const raw = String(legacyTitles).trim();
        parsed.titles = raw.toLowerCase() === 'none' ? 'none' : raw.split('|').map((s) => s.trim());
      }
      el.setAttribute('columns', serializeColumns(tag, parsed.on, parsed.titles));
      for (const name of legacy) el.removeAttribute(name);
      if (legacyTitles != null) el.removeAttribute('labels');
      warn(
        `columns:${tag}`,
        `的 ${[...legacy, ...(legacyTitles != null ? ['labels'] : [])].join(' / ')} 已并成 columns；` +
          `请写成 columns="${serializeColumns(tag, parsed.on, parsed.titles)}"`
      );
    }
  }

  /* --------------------------------------------------- 15.2 间距 → gap/pad */
  // 直接改名：像素间距 / 内距也走 gap / pad（数字就是像素）。
  for (const [from, to] of [
    ['gap-px', 'gap'],
    ['pad-px', 'pad'],
  ]) {
    const raw = get(from);
    if (raw == null) continue;
    el.removeAttribute(from);
    // 旧名是"现在这一次"的意图：覆盖上一次折叠留下的新值（动态改属性 / 切预设）。
    el.setAttribute(to, raw);
    warn(`space:${from}`, `的 ${from}="${raw}" 已并成 ${to}；请写成 ${to}="${raw}"`);
  }
  // 轴向：gap-x / gap-y（grid）与 pad-x / pad-y（box）折成 "x y"。
  for (const axis of [
    { tags: ['vk-grid'], from: ['gap-x', 'gap-y'], to: 'gap', fallback: 'md' },
    { tags: ['vk-box'], from: ['pad-x', 'pad-y'], to: 'pad', fallback: '0' },
  ]) {
    if (!axis.tags.includes(tag)) continue;
    if (get(axis.from[0]) == null && get(axis.from[1]) == null) continue;
    const base = parseSpace(get(axis.to));
    const x = get(axis.from[0]) ?? base?.x ?? axis.fallback;
    const y = get(axis.from[1]) ?? base?.y ?? axis.fallback;
    el.removeAttribute(axis.from[0]);
    el.removeAttribute(axis.from[1]);
    el.setAttribute(axis.to, String(x) === String(y) ? String(x) : `${x} ${y}`);
    warn(`space:${axis.to}:${tag}`, `的 ${axis.from.join(' / ')} 已并成 ${axis.to}；请写成 ${axis.to}="${x === y ? x : `${x} ${y}`}"`);
  }

  /* ---------------------------------------------------- 15.2 箭头 → arrow */
  // cap / arrow-style / arrow-size / arrow-scale / arrow-label / head 六个别名
  // 全折进 arrow 一个词：end:open、size:40、scale:0.12、label:gcc、cap:start。
  const arrowOld = {
    'vk-edge': ['cap', 'arrow-style', 'arrow-size'],
    'vk-flow': ['arrow-scale', 'arrow-label'],
    'vk-annotate': ['head', 'arrow-scale', 'arrow-label'],
  }[tag];
  if (arrowOld && arrowOld.some((name) => get(name) != null)) {
    if (tag === 'vk-flow') {
      // flow 的 arrow 还是"画不画"：true / false，后面接 scale / label。
      const raw = get('arrow');
      const on = !(raw != null && ['false', '0', 'off', 'none', 'no'].includes(raw.trim().toLowerCase()));
      const cfg = parseArrow(raw);
      let scale = cfg.scale;
      let label = cfg.label;
      if (get('arrow-scale') != null) {
        const n = Number(get('arrow-scale'));
        if (Number.isFinite(n)) scale = n;
      }
      if (get('arrow-label') != null) label = String(get('arrow-label')).trim() || null;
      for (const name of arrowOld) el.removeAttribute(name);
      const next = serializeFlowArrow({ on, scale, label });
      el.setAttribute('arrow', next);
      warn('arrow:flow', `的 arrow-scale / arrow-label 已并成 arrow；请写成 arrow="${next}"`);
    } else {
      const cfg = parseArrow(get('arrow'));
      if (tag === 'vk-edge' && get('cap') != null) {
        const raw = String(get('cap')).trim().toLowerCase();
        cfg.dot = raw === 'dot' ? 'start' : null;
      }
      if (tag === 'vk-edge' && get('arrow-style') != null) {
        const raw = String(get('arrow-style')).trim().toLowerCase();
        if (raw === 'solid' || raw === 'open' || raw === 'thin') cfg.style = raw;
      }
      if (tag === 'vk-edge' && get('arrow-size') != null) {
        const n = Number(get('arrow-size'));
        if (Number.isFinite(n)) cfg.size = n;
      }
      if (tag === 'vk-annotate' && get('head') != null) {
        const raw = String(get('head')).trim().toLowerCase();
        cfg.end = raw === 'arrow';
        cfg.dot = raw === 'dot' ? 'end' : null;
      }
      if (tag === 'vk-annotate' && get('arrow-scale') != null) {
        const n = Number(get('arrow-scale'));
        if (Number.isFinite(n)) cfg.scale = n;
      }
      if (tag === 'vk-annotate' && get('arrow-label') != null) {
        cfg.label = String(get('arrow-label')).trim() || null;
      }
      for (const name of arrowOld) el.removeAttribute(name);
      const next = serializeArrow(cfg);
      el.setAttribute('arrow', next);
      warn('arrow', `的 ${arrowOld.join(' / ')} 已并成 arrow；请写成 arrow="${next}"`);
    }
  }

  /* ---------------------------------------------------- 15.2 屏障 → fence */
  if (tag === 'vk-asm' && (get('fence-after') != null || get('fence-label') != null)) {
    const cfg = parseFence(get('fence'));
    if (get('fence-after') != null) {
      const raw = String(get('fence-after')).trim();
      cfg.after = /^\d+$/.test(raw) ? raw : '';
      el.removeAttribute('fence-after');
    }
    if (get('fence-label') != null) {
      cfg.label = String(get('fence-label')).trim() || '内存屏障';
      el.removeAttribute('fence-label');
    }
    const next = serializeFence(cfg);
    if (next) el.setAttribute('fence', next);
    else el.removeAttribute('fence');
    warn('fence', `的 fence-after / fence-label 已并成 fence；请写成 fence="${next}"`);
  }

  /* ------------------------------------------------ 15.2 工序进度 → counter */
  if (tag === 'vk-label' && (get('index') != null || get('total') != null)) {
    // 两个旧名可能分两次写进来（index 先、total 后）：以当前 counter 为底再合成。
    const base = parseCounter(get('counter'));
    const indexRaw = get('index');
    const totalRaw = get('total');
    const index = indexRaw != null ? String(indexRaw).trim() : String(base.index);
    const total = totalRaw != null ? String(totalRaw).trim() : String(base.total);
    el.removeAttribute('index');
    el.removeAttribute('total');
    const next = /^\d+$/.test(index) ? (/^\d+$/.test(total) ? `${index}/${total}` : index) : '';
    // 动态改旧名时旧值优先；没有分子（只写了 total）就清掉。
    if (next) el.setAttribute('counter', next);
    else el.removeAttribute('counter');
    warn('counter', `的 index / total 已并成 counter；请写成 counter="${next}"`);
  }

  /* ------------------------------------------- 15.2 对照两图 → labels="a,b" */
  if (tag === 'vk-compare' && (get('a') != null || get('b') != null)) {
    // 两个旧名可能分两次写进来（a 先、b 后）：以当前 a/b 的合并值为准，
    // 角标从 labels 里保留（label-a / label-b 也先折进 labels 的竖线段）。
    const parsed = parseCompareLabels(get('labels'));
    const next = {
      a: String(get('a') ?? parsed.a ?? '').trim(),
      b: String(get('b') ?? parsed.b ?? '').trim(),
      la: parsed.la,
      lb: parsed.lb,
    };
    el.removeAttribute('a');
    el.removeAttribute('b');
    el.setAttribute('labels', serializeCompareLabels(next));
    warn('compare:labels', `的 a / b 已并成 labels="a,b"；请写成 labels="${serializeCompareLabels(next)}"`);
  }
}

/* --------------------------------------------------------------- 15.2 间距落点 */

/** 档位 / 像素 → inline 值；不认识的 token 返回空串（保留 CSS 默认）。 */

/**
 * 把 pad / gap 落到真正的内距 / 沟槽上。
 *
 * 之所以由 JS 写而不再用 `[pad='md lg']` 这类选择器：两个轴的组合是 8×8，
 * CSS 要么写 64 条规则，要么没法表达。这里只写四条 longhand / 两条 gap。
 * `spaceCss` 返回的是 `var(--vk-sN)`，与原来的 CSS 令牌引用同源，逐像素不变。
 */
export function applySpacing(el) {
  const tag = el.tagName?.toLowerCase();
  if (tag === 'vk-box') {
    const parsed = parseSpace(el.getAttribute('pad'));
    const x = parsed ? spaceCss(parsed.x) : '';
    const y = parsed ? spaceCss(parsed.y) : '';
    for (const side of ['Left', 'Right']) {
      if (x) el.style[`padding${side}`] = x;
      else el.style.removeProperty(`padding-${side.toLowerCase()}`);
    }
    for (const side of ['Top', 'Bottom']) {
      if (y) el.style[`padding${side}`] = y;
      else el.style.removeProperty(`padding-${side.toLowerCase()}`);
    }
    return;
  }
  if (tag === 'vk-grid') {
    const parsed = parseSpace(el.getAttribute('gap'));
    const x = parsed ? spaceCss(parsed.x) : '';
    const y = parsed ? spaceCss(parsed.y) : '';
    if (x) el.style.columnGap = x;
    else el.style.removeProperty('column-gap');
    if (y) el.style.rowGap = y;
    else el.style.removeProperty('row-gap');
  }
}

/** 13.0 的名字，保留给旧 import。 */
export const normalizeTier = normalizeVocab;

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
  // 直接引用 token，行为和 12.x 一致。新名（caption / headline / display）是同一件事。
  if (['caption', 'label', 'body', 'headline', 'subhead', 'display', 'title', 'hero'].includes(v)) {
    el.style.maxWidth = `var(--vk-measure-${v})`;
    return;
  }
  const n = Number(v);
  if (Number.isInteger(n) && n >= 8 && n <= 60) el.style.maxWidth = n + 'em';
  else el._warnOnce?.('measure', `的 measure="${v}" 只能是 none、8–60 的整数（一行几个字）或档名（caption/body/headline/display，旧名照旧可用）`);
}

/* --------------------------------------------------------------- 内容字号 */

/** size 允许的语义档：数值是像素，名字是同一套字号 token（唯一真源在 vocab）。 */
const CONTENT_SIZE_TIERS = new Set(SIZE_TIERS);

/**
 * 内容组件的字号：size="160" 是像素，size="body" 是语义档。
 *
 * 只写一个宿主变量 --vk-cs；行高、行号、内距、语法色块都在 CSS 里从它派生，
 * 所以不会出现"字放大了、行号还是 48"这种半缩放。不写 size 时不动变量，
 * 宿主 CSS 的默认值就是今天的样子（逐像素不变）。
 */
export function applyContentSize(el) {
  const raw = (el.getAttribute?.('size') || '').trim();
  const fit = el.getAttribute?.('fit') === 'width';
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) el.style.setProperty('--vk-cs', n + 'px');
    else if (CONTENT_SIZE_TIERS.has(raw)) el.style.setProperty('--vk-cs', `var(--vk-t-${raw})`);
    else {
      el.style.removeProperty('--vk-cs');
      el._warnOnce?.('size', `的 size="${raw}" 不是像素数，也不是字号档名（body / headline / caption …），已忽略`);
    }
  } else {
    el.style.removeProperty('--vk-cs');
  }
  if (raw) el.dataset.contentSize = raw;
  else delete el.dataset.contentSize;
  // 契约读 data-fit；它同时也是"这一块靠运行期铺满"的声明。
  if (fit) el.dataset.fit = 'width';
  else delete el.dataset.fit;
  if (fit) el.dataset.vkPlace = '';
  else if (el.hasAttribute('data-vk-place')) {
    el.removeAttribute('data-vk-place');
    el._unregisterPlace?.();
  }
}

/**
 * fit="width" 的内容块：把最宽的一行放大/缩小到容器宽。
 *
 * 做法和 vk-text 的 fit 同一个思路（量自然宽 → 按比例改字号），只是量的是
 * 整块内容：临时把内容根设成 max-content，量完还原。行高/内距也随字号走，
 * 所以第一次按比例算就能收敛，再做一次只吸收 subpixel 误差。
 */
export function fitContent(el, rootSel) {
  if (!HAS_DOM || !el.isConnected || el.getAttribute?.('fit') !== 'width') return;
  const root = el.querySelector(rootSel);
  if (!root) return;
  const target = root.parentElement?.clientWidth || el.clientWidth;
  if (!target) return;

  const naturalWidth = () => {
    const prev = [root.style.width, root.style.maxWidth, root.style.overflow];
    root.style.width = 'max-content';
    root.style.maxWidth = 'none';
    root.style.overflow = 'visible';
    const w = root.offsetWidth;
    [root.style.width, root.style.maxWidth, root.style.overflow] = prev;
    return w;
  };

  const fitOnce = () => {
    const natural = naturalWidth();
    if (!natural) return false;
    const current = parseFloat(getComputedStyle(root).fontSize) || 0;
    if (!current) return false;
    const next = Math.max(8, current * (target / natural));
    el.style.setProperty('--vk-cs', next.toFixed(2) + 'px');
    return Math.abs(next - current) > 0.05;
  };

  fitOnce();
  // 第二遍只吸收 hinting / 小数像素的误差；不会来回震荡。
  const natural = naturalWidth();
  if (natural) {
    const current = parseFloat(getComputedStyle(root).fontSize) || 0;
    if (current) el.style.setProperty('--vk-cs', Math.max(8, current * (target / natural)).toFixed(2) + 'px');
  }
}

/* --------------------------------------------------------------- 出血 */

/**
 * 出血：通用属性 bleed="x|y|all|none"。
 *
 * 真正的几何在 CSS 里（负 margin + 100% + 2×版心边距），这里只把作者写的值
 * 镜像到 data-bleed：运行时改属性也能立刻生效，契约也能读到"改了就变"。
 */
export function applyBleed(el) {
  const raw = (el.getAttribute?.('bleed') || '').trim();
  if (!raw || raw === 'none') delete el.dataset.bleed;
  else el.dataset.bleed = raw;
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
    // 值层迁移：旧档名（display-2xl / heading / meta …）与 15.2 的别名在连上 DOM
    // 的第一刻折成新名。折完再往下走，所以 CSS、文档、契约都只认一套词。
    normalizeTier(this);
    applySpacing(this);
    applyMeasure(this);
    applyBleed(this);
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
    // 15.2 的旧名也要能被动态改写：折成新名后重画一次（新名自己的回调会再触发）。
    if (DEPRECATED_ATTRS.includes(name)) {
      normalizeTier(this);
      applySpacing(this);
      this._schedulePaint();
      return;
    }
    // 行宽 / 间距是纯样式，不重建子树，属性一变就立刻重算。
    if (name === 'measure') applyMeasure(this);
    if (name === 'bleed') applyBleed(this);
    if (name === 'pad' || name === 'gap') applySpacing(this);
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

  /**
   * 预编译缺失 / 过期时警告一次。
   *
   * build:false 用于"没有构建产物可补"的情况（比如位数据写错）：
   * 否则提示会让人去跑 vk build，而真正要改的是这一块的属性。
   */
  stale(reason, { build = true } = {}) {
    this.dataset.vkStale = '1';
    if (this._loading) return;
    this._warnOnce('stale', build ? `${reason}。运行 npx vk build 生成预编译数据。` : reason);
  }
}

/* ---------------------------------------------------------------- 布局 */

/**
 * 布局队列。整个 window 只有一份：
 * `document.write` / `setContent` 这类场景会在同一个 window 上重新执行本 bundle，
 * 自定义元素注册表仍在（注册表属于 window），元素用的还是上一份的类——
 * 这时如果换一个新的 Set，layout() 就会看不到那些元素。复用旧的队列。
 */
export const PLACE = VK._place instanceof Set ? VK._place : new Set();
export const EDGES = VK._edges instanceof Set ? VK._edges : new Set();
VK._place = PLACE;
VK._edges = EDGES;

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

  // 别名也在等：旧页写 <vk-pin> 时，它和本体一样要渲染完。
  const tags = ALL_TAG_NAMES.join(',');
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







