/**
 * 标本册生成器：31 个组件 = 31 张 1920×1080 帧。
 *
 * 每页五个镜头：成品 / 变体 / 解剖 / 用法 / API。
 * 页面本身是 vk 标签写成的；这里只做数据装配，不写站点样式。
 *
 *   node tools/specimens.mjs
 *   node tools/specimens.mjs --check
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseFragment, serializeOuter } from 'parse5';
import { TAGS, TAG_NAMES, LAYERS, byLayer } from '../src/registry.mjs';
import { SCENES } from '../src/scenes/scenes.mjs';
import { PRESETS } from '../src/scenes/presets.mjs';
import { NOTES, PARTNERS, VALUE_LABELS } from '../src/showcase/notes.mjs';
import { checkMode } from './lib/io.mjs';
import { hash32 } from '../src/shared/code.mjs';
import { sitePath } from './lib/paths.mjs';

const check = checkMode();
const LAYER_NAME = Object.fromEntries(LAYERS.map((l) => [l.id, l.label]));
const ORDER = [];
for (const layer of LAYERS) for (const tag of byLayer(layer.id)) ORDER.push(tag);

const INLINE = new Set(['vk-icon', 'vk-tag', 'vk-mark', 'vk-keys']);
const TALL = new Set(['vk-table', 'vk-frames', 'vk-page']);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sceneOf = new Map(SCENES.map((s) => [s.tag, s.body.trim()]));
const tagIndex = new Map(ORDER.map((tag, i) => [tag, i]));

/* ------------------------------------------------------------- 数据推导 */

function extractSnippet(tag) {
  const body = sceneOf.get(tag) || '';
  const frag = parseFragment(body);
  let found = null;
  const visit = (nodes) => {
    for (const n of nodes || []) {
      if (!found && n.tagName === tag) found = n;
      if (n.childNodes) visit(n.childNodes);
    }
  };
  visit(frag.childNodes);
  return found ? serializeOuter(found) : body;
}

function rootAttrs(snippet) {
  const m = snippet.trim().match(/^<[a-z0-9-]+([\s\S]*?)>/i);
  const out = new Map();
  if (!m) return out;
  for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) out.set(a[1], a[2]);
  return out;
}

function withWidth(snippet, tag, extra = '') {
  let s = snippet.trim();
  const hasW = !!TAGS[tag]?.attrs?.w;
  // vk-text 的 measure 会压过 w；这种文本不要再塞一个假的硬宽。
  if (tag === 'vk-page' || INLINE.has(tag) || !hasW || (tag === 'vk-text' && /\smeasure="/.test(s))) {
    return extra ? s.replace(new RegExp(`^<${tag}`), `<${tag} ${extra}`) : s;
  }
  if (!rootAttrs(s).has('w')) s = s.replace(new RegExp(`^<${tag}`), `<${tag} w="1400"`);
  if (extra) s = s.replace(new RegExp(`^<${tag}`), `<${tag} ${extra}`);
  return s;
}

/** 标本页正文只有 1680，任何大于 1400 的硬宽都收回来。 */
function clampWidth(s, max = 1400) {
  return s.replace(/\sw="(\d+)"/, (m, n) => ` w="${Math.min(Number(n), max)}"`);
}

const occurrences = new Map(TAG_NAMES.map((t) => [t, []]));
for (const [host, body] of sceneOf) {
  for (const tag of TAG_NAMES) {
    if (tag === host) continue;
    if (new RegExp(`<${tag}(?:\\s|>)`).test(body)) occurrences.get(tag).push(host);
  }
}
for (const list of occurrences.values()) {
  list.sort((a, b) => (tagIndex.get(a) ?? 0) - (tagIndex.get(b) ?? 0));
}

/* --------------------------------------------------------------- 控件 */

const PRIORITY = ['variant', 'density', 'surface', 'chrome', 'fit', 'size', 'tone', 'show', 'grows', 'summary', 'numbers', 'cols', 'group', 'ascii', 'address', 'align', 'display', 'bare', 'stripe', 'mono', 'flat', 'border', 'radius', 'orientation', 'current'];

function controlsOf(tag) {
  const attrs = TAGS[tag].attrs || {};
  const picked = [];
  for (const name of PRIORITY) {
    const spec = attrs[name];
    if (!spec || spec.content || spec.hidden || !spec.values || spec.values.length > 6) continue;
    picked.push(name);
  }
  if (!picked.length) {
    for (const [name, spec] of Object.entries(attrs)) {
      if (spec.content || spec.hidden || !spec.values || spec.values.length > 6) continue;
      picked.push(name);
    }
  }
  return picked.slice(0, 4);
}

function controlsHtml(tag, base) {
  const groups = controlsOf(tag).map((name) => {
    const spec = TAGS[tag].attrs[name];
    const on = base.get(name);
    const tags = spec.values
      .map((v) => `<vk-tag data-attr="${esc(name)}" data-value="${esc(v)}" tone="${on === v ? 'accent' : 'muted'}" size="meta">${esc(VALUE_LABELS[v] ?? v)}</vk-tag>`)
      .join('');
    return `<vk-stack gap="2xs" w="360">
      <vk-text size="meta" mono emphasis="muted">${esc(spec.label || name)}</vk-text>
      <vk-row gap="2xs" wrap>${tags}</vk-row>
    </vk-stack>`;
  });
  return groups.length ? `<vk-row gap="lg" align="top" wrap>${groups.join('')}</vk-row>` : '';
}

function presetsHtml(tag, base) {
  const list = [{ label: '默认', attrs: {} }, ...(PRESETS[tag] || [])];
  const tags = list
    .map((p, i) => `<vk-tag data-preset="${i}" tone="${i === 0 ? 'accent' : 'muted'}" size="meta">${esc(p.label)}</vk-tag>`)
    .join('');
  const data = JSON.stringify(list).replace(/</g, '\\u003c');
  return {
    html: `<vk-row gap="xs" align="center" wrap data-presets>${tags}</vk-row>`,
    data: `<script type="application/json" id="vk-presets">${data}</script>`,
  };
}

/* --------------------------------------------------------------- 页块 */

function lensBar(tag, info) {
  const defs = [
    ['plate', '成品'],
    ['variants', '变体'],
    ['anatomy', '解剖'],
    ['usage', '用法'],
    ['api', 'API'],
  ];
  const tags = defs
    .map(([id, label]) => `<a href="#${id}"><vk-tag data-lens-tag="${id}" tone="${id === 'plate' ? 'accent' : 'muted'}" size="meta">${label}</vk-tag></a>`)
    .join('');
  return `<vk-row slot="footer" w="1680" justify="between" align="center">
    <vk-row gap="xs" align="center">${tags}</vk-row>
    <vk-row gap="md" align="center">
      <vk-text size="meta" mono emphasis="muted" data-pageinfo>${info}</vk-text>
      <vk-text size="meta" mono emphasis="muted">← → 翻页 · [ ] 换组件</vk-text>
    </vk-row>
  </vk-row>`;
}

function shell({ title, tag, page, header, footer, body, scripts }) {
  return `<!doctype html>
<!-- generated by tools/specimens.mjs — do not edit -->
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<link rel="icon" href="data:,">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${page === 'specimen' ? '../' : ''}vk/fonts.css">
<link rel="stylesheet" href="${page === 'specimen' ? '../' : ''}vk/vk.css">
<link rel="stylesheet" href="${page === 'specimen' ? '../' : ''}showcase.css">
</head>
<body data-page="${page}"${tag ? ` data-tag="${tag}"` : ''}${scripts || ''}>
<vk-page fit="contain" align="center" header="${esc(header)}">
${lensBar(tag, '')}
${body}
</vk-page>
${footer || ''}
<script src="${page === 'specimen' ? '../' : ''}dist/vk.js"></script>
<script src="${page === 'specimen' ? '../' : ''}showcase.js"></script>
<script>window.vk.ready();</script>
</body>
</html>`;
}

/* --------------------------------------------------------------- 镜头 */

function plateLens(tag) {
  let body = sceneOf.get(tag) || '';
  if (tag === 'vk-page') body = body.replace('<vk-page', '<vk-page fit="contain"');
  return `<vk-stack w="1680" h="888" justify="center" align="center">${body}</vk-stack>`;
}

/** 变体镜头里的目标先落到能装进 888 的密度；控件仍然可以改回去。 */
function fitVariant(s, tag) {
  const W = { 'vk-img': [900, 506], 'vk-figure': [520, null], 'vk-browser': [1100, null] };
  if (W[tag]) {
    const [w, h] = W[tag];
    s = s.replace(/\sw="\d+"/, ` w="${w}"`);
    if (h) s = s.replace(/\sh="\d+"/, ` h="${h}"`);
  }
  // 行内标记离开正文就没有字号；给它一个 body 语境，44px 地板才成立。
  if (tag === 'vk-mark') return `<vk-text size="body">${s}</vk-text>`;
  if (tag !== 'vk-code' && tag !== 'vk-term') return s;
  return /\sdensity="/.test(s)
    ? s.replace(/\sdensity="[^"]*"/, ' density="compact"')
    : s.replace(new RegExp(`^<${tag}`), `<${tag} density="compact"`);
}

const CONTEXTUAL = new Set(['vk-edge', 'vk-annotate', 'vk-note']);

function variantLens(tag) {
  const base = rootAttrs(extractSnippet(tag));
  const snippet = CONTEXTUAL.has(tag)
    ? (sceneOf.get(tag) || '').trim().replace(new RegExp(`<${tag}(?=[\\s>])`), `<${tag} data-variant-target`)
    : withWidth(extractSnippet(tag), tag, 'data-variant-target');
  const presets = presetsHtml(tag, base);
  const controls = TALL.has(tag) ? '' : controlsHtml(tag, base);
  if (tag === 'vk-page') {
    return {
      html: `<vk-callout tone="accent" title="页面的变体是容器给的" size="body">align 和 fit 只在页面被放进不同宿主时才有差异；这张标本本身就是页面。把这一页拖窄，页眉、正文、页脚仍然各就各位。</vk-callout>`,
      data: presets.data,
    };
  }
  const target = CONTEXTUAL.has(tag)
    ? clampWidth(snippet)
    : fitVariant(
        clampWidth(
          tag === 'vk-frames'
            ? withWidth(extractSnippet(tag), tag, 'data-variant-target summary="none"')
            : snippet
        ),
        tag
      );
  return {
    html: `<vk-stack gap="sm">
      ${presets.html}
      ${controls}
      <vk-box w="1680" surface="none">${target}</vk-box>
    </vk-stack>`,
    data: presets.data,
  };
}

function anatomyLens(tag) {
  if (tag === 'vk-page') {
    return `<vk-canvas w="1680" h="888" grid="24" data-anatomy>
      <vk-box x="0" y="72" w="1680" h="96" surface="none" border="hair" radius="none"><vk-text x="24" y="20" size="meta" mono emphasis="muted">页眉轨道 · 96</vk-text></vk-box>
      <vk-box x="0" y="216" w="1680" h="528" surface="none" border="strong" radius="none"><vk-text x="24" y="20" size="meta" mono emphasis="muted">正文 · 1680×888 安全区</vk-text></vk-box>
      <vk-box x="0" y="792" w="1680" h="96" surface="none" border="hair" radius="none"><vk-text x="24" y="20" size="meta" mono emphasis="muted">页脚轨道 · 96</vk-text></vk-box>
    </vk-canvas>`;
  }
  // 关系型组件离开它的语境（canvas / 代码）就没有意义；解剖整段场景。
  // 场景本身已经是成品，不再叠芯片/引线——那会把关系图遮住。
  if (tag === 'vk-edge' || tag === 'vk-annotate') {
    const scene = (sceneOf.get(tag) || '').trim();
    return `<vk-canvas w="1680" h="888" grid="24" data-anatomy>
      <vk-box x="0" y="40" w="1680" surface="none">${scene}</vk-box>
    </vk-canvas>`;
  }
  const snippet = fitVariant(
    clampWidth(
      withWidth(
        extractSnippet(tag),
        tag,
        tag === 'vk-frames' ? 'data-anatomy-target summary="none"' : 'data-anatomy-target'
      ),
      1100
    ),
    tag
  );
  return `<vk-canvas w="1680" h="888" grid="24" data-anatomy>
    <vk-box x="120" y="40" w="1100" surface="none">${snippet}</vk-box>
  </vk-canvas>`;
}

/** 用法镜头只给根标签；子内容省略，避免 620 宽把片段折成几十行。 */
function minimalSnippet(tag) {
  const raw = withWidth(extractSnippet(tag), tag, '').trim();
  const m = raw.match(/^<[^>]+>/s);
  return (m ? m[0] : raw).replace(/\s+/g, ' ').trim();
}

function usageLens(tag) {
  const uses = occurrences.get(tag) || [];
  const rows = uses
    .slice(0, 4)
    .map((other) => {
      const def = TAGS[other];
      return `<a href="${other}.html"><vk-row gap="md" align="baseline" justify="between">
        <vk-row gap="md" align="baseline">
          <vk-text size="meta" mono w="320">${esc(other)}</vk-text>
          <vk-text size="meta" emphasis="secondary" w="200">${esc(def.name)}</vk-text>
        </vk-row>
        <vk-text size="meta" mono emphasis="muted">${esc(LAYER_NAME[def.layer])}</vk-text>
      </vk-row></a>`;
    })
    .join('');
  const note = NOTES[tag] || '';
  const snippet =
    tag === 'vk-page'
      ? '<vk-callout tone="accent" size="body">页面没有更小的用法片段；它本身就是容器。</vk-callout>'
      : `<vk-code lang="html" density="compact" fit="wrap" w="620">${esc(minimalSnippet(tag))}</vk-code>`;
  const partners = (PARTNERS[tag] || [])
    .slice(0, 3)
    .map((other) => `<a href="${other}.html"><vk-tag size="meta" tone="muted">${esc(other)}</vk-tag></a>`)
    .join('');
  return `<vk-row gap="xl" align="top">
    <vk-box w="980" surface="none">
      <vk-text size="heading" weight="bold">它出现在这些画面里</vk-text>
      <vk-stack gap="2xs">${rows || '<vk-callout tone="warn" size="body">它只在这一页里出现；没有其他标本使用它。</vk-callout>'}</vk-stack>
      <vk-callout tone="accent" size="label" title="用法">${esc(note)}</vk-callout>
    </vk-box>
    <vk-box w="620" surface="none">
      <vk-text size="heading" weight="bold">最小片段</vk-text>
      ${snippet}
      ${partners ? `<vk-text size="meta" mono emphasis="muted">常一起出现</vk-text><vk-row gap="xs" wrap>${partners}</vk-row>` : ''}
    </vk-box>
  </vk-row>`;
}

function typeText(spec) {
  if (spec.values) return spec.values.join(' / ');
  if (spec.type === 'bool') return '开关';
  if (spec.type === 'num') return '数字';
  if (spec.type === 'int') return '整数';
  if (spec.type === 'size') return '尺寸';
  if (spec.type === 'selector') return '选择器';
  if (spec.type === 'lines') return '行段';
  return '文本';
}

function apiRows(tag) {
  const attrs = TAGS[tag].attrs || {};
  const rows = [];
  const order = ['appearance', 'layout', 'state'];
  const weight = (s) => order.indexOf(s.group) + 1 || 4;
  const names = Object.entries(attrs)
    .filter(([, s]) => !s.hidden)
    .sort((a, b) => weight(a[1]) - weight(b[1]) || a[0].localeCompare(b[0]));
  for (const [name, spec] of names) {
    const def = spec.default === undefined ? '—' : String(spec.default);
    rows.push(`<tr data-api-page="0" data-group="${esc(spec.group || '')}"><td><b>${esc(name)}</b></td><td>${esc(spec.label || '')}</td><td>${esc(typeText(spec))}</td><td>${esc(def)}</td></tr>`);
  }
  return rows;
}

function apiLens(tag) {
  const rows = apiRows(tag);
  const per = 5;
  const html = rows
    .map((r, i) => r.replace('data-api-page="0"', `data-api-page="${Math.floor(i / per)}"`))
    .join('');
  return `<vk-row justify="between" align="center">
    <vk-text size="heading" weight="bold">属性</vk-text>
    <vk-row gap="md" align="center">
      <vk-text size="meta" mono emphasis="muted" data-apipages>${Math.max(1, Math.ceil(rows.length / per))} 页</vk-text>
      <vk-tag data-copy tone="muted" size="meta">复制当前片段</vk-tag>
    </vk-row>
  </vk-row>
  <vk-table variant="spec" density="compact" w="1680">
    <table>
      <colgroup><col style="width:320px"><col style="width:200px"><col style="width:800px"><col style="width:360px"></colgroup>
      <thead><tr><th>属性</th><th>中文</th><th>类型</th><th>默认</th></tr></thead>
      <tbody>${html}</tbody>
    </table>
  </vk-table>`;
}

/* --------------------------------------------------------------- 页面 */

const pages = [];
for (const tag of ORDER) {
  const def = TAGS[tag];
  const no = String(tagIndex.get(tag) + 1).padStart(2, '0');
  const header = `${no} / 31 · ${tag} · ${def.name} · ${LAYER_NAME[def.layer]}`;
  const variants = variantLens(tag);
  const body = [
    `<vk-box w="1680" h="888" surface="none" id="plate" data-lens="plate">${plateLens(tag)}</vk-box>`,
    `<vk-box w="1680" h="888" surface="none" id="variants" data-lens="variants" hidden></vk-box>`,
    `<template data-lens-template="variants">${variants.html}</template>`,
    `<vk-box w="1680" h="888" surface="none" id="anatomy" data-lens="anatomy" hidden></vk-box>`,
    `<template data-lens-template="anatomy">${anatomyLens(tag)}</template>`,
    `<vk-box w="1680" h="888" surface="none" id="usage" data-lens="usage" hidden></vk-box>`,
    `<template data-lens-template="usage">${usageLens(tag)}</template>`,
    `<vk-box w="1680" h="888" surface="none" id="api" data-lens="api" hidden></vk-box>`,
    `<template data-lens-template="api">${apiLens(tag)}</template>`,
    variants.data,
    `<script type="application/json" data-base-snippet>${JSON.stringify({
      html: tag === 'vk-page' ? '' : withWidth(extractSnippet(tag), tag, '').trim(),
    }).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
  pages.push({
    tag,
    html: shell({ title: `${tag} · ${def.name} · vk 标本册`, tag, page: 'specimen', header, body, footer: '' }),
  });
}

/* --------------------------------------------------------------- 索引 */

function indexRow(tag, i) {
  const def = TAGS[tag];
  const no = String(i + 1).padStart(2, '0');
  return `<a href="specimen/${tag}.html"><vk-row gap="sm" align="baseline" w="820">
    <vk-text size="meta" mono emphasis="muted" w="56">${no}</vk-text>
    <vk-text size="meta" mono w="320">${esc(tag)}</vk-text>
    <vk-text size="meta" w="150">${esc(def.name)}</vk-text>
    <vk-text size="meta" mono emphasis="muted" w="200">${esc(LAYER_NAME[def.layer])}</vk-text>
  </vk-row></a>`;
}

function indexColumn(entries) {
  return `<vk-box w="820" surface="none">${entries.join('<vk-rule></vk-rule>')}</vk-box>`;
}

function indexPageHtml() {
  const entries = ORDER.map((tag, i) => indexRow(tag, i));
  const perPage = 26;
  const chunks = [];
  for (let i = 0; i < entries.length; i += perPage) chunks.push(entries.slice(i, i + perPage));
  const sections = chunks
    .map((chunk, page) => {
      const left = chunk.slice(0, 13);
      const right = chunk.slice(13);
      return `<vk-box w="1680" h="888" surface="none" id="p${page + 1}" data-docpage="${page}"${page ? ' hidden' : ''}>
        <vk-row gap="md" align="top">${indexColumn(left)}${indexColumn(right)}</vk-row>
      </vk-box>`;
    })
    .join('');
  const pageTags = chunks
    .map((_, i) => `<a href="#p${i + 1}"><vk-tag data-docpage-tag="${i}" tone="${i === 0 ? 'accent' : 'muted'}" size="meta">${i + 1}</vk-tag></a>`)
    .join('');
  const footer = `<vk-row slot="footer" w="1680" justify="between" align="center">
    <vk-row gap="xs" align="center">${pageTags}</vk-row>
    <vk-text size="meta" mono emphasis="muted">31 个组件 · 5 层 · 1920 × 1080</vk-text>
  </vk-row>`;
  return `<!doctype html>
<!-- generated by tools/specimens.mjs — do not edit -->
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<link rel="icon" href="data:,">
<title>vk 标本册 · 31 个组件</title>
<link rel="stylesheet" href="vk/fonts.css">
<link rel="stylesheet" href="vk/vk.css">
<link rel="stylesheet" href="showcase.css">
</head>
<body data-page="index">
<vk-page fit="contain" align="top" header="vk 标本册 · 31 个组件 · 5 层">
${footer}
${sections}
</vk-page>
<script src="dist/vk.js"></script>
<script src="showcase.js"></script>
<script>window.vk.ready();</script>
</body>
</html>`;
}

/* --------------------------------------------------------------- 写出 */

/** 页面带内容戳：precompile 之后文件里仍有这个戳，--check 就不会误报漂移。 */
function writePage(file, html) {
  const stamp = hash32(html);
  const full = html.replace('<body ', `<body data-vk-page="${stamp}" `);
  let old = null;
  try {
    old = fs.readFileSync(file, 'utf8');
  } catch {
    /* 第一次生成 */
  }
  if (old && old.includes(`data-vk-page="${stamp}"`)) return false;
  if (check) {
    console.error(`✗ ${file}  内容已过期`);
    process.exitCode = 1;
    return true;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, full);
  return true;
}

const out = sitePath('');
fs.mkdirSync(path.join(out, 'specimen'), { recursive: true });
let written = 0;
for (const p of pages) {
  const file = path.join(out, 'specimen', `${p.tag}.html`);
  if (writePage(file, p.html)) written++;
}
if (writePage(path.join(out, 'index.html'), indexPageHtml())) written++;
console.log(`specimens: ${pages.length} 页${check ? '（检查）' : ''}${written ? ` · ${written} 写` : ' · 无变化'}`);
