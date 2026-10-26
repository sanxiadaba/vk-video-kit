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
  const groups = controlsOf(tag).slice(0, 3).map((name) => {
    const spec = TAGS[tag].attrs[name];
    const on = base.get(name);
    const tags = spec.values
      .map((v) => `<vk-tag data-attr="${esc(name)}" data-value="${esc(v)}" role="button" tabindex="0" aria-pressed="${on === v}" ${on === v ? 'state="selected"' : ''} tone="muted" size="meta">${esc(VALUE_LABELS[v] ?? v)}</vk-tag>`)
      .join('');
    return `<vk-stack gap="2xs" w="390">
      <vk-text size="meta" mono emphasis="muted">${esc(spec.label || name)}</vk-text>
      <vk-row gap="2xs" wrap>${tags}</vk-row>
    </vk-stack>`;
  });
  return groups.length ? `<vk-row gap="md" align="top" wrap data-controls>${groups.join('')}</vk-row>` : '';
}

function presetsHtml(tag, base) {
  const list = [{ label: '默认', attrs: {} }, ...(PRESETS[tag] || [])];
  const tags = list
    .map((p, i) => `<vk-tag data-preset="${i}" role="button" tabindex="0" aria-pressed="${i === 0}" ${i === 0 ? 'state="selected"' : ''} tone="muted" size="meta">${esc(p.label)}</vk-tag>`)
    .join('');
  const data = JSON.stringify(list).replace(/</g, '\\u003c');
  return {
    html: `<vk-stack gap="2xs"><vk-text size="meta" mono emphasis="muted">预设</vk-text><vk-row gap="2xs" align="center" wrap data-presets>${tags}</vk-row></vk-stack>`,
    data: `<script type="application/json" id="vk-presets">${data}</script>`,
  };
}

/* --------------------------------------------------------------- 页块 */

const LENSES = [
  ['plate', '成品'],
  ['variants', '变体'],
  ['anatomy', '解剖'],
  ['usage', '用法'],
  ['api', 'API'],
];

function pageHead(tag) {
  const def = TAGS[tag];
  const i = ORDER.indexOf(tag);
  const no = String(i + 1).padStart(2, '0');
  const total = String(ORDER.length).padStart(2, '0');
  const nav = LENSES
    .map(([id, label]) => `<a href="#${id}" role="tab" aria-selected="${id === 'plate'}" data-lens-link><vk-tag data-lens-tag="${id}" ${id === 'plate' ? 'state="selected"' : ''} tone="muted" size="meta">${label}</vk-tag></a>`)
    .join('');
  return `<vk-row slot="header" w="1680" justify="between" align="center">
    <vk-row gap="sm" align="baseline">
      <vk-text size="meta" mono emphasis="muted">PLATE ${no} / ${total}</vk-text>
      <vk-text size="label" mono weight="medium" role="heading" aria-level="1">${tag}</vk-text>
      <vk-text size="label" emphasis="secondary">${esc(def.name)}</vk-text>
      <vk-tag size="meta" tone="muted">${esc(LAYER_NAME[def.layer])}</vk-tag>
    </vk-row>
    <vk-row gap="2xs" align="center" role="tablist" aria-label="镜头">${nav}</vk-row>
  </vk-row>`;
}

function pageFoot(tag) {
  const i = ORDER.indexOf(tag);
  const n = ORDER.length;
  const prev = ORDER[(i - 1 + n) % n];
  const next = ORDER[(i + 1) % n];
  const no = String(i + 1).padStart(2, '0');
  const total = String(n).padStart(2, '0');
  return `<vk-row slot="footer" w="1680" justify="between" align="center">
    <vk-row gap="sm" align="center">
      <a href="../index.html"><vk-tag size="meta" tone="muted">目录</vk-tag></a>
      <a href="${prev}.html" rel="prev"><vk-tag size="meta" tone="muted">← ${prev}</vk-tag></a>
      <a href="${next}.html" rel="next"><vk-tag size="meta" tone="muted">${next} →</vk-tag></a>
    </vk-row>
    <vk-row gap="md" align="center">
      <vk-text size="meta" mono emphasis="muted" data-pageinfo></vk-text>
      <vk-text size="meta" mono emphasis="muted">${no} / ${total} · ← → · [ ]</vk-text>
    </vk-row>
  </vk-row>`;
}

function shell({ title, tag, page, body, scripts }) {
  const i = ORDER.indexOf(tag);
  const n = ORDER.length;
  const prev = ORDER[(i - 1 + n) % n];
  const next = ORDER[(i + 1) % n];
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
<body data-page="${page}"${tag ? ` data-tag="${tag}" data-prev="${prev}.html" data-next="${next}.html"` : ''}>
<vk-page fit="contain" align="top">
${pageHead(tag)}
${body}
${pageFoot(tag)}
</vk-page>
${scripts || ''}
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
  return `<vk-box w="1680" h="888" surface="paper" border="hair" radius="none">
    <vk-stack w="1680" h="888" justify="center" align="center">${body}</vk-stack>
  </vk-box>`;
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
    ? clampWidth(snippet, 1240)
    : fitVariant(
        clampWidth(
          tag === 'vk-frames'
            ? withWidth(extractSnippet(tag), tag, 'data-variant-target summary="none"')
            : snippet,
          1240
        ),
        tag
      );
  const tall = TALL.has(tag);
  // 宽关系图（edge / annotate）不塞进 1240 的舞台：整幅 + 顶部预设 + 底部控件。
  if (CONTEXTUAL.has(tag) || tag === 'vk-canvas') {
    const wide = clampWidth(snippet, 1680);
    const presetRow = presets.html.replace('<vk-text size="meta" mono emphasis="muted">预设</vk-text>', '');
    return {
      html: `<vk-stack h="888" gap="sm">
        <vk-row justify="between" align="bottom" w="1680">${presetRow}<vk-text size="meta" mono emphasis="muted">关系图 · 整幅</vk-text></vk-row>
        <vk-stack h="520" justify="center" align="center">${wide}</vk-stack>
        ${controls}
      </vk-stack>`,
      data: presets.data,
    };
  }
  return {
    html: `<vk-row gap="lg" align="top" w="1680" h="888">
      <vk-box w="380" surface="none"><vk-stack gap="md">${presets.html}</vk-stack></vk-box>
      <vk-box w="1240" surface="none"><vk-stack h="888" gap="md">
        ${!tall && !PRESETS[tag]?.length && !controlsOf(tag).length ? `<vk-callout tone="accent" title="没有可见变体" size="body">它的形状由内容长度决定；换内容比换属性更接近它的用法。下面是最小形态，解剖页给出实际尺寸。</vk-callout>` : ''}
        <vk-stack h="${tall ? 888 : 660}" justify="center" align="center">${target}</vk-stack>
        ${tall ? '' : controls}
      </vk-stack></vk-box>
    </vk-row>`,
    data: presets.data,
  };
}

function anatomyLens(tag) {
  if (tag === 'vk-page') {
    const scene = (sceneOf.get('vk-page') || '').trim().replace(/^<vk-page/, '<vk-page data-anatomy-target');
    return `<vk-canvas w="1680" h="888" grid="24" data-anatomy>
      <vk-box x="120" y="40" w="1400" surface="none">${scene}</vk-box>
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
  const WIDE = { 'vk-bytes': 1240, 'vk-canvas': 1400, 'vk-table': 1400, 'vk-frames': 1400, 'vk-browser': 1400 };
  const fitW = WIDE[tag] || 1100;
  const snippet = fitVariant(
    clampWidth(
      withWidth(
        extractSnippet(tag),
        tag,
        tag === 'vk-frames' ? 'data-anatomy-target summary="none"' : 'data-anatomy-target'
      ),
      fitW
    ),
    tag
  );
  return `<vk-canvas w="1680" h="888" grid="24" data-anatomy>
    <vk-box x="120" y="40" w="${fitW}" surface="none">${snippet}</vk-box>
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
  if (!rows.length) {
    return `<vk-row justify="between" align="center">
      <vk-text size="heading" weight="bold" role="heading" aria-level="2">属性</vk-text>
      <vk-tag data-copy role="button" tabindex="0" tone="muted" size="meta">复制当前片段</vk-tag>
    </vk-row>
    <vk-row gap="xl" align="center" w="1680">
      <vk-box w="360" surface="none"><vk-stack gap="2xs">
        <vk-text size="display" weight="bold">0</vk-text>
        <vk-text size="title" weight="medium">个公开属性</vk-text>
        <vk-text size="body" emphasis="secondary">内容就是全部 API。</vk-text>
      </vk-stack></vk-box>
      <vk-box w="1200" surface="none"><vk-stack gap="md">
        <vk-callout tone="accent" title="没有公开属性" size="body">这个组件只消费文本内容；它的形状由内容本身决定，没有可调的外观或布局开关。用法页给最小片段，解剖页给尺寸。</vk-callout>
        <vk-text size="body" mono emphasis="secondary" w="1200">${esc(minimalSnippet(tag))}</vk-text>
      </vk-stack></vk-box>
    </vk-row>`;
  }
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const balanced = Math.max(1, Math.ceil(rows.length / pages));
  const html = rows
    .map((r, i) => r.replace('data-api-page="0"', `data-api-page="${Math.floor(i / balanced)}"`))
    .join('');
  return `<vk-row justify="between" align="center">
    <vk-text size="heading" weight="bold" role="heading" aria-level="2">属性</vk-text>
    <vk-row gap="md" align="center">
      <vk-text size="meta" mono emphasis="muted" data-apipages>${pages} 页 · ${rows.length} 项</vk-text>
      <vk-tag data-copy role="button" tabindex="0" tone="muted" size="meta">复制当前片段</vk-tag>
    </vk-row>
  </vk-row>
  <vk-table variant="spec" density="dense" w="1680">
    <table>
      <colgroup><col style="width:280px"><col style="width:160px"><col style="width:940px"><col style="width:300px"></colgroup>
      <thead><tr><th>属性</th><th>中文</th><th>类型</th><th>默认</th></tr></thead>
      <tbody>${html}</tbody>
    </table>
  </vk-table>`;
}

/* --------------------------------------------------------------- 页面 */

const pages = [];
for (const tag of ORDER) {
  const def = TAGS[tag];
  const variants = variantLens(tag);
  const body = [
    `<vk-box w="1680" h="888" surface="none" data-lens="plate">${plateLens(tag)}</vk-box>`,
    `<vk-box w="1680" h="888" surface="none" data-lens="variants" hidden></vk-box>`,
    `<template data-lens-template="variants">${variants.html}</template>`,
    `<vk-box w="1680" h="888" surface="none" data-lens="anatomy" hidden></vk-box>`,
    `<template data-lens-template="anatomy">${anatomyLens(tag)}</template>`,
    `<vk-box w="1680" h="888" surface="none" data-lens="usage" hidden></vk-box>`,
    `<template data-lens-template="usage">${usageLens(tag)}</template>`,
    `<vk-box w="1680" h="888" surface="none" data-lens="api" hidden></vk-box>`,
    `<template data-lens-template="api">${apiLens(tag)}</template>`,
  ].join('\n');
  const scripts = `${variants.data}
<script type="application/json" data-base-snippet>${JSON.stringify({
    html: tag === 'vk-page' ? '' : withWidth(extractSnippet(tag), tag, '').trim(),
  }).replace(/</g, '\\u003c')}</script>`;
  pages.push({
    tag,
    html: shell({ title: `${tag} · ${def.name} · vk 标本册`, tag, page: 'specimen', body, scripts }),
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
  const perPage = 16;
  const chunks = [];
  for (let i = 0; i < entries.length; i += perPage) chunks.push(entries.slice(i, i + perPage));
  const total = ORDER.length;
  const layerTags = LAYERS.map((l) => `<vk-tag size="meta" tone="muted">${esc(l.label)} · ${ORDER.filter((t) => TAGS[t].layer === l.id).length}</vk-tag>`).join('');
  const cover = `<vk-box w="1680" h="888" surface="none" data-docpage="0">
    <vk-stack h="888" justify="center" gap="md">
      <vk-text size="display" weight="bold" role="heading" aria-level="1">${total}</vk-text>
      <vk-text size="title" weight="medium">个组件，5 层，一张 1920×1080 的台面。</vk-text>
      <vk-row gap="sm" align="center" wrap>${layerTags}</vk-row>
      <vk-text size="body" emphasis="secondary" w="1100">不是 ${total} 个 demo，是 ${total} 张标本。每张五个镜头：成品、变体、解剖、用法、API。</vk-text>
    </vk-stack>
  </vk-box>`;
  const contents = chunks
    .map((chunk, page) => {
      const half = Math.ceil(chunk.length / 2);
      const left = chunk.slice(0, half);
      const right = chunk.slice(half);
      return `<vk-box w="1680" h="888" surface="none" data-docpage="${page + 1}" hidden>
        <vk-stack gap="md">
          <vk-row justify="between" align="baseline">
            <vk-text size="heading" weight="bold" role="heading" aria-level="2">目录</vk-text>
            <vk-text size="meta" mono emphasis="muted">${String(page * perPage + 1).padStart(2, '0')}–${String(page * perPage + chunk.length).padStart(2, '0')}</vk-text>
          </vk-row>
          <vk-row gap="md" align="top">${indexColumn(left)}${indexColumn(right)}</vk-row>
        </vk-stack>
      </vk-box>`;
    })
    .join('');
  const pageTags = ['封面', ...chunks.map((_, i) => String(i + 1))]
    .map((label, i) => `<a href="#p${i + 1}"><vk-tag data-docpage-tag="${i}" ${i === 0 ? 'state="selected"' : ''} tone="muted" size="meta">${label}</vk-tag></a>`)
    .join('');
  const header = `<vk-row slot="header" w="1680" justify="between" align="center">
    <vk-row gap="sm" align="baseline">
      <vk-text size="label" mono weight="medium" role="heading" aria-level="1">vk 标本册</vk-text>
      <vk-text size="meta" mono emphasis="muted">${total} 个组件 · 5 层 · 1920 × 1080</vk-text>
    </vk-row>
    <vk-text size="meta" mono emphasis="muted">vi · 2026</vk-text>
  </vk-row>`;
  const footer = `<vk-row slot="footer" w="1680" justify="between" align="center">
    <vk-row gap="xs" align="center">${pageTags}</vk-row>
    <vk-text size="meta" mono emphasis="muted">← → 翻页 · 1–${total} 组件 · 1–5 镜头</vk-text>
  </vk-row>`;
  return `<!doctype html>
<!-- generated by tools/specimens.mjs — do not edit -->
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<link rel="icon" href="data:,">
<title>vk 标本册 · ${total} 个组件</title>
<link rel="stylesheet" href="vk/fonts.css">
<link rel="stylesheet" href="vk/vk.css">
<link rel="stylesheet" href="showcase.css">
</head>
<body data-page="index">
<vk-page fit="contain" align="top">
${header}
${footer}
${cover}
${contents}
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
