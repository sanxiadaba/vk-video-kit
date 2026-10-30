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
const stripOf = new Map(SCENES.map((s) => [s.tag, (s.strip || s.body).trim()]));

const RESET = `html,body{margin:0;padding:0;background:#eef2f7;color:#0b0f14}
body{display:block;min-height:100vh}
a{color:inherit;text-decoration:none}
a:hover{color:#1b3fd6}
.vk-page{width:1920px;margin:0 auto}
/* 标本页 = 纸 + 帧板：帧板 1080 在上，状态带与最小写法在下。 */
.vk-sheet{width:1680px;margin:48px auto 96px}
.vk-sheet-hd{display:flex;justify-content:space-between;align-items:baseline;margin-top:48px;padding:16px 0;border-top:2px solid var(--vk-line-strong)}
.vk-states{display:flex;flex-direction:column;gap:40px;margin-top:8px}
.vk-state{border-top:1px solid var(--vk-line-1);padding-top:16px}
.vk-state-meta{font-family:var(--vk-font-mono);font-size:var(--vk-t-meta);line-height:1.4;color:var(--vk-ink-3);margin-bottom:16px}
.vk-state-body{width:100%}
.vk-snippet{margin:8px 0 0;padding:24px 32px;border:1px solid var(--vk-line-1);border-radius:8px;background:#fff;font-family:var(--vk-font-mono);font-size:var(--vk-t-meta);line-height:1.5;color:var(--vk-ink-1);white-space:pre-wrap;word-break:break-word}
.spec-scale{width:1400px}
/* 标本页的宽度是版面意图，用作者 CSS 表达——组件不再接受像素 w/h。 */
.spec-w{width:1400px}
.spec-w1680{width:1680px}
.spec-w1360{width:1360px}
.spec-w1200{width:1200px}
.spec-w1120{width:1120px}
.spec-w1100{width:1100px}
.spec-w1000{width:1000px}
.spec-w600{width:600px}
.spec-h560{height:560px}
.spec-h240{display:flex;height:240px}
.spec-pill{width:160px}
/* 索引卡高度也是版式意图，落在作者 CSS 上。 */
.spec-card{display:flex;flex-direction:column;height:352px}
.spec-scale > *{zoom:.73}
.spec-card-tag{white-space:nowrap;letter-spacing:-.06em}
/* 索引卡：名字单行，行高按版式收紧。 */
.spec-card-name,.spec-card-tag,.spec-card-name *,.spec-card-tag *{line-height:1!important;white-space:nowrap}
/* 缩略图：vk-img 不受 w/h 约束，用 CSS 定高；cover 裁成等高的一条。 */
vk-img.spec-thumb,vk-img.spec-thumb .vk-img{height:296px!important}
/* 最后一页只有一张卡：放大成专题，不再是一张孤零零的小卡。 */
.spec-lone{display:flex;justify-content:center;padding-top:24px}
.spec-lone .spec-card{width:1120px;height:700px}
.spec-lone .spec-thumb,.spec-lone .spec-thumb .vk-img{height:620px!important}


`;

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
    t ? `<a href="${t}.html"><vk-text size="meta" mono ink="muted" data-meta>${esc(label)}</vk-text></a>` : '';
  return `<vk-row gap="sm" align="baseline">${link(prev, '← ' + (prev || ''))}${link(
    next,
    (next || '') + ' →'
  )}</vk-row>`;
}

function applyPreset(body, tag, attrs = {}) {
  const re = new RegExp(`<${tag}\\b([^>]*)>`);
  const m = body.match(re);
  if (!m) return body;
  const parsed = [];
  const attrRe = /([a-zA-Z0-9:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let mm;
  while ((mm = attrRe.exec(m[1]))) parsed.push([mm[1], mm[2] ?? mm[3] ?? mm[4] ?? '']);
  const map = new Map(parsed);
  // 折叠后的行不渲染：current / focus 落在 fold 区间里是死属性，预设不该带进画面。
  if (attrs.fold != null) {
    map.delete('current');
    map.delete('focus');
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null) map.delete(k);
    else map.set(k, String(v));
  }
  const next = [...map].map(([k, v]) => (v === '' ? k : `${k}="${v}"`)).join(' ');
  return body.replace(re, `<${tag}${next ? ' ' + next : ''}>`);
}

function unwrapSpec(html) {
  let s = html.trim();
  const div = s.match(/^<div class="spec-[^"]*">([\s\S]*)<\/div>$/);
  if (div) s = div[1].trim();
  const box = s.match(/^<vk-box class="spec-[^"]*"[^>]*>([\s\S]*)<\/vk-box>$/);
  if (box) s = box[1].trim();
  return s;
}

function stripDefaults(html, tag) {
  const def = TAGS[tag];
  return html.replace(new RegExp(`<${tag}\\b([^>]*)>`), (m, raw) => {
    const parsed = [];
    const attrRe = /([a-zA-Z0-9:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let mm;
    while ((mm = attrRe.exec(raw))) parsed.push([mm[1], mm[2] ?? mm[3] ?? mm[4] ?? '']);
    const keep = parsed.filter(([k, v]) => {
      const spec = def.attrs?.[k];
      return !(spec && spec.default !== undefined && String(spec.default) === v);
    });
    const next = keep.map(([k, v]) => (v === '' ? k : `${k}="${v}"`)).join(' ');
    return `<${tag}${next ? ' ' + next : ''}>`;
  });
}

function snippetOf(rawBody, tag) {
  const body = stripDefaults(unwrapSpec(rawBody), tag);
  return esc(
    body
      .replace(/ class="spec-[^"]*"/g, '')
      .replace(/(src|href)="\.\.\//g, '$1="')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

function scopeIds(html, prefix) {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  if (!ids.size) return html;
  for (const id of ids) html = html.split(`id="${id}"`).join(`id="${prefix}${id}"`);
  return html.replace(/\b(for|from|to)="([^"]*)"/g, (m, attr, value) =>
    `${attr}="${value.replace(/#([\w-]+)/g, (all, id) => (ids.has(id) ? `#${prefix}${id}` : all))}"`
  );
}

const STATE_STRIP = {
  'vk-cells': `<vk-cells cols="4"><li value="1" label="a[0]" state="current"></li><li value="2" label="a[1]" state="mark"></li><li value="3" label="a[2]" state="err"></li><li value="0" label="a[3]" state="ok"></li></vk-cells>`,
  'vk-table': `<vk-table variant="matrix"><table><thead><tr><th>i\\j</th><th>0</th><th>1</th></tr></thead><tbody><tr><th>0</th><td state="current">1</td><td state="mark">2</td></tr><tr><th>1</th><td>3</td><td state="err">4</td></tr></tbody></table></vk-table>`,
  'vk-list': `<vk-list variant="check"><li state="ok">这一条成立</li><li state="warn">这一条要再看</li><li state="err">这一条不成立</li></vk-list>`,
  'vk-timeline': `<vk-timeline start="1972" end="2018"><li date="1972" label="当前节点" state="current">说明一</li><li date="1999" label="标注节点" state="mark">说明二</li><li date="2018" label="普通节点">说明三</li></vk-timeline>`,
};

function specPage(tag, no) {
  const def = TAGS[tag];
  const rawBody = sceneOf.get(tag) || `<vk-text size="body">（没有标准形态）</vk-text>`;
  const stripBody = stripOf.get(tag) || rawBody;
  const presets = PRESETS[tag] || [];
  const meta = `${String(no).padStart(3, '0')} / ${String(ORDER.length).padStart(3, '0')}`;
  const plate = `<vk-page align="top" data-allow-void>
  <vk-stack gap="2xs">
    <vk-row justify="between" align="baseline">
      <vk-row gap="xs" align="baseline">
        <a href="../index.html"><vk-text size="meta" mono ink="muted" data-meta>← 索引</vk-text></a>
        <vk-text size="meta" mono ink="muted" data-meta>${esc(LAYER_NAME[def.layer])}</vk-text>
        <vk-text size="meta" mono ink="muted" data-meta>·</vk-text>
        <vk-text size="meta" mono ink="muted" data-meta>${esc(tag)}</vk-text>
        <vk-text size="meta" mono ink="muted" data-meta>·</vk-text>
        <vk-text size="meta" mono ink="muted" data-meta>${esc(def.name)}</vk-text>
      </vk-row>
      <vk-row gap="md" align="baseline">
        ${nav(no, tag)}
        <vk-text size="meta" mono ink="muted" data-meta>${meta}</vk-text>
      </vk-row>
    </vk-row>
    <vk-rule></vk-rule>
<div class="spec-body">${tag === 'vk-page' ? `<div class="spec-scale">${rawBody}</div>` : rawBody}</div>
  </vk-stack>
</vk-page>`;

  const stateCount = presets.length + (STATE_STRIP[tag] ? 1 : 0);
  const stateExample = STATE_STRIP[tag]
    ? `<div class="vk-state">
  <div class="vk-state-meta">状态 · state="current|mark|ok|warn|err"（作者手写条目）</div>
  <div class="vk-state-body">${STATE_STRIP[tag]}</div>
</div>`
    : '';
  const states = `${stateExample}${presets.length
    ? presets
        .map((p, si) => {
          const values = Object.entries(p.attrs || {})
            .map(([k, v]) => (v === null ? `−${k}` : `${k}="${v}"`))
            .join(' · ');
          return `<div class="vk-state">
  <div class="vk-state-meta">预设 · ${esc(p.label)}${values ? `　${esc(values)}` : ''}</div>
  <div class="vk-state-body">${scopeIds(applyPreset(stripBody, tag, p.attrs || {}), `s${si}-`)}</div>
</div>`;
        })
        .join('\n')
    : STATE_STRIP[tag]
      ? ''
      : `<div class="vk-state"><div class="vk-state-meta">没有外观预设：它的形状由内容决定。</div></div>`}`;

  const sheet = `<section class="vk-sheet">
  <div class="vk-sheet-hd"><vk-text size="meta" mono data-meta>状态</vk-text><vk-text size="meta" mono ink="muted" data-meta>${stateCount ? `${stateCount} 档` : '无'}</vk-text></div>
  <div class="vk-states">${states}</div>
  <div class="vk-sheet-hd"><vk-text size="meta" mono data-meta>最小写法</vk-text><vk-text size="meta" mono ink="muted" data-meta>去掉 .spec-* 包装</vk-text></div>
  <pre class="vk-snippet">${snippetOf(rawBody, tag)}</pre>
</section>`;

  return shell(`vk · ${tag} · ${def.name}`, `<!-- vk:spec:${specHash(tag, rawBody, presets)} -->\n${plate}\n${sheet}`);
}

function card(tag, no) {
  const def = TAGS[tag];
  // 索引 = 缩略图 + 名字。缩略图取组件本体（不裁切），卡片端 contain 完整显示。
  return `<a class="spec-card" href="specimen/${tag}.html"><vk-stack gap="2xs" fill overflow="clip">
  <vk-img class="spec-thumb" src="thumbs/${tag}.png" alt="" ratio="16 / 9" fit="cover"></vk-img>
  <vk-row class="spec-card-name" gap="xs" align="baseline"><vk-text size="meta">${esc(def.name)}</vk-text><vk-text size="meta" mono ink="muted" data-meta>${esc(tag)}</vk-text></vk-row>
</vk-stack></a>`;
}

/** 一页 12 格（4 列 × 3 行）。36 格一页时每格只有 273×82，组件认不出来；
 *  12 格一页能做到 414×177（面积 3.3 倍），完整显示、不裁切。 */
const PER_PAGE = 6;
const PAGES = Math.ceil(ORDER.length / PER_PAGE);
const pageHref = (n) => (n === 1 ? 'index.html' : `index-${n}.html`);

function indexPage(n) {
  const slice = ORDER.slice((n - 1) * PER_PAGE, n * PER_PAGE);
  const cards = slice.map((tag, i) => card(tag, i + 1)).join('\n');
  const prev =
    n > 1
      ? `<a href="${pageHref(n - 1)}"><vk-text size="meta" mono ink="muted" data-meta>← 上一页</vk-text></a>`
      : `<vk-text size="meta" mono ink="muted" data-meta>← 上一页</vk-text>`;
  const next =
    n < PAGES
      ? `<a href="${pageHref(n + 1)}"><vk-text size="meta" mono ink="muted" data-meta>下一页 →</vk-text></a>`
      : `<vk-text size="meta" mono ink="muted" data-meta>下一页 →</vk-text>`;
  const page = `<vk-page align="top" data-allow-void>
  <vk-stack gap="sm">
    <vk-row justify="between" align="baseline">
      <vk-row gap="md" align="baseline">
        <vk-text class="spec-card-name" size="meta">${ORDER.length} 个组件</vk-text>
        <vk-text size="meta" mono ink="muted" data-meta>${String(n).padStart(2, '0')} / ${String(PAGES).padStart(2, '0')}</vk-text>
      </vk-row>
      <vk-row gap="md" align="baseline">${prev}${next}</vk-row>
    </vk-row>
    <vk-rule variant="strong"></vk-rule>
${slice.length === 1 ? `<div class="spec-lone">${cards}</div>` : `<vk-grid cols="3" gap-x="sm" gap-y="sm">${cards}</vk-grid>`}
  </vk-stack>
</vk-page>`;
  return shell(`vk · 组件索引 ${n}/${PAGES}`, `<!-- vk:spec:${hash32(JSON.stringify([hash32(card.toString()), hash32(indexPage.toString()), hash32(RESET), n, slice]))} -->\n${page}`, 0);
}

const files = new Map();
ORDER.forEach((tag, i) => files.set(`${SITE}/specimen/${tag}.html`, specPage(tag, i + 1)));
for (let n = 1; n <= PAGES; n++) files.set(`${SITE}/${pageHref(n)}`, indexPage(n));

/**
 * 规格页会被 `cli/build` 二次加工（内联源码、高亮 token、图标），所以不能逐字比。
 * 生成器在页面里留一个指纹注释：它只随"输入"变化，构建不会动它。
 */
function specHash(tag, rawBody, presets) {
  return hash32(
    JSON.stringify([
      // 模板也是输入：改了 shell 就必须重写，否则生成物永远停在旧版。
      hash32(shell.toString()),hash32(RESET),
      hash32(specPage.toString()),
      hash32(applyPreset.toString()),hash32(stripDefaults.toString()),hash32(unwrapSpec.toString()),hash32(scopeIds.toString()),
      tag,
      TAGS[tag].summary,
      TAGS[tag].name,
      TAGS[tag].layer,
      ORDER.length,
      rawBody,
      stripOf.get(tag) || '',
      presets.map((p) => p.label),
    ])
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

