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
  return picked.slice(0, 2);
}

function controlsHtml(tag, base) {
  const groups = controlsOf(tag).slice(0, 2).map((name) => {
    const spec = TAGS[tag].attrs[name];
    const on = base.get(name);
    const tags = spec.values
      .map((v) => `<vk-tag data-attr="${esc(name)}" data-value="${esc(v)}" role="button" tabindex="0" aria-pressed="${on === v}" ${on === v ? 'state="selected"' : ''} tone="muted" size="meta">${esc(VALUE_LABELS[v] ?? v)}</vk-tag>`)
      .join('');
    return `<vk-stack gap="2xs" w="320">
      <vk-text size="meta" mono emphasis="muted">${esc(spec.label || name)}</vk-text>
      <vk-row gap="2xs" wrap>${tags}</vk-row>
    </vk-stack>`;
  });
  return groups.length ? `<vk-row gap="sm" align="top" wrap data-controls>${groups.join('')}</vk-row>` : '';
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
  ['plate', '成品', '装裱后的成品'],
  ['variants', '变体', '预设与属性'],
  ['anatomy', '解剖', '实测的部件'],
  ['usage', '用法', '出现与片段'],
  ['api', 'API', '公开属性'],
];

const RAIL_W = 280;
const STAGE_W = 1376;
const STAGE_IN = 1360;

function pageHead(tag) {
  const i = ORDER.indexOf(tag);
  const no = String(i + 1).padStart(3, '0');
  const total = String(ORDER.length).padStart(3, '0');
  return `<vk-row slot="header" w="1680" justify="between" align="center">
    <vk-row gap="sm" align="baseline">
      <vk-text size="label" mono weight="bold">vk</vk-text>
      <vk-text size="meta" mono>specimen book</vk-text>
    </vk-row>
    <vk-text size="meta" mono>${no} / ${total}</vk-text>
  </vk-row>`;
}

function pageFoot(tag) {
  const i = ORDER.indexOf(tag);
  const n = ORDER.length;
  const prev = ORDER[(i - 1 + n) % n];
  const next = ORDER[(i + 1) % n];
  const no = String(i + 1).padStart(3, '0');
  const total = String(n).padStart(3, '0');
  return `<vk-row slot="footer" w="1680" justify="between" align="center">
    <vk-row gap="lg" align="center">
      <a href="../index.html"><vk-text size="meta" mono>目录</vk-text></a>
      <a href="${prev}.html" rel="prev"><vk-text size="meta" mono>← ${prev}</vk-text></a>
      <a href="${next}.html" rel="next"><vk-text size="meta" mono>${next} →</vk-text></a>
    </vk-row>
    <vk-row gap="lg" align="center">
      <vk-text size="meta" mono data-pageinfo></vk-text>
      <vk-text size="meta" mono>${no} / ${total}</vk-text>
    </vk-row>
  </vk-row>`;
}

function rail(tag) {
  const def = TAGS[tag];
  const i = ORDER.indexOf(tag);
  const no = String(i + 1).padStart(3, '0');
  const links = LENSES
    .map(([id, label], k) => `<a href="#${id}" data-lens-link role="tab" aria-selected="${id === 'plate'}" aria-current="${id === 'plate' ? 'page' : 'false'}"><vk-row gap="sm" align="baseline"><vk-text size="meta" mono>0${k + 1}</vk-text><vk-text size="label">${label}</vk-text></vk-row></a>`)
    .join('');
  return `<vk-box w="${RAIL_W}" h="888" surface="ink" pad="md">
    <vk-stack h="840" justify="start" gap="sm">
      <vk-text class="plate-no" size="title" weight="bold">${no}</vk-text>
      <vk-stack gap="2xs">
        <vk-text class="plate-name" size="label" weight="medium" role="heading" aria-level="1">${esc(def.name)}</vk-text>
        <vk-text size="meta" mono>${tag}</vk-text>
        <vk-tag size="meta" tone="muted">${esc(LAYER_NAME[def.layer])}</vk-tag>
      </vk-stack>
      <vk-rule variant="thin"></vk-rule>
      <vk-stack gap="2xs" role="tablist" aria-label="镜头" data-lens-nav>${links}</vk-stack>
    </vk-stack>
  </vk-box>`;
}

function stage(tag, lens, content) {
  return `<vk-box w="${STAGE_W}" h="888" surface="paper" pad="2xs" data-stage>
    <vk-box w="${STAGE_IN}" surface="none">${content}</vk-box>
  </vk-box>`;
}

function stageSection(tag, lens, content, headerRight = '', hidden = false) {
  return `<vk-box w="${STAGE_W}" h="888" surface="none" data-lens="${lens}"${hidden ? ' hidden' : ''}>${stage(tag, lens, content, headerRight)}</vk-box>`;
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
<vk-page fit="contain" align="top" surface="ink">
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
  if (['vk-code', 'vk-term'].includes(tag)) {
    body = /\sdensity="/.test(body)
      ? body.replace(/\sdensity="[^"]*"/, ' density="compact"')
      : body.replace(new RegExp(`^<${tag}`), `<${tag} density="compact"`);
  }
  const PLATE_W = { 'vk-edge': 1300, 'vk-canvas': 1300, 'vk-annotate': 1300 };
  if (tag !== 'vk-annotate') body = clampWidth(body, PLATE_W[tag] || 1100);
  const def = TAGS[tag];
  const no = String(ORDER.indexOf(tag) + 1).padStart(3, '0');
  if (['vk-frames', 'vk-figure', 'vk-page'].includes(tag)) return `<vk-stack h="872" justify="center" align="center">${body}</vk-stack>`;
  return `<vk-stack h="872" gap="sm" justify="center" align="center">
    <vk-box surface="paper" border="hair" pad="sm" radius="md" data-plate-mount>${body}</vk-box>
    <vk-text size="meta" mono emphasis="muted">PLATE ${no} / ${tag} / ${esc(LAYER_NAME[def.layer])}</vk-text>
  </vk-stack>`;
}

/** 变体镜头里的目标先落到能装进 888 的密度；控件仍然可以改回去。 */
function fitVariant(s, tag) {
  const W = { 'vk-img': [900, 506], 'vk-figure': [520, null], 'vk-browser': [940, null] };
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

const CONTEXTUAL = new Set(['vk-edge', 'vk-annotate']);

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
    ? clampWidth(snippet, 1300)
    : fitVariant(
        clampWidth(
          tag === 'vk-frames'
            ? withWidth(extractSnippet(tag), tag, 'data-variant-target summary="none"')
            : snippet,
          940
        ),
        tag
      );
  const tall = TALL.has(tag);
  // 宽关系图：整幅 + 顶部预设；控件让位给场景本身。
  if (CONTEXTUAL.has(tag) || ['vk-canvas', 'vk-bytes', 'vk-stack'].includes(tag)) {
    const wide = tag === 'vk-annotate' ? snippet : clampWidth(snippet, 1300);
    return {
      html: `<vk-stack h="872" gap="sm">
        ${presets.html}
        <vk-stack h="640" justify="center" align="center">${wide}</vk-stack>
      </vk-stack>`,
      data: presets.data,
    };
  }
  return {
    html: `<vk-row gap="lg" align="top" w="1352" h="872">
      <vk-box w="380" surface="none"><vk-stack gap="sm">${presets.html}${controls}</vk-stack></vk-box>
      <vk-box w="940" surface="none"><vk-stack h="872" gap="sm" justify="center" align="center">
        ${!tall && !PRESETS[tag]?.length && !controlsOf(tag).length ? `<vk-callout tone="accent" title="没有可见变体" size="body">它的形状由内容长度决定；换内容比换属性更接近它的用法。下面是最小形态，解剖页给出实际尺寸。</vk-callout>` : ''}
        ${target}
      </vk-stack></vk-box>
    </vk-row>`,
    data: presets.data,
  };
}

function anatomyLens(tag) {
  if (tag === 'vk-page') {
    const scene = (sceneOf.get('vk-page') || '').trim().replace(/^<vk-page/, '<vk-page data-anatomy-target');
    return `<vk-canvas w="1352" h="872" grid="24" data-anatomy>
      <vk-box x="56" y="40" w="1100" surface="none">${scene}</vk-box>
    </vk-canvas>`;
  }
  // 关系型组件离开它的语境（canvas / 代码）就没有意义；解剖整段场景。
  if (tag === 'vk-edge' || tag === 'vk-annotate') {
    const scene = tag === 'vk-annotate' ? (sceneOf.get(tag) || '').trim() : clampWidth((sceneOf.get(tag) || '').trim(), 1300);
    return `<vk-canvas w="1352" h="872" grid="24" data-anatomy>
      <vk-box x="24" y="40" w="1300" surface="none">${scene}</vk-box>
    </vk-canvas>`;
  }
  const WIDE = { 'vk-bytes': 1100, 'vk-canvas': 1200, 'vk-table': 1100, 'vk-frames': 1100, 'vk-browser': 1200 };
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
  return `<vk-canvas w="1352" h="872" grid="24" data-anatomy>
    <vk-box x="56" y="40" w="${fitW}" surface="none">${snippet}</vk-box>
  </vk-canvas>`;
}

/** 用法镜头只给根标签；子内容省略，避免 620 宽把片段折成几十行。 */
function minimalSnippet(tag) {
  const raw = withWidth(extractSnippet(tag), tag, '').trim();
  const m = raw.match(/^<([a-z0-9-]+)([^>]*)>/s);
  if (!m) return raw.replace(/\s+/g, ' ').slice(0, 50);
  const attrs = [...m[2].matchAll(/\s([a-z0-9-]+)="([^"]*)"/g)]
    .slice(0, 2)
    .map(([, k, v]) => `${k}="${v}"`);
  return `<${m[1]}${attrs.length ? ` ${attrs.join(' ')}` : ''} …>`;
}

function usageLens(tag) {
  const uses = occurrences.get(tag) || [];
  const rows = uses
    .slice(0, 1)
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
      : `<vk-text size="body" mono w="1352" data-usage-snippet>${esc(minimalSnippet(tag))}</vk-text>`;
  const partners = (PARTNERS[tag] || [])
    .slice(0, 3)
    .map((other) => `<a href="${other}.html"><vk-tag size="meta" tone="muted">${esc(other)}</vk-tag></a>`)
    .join('');
  return `<vk-stack h="872" gap="md">
    <vk-row gap="lg" align="top" w="1352">
      <vk-box w="900" surface="none">
        <vk-text size="heading" weight="bold">它出现在这些画面里</vk-text>
        <vk-stack gap="2xs">${rows || '<vk-callout tone="warn" size="body">它只在这一页里出现；没有其他标本使用它。</vk-callout>'}</vk-stack>
        <vk-callout tone="accent" size="body">${esc(note)}</vk-callout>
      </vk-box>
      <vk-box w="420" surface="none">
        <vk-text size="heading" weight="bold">常一起出现</vk-text>
        ${partners ? `<vk-row gap="xs" wrap>${partners}</vk-row>` : '<vk-text size="meta" emphasis="muted">没有固定搭档。</vk-text>'}
      </vk-box>
    </vk-row>
    <vk-box w="1352" surface="none">
      <vk-text size="meta" mono emphasis="muted">最小片段</vk-text>
      ${snippet}
    </vk-box>
  </vk-stack>`;
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
  const per = 4;
  if (!rows.length) {
    return `<vk-row justify="between" align="center">
      <vk-text size="heading" weight="bold" role="heading" aria-level="2">属性</vk-text>
      <vk-tag data-copy role="button" tabindex="0" tone="muted" size="meta">复制当前片段</vk-tag>
    </vk-row>
    <vk-row gap="md" align="center" w="1352">
      <vk-box w="380" surface="none"><vk-stack gap="2xs">
        <vk-text size="display" weight="bold">0</vk-text>
        <vk-text size="heading" weight="medium">个公开属性</vk-text>
        <vk-text size="body" emphasis="secondary">内容就是全部 API。</vk-text>
      </vk-stack></vk-box>
      <vk-box w="940" surface="none"><vk-stack gap="md">
        <vk-callout tone="accent" title="没有公开属性" size="body">这个组件只消费文本内容；它的形状由内容本身决定，没有可调的外观或布局开关。用法页给最小片段，解剖页给尺寸。</vk-callout>
        <vk-text size="body" mono emphasis="secondary" w="948">${esc(minimalSnippet(tag))}</vk-text>
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
  <vk-table variant="spec" density="dense" w="1330" class="api-table">
    <table>
      <colgroup><col style="width:240px"><col style="width:150px"><col style="width:730px"><col style="width:210px"></colgroup>
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
  const body = `<vk-row w="1680" h="888" align="top">
    ${rail(tag)}
    <vk-box w="${STAGE_W}" h="888" surface="none">
      ${stageSection(tag, 'plate', plateLens(tag))}
      <vk-box w="${STAGE_W}" h="888" surface="none" data-lens="variants" hidden></vk-box>
      <template data-lens-template="variants">${stage(tag, 'variants', variants.html)}</template>
      <vk-box w="${STAGE_W}" h="888" surface="none" data-lens="anatomy" hidden></vk-box>
      <template data-lens-template="anatomy">${stage(tag, 'anatomy', anatomyLens(tag))}</template>
      <vk-box w="${STAGE_W}" h="888" surface="none" data-lens="usage" hidden></vk-box>
      <template data-lens-template="usage">${stage(tag, 'usage', usageLens(tag))}</template>
      <vk-box w="${STAGE_W}" h="888" surface="none" data-lens="api" hidden></vk-box>
      <template data-lens-template="api">${stage(tag, 'api', apiLens(tag))}</template>
    </vk-box>
  </vk-row>`;
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

function indexCell(tag, i) {
  const def = TAGS[tag];
  const no = String(i + 1).padStart(2, '0');
  const layer = (LAYERS.find((l) => l.id === def.layer)?.label || '').replace(/^L\d\s*/, '');
  return `<a href="specimen/${tag}.html"><vk-box w="260" h="104" surface="paper" border="hair" pad="2xs" radius="sm">
    <vk-row justify="between" align="baseline"><vk-text size="meta" mono>${no}</vk-text><vk-text size="meta" mono emphasis="muted">${esc(layer)}</vk-text></vk-row>
    <vk-text size="meta" mono>${tag.replace(/^vk-/, '')}</vk-text>
  </vk-box></a>`;
}

function indexPageHtml() {
  const total = ORDER.length;
  const cells = ORDER.map((tag, i) => indexCell(tag, i)).join('');
  const layers = LAYERS.map((l) => {
    const n = ORDER.filter((t) => TAGS[t].layer === l.id).length;
    return `<vk-row justify="between" align="baseline"><vk-text size="meta" mono>${l.id === 'tokens' ? 'L0' : l.label.slice(0, 2)}</vk-text><vk-text size="meta" mono>${String(n).padStart(2, '0')}</vk-text></vk-row>`;
  }).join('');
  const railBox = `<vk-box w="${RAIL_W}" h="888" surface="ink" pad="md">
    <vk-stack h="840" justify="start" gap="sm">
      <vk-text class="plate-no" size="title" weight="bold" role="heading" aria-level="1">${total}</vk-text>
      <vk-text size="label" weight="medium">plates</vk-text>
      <vk-text size="meta">5 layers</vk-text>
      <vk-rule variant="thin"></vk-rule>
      <vk-stack gap="2xs">${layers}</vk-stack>
    </vk-stack>
  </vk-box>`;
  const stageBox = `<vk-box w="${STAGE_W}" h="888" surface="paper" pad="sm" data-stage>
    <vk-stack h="856" justify="center">
      <vk-row gap="2xs" wrap w="1332">${cells}</vk-row>
    </vk-stack>
  </vk-box>`;
  let coverCode = (sceneOf.get('vk-code') || '').trim();
  coverCode = /\sdensity="/.test(coverCode)
    ? coverCode.replace(/\sdensity="[^"]*"/, ' density="compact"')
    : coverCode.replace(/^<vk-code/, '<vk-code density="compact"');
  coverCode = clampWidth(coverCode, 728);
  const cover = `<vk-box w="1680" h="888" surface="ink" data-docpage="0">
    <vk-row gap="lg" align="center" w="1680" h="888">
      <vk-stack w="800" gap="md">
        <vk-text class="plate-no" size="display" weight="bold" role="heading" aria-level="1">${total}</vk-text>
        <vk-text class="plate-name" size="title" weight="medium">件标本，五种看法。</vk-text>
        <vk-text size="body">一本 1920×1080 的标本册：每个组件五个镜头，成品 / 变体 / 解剖 / 用法 / API。</vk-text>
      </vk-stack>
      <vk-box w="780" surface="paper" border="hair" pad="sm" radius="md" data-plate-mount>${coverCode}</vk-box>
    </vk-row>
  </vk-box>`;
  const contact = `<vk-box w="1680" h="888" surface="none" data-docpage="1" hidden>
    <vk-row w="1680" h="888" align="top">${railBox}<vk-box w="${STAGE_W}" h="888" surface="none">${stageBox}</vk-box></vk-row>
  </vk-box>`;
  const header = `<vk-row slot="header" w="1680" justify="between" align="center">
    <vk-row gap="sm" align="baseline">
      <vk-text class="plate-name" size="label" weight="medium">vk</vk-text>
      <vk-text size="meta" mono>specimen book</vk-text>
    </vk-row>
    <vk-text size="meta" mono>${total} plates</vk-text>
  </vk-row>`;
  const footer = `<vk-row slot="footer" w="1680" justify="between" align="center">
    <vk-row gap="sm" align="center">
      <a href="#p1"><vk-tag data-docpage-tag="0" state="selected" tone="muted" size="meta">封面</vk-tag></a>
      <a href="#p2"><vk-tag data-docpage-tag="1" tone="muted" size="meta">01</vk-tag></a>
    </vk-row>
    <vk-text size="meta" mono>31 components / 5 layers · 1920 × 1080 / 44PX</vk-text>
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
<vk-page fit="contain" align="top" surface="ink">
${header}
${footer}
${cover}${contact}
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
