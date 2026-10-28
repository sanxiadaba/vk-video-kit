/**
 * 规格页生成器：一页一组件，单镜头。
 *
 * 页面上只有：一行元信息（层 / 标签 / 编号 / 上下页）+ 该组件的标准形态。
 * 没有成品、没有用法、没有解剖——那些是 DEMO 与叙事，不属本层。
 * 完整属性表在 docs/reference.md，由 registry 生成，和这里同源。
 *
 *   node tools/specimens.mjs
 *   node tools/specimens.mjs --check
 */
import fs from 'node:fs';
import { TAGS, LAYERS, byLayer } from '../src/registry.mjs';
import { SCENES } from '../src/scenes/scenes.mjs';
import { PRESETS } from '../src/scenes/presets.mjs';
import { checkMode } from './lib/io.mjs';
import { SITE } from './lib/paths.mjs';
import { hash32 } from '../src/shared/code.mjs';

const check = checkMode();
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const LAYER_NAME = Object.fromEntries(LAYERS.map((l) => [l.id, l.label]));
const LAYER_SHORT = { tokens: '值', elements: '原子', layout: '排布', components: '器械', relations: '关系', page: '页面' };
const ORDER = [];
for (const layer of LAYERS) for (const tag of byLayer(layer.id)) ORDER.push(tag);
const sceneOf = new Map(SCENES.map((s) => [s.tag, s.body.trim()]));

const RESET = `html,body{margin:0;padding:0;background:#eef2f7;color:#0b0f14}
body{display:flex;justify-content:center;min-height:100vh}
a{color:inherit;text-decoration:none}
a:hover{color:#1b3fd6}
.spec-scale{width:1400px}
.spec-scale > *{zoom:.73}
.spec-card-tag{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.06em}`;

function shell(title, body, depth = 1) {
  // depth：索引在站点根，规格页在 specimen/ 下一层；两者的相对路径前缀不同。
  const up = depth ? '../'.repeat(depth) : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1920">
<link rel="icon" href="data:,">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${up}vk/fonts.css">
<link rel="stylesheet" href="${up}vk/vk.css">
<style>${RESET}
.vk-page{margin:0 auto}
</style>
</head>
<body>
${body}
<script src="${up}dist/vk.js"></script>
</body>
</html>
`;
}

function nav(no, tag) {
  const i = ORDER.indexOf(tag);
  const prev = ORDER[i - 1];
  const next = ORDER[i + 1];
  const link = (t, label) =>
    t ? `<a href="${t}.html"><vk-text size="micro" mono ink="muted" data-meta>${esc(label)}</vk-text></a>` : '';
  return `<vk-row gap="sm" align="baseline">${link(prev, '← ' + (prev || ''))}${link(
    next,
    (next || '') + ' →'
  )}</vk-row>`;
}

function specPage(tag, no) {
  const def = TAGS[tag];
  const rawBody = sceneOf.get(tag) || `<vk-text size="body">（没有标准形态）</vk-text>`;
  const presets = PRESETS[tag] || [];
  const presetText = presets.length
    ? '预设：' + presets.map((p) => p.label).join(' · ')
    : '没有外观预设：它的形状由内容决定。';
  const meta = `${String(no).padStart(3, '0')} / ${String(ORDER.length).padStart(3, '0')}`;
  // 高个组件（代码窗、表格、内存图…）在 888 安全区里放不下一行预设说明；
  // 预设仍列在 reference.md 与变体里，这里不为了"凑一行"去缩字或裁切。
  const TALL = new Set([
    'vk-code', 'vk-term', 'vk-diff', 'vk-asm', 'vk-table',
    'vk-bytes', 'vk-tree', 'vk-timeline', 'vk-figure',
    'vk-cells', 'vk-list', 'vk-math', 'vk-page',
    'vk-bits',
  ]);
  const footer = TALL.has(tag)
    ? ''
    : `    <vk-row justify="between" align="baseline">
      <vk-text size="micro" mono ink="muted" data-meta>${esc(presetText)}</vk-text>
      <vk-text size="micro" mono ink="muted" data-meta>属性表：docs/reference.md</vk-text>
    </vk-row>
`;
  const page = `<vk-page align="top">
  <vk-stack gap="2xs">
    <vk-row justify="between" align="baseline">
      <vk-row gap="xs" align="baseline">
        <vk-text size="micro" mono ink="muted" data-meta>${esc(LAYER_NAME[def.layer])}</vk-text>
        <vk-text size="micro" mono ink="muted" data-meta>·</vk-text>
        <vk-text size="micro" mono ink="muted" data-meta>${esc(tag)}</vk-text>
        <vk-text size="micro" mono ink="muted" data-meta>·</vk-text>
        <vk-text size="micro" mono ink="muted" data-meta>${esc(def.name)}</vk-text>
      </vk-row>
      <vk-row gap="md" align="baseline">
        ${nav(no, tag)}
        <vk-text size="micro" mono ink="muted" data-meta>${meta}</vk-text>
      </vk-row>
    </vk-row>
    <vk-rule></vk-rule>
${tag === "vk-page" ? `<div class="spec-scale">${rawBody}</div>` : rawBody}
${footer}  </vk-stack>
</vk-page>`;
  return shell(`vk · ${tag} · ${def.name}`, `<!-- vk:spec:${specHash(tag, rawBody, presets)} -->\n${page}`);
}

function card(tag, no) {
  const def = TAGS[tag];
  return `<a href="specimen/${tag}.html"><vk-box surface="paper" border="hair" radius="md" pad="2xs" h="148" overflow="clip">
  <vk-stack gap="2xs">
    <vk-text size="meta">${esc(def.name)}</vk-text>
    <vk-text class="spec-card-tag" size="micro" mono ink="muted" data-meta>${esc(tag.replace(/^vk-/, ""))}</vk-text>
  </vk-stack>
</vk-box></a>`;
}

function indexPage() {
  const cards = ORDER.map((tag, i) => card(tag, i + 1)).join('\n');
  const page = `<vk-page align="top">
  <vk-stack gap="xs">
    <vk-row justify="between" align="baseline">
      <vk-text size="label">${ORDER.length} 个组件</vk-text>
      <vk-text size="micro" mono ink="muted" data-meta>${ORDER.length} tags · 5 layers · 1920×1080 · 44px 地板</vk-text>
    </vk-row>
    <vk-rule></vk-rule>
    <vk-grid cols="repeat(8, minmax(0, 1fr))" gap="2xs">
${cards}
    </vk-grid>
  </vk-stack>
</vk-page>`;
  return shell('vk · 组件索引', `<!-- vk:spec:${hash32(JSON.stringify(ORDER))} -->\n${page}`, 0);
}

const files = new Map();
ORDER.forEach((tag, i) => files.set(`${SITE}/specimen/${tag}.html`, specPage(tag, i + 1)));
files.set(`${SITE}/index.html`, indexPage());

/**
 * 规格页会被 `cli/build` 二次加工（内联源码、高亮 token、图标），所以不能逐字比。
 * 生成器在页面里留一个指纹注释：它只随"输入"变化，构建不会动它。
 */
function specHash(tag, rawBody, presets) {
  return hash32(
    JSON.stringify([tag, TAGS[tag].summary, TAGS[tag].name, TAGS[tag].layer, rawBody, presets.map((p) => p.label)])
  );
}

fs.mkdirSync(`${SITE}/specimen`, { recursive: true });
let written = 0;
let stale = 0;
for (const [file, html] of files) {
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (before === html) continue;
  const want = html.match(/<!-- vk:spec:([0-9a-f]+) -->/)?.[1];
  const got = before?.match(/<!-- vk:spec:([0-9a-f]+) -->/)?.[1];
  // 预编译过的页与原始场景不同；只要规格指纹没变，就别用未编译的原文盖掉它。
  if (want && got && want === got && /data-vk-(?:icons|math|hl|hl-diff|src|asm|tree|frames|bytes)\b/.test(before)) continue;
  if (check) {
    if (want && got && want === got) continue;
    stale++;
    console.error(`✗ ${file}`);
  } else {
    fs.writeFileSync(file, html);
    written++;
  }
}
if (check) {
  console.log(stale ? `specimens: ${stale} 张过期` : 'specimens: 最新');
  if (stale) process.exit(1);
} else {
  console.log(`specimens: ${files.size} 张（写入 ${written}）`);
}
