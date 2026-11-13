/** 构建期：窗口皮、页面、flow、卡片、图片、整页包装。 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { attrOf, hasAttr, serialize, raw, esc, textOf } from '../shared/dom.mjs';
import { setStyle } from '../normalize.mjs';
import { GAP } from '../vocab.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');

export function frame({ title, body, range, digits, kind = 'code' }) {
  const hd = title
    ? `<div class="vk-fhd"><span class="vk-fmark" aria-hidden="true"></span><span class="vk-ftitle">${esc(title)}</span>${
        range ? `<span class="vk-frange">${esc(range)}</span>` : ''
      }</div>`
    : '';
  return `<div class="vk-frame" data-kind="${kind}"${digits ? ` style="--vk-ln-digits:${digits}"` : ''}>${hd}<div class="vk-fbd">${body}</div></div>`;
}

export function buildFlow(node) {
  const cols = attrOf(node, 'cols') || '1';
  const gap = Number(attrOf(node, 'gap') in GAP ? GAP[attrOf(node, 'gap')] : Number(String(attrOf(node, 'gap') || '').replace(/px$/i, '')) || GAP.normal);
  /* 每一层 flow 都把列模板写死：否则子 flow 会继承父级模板。 */
  let template;
  if (cols === 'auto') template = 'none';
  else if (/^\d+$/.test(cols)) template = `repeat(${cols}, minmax(0, 1fr))`;
  else template = cols.split(/\s+/).map((n) => (/^\d+$/.test(n) ? `${n}fr` : n)).join(' ');

  /* 两栏里一侧是一句短批注：自动堆叠，不让侧栏留孤字。 */
  const tags = (node.childNodes || []).filter((c) => c.tagName);
  const texts = tags.filter((c) => c.tagName === 'vk-text');
  const others = tags.filter((c) => c.tagName !== 'vk-text');
  const shortNote = texts.length === 1 && others.length === 1 && textOf(texts[0]).trim().length <= 15;
  if (shortNote) {
    template = 'minmax(0, 1fr)';
    node.attrs.push({ name: 'data-vk-stack', value: '1' });
  }

  setStyle(node, { '--vk-gap': `${gap}px`, '--vk-cols-template': template });
  if (cols === 'auto') node.attrs.push({ name: 'data-cols', value: 'auto' });

  for (const child of (node.childNodes || []).filter((c) => c.tagName)) {
    if (!hasAttr(child, 'span')) continue;
    const n = Number(attrOf(child, 'span'));
    if (!Number.isFinite(n) || n <= 1) continue;
    setStyle(child, { '--vk-span': n });
  }
}

export function buildCard(node) {
  const title = attrOf(node, 'title');
  const body = (node.childNodes || []).map(serialize).join('');
  const hd = title ? `<div class="vk-fhd vk-fhd-plain"><span class="vk-ftitle">${esc(title)}</span></div>` : '';
  node.childNodes = [raw(`${hd}<div class="vk-fbd">${body}</div>`)];
}

export function buildPage(node) {
  const list = node.childNodes || [];
  const head = list.find((c) => c.tagName === 'vk-head');
  const rest = list.filter((c) => c !== head);
  const stage = `<div class="vk-stage">${head ? serialize(head) : ''}<div class="vk-body">${rest.map(serialize).join('')}</div></div>`;
  node.childNodes = [raw(stage)];
}

export function buildImg(node, file) {
  const src = attrOf(node, 'src');
  if (!src) return;
  const alt = attrOf(node, 'alt') || '';
  const position = attrOf(node, 'position') || '50% 50%';
  const ratio = attrOf(node, 'ratio');
  let href = src;
  if (!/^[a-z]+:|^\/\//i.test(src)) href = pathToFileURL(path.resolve(path.dirname(path.resolve(file)), src)).href;
  if (ratio) setStyle(node, { 'aspect-ratio': ratio });
  node.childNodes = [raw(`<img class="vk-img-el" src="${esc(href)}" alt="${esc(alt)}" style="object-position:${esc(position)}">`)];
}

export const LIBS = {
  fonts: pathToFileURL(path.join(ROOT, 'dist/fonts.css')).href,
  css: pathToFileURL(path.join(ROOT, 'dist/vk.css')).href,
  js: pathToFileURL(path.join(ROOT, 'dist/vk.js')).href,
};

export function wrapFragment(body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${LIBS.fonts}">
<link rel="stylesheet" href="${LIBS.css}">
</head>
<body>
${body}
<script src="${LIBS.js}"></script>
</body>
</html>
`;
}

export function rewriteLinks(doc, file) {
  for (const node of (function walk(n, out = []) {
    out.push(n);
    for (const c of n.childNodes || []) walk(c, out);
    return out;
  })(doc)) {
    if (node.nodeName !== 'link' && node.nodeName !== 'script') continue;
    const name = node.nodeName === 'link' ? 'href' : 'src';
    const a = (node.attrs || []).find((x) => x.name === name);
    if (!a || /^[a-z]+:|^\/\/|^#/i.test(a.value)) continue;
    a.value = pathToFileURL(path.resolve(path.dirname(path.resolve(file)), a.value)).href;
  }
}
