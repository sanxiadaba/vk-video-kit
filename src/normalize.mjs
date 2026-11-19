/**
 * v27 · 归一化
 * ----------------------------------------------------------------------------
 * 作者写的是「人话属性」，运行期只认「一种形状」。这一步在解析之后、渲染之前，
 * 把四件事一次做完，后面所有层都不再各自兜底：
 *
 *   1. 布尔归一：current="false" / hex="0" 真的关掉，不再「有属性就真」。
 *   2. 上下文默认：两栏里的代码窗默认 caption；卡片 surface 默认 auto。
 *   3. 默认值落地：schema 里写了默认值的属性，缺省就写进 DOM（变体优先）。
 *   4. 组件身份：每个件写 data-vk / data-as，CSS 只认这两个钩子。
 *
 * 这里不发明值：所有默认值来自 schema.mjs，所有间距档位来自 vocab.mjs。
 */
import { TAGS, attrsOf, variantOf } from './schema.mjs';
import { GAP, STYLE_LOCKED } from './vocab.mjs';

export const spacePx = (value, fallback = 0) => {
  const t = String(value ?? '').trim();
  if (t === '') return fallback;
  if (Object.prototype.hasOwnProperty.call(GAP, t)) return GAP[t];
  const n = Number(t.replace(/px$/i, ''));
  return Number.isFinite(n) ? n : fallback;
};

const attrOf = (node, name) => (node.attrs || []).find((a) => a.name === name)?.value ?? null;
const hasAttr = (node, name) => (node.attrs || []).some((a) => a.name === name);
const setAttr = (node, name, value) => {
  if (!hasAttr(node, name)) node.attrs.push({ name, value: String(value) });
};
const dropAttr = (node, name) => {
  node.attrs = (node.attrs || []).filter((a) => a.name !== name);
};

const walk = (node, out = []) => {
  out.push(node);
  for (const child of node.childNodes || []) walk(child, out);
  return out;
};

const FALSEY = new Set(['false', '0', 'no', 'off', 'null', 'none']);
const TRUTHY = new Set(['true', '1', 'yes', 'on', '']);

/** 把 style 字符串拆成有序 map。 */
export function styleMap(node) {
  const map = new Map();
  for (const piece of String(attrOf(node, 'style') ?? '').split(';')) {
    const at = piece.indexOf(':');
    if (at < 0) continue;
    const key = piece.slice(0, at).trim();
    if (key) map.set(key, piece.slice(at + 1).trim());
  }
  return map;
}

/** 合并声明，保证只有一个 style 属性。 */
export function setStyle(node, decls) {
  const map = styleMap(node);
  for (const [key, value] of Object.entries(decls)) {
    if (value !== undefined && value !== null && value !== '') map.set(key, String(value));
  }
  const value = [...map].map(([k, v]) => `${k}:${v}`).join(';');
  const rest = (node.attrs || []).filter((a) => a.name !== 'style');
  if (value) rest.push({ name: 'style', value });
  node.attrs = rest;
}

/** style 只留颜色 token；锁定的字号/间距/字体等一律删掉，报错交给 validate。
    只报不删会让作者以为被拦了，画面却已经变了。 */
function sanitizeStyle(node) {
  const style = attrOf(node, 'style');
  if (!style) return;
  const kept = [];
  for (const piece of String(style).split(';')) {
    const at = piece.indexOf(':');
    if (at < 0) continue;
    const prop = piece.slice(0, at).trim();
    if (!prop.startsWith('--vk-')) continue;
    if (STYLE_LOCKED.test(prop)) continue;
    kept.push(piece.trim());
  }
  const rest = (node.attrs || []).filter((a) => a.name !== 'style');
  if (kept.length) rest.push({ name: 'style', value: kept.join(';') });
  node.attrs = rest;
}

/** flow 的列数：split 是比例，cols 是列数；两栏以上才算「半栏」。 */
export function flowColumns(flow) {
  const split = attrOf(flow, 'split');
  if (split) return split.trim().split(/\s+/).filter(Boolean).length;
  const cols = String(attrOf(flow, 'cols') ?? '').trim();
  if (!cols || cols === 'auto') return 1;
  return cols.split(/\s+/).filter(Boolean).length;
}

/** 在整棵树里落地默认值、布尔、上下文默认、组件身份。返回同一棵树。 */
export function normalizeTree(root) {
  for (const node of walk(root)) {
    const tag = node.tagName;
    sanitizeStyle(node);
    if (!tag?.startsWith('vk-')) continue;
    const as = variantOf(tag, attrOf(node, 'as'));
    const spec = attrsOf(tag, as);
    const decls = {};

    /* 布尔先归一：存在即真，但 "false" 不是真。 */
    for (const [name, def] of Object.entries(spec)) {
      if (def.type !== 'bool') continue;
      const v = attrOf(node, name);
      if (v == null) continue;
      const s = String(v).trim().toLowerCase();
      if (FALSEY.has(s)) dropAttr(node, name);
      else if (TRUTHY.has(s)) dropAttr(node, name), setAttr(node, name, '');
    }

    /* 上下文默认：两栏里的代码窗默认 caption，免得 64px 直接被裁。 */
    if (tag === 'vk-code' && ['code', 'term', 'diff', 'asm'].includes(as) && !hasAttr(node, 'size')) {
      const parent = node.parentNode;
      if (parent?.tagName === 'vk-flow' && flowColumns(parent) > 1) setAttr(node, 'size', 'caption');
    }

    for (const [name, def] of Object.entries(spec)) {
      if (def.default === undefined || def.when) continue;
      /* infer 的默认值不落 DOM：库要看见「作者没写」才能推断（graph 布局 / callout 形态）。 */
      if (def.infer && !hasAttr(node, name)) continue;
      if (name === 'as' && !TAGS[tag].variants) continue;
      setAttr(node, name, def.default);
    }

    for (const [name, def] of Object.entries(spec)) {
      if (def.type !== 'space') continue;
      const value = attrOf(node, name);
      if (value == null) continue;
      /* 间距只在这一处落地：buildFlow 不再自己算一遍 gap。写错档名时回落到 normal，
         而不是 0——0 会让两栏贴在一起。 */
      const px = spacePx(value, name === 'gap' ? GAP.normal : 0);
      if (name === 'gap') decls['--vk-gap'] = `${px}px`;
    }

    if (Object.keys(decls).length) setStyle(node, decls);
    /* 身份：data-vk 是机制（page / code / board…），data-as 是变体（cells / diff…）。
       机制决定宿主样式，变体只决定这一块的画法。 */
    node.attrs.push({ name: 'data-vk', value: tag.slice(3) });
    if (as) node.attrs.push({ name: 'data-as', value: as });
  }
  /* 标注可以写在 flow 里（文档允许），但覆盖层的坐标是相对画布的。
     留在一个 position:relative 的 flow 里会被当成本地坐标，整条注记飞出画布。
     统一提升到 page：锚点仍按 id 找，视觉与坐标只认画布。 */
  for (const node of [...walk(root)]) {
    if (node.tagName !== 'vk-callout' || node.parentNode?.tagName !== 'vk-flow') continue;
    let page = node.parentNode;
    while (page && page.tagName !== 'vk-page') page = page.parentNode;
    if (!page) continue;
    const flow = node.parentNode;
    flow.childNodes = (flow.childNodes || []).filter((n) => n !== node);
    page.childNodes = [...(page.childNodes || []), node];
    node.parentNode = page;
  }
  return root;
}
