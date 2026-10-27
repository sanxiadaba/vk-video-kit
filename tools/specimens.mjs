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

const INLINE = new Set(['vk-icon', 'vk-tag', 'vk-mark', 'vk-keys', 'vk-pin', 'vk-ring', 'vk-spotlight']);
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

function brand() {
  return `<vk-row gap="2xs" align="center" w="280" data-brand>
    <vk-text size="sub" mono weight="bold" data-meta>vk</vk-text>
    <vk-text size="micro" mono data-meta>specimen</vk-text>
  </vk-row>`;
}

function topbar(tag) {
  if (!tag) {
    return `<vk-row slot="header" w="1680" h="64" justify="between" align="center" data-topbar>
      ${brand()}
      <vk-row gap="sm" align="baseline" data-crumb>
        <vk-text size="caption" weight="medium" data-meta>目录</vk-text>
      </vk-row>
      <vk-text size="micro" mono data-meta>5.0 · ${ORDER.length} tags</vk-text>
    </vk-row>`;
  }
  const def = TAGS[tag];
  const i = ORDER.indexOf(tag);
  const no = String(i + 1).padStart(3, '0');
  const tabs = LENSES
    .map(([id, label]) => `<a class="lens-tab" href="#${id}" data-lens-link role="tab" aria-selected="${id === 'plate'}" aria-current="${id === 'plate' ? 'page' : 'false'}"><vk-text size="caption" data-meta>${label}</vk-text></a>`)
    .join('');
  return `<vk-row slot="header" w="1680" h="64" justify="between" align="center" data-topbar>
    ${brand()}
    <vk-row gap="sm" align="baseline" data-crumb>
      <a href="../index.html"><vk-text size="caption" emphasis="muted" data-meta>Components</vk-text></a>
      <vk-text size="caption" mono emphasis="muted" data-meta>/</vk-text>
      <vk-text size="caption" mono data-meta>${no}</vk-text>
      <vk-text size="caption" weight="medium" data-meta>${esc(def.name)}</vk-text>
      <vk-text size="micro" mono emphasis="muted" data-meta>${tag}</vk-text>
    </vk-row>
    <vk-row gap="2xs" align="center" role="tablist" aria-label="镜头" data-lens-nav>${tabs}</vk-row>
  </vk-row>`;
}

function pageFoot(tag) {
  if (!tag) {
    return `<vk-row slot="footer" w="1680" h="64" justify="between" align="center" data-footer>
      <vk-row gap="md" align="center">
        <vk-text size="micro" mono data-meta>${ORDER.length} components / 5 layers</vk-text>
        <vk-text size="micro" mono data-meta>1920 × 1080 / 44PX</vk-text>
      </vk-row>
      <vk-text size="micro" mono data-meta>vk specimen · 2026</vk-text>
    </vk-row>`;
  }
  const i = ORDER.indexOf(tag);
  const n = ORDER.length;
  const prev = ORDER[(i - 1 + n) % n];
  const next = ORDER[(i + 1) % n];
  const no = String(i + 1).padStart(3, '0');
  const total = String(n).padStart(3, '0');
  return `<vk-row slot="footer" w="1680" h="64" justify="between" align="center" data-footer>
    <vk-row gap="lg" align="center">
      <a href="../index.html"><vk-text size="micro" mono data-meta>All components</vk-text></a>
      <a href="${prev}.html" rel="prev"><vk-text size="micro" mono data-meta>← ${prev}</vk-text></a>
      <a href="${next}.html" rel="next"><vk-text size="micro" mono data-meta>${next} →</vk-text></a>
    </vk-row>
    <vk-row gap="lg" align="center">
      <vk-text size="micro" mono data-meta data-pageinfo></vk-text>
      <vk-text size="micro" mono data-meta>${no} / ${total}</vk-text>
    </vk-row>
  </vk-row>`;
}

/** 全局侧栏：搜索 + 31 个组件的分组导航。 */
function sidebar(activeTag, prefix = '') {
  const groups = LAYERS.filter((l) => l.id !== 'tokens')
    .map((l) => {
      const tags = ORDER.filter((t) => TAGS[t].layer === l.id);
      const items = tags
        .map((t, k) => {
          const def = TAGS[t];
          const no = String(ORDER.indexOf(t) + 1).padStart(2, '0');
          const query = [t, def.name, def.summary, l.label].join(' ');
          const active = t === activeTag;
          return `<a href="${prefix}${t}.html" data-side-link data-search="${esc(query)}" aria-current="${active ? 'page' : 'false'}">
            <vk-row gap="2xs" align="baseline"><vk-text size="micro" mono data-meta>${no}</vk-text><vk-text size="micro" mono data-meta>${t.replace(/^vk-/, '')}</vk-text></vk-row>
            <vk-text size="caption" data-meta>${esc(def.name)}</vk-text>
          </a>`;
        })
        .join('');
      return `<vk-stack gap="2xs" data-side-group>
        <vk-row justify="between" align="baseline"><vk-text size="micro" mono emphasis="muted" data-meta>${esc(l.label.replace(/^L\d\s*/, ''))}</vk-text><vk-text size="micro" mono emphasis="muted" data-meta>${tags.length}</vk-text></vk-row>
        ${items}
      </vk-stack>`;
    })
    .join('');
  return `<vk-box w="${RAIL_W}" h="952" surface="paper" border="hair" data-sidebar>
    <vk-box pad="sm" h="64" surface="none" data-side-search-box>
      <vk-row gap="2xs" align="center">
        <vk-icon name="search" scale="sm"></vk-icon>
        <input type="search" data-side-search placeholder="搜索组件" aria-label="搜索组件">
      </vk-row>
    </vk-box>
    <vk-box surface="none" data-side-nav>${groups}</vk-box>
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
<vk-page fit="contain" align="top" surface="paper">
${topbar(tag)}
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
  const PLATE_W = {
    'vk-edge': 1360,
    'vk-canvas': 1360,
    'vk-annotate': 1360,
    'vk-bytes': 1360,
    'vk-memory': 1360,
    'vk-asm': 1360,
    'vk-timeline': 1360,
    'vk-pin': 1360,
    'vk-ring': 1360,
    'vk-spotlight': 1360,
  };
  const SMALL_PLATE = new Set(['vk-icon', 'vk-tag', 'vk-mark', 'vk-keys', 'vk-rule', 'vk-badge']);
  if (tag !== 'vk-annotate') body = clampWidth(body, SMALL_PLATE.has(tag) ? 900 : PLATE_W[tag] || 1360);
  const def = TAGS[tag];
  const no = String(ORDER.indexOf(tag) + 1).padStart(3, '0');
  if (['vk-frames', 'vk-figure', 'vk-page'].includes(tag)) return `<vk-stack h="872" justify="center" align="center">${body}</vk-stack>`;
  return `<vk-stack h="872" gap="sm" justify="center" align="center">
    ${body}
    <vk-text size="caption" mono emphasis="muted" data-meta>PLATE ${no} / ${tag} / ${esc(LAYER_NAME[def.layer])}</vk-text>
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
  // 宽关系图 / 宽数据件：整幅 + 顶部预设；控件让位给场景本身。
  if (
    CONTEXTUAL.has(tag) ||
    ['vk-canvas', 'vk-bytes', 'vk-stack', 'vk-asm', 'vk-bits', 'vk-memory', 'vk-timeline', 'vk-cells', 'vk-table'].includes(tag)
  ) {
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
  if (['vk-edge', 'vk-annotate', 'vk-pin', 'vk-ring', 'vk-spotlight'].includes(tag)) {
    const scene = tag === 'vk-annotate'
      ? (sceneOf.get(tag) || '').trim().replace(/^<vk-annotate/, '<vk-annotate data-anatomy-target')
      : (sceneOf.get(tag) || '').trim().replace(new RegExp(`<${tag}(?=[\\s>])`), `<${tag} data-anatomy-target`);
    return `<vk-canvas w="1352" h="872" grid="24" data-anatomy>
      <vk-box x="8" y="40" w="1336" surface="none">${clampWidth(scene, 1336)}</vk-box>
    </vk-canvas>`;
  }
  const WIDE = {
    'vk-bytes': 1200,
    'vk-canvas': 1200,
    'vk-table': 1100,
    'vk-frames': 1100,
    'vk-browser': 1200,
    'vk-asm': 1240,
    'vk-bits': 1240,
    'vk-memory': 1280,
    'vk-timeline': 1280,
    'vk-cells': 1240,
  };
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
        <vk-stack gap="2xs">${rows || '<vk-text size="body" emphasis="secondary">没有其他标本使用它。</vk-text>'}</vk-stack>
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
  const body = `<vk-row w="1680" h="952" align="top" gap="sm" data-app>
    ${sidebar(tag)}
    <vk-box w="${STAGE_W}" h="952" surface="none" pad-y="md" data-main>
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
  const query = [tag, def.name, def.summary, layer].join(' ');
  return `<a href="specimen/${tag}.html" data-index-cell data-layer="${esc(def.layer)}" data-search="${esc(query)}"><vk-box w="200" h="96" surface="none" border="none" data-index-card>
    <vk-stack h="84" gap="2xs" justify="between">
      <vk-row justify="between" align="baseline"><vk-text size="micro" mono data-meta>${no}</vk-text><vk-text size="micro" mono emphasis="muted" data-meta>${esc(tag.replace(/^vk-/, ''))}</vk-text></vk-row>
      <vk-text size="meta">${esc(def.name)}</vk-text>
    </vk-stack>
  </vk-box></a>`;
}

function indexPageHtml() {
  const total = ORDER.length;
  const cells = ORDER.map((tag, i) => indexCell(tag, i)).join('');
  const layerTags = LAYERS.filter((l) => l.id !== 'tokens').map((l) => {
    const label = (l.label || '').replace(/^L\d\s*/, '');
    return `<vk-tag size="micro" data-meta tone="muted" data-index-layer="${l.id}" role="button" tabindex="0">${esc(label)}</vk-tag>`;
  }).join('');
  const body = `<vk-row w="1680" h="952" align="top" gap="md" data-app>
    <vk-stack w="600" h="888" gap="lg" justify="between" data-hero>
      <vk-stack gap="lg">
        <vk-title size="heading" sub="不提供页面模板，不规定叙事；调用方自己拼。">
          <em>40</em> 个画面组件，<br>每个都独立成立。
        </vk-title>
        <vk-code w="560" lang="c" file="hello.c" density="compact" highlight="2">
          <script type="text/plain" data-vk-source>
char s[] = "hi";
s[0] = 'H';
          </script>
        </vk-code>
      </vk-stack>
      <vk-stack gap="sm">
        <input class="index-search" data-side-search placeholder="搜索 40 个组件" aria-label="搜索组件">
        <vk-row gap="2xs" wrap data-index-layers>
          <vk-tag size="micro" data-meta tone="muted" data-index-layer="all" state="selected" role="button" tabindex="0">全部</vk-tag>
          ${layerTags}
        </vk-row>
      </vk-stack>
    </vk-stack>
    <vk-box w="1040" h="888" surface="none" data-catalog>
      <vk-stack gap="sm">
        <vk-row justify="between" align="baseline" w="1040">
          <vk-text size="label" mono data-meta>Index</vk-text>
          <vk-text size="micro" mono emphasis="muted" data-meta data-index-count>${total} / ${total}</vk-text>
        </vk-row>
        <vk-grid cols="5" gap="2xs" w="1032" data-index-grid>${cells}</vk-grid>
        <vk-text size="caption" emphasis="muted" data-meta data-index-empty hidden>没有匹配的组件。按 Esc 清空搜索。</vk-text>
      </vk-stack>
    </vk-box>
  </vk-row>`;
  return `<!doctype html>
<!-- generated by tools/specimens.mjs — do not edit -->
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<link rel="icon" href="data:,">
<title>vk components · ${total} specimens</title>
<link rel="stylesheet" href="vk/fonts.css">
<link rel="stylesheet" href="vk/vk.css">
<link rel="stylesheet" href="showcase.css">
</head>
<body data-page="index">
<vk-page fit="contain" align="top" surface="paper">
${topbar(null)}
${body}
${pageFoot(null)}
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
// 退场的标签不能留旧页：index / 门禁 / links 都会顺着目录扫。
for (const f of fs.readdirSync(path.join(out, 'specimen'))) {
  if (!f.endsWith('.html')) continue;
  if (TAG_NAMES.includes(f.slice(0, -5))) continue;
  if (check) {
    console.error(`✗ specimen/${f}  标签已退场，页面应删除`);
    process.exitCode = 1;
  } else {
    fs.rmSync(path.join(out, 'specimen', f));
  }
}
if (writePage(path.join(out, 'index.html'), indexPageHtml())) written++;
console.log(`specimens: ${pages.length} 页${check ? '（检查）' : ''}${written ? ` · ${written} 写` : ' · 无变化'}`);
