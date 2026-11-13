/** 解析树工具与序列化：构建期唯一的一份。 */

const VOID = new Set(['img', 'br', 'hr', 'meta', 'link', 'input', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);
const RAWTEXT = new Set(['script', 'style', 'textarea', 'title']);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const attrOf = (node, name) => (node.attrs || []).find((a) => a.name === name)?.value ?? null;
export const hasAttr = (node, name) => (node.attrs || []).some((a) => a.name === name);
export const lineOf = (node) => node.sourceCodeLocation?.startLine || 1;
export const kids = (node) => (node.childNodes || []).filter((c) => c.tagName);

export const flatten = (node, out = []) => {
  out.push(node);
  for (const c of node.childNodes || []) flatten(c, out);
  return out;
};

export const textOf = (node) =>
  (node.childNodes || [])
    .map((c) => (c.nodeName === '#text' ? c.value : c.tagName === 'script' ? '' : textOf(c)))
    .join('');

/** 直接写在元素里的非空白文字。 */
export const directText = (node) =>
  (node.childNodes || [])
    .filter((c) => c.nodeName === '#text' && c.value.trim())
    .map((c) => c.value.trim())
    .join(' ');

export const raw = (html) => ({ nodeName: '#raw', value: html, childNodes: [], attrs: [] });

const attrText = (attrs) => (attrs || []).map((a) => (a.value ? ` ${a.name}="${esc(a.value)}"` : ` ${a.name}`)).join('');

export function serialize(node) {
  if (!node) return '';
  switch (node.nodeName) {
    case '#document':
    case '#document-fragment':
      return (node.childNodes || []).map(serialize).join('');
    case '#documentType':
      return '<!doctype html>';
    case '#text':
      return esc(node.value || '');
    case '#comment':
      return `<!--${node.data || ''}-->`;
    case '#raw':
      return node.value;
    default: {
      const tag = node.tagName;
      if (!tag) return (node.childNodes || []).map(serialize).join('');
      if (RAWTEXT.has(tag)) return `<${tag}${attrText(node.attrs)}>${(node.childNodes || []).map((c) => c.value || '').join('')}</${tag}>`;
      const open = `<${tag}${attrText(node.attrs)}>`;
      if (VOID.has(tag)) return open;
      return `${open}${(node.childNodes || []).map(serialize).join('')}</${tag}>`;
    }
  }
}
