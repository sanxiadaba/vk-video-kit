/**
 * v20 · 归一化
 * ----------------------------------------------------------------------------
 * 作者写的是「人话属性」，运行期只认「一种形状」。这一步在解析之后、渲染之前，
 * 把三件事一次做完，后面所有层都不再各自兜底：
 *
 *   1. 默认值落地：schema 里写了默认值的属性，缺省就写进 DOM。
 *      CSS 因此不再自带第二份默认值（vk-page 的 band、vk-surface 的 pad/radius
 *      过去都死在「CSS 初始态 ≠ schema 默认值」上）。
 *   2. 间距归一：gap / pad 的档名与像素值统一换成 --vk-gap / --vk-pad。
 *      构建期与运行期只读一个数，不再各自 Number()。
 *   3. style 合并：一个元素最多一个 style。作者写的保留，生成的合并进去。
 *
 * 这里不发明值：所有默认值来自 schema.mjs，所有间距档位来自 vocab.mjs。
 */
import { attrsOf } from './schema.mjs';
import { GAP } from './vocab.mjs';

export const spacePx = (value, fallback = 0) => {
  const t = String(value ?? '').trim();
  if (t === '') return fallback;
  if (Object.prototype.hasOwnProperty.call(GAP, t)) return GAP[t];
  const n = Number(t.replace(/px$/i, ''));
  return Number.isFinite(n) ? n : fallback;
};

/* 这些属性不写默认值：写进去会改变「有没有写」的语义，或者属于子项/逃生口。 */
const NO_DEFAULT = new Set([
  'span', 'bleed', 'x', 'y', 'w', 'h', 'z',
  'current', 'fold', 'lines', 'state',
  'src', 'id', 'class', 'style', 'role', 'hidden', 'alt', 'href',
]);

const attrOf = (node, name) => (node.attrs || []).find((a) => a.name === name)?.value ?? null;
const hasAttr = (node, name) => (node.attrs || []).some((a) => a.name === name);

const setAttr = (node, name, value) => {
  if (!hasAttr(node, name)) node.attrs.push({ name, value: String(value) });
};

const walk = (node, out = []) => {
  out.push(node);
  for (const child of node.childNodes || []) walk(child, out);
  return out;
};

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

/** 在整棵树里落地默认值、间距与样式。返回同一棵树。 */
export function normalizeTree(root) {
  for (const node of walk(root)) {
    const tag = node.tagName;
    if (!tag?.startsWith('vk-')) continue;
    const spec = attrsOf(tag);
    const decls = {};

    for (const [name, def] of Object.entries(spec)) {
      if (def.default === undefined || def.when || NO_DEFAULT.has(name)) continue;
      setAttr(node, name, def.default);
    }

    for (const [name, def] of Object.entries(spec)) {
      if (def.type !== 'space') continue;
      const value = attrOf(node, name);
      if (value == null) continue;
      const px = spacePx(value, 0);
      if (name === 'gap') decls['--vk-gap'] = `${px}px`;
      else if (name === 'pad') decls['--vk-pad'] = `${px}px`;
    }

    if (Object.keys(decls).length) setStyle(node, decls);
  }
  return root;
}
