/** 构建期：窗口皮、页面、flow、卡片、图片、整页包装。 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { attrOf, hasAttr, serialize, raw, esc, textOf } from '../shared/dom.mjs';
import { setStyle } from '../normalize.mjs';
import { TAGS } from '../schema.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');

/* 所有「文本网格」共用这一张皮：8px 边、标题、右侧范围。没有三点、没有彩色。 */
export function frame({ title, body, range, digits, kind = 'code' }) {
  const hd = title
    ? `<div class="vk-fhd"><span class="vk-ftitle">${esc(title)}</span>${
        range ? `<span class="vk-frange">${esc(range)}</span>` : ''
      }</div>`
    : '';
  return `<div class="vk-frame" data-kind="${kind}"${digits ? ` style="--vk-ln-digits:${digits}"` : ''}>${hd}<div class="vk-fbd">${body}</div></div>`;
}

export function buildFlow(node) {
  /* cols 只认整数 / auto；比例走 split（"7 5" → 7fr 5fr）。 */
  const cols = String(attrOf(node, 'cols') ?? '').trim();
  const split = String(attrOf(node, 'split') ?? '').trim();
  const fr = (t) => (/^\d+(\.\d+)?$/.test(t) ? `${t}fr` : t);
  let template = 'minmax(0, 1fr)';
  if (split) template = split.split(/\s+/).filter(Boolean).map(fr).join(' ');
  else if (cols === 'auto') template = 'none';
  else if (/^\d+$/.test(cols)) template = `repeat(${cols}, minmax(0, 1fr))`;

  /* gap 由 normalize 统一定（见 normalize.mjs）：这里只写列模板。
     每一层 flow 都把列模板写死：否则子 flow 会继承父级模板。 */
  setStyle(node, { '--vk-cols-template': template });
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

/* ------------------------------------------------------------------ 标注
   形态推断：有正文 → note，无正文 → mark；as 写死就用写的。
   for 是 v26 的旧名，构建期接住并改成 target，运行期只认 as / target。 */
const calloutAs = (node) => {
  const declared = attrOf(node, 'as') || attrOf(node, 'mode');
  if (declared && TAGS['vk-callout'].variants[declared]) return declared;
  return textOf(node).trim() ? 'note' : 'mark';
};

export function buildCallout(node) {
  const as = calloutAs(node);
  const target = attrOf(node, 'target') || attrOf(node, 'for');
  const rest = (node.attrs || []).filter((a) => !['as', 'mode', 'for', 'target', 'data-as'].includes(a.name));
  node.attrs = [...rest, { name: 'as', value: as }, ...(target ? [{ name: 'target', value: target }] : []), { name: 'data-as', value: as }];
}

export function buildPage(node) {
  const list = node.childNodes || [];
  const head = list.find((c) => c.tagName === 'vk-head');
  const rest = list.filter((c) => c !== head);
  /* 有「一句话」的注记：正文右侧让出一列，注记只用这一列，永远不压内容。
     注记也可能写在 flow 里，所以递归找。 */
  const hasNote = (function walk(nodes) {
    return (nodes || []).some((c) => {
      if (c.tagName === 'vk-callout' && calloutAs(c) === 'note') return true;
      return walk(c.childNodes);
    });
  })(rest);
  if (hasNote) node.attrs.push({ name: 'data-vk-anno', value: 'right' });
  const stage = `<div class="vk-stage">${head ? serialize(head) : ''}<div class="vk-body">${rest.map(serialize).join('')}</div></div>`;
  node.childNodes = [raw(stage)];
}

export function buildImg(node, ctx) {
  const src = attrOf(node, 'src');
  if (!src) return;
  const alt = attrOf(node, 'alt') || '';

  /* bleed 只在合法位置生效：x 给 flow 子项，all 给 page 第一层。
     放错了就忽略（删掉属性，免得 CSS 把图绝对定位），图照出；校验已报的位置信息不重复报。 */
  const bleed = attrOf(node, 'bleed');
  if (bleed) {
    const parent = node.parentNode?.tagName;
    const ok = bleed === 'all' ? parent === 'vk-page' : parent === 'vk-flow';
    if (!ok) {
      if (!ctx.diag.has(node, 'ATTR_PLACEMENT')) {
        ctx.diag(node, {
          code: 'ATTR_PLACEMENT',
          message: `<vk-img> 的 bleed="${bleed}" 位置不对，已忽略`,
          fix: bleed === 'all' ? 'bleed="all" 只给 <vk-page> 第一层的 <vk-img>' : 'bleed="x" 只给 <vk-flow> 的直接子项',
        });
      }
      node.attrs = (node.attrs || []).filter((a) => a.name !== 'bleed');
    }
  }

  /* aspect 接受 "16 / 9" 和 "16:9"；写坏了不猜，报一条。 */
  const aspect = attrOf(node, 'aspect');
  if (aspect != null && aspect !== '') {
    const m = String(aspect).match(/^\s*(\d+(?:\.\d+)?)\s*[/:]\s*(\d+(?:\.\d+)?)\s*$/);
    if (m) setStyle(node, { 'aspect-ratio': `${m[1]} / ${m[2]}` });
    else if (!ctx.diag.has(node, 'VALUE_RATIO')) ctx.diag(node, { code: 'VALUE_RATIO', message: `<vk-img> 的 aspect="${aspect}" 不是比例`, fix: '写 "16 / 9" 或 "16:9"' });
  }

  const fitRaw = attrOf(node, 'fit') || 'contain';
  const fit = fitRaw === 'cover' ? 'cover' : 'contain';
  const focusRaw = attrOf(node, 'focus') || '50% 50%';
  const focus = /^[\w.%\s-]+$/.test(focusRaw) ? focusRaw : '50% 50%';
  if (focusRaw !== focus && !ctx.diag.has(node, 'VALUE_ENUM')) ctx.diag(node, { code: 'VALUE_ENUM', message: `<vk-img> 的 focus="${focusRaw}" 不是焦点位置`, fix: '写 "50% 50%" 或 "left top" 这类' });

  const remote = /^[a-z]+:|^\/\//i.test(src);
  if (!remote && !ctx.resolveAsset(src)) {
    ctx.diag(node, { code: 'SRC_MISSING', message: `图片不存在：${src}`, fix: '路径相对页面文件解析；写错了就在图上画一块占位，不会出破图标' });
    node.childNodes = [raw(`<div class="vk-missing">图片不存在：${esc(src)}</div>`)];
    return;
  }
  const href = remote ? src : pathToFileURL(path.resolve(path.dirname(path.resolve(ctx.file)), src)).href;
  node.childNodes = [raw(`<img class="vk-img-el" src="${esc(href)}" alt="${esc(alt)}" style="object-fit:${fit};object-position:${focus}">`)];
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

/** 作者写了整页 HTML 时，补上 dist 的三件；已有就尊重。 */
export function ensureLibs(doc) {
  const html = (doc.childNodes || []).find((n) => n.tagName === 'html');
  const head = (html?.childNodes || []).find((n) => n.tagName === 'head');
  const body = (html?.childNodes || []).find((n) => n.tagName === 'body');
  if (head) {
    const links = (head.childNodes || []).filter((n) => n.tagName === 'link').map((n) => attrOf(n, 'href') || '');
    if (!links.includes(LIBS.fonts)) head.childNodes.push(raw(`<link rel="stylesheet" href="${LIBS.fonts}">`));
    if (!links.includes(LIBS.css)) head.childNodes.push(raw(`<link rel="stylesheet" href="${LIBS.css}">`));
  }
  if (body) {
    const scripts = (body.childNodes || []).filter((n) => n.tagName === 'script').map((n) => attrOf(n, 'src') || '');
    if (!scripts.includes(LIBS.js)) body.childNodes.push(raw(`<script src="${LIBS.js}"></script>`));
  }
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
