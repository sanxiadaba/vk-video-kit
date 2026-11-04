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
import { TAGS, TAG_NAMES, ALIASES, LAYERS, byLayer } from '../src/registry.mjs';
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
/* 标本页 = 纸 + 居中舞台：帧板 1080 在上，状态带与最小写法在下。
   舞台占满 1680×888 安全区；主帧内容在舞台里水平、垂直居中，并按可用高度等比放大。 */
.spec-stage{width:1680px;height:888px;display:flex;flex-direction:column;min-width:0;max-width:100%}
.spec-hd{display:flex;justify-content:space-between;align-items:baseline;gap:32px;min-width:0;max-width:100%;white-space:nowrap;font-family:var(--vk-font-mono);font-size:var(--vk-t-meta);line-height:1.25;color:var(--vk-ink-3)}
.spec-hd a{color:inherit}
.spec-hd a:hover{color:var(--vk-focus)}
.spec-hd-l,.spec-hd-r{display:flex;align-items:baseline;gap:10px;min-width:0}
.spec-hd-l{flex:1 1 auto;overflow:hidden}
.spec-hd-l .spec-name{overflow:hidden;text-overflow:ellipsis}
.spec-hd-r{flex:0 0 auto}
.spec-hd .spec-dot{opacity:.55}
.spec-nav{padding:0 6px}
.spec-rule{flex:0 0 auto;height:1px;margin:14px 0 0;background:var(--vk-line-strong)}
.spec-body{flex:1 1 auto;min-height:0;min-width:0;max-width:100%;display:flex;align-items:center;justify-content:center}
/* 主帧按组件的原生尺寸居中，不缩放。
   宽度 100% 的子项靠 stretch 撑满舞台；有 spec-w* 的组件由作者 CSS 定宽。 */
.spec-fit{display:flex;flex-direction:column;align-items:center;gap:20px;width:1680px;max-width:1680px;min-width:0}
.spec-fit>*{width:100%;max-width:100%;min-width:0}
/* vk-page 自己就是画布：缩到 1400 宽再交给舞台放大，虚线标出 1920×1080 的边界。 */
.spec-page-view{width:1920px;max-width:none;zoom:.7291667;outline:2px dashed var(--vk-line-strong);outline-offset:0;flex:0 0 auto}
.vk-sheet{width:1680px;margin:48px auto 96px}
.vk-sheet-hd{display:flex;justify-content:space-between;align-items:baseline;margin-top:48px;padding:16px 0;border-top:2px solid var(--vk-line-strong)}
.state-strip{display:flex;flex-direction:column;gap:40px;margin-top:8px}
.state-strip>.vk-state{border-top:1px solid var(--vk-line-1);padding-top:16px;min-width:0;max-width:100%}
.vk-state-meta{font-family:var(--vk-font-mono);font-size:var(--vk-t-meta);line-height:1.4;color:var(--vk-ink-3);margin-bottom:16px;overflow-wrap:anywhere}
.vk-state-body{width:100%;min-width:0;max-width:100%;overflow:hidden}
.vk-snippet{margin:8px 0 0;padding:24px 32px;border:1px solid var(--vk-line-1);border-radius:8px;background:#fff;font-family:var(--vk-font-mono);font-size:var(--vk-t-meta);line-height:1.5;color:var(--vk-ink-1);white-space:pre-wrap;word-break:break-word;max-width:100%}
.spec-scale{width:1400px}
/* 标本页的宽度是版面意图，用作者 CSS 表达——组件不再接受像素 w/h。 */
.spec-w,.spec-w1680,.spec-w1360,.spec-w1200,.spec-w1120,.spec-w1100,.spec-w1000,.spec-w900,.spec-w780,.spec-w600,.spec-w520{min-width:0}
.spec-w{width:1400px}
.spec-w1680{width:1680px}
.spec-w1360{width:1360px}
.spec-w900{width:900px}
.spec-w1200{width:1200px}
.spec-w1120{width:1120px}
.spec-w1100{width:1100px}
.spec-w1000{width:1000px}
.spec-w780{width:780px}
.spec-w600{width:600px}
.spec-w520{width:520px}
.spec-h560{height:560px}
.spec-h540{height:540px}
.spec-h240{display:flex;height:240px}
.spec-pill{width:160px}
.spec-pad-top{padding-top:96px}
.spec-indent{margin-left:120px}
/* 索引卡高度也是版式意图，落在作者 CSS 上。卡高 352；缩略图留出名字一行（caption 48 → 64）。 */
.spec-card{display:flex;flex-direction:column;height:352px}
.spec-scale > *{zoom:.73}
.spec-card-tag{white-space:nowrap;letter-spacing:-.06em}
/* 索引卡：名字单行，行高按版式收紧。 */
.spec-card-name,.spec-card-tag,.spec-card-name *,.spec-card-tag *{line-height:1!important;white-space:nowrap}
/* 缩略图：vk-img 不受 w/h 约束，用 CSS 定高；contain 完整显示组件本体。
   留白必须是纸色——灰底会在卡片里画出一道"没内容"的框。 */
vk-img.spec-thumb,vk-img.spec-thumb .vk-img{height:264px!important;background:#fff}
vk-img.spec-thumb .vk-img{border-radius:0}
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

/**
 * 页眉只留一行：左边是当前位置，右边是「上一页 / 下一页 + 编号」。
 * 标本页很多，全名并排会把 1680 撑爆（vk-edge 曾经折成两行）；
 * 箭头带 title / aria-label，鼠标悬停与读屏都能拿到全名。
 */
function nav(tag) {
  const i = ORDER.indexOf(tag);
  const prev = ORDER[i - 1];
  const next = ORDER[i + 1];
  const link = (t, label, arrow) =>
    t
      ? `<a class="spec-nav" href="${t}.html" title="${esc(label)}" aria-label="${esc(label)}">${arrow}</a>`
      : `<span class="spec-nav" aria-hidden="true">${arrow}</span>`;
  return `${link(prev, '上一个：' + (prev || ''), '←')}${link(next, '下一个：' + (next || ''), '→')}`;
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

/**
 * 有出场演示的标本页给一条时间轴：没有 dur，director 的 plan() 不产生任何 cue，
 * reveal="line" 就只能看静帧。poster = dur = 终态，所以静态截图与门禁都不变。
 */
const SCENE_DUR = { 'vk-term': '2.2' };

const STATE_STRIP = {
  'vk-cells': `<vk-cells cols="4" addr="0x404064"><li value="'h'" label="s[0]" state="ok"></li><li value="'e'" label="s[1]" state="mark"></li><li value="0x2a" label="int x" state="warn"></li><li value="0xff" label="y" state="err"></li></vk-cells>`,
  'vk-table': `<vk-table variant="matrix"><table><thead><tr><th>i\\j</th><th>0</th><th>1</th></tr></thead><tbody><tr><th>0</th><td state="current">52,980</td><td state="mark">635</td></tr><tr><th>1</th><td>760</td><td state="err">43,956</td></tr></tbody></table></vk-table>`,
  'vk-list': `<vk-list variant="check"><li state="ok">hello.i 是 52,980 字节</li><li state="warn">hello.s 只有 635 字节</li><li state="err">s[5] 漏掉 \\0</li></vk-list>`,
};

/** 旧名 → 新标签的示例属性：别名页给"旧写法 / 新写法"对照。 */
const ALIAS_ATTR = {
  'vk-icon': 'icon="check"',
  'vk-rule': 'border="hair"',
  'vk-window': 'chrome="dots" title="main.c"',
  'vk-pin': 'kind="bubble"',
  'vk-ring': 'ring',
  'vk-caption': 'for="#id" anchor="above"',
};

/** 指向本标签的旧名（规格页底部列出，免得旧链接死掉、也免得别名页成孤儿）。 */
const aliasesOf = (tag) => Object.entries(ALIASES).filter(([, a]) => a.to === tag);

function aliasPage(alias) {
  const info = ALIASES[alias];
  const to = info.to;
  const sample = ALIAS_ATTR[alias] || '';
  const body = `<vk-page align="top" data-allow-void>
  <vk-stack gap="md">
    <vk-stack direction="row" gap="xs" align="baseline">
      <a href="../index.html"><vk-text size="label" mono ink="muted" data-meta>← 索引</vk-text></a>
      <vk-text size="label" mono ink="muted" data-meta>·</vk-text>
      <vk-text size="label" mono ink="muted" data-meta>${esc(alias)}</vk-text>
      <vk-text size="label" mono ink="muted" data-meta>· 旧名</vk-text>
    </vk-stack>
    <vk-stack gap="sm">
      <vk-text size="subhead" weight="bold">${esc(alias)} → ${esc(to)}</vk-text>
      <vk-text size="body" measure="body">${esc(info.note)}</vk-text>
      <vk-stack direction="row" gap="md" align="center">
        <vk-label variant="chip" tone="warn">旧名保留</vk-label>
        <a href="${esc(to)}.html"><vk-text size="body" mono>看 ${esc(to)} 的属性与标本 →</vk-text></a>
      </vk-stack>
    </vk-stack>
    <vk-stack gap="2xs">
      <vk-text size="label" mono ink="muted" data-meta>旧写法（仍可用，构建期给一条迁移提示）</vk-text>
      <vk-text size="label" mono>${esc(`<${alias} …>…</${alias}>`)}</vk-text>
      <vk-text size="label" mono>${esc(`<${to}${sample ? ` ${sample}` : ''}>…</${to}>`)}</vk-text>
    </vk-stack>
  </vk-stack>
</vk-page>`;
  return shell(`vk · ${alias} · 旧名`, `<!-- vk:spec:${hash32(JSON.stringify(['alias', alias, to, info.note, sample, hash32(aliasPage.toString())]))} -->\n${body}`);
}

const ALIAS_ORDER = [...new Set(Object.values(ALIASES).map((a) => a.to))]
  .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
  .flatMap((to) => Object.keys(ALIASES).filter((alias) => ALIASES[alias].to === to));

/* --------------------------------------------------------------- 主题标本页
   同一块内容并排三次：三套主题只换颜色。这一页是主题层的相册；"几何逐项相等"
   由 tests/theme-geometry.test.mjs 量包围盒与字号，不靠眼睛。 */
const THEME_COLS = [
  { id: 'paper', scene: '现在的样子' },
  { id: 'graphite', scene: '长时间看' },
  { id: 'blueprint', scene: '讲结构' },
];

/** 主题页自己的版式（作者 CSS）；色块直接引用 --vk-theme-*，就是文档里教的写法。
 *  版面上所有字都 ≥ caption 48（tag 档用 vk-label 的 36）：门禁的"字号地板"不看
 *  是不是标本页——这一页也得按交付标准排。 */
const THEME_CSS = `<style>
.theme-page{display:flex;flex-direction:column;gap:24px;height:100%}
.theme-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;flex:1 1 auto;min-height:0}
.theme-col{display:flex;flex-direction:column;gap:14px;min-width:0;overflow:hidden;padding:20px;border-radius:12px;background:var(--vk-paper-sf-0);border:1px solid var(--vk-line-1)}
.theme-col-hd{display:flex;align-items:baseline;justify-content:space-between;gap:12px;min-width:0}
.theme-name{font-family:var(--vk-font-mono);font-size:48px;line-height:1.1;font-weight:500;color:var(--vk-ink-1);white-space:nowrap}
.theme-swatch{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:auto}
.theme-sw{min-width:0}
.theme-sw i{display:block;height:40px;border-radius:6px;border:1px solid var(--vk-line-1)}
.theme-sw b{display:block;margin-top:6px;font-family:var(--vk-font-mono);font-size:48px;line-height:1.15;font-weight:400;color:var(--vk-ink-3);white-space:nowrap}
</style>`;

const SWATCHES = [
  ['纸', '--vk-theme-paper'],
  ['墨', '--vk-theme-ink-1'],
  ['表面', '--vk-theme-surface-2'],
  ['强调', '--vk-theme-accent'],
];

function themeColumn(c) {
  return `<div class="theme-col" data-theme="${c.id}">
      <div class="theme-col-hd"><span class="theme-name">${esc(c.id)}</span><vk-label variant="tag">${esc(c.scene)}</vk-label></div>
      <vk-text size="headline">纸与墨</vk-text>
      <vk-text size="body" ink="secondary">换纸，不换版。</vk-text>
      <vk-stack direction="row" gap="xs" wrap>
        <vk-label variant="chip" tone="ok">成立</vk-label>
        <vk-label variant="chip" tone="warn">注意</vk-label>
        <vk-label variant="chip" tone="err">失败</vk-label>
      </vk-stack>
      <vk-code chrome="min" mass="compact" lang="py" surface="dark" numbers="none" size="caption">def rank(x):</vk-code>
      <div class="theme-swatch">
${SWATCHES.map(([label, token]) => `        <div class="theme-sw"><i style="background:var(${token})"></i><b>${label}</b></div>`).join('\n')}
      </div>
    </div>`;
}

function themePage() {
  const page = `<vk-page align="top" data-allow-void>
  <div class="theme-page">
    <div class="spec-hd">
      <div class="spec-hd-l">
        <a href="../index.html">← 索引</a><span class="spec-dot">·</span><span>主题</span><span class="spec-dot">·</span><span class="spec-name">三套调色板</span>
      </div>
      <div class="spec-hd-r"><span class="spec-no">只换颜色 · docs/themes.md</span></div>
    </div>
    <div class="spec-rule"></div>
    <div class="theme-cols">
${THEME_COLS.map(themeColumn).join('\n')}
    </div>
  </div>
</vk-page>`;
  return shell(`vk · 主题 · 三套调色板`, `<!-- vk:spec:${hash32(JSON.stringify(['theme', hash32(themePage.toString()), hash32(themeColumn.toString()), hash32(shell.toString()), hash32(RESET), hash32(THEME_CSS), hash32(JSON.stringify(SWATCHES)), JSON.stringify(THEME_COLS)]))} -->\n${THEME_CSS}\n${page}`);
}

/** 主帧最多展示的状态数：1 个状态示例 + 至多 2 个外观预设，合计 ≤3。 */
const MAX_STATES = 3;

function specPage(tag, no) {
  const def = TAGS[tag];
  const rawBody = sceneOf.get(tag) || `<vk-text size="body">（没有标准形态）</vk-text>`;
  const stripBody = stripOf.get(tag) || rawBody;
  const presets = PRESETS[tag] || [];
  const meta = `${String(no).padStart(3, '0')} / ${String(ORDER.length).padStart(3, '0')}`;
  const sceneDur = SCENE_DUR[tag] ? ` dur="${SCENE_DUR[tag]}"` : '';

  // 一页 = 1680×888 的居中舞台：页眉钉在舞台顶部，主帧在剩余空间里水平 + 垂直居中。
  // 舞台尺寸就是安全区，所以内容无论多大都不会越过 1920×1080 的纸。
  const plate = `<vk-page align="center" data-allow-void${sceneDur}>
  <div class="spec-stage">
    <div class="spec-hd">
      <div class="spec-hd-l">
        <a href="../index.html">← 索引</a><span class="spec-dot">·</span><span class="spec-tag">${esc(tag)}</span><span class="spec-dot">·</span><span class="spec-name">${esc(def.name)}</span>
      </div>
      <div class="spec-hd-r">${nav(tag)}<span class="spec-no">${meta}</span></div>
    </div>
    <div class="spec-rule"></div>
    <div class="spec-body"><div class="spec-fit">${rawBody}</div></div>
  </div>
</vk-page>`;

  const stateEntries = [];
  if (STATE_STRIP[tag]) {
    stateEntries.push({
      meta: '状态 · state="current|mark|ok|warn|err"（作者手写条目）',
      html: STATE_STRIP[tag],
    });
  }
  for (const p of presets) {
    if (stateEntries.length >= MAX_STATES) break;
    const values = Object.entries(p.attrs || {})
      .map(([k, v]) => (v === null ? `−${k}` : `${k}="${v}"`))
      .join(' · ');
    stateEntries.push({
      meta: `预设 · ${esc(p.label)}${values ? `　${esc(values)}` : ''}`,
      html: scopeIds(applyPreset(stripBody, tag, p.attrs || {}), `s${stateEntries.length}-`),
    });
  }
  const stateCount = stateEntries.length;
  const states = stateCount
    ? stateEntries
        .map(
          (entry) => `<div class="vk-state">
  <div class="vk-state-meta">${entry.meta}</div>
  <div class="vk-state-body">${entry.html}</div>
</div>`
        )
        .join('\n')
    : `<div class="vk-state"><div class="vk-state-meta">没有外观预设：它的形状由内容决定。</div></div>`;

  const aliases = aliasesOf(tag);
  const aliasBlock = aliases.length
    ? `<div class="vk-sheet-hd"><vk-text size="label" mono data-meta>旧名</vk-text><vk-text size="label" mono ink="muted" data-meta>已合并，旧名保留</vk-text></div>
  <vk-stack direction="row" gap="md" align="baseline">${aliases
    .map(([name]) => `<a href="${name}.html"><vk-text size="label" mono>${esc(name)}</vk-text></a>`)
    .join('')}</vk-stack>`
    : '';
  const sheet = `<section class="vk-sheet">
  <div class="vk-sheet-hd"><vk-text size="label" mono data-meta>状态</vk-text><vk-text size="label" mono ink="muted" data-meta>${stateCount ? `${stateCount} 档 · 其余属性见 reference` : '无'}</vk-text></div>
  <div class="state-strip">${states}</div>
  <div class="vk-sheet-hd"><vk-text size="label" mono data-meta>最小写法</vk-text><vk-text size="label" mono ink="muted" data-meta>去掉 .spec-* 包装</vk-text></div>
  <pre class="vk-snippet">${snippetOf(rawBody, tag)}</pre>
  ${aliasBlock}
</section>`;

  return shell(`vk · ${tag} · ${def.name}`, `<!-- vk:spec:${specHash(tag, rawBody, presets)} -->\n${plate}\n${sheet}`);
}

function card(tag, no) {
  const def = TAGS[tag];
  // 索引 = 缩略图 + 名字。缩略图是组件本体（不是整页），卡片端 contain 完整显示。
  return `<a class="spec-card" href="specimen/${tag}.html"><vk-stack gap="2xs" fill overflow="clip">
  <vk-img class="spec-thumb" src="thumbs/${tag}.png" alt="" ratio="16 / 9" fit="contain"></vk-img>
  <vk-stack direction="row" class="spec-card-name" gap="xs" align="baseline"><vk-text size="label">${esc(def.name)}</vk-text><vk-text size="label" mono ink="muted" data-meta>${esc(tag)}</vk-text></vk-stack>
</vk-stack></a>`;
}

/** 一页 6 格（3 列 × 2 行）。格子再小，缩略图里的组件就认不出来；
 *  这一页 6 格能做到 490×296，组件本体按 contain 完整放下。 */
const PER_PAGE = 6;
const PAGES = Math.ceil(ORDER.length / PER_PAGE);
const pageHref = (n) => (n === 1 ? 'index.html' : `index-${n}.html`);

function indexPage(n) {
  const slice = ORDER.slice((n - 1) * PER_PAGE, n * PER_PAGE);
  const cards = slice.map((tag, i) => card(tag, i + 1)).join('\n');
  const prev =
    n > 1
      ? `<a href="${pageHref(n - 1)}"><vk-text size="label" mono ink="muted" data-meta>← 上一页</vk-text></a>`
      : `<vk-text size="label" mono ink="muted" data-meta>← 上一页</vk-text>`;
  const next =
    n < PAGES
      ? `<a href="${pageHref(n + 1)}"><vk-text size="label" mono ink="muted" data-meta>下一页 →</vk-text></a>`
      : `<vk-text size="label" mono ink="muted" data-meta>下一页 →</vk-text>`;
  const page = `<vk-page align="top" data-allow-void>
  <vk-stack gap="sm">
    <vk-stack direction="row" justify="between" align="baseline">
      <vk-stack direction="row" gap="md" align="baseline">
        <vk-text class="spec-card-name" size="label">${ORDER.length} 个组件</vk-text>
        <vk-text size="label" mono ink="muted" data-meta>${String(n).padStart(2, '0')} / ${String(PAGES).padStart(2, '0')}</vk-text>
      </vk-stack>
      <vk-stack direction="row" gap="md" align="baseline"><a href="specimen/theme.html"><vk-text size="label" mono ink="muted" data-meta>主题 3 套 →</vk-text></a>${prev}${next}</vk-stack>
    </vk-stack>
    <vk-box border="strong"></vk-box>
${slice.length === 1 ? `<div class="spec-lone">${cards}</div>` : `<vk-grid cols="3" gap-x="sm" gap-y="sm">${cards}</vk-grid>`}
  </vk-stack>
</vk-page>`;
  return shell(`vk · 组件索引 ${n}/${PAGES}`, `<!-- vk:spec:${hash32(JSON.stringify([hash32(card.toString()), hash32(indexPage.toString()), hash32(RESET), n, slice]))} -->\n${page}`, 0);
}

const files = new Map();
ORDER.forEach((tag, i) => files.set(`${SITE}/specimen/${tag}.html`, specPage(tag, i + 1)));
// 主题页：同一块内容并排展示三套主题（索引页链到它，不是孤儿页）。
files.set(`${SITE}/specimen/theme.html`, themePage());
// 旧名页：一页一句"已合并到谁"，并链回新标签；新标签页底部也链回来（不是孤儿页）。
for (const alias of ALIAS_ORDER) files.set(`${SITE}/specimen/${alias}.html`, aliasPage(alias));
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
      hash32(JSON.stringify(STATE_STRIP)), MAX_STATES,
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

// 删掉已经不存在的标签的标本页。
// 14.0 会一路删标签；生成器只写不删，残留的 vk-keys.html 会让 links 门禁
// 报"不可达"，还会让索引链接到空页。这里按 registry 的现状清一遍。
const live = new Set([...TAG_NAMES, ...ALIAS_ORDER].map((t) => `${t}.html`));
for (const dir of [`${SITE}/specimen`, `${SITE}/specimens`]) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!/^vk-.*\.html$/.test(name) || live.has(name)) continue;
    if (check) {
      stale++;
      console.error(`✗ ${dir}/${name}（标签已删除，产物还在）`);
    } else {
      fs.rmSync(`${dir}/${name}`, { force: true });
    }
  }
}

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

