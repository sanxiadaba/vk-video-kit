/**
 * 组件画廊：索引 + 每个标签一页详情（实时 iframe / 属性表 / 最小写法）。
 * 只用于看，不是模板；截图与测试基线同一条（out/golden）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TAGS, TAG_NAMES, LAYERS, LAYOUT_ATTRS, CHILDREN, STATES } from '../src/schema.mjs';
import { SAMPLES, fixturePage } from './samples.mjs';
import { publish } from './lib/publish.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const layerOf = (tag) => LAYERS.find((l) => l.id === TAGS[tag].layer)?.label || TAGS[tag].layer;
const prevNext = (tag) => {
  const i = TAG_NAMES.indexOf(tag);
  return [TAG_NAMES[(i - 1 + TAG_NAMES.length) % TAG_NAMES.length], TAG_NAMES[(i + 1) % TAG_NAMES.length]];
};

const CSS = `
*{box-sizing:border-box}
body{margin:0;padding:40px 48px 80px;background:#eef2f7;color:#0b0f14;font-family:Inter,"Noto Sans SC",sans-serif;line-height:1.6}
a{color:#1b3fd6;text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1180px;margin:0 auto}
.nav{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;color:#4b5563;margin-bottom:24px}
h1{font-size:30px;margin:0 0 6px}h1 code{font-family:"JetBrains Mono",monospace;font-size:26px}
.lead{color:#4b5563;margin:0 0 24px;max-width:900px}
.frame{display:block;width:100%;max-width:960px;aspect-ratio:16/9;overflow:hidden;border:1px solid #d8e2ee;border-radius:10px;background:#fff}
.frame iframe{width:1920px;height:1080px;border:0;transform:scale(.5);transform-origin:0 0;display:block}
h2{font-size:16px;margin:36px 0 10px;color:#333d4b}
table{border-collapse:collapse;width:100%;font-size:13px;background:#fff;border:1px solid #d8e2ee}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #edf2f8;vertical-align:top}
th{background:#f7f9fc;font-weight:600;color:#333d4b}
td:first-child{font-family:"JetBrains Mono",monospace;white-space:nowrap}
td code{font-family:"JetBrains Mono",monospace;font-size:12px;color:#333d4b}
pre{margin:0;padding:16px 18px;background:#fff;border:1px solid #d8e2ee;border-radius:8px;overflow:auto;font:13px/1.6 "JetBrains Mono",monospace}
.meta{font-size:13px;color:#4b5563;margin-top:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:24px}
.card{color:inherit}
figure{margin:0;background:#fff;border:1px solid #d8e2ee;border-radius:10px;overflow:hidden;transition:box-shadow .15s}
.card:hover figure{box-shadow:0 6px 20px rgba(11,15,20,.08)}
img{display:block;width:100%;height:auto}
figcaption{padding:10px 14px;font-size:13px;color:#4b5563;border-top:1px solid #edf2f8}
`;

function attrTable(tag) {
  const rows = Object.entries(TAGS[tag].attrs)
    .filter(([name]) => !LAYOUT_ATTRS.has(name))
    .map(([name, spec]) => {
      const kind = spec.values ? spec.values.map((v) => `<code>${esc(v)}</code>`).join(' ') : `<code>${esc(spec.type || 'text')}</code>`;
      const def = spec.default === undefined ? '' : `<code>${esc(spec.default)}</code>`;
      return `<tr><td>${esc(name)}</td><td>${kind}</td><td>${def}</td><td>${esc(spec.label || '')}</td></tr>`;
    });
  return `<table><thead><tr><th>属性</th><th>取值</th><th>默认</th><th>说明</th></tr></thead><tbody>${rows.join('')}</tbody></table>
<p class="meta">另有布局协议（所有块级通用）：span · row-span · grow · stretch · bleed · overflow · state</p>`;
}

function detail(tag) {
  const def = TAGS[tag];
  const [prev, next] = prevNext(tag);
  const model = CHILDREN[tag];
  const child = model
    ? model.kind === 'item'
      ? `条目写成 <code>&lt;${model.item}&gt;</code>`
      : model.kind === 'wrapper'
        ? `内容包在 <code>&lt;${model.wrapper}&gt;</code> 里`
        : '内容来自 <code>src</code> 或内联 <code>&lt;script data-vk-source&gt;</code>'
    : '裸文本';
  const state = STATES[tag] ? `状态：<code>state="${STATES[tag].values.join('|')}"</code>（${STATES[tag].where.join(' / ')}）` : '';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${tag} · vk</title><style>${CSS}</style></head><body>
<div class="wrap">
  <div class="nav"><a href="../index.html">← 全部标签</a><span>${esc(layerOf(tag))} · ${TAG_NAMES.indexOf(tag) + 1}/${TAG_NAMES.length}</span></div>
  <h1><code>${tag}</code> · ${esc(def.name)}</h1>
  <p class="lead">${esc(def.summary)}</p>

  <a class="frame" href="../pages/${tag}.html" target="_blank" title="打开 1920×1080 原始帧"><iframe src="../pages/${tag}.html" scrolling="no" loading="lazy"></iframe></a>
  <p class="meta">实时渲染（这里缩到 960 宽）· 点一下打开 1920 原始帧</p>

  <h2>属性</h2>
  ${attrTable(tag)}
  <p class="meta">子节点：${child}${state ? ' · ' + state : ''}</p>

  <h2>最小写法</h2>
  <pre>${esc(SAMPLES[tag])}</pre>

  <div class="nav" style="margin-top:40px"><a href="${prev}.html">← ${prev}</a><a href="../index.html">全部标签</a><a href="${next}.html">${next} →</a></div>
</div></body></html>`;
}

fs.mkdirSync('tests/pages', { recursive: true });
for (const tag of Object.keys(SAMPLES)) fs.writeFileSync(path.join('tests/pages', `${tag}.html`), fixturePage(tag));
execFileSync(process.execPath, ['bin/vk.mjs', 'build', 'tests/pages'], { stdio: 'inherit' });
publish();

const dir = path.join('out', 'gallery');
fs.mkdirSync(dir, { recursive: true });
execFileSync(
  process.execPath,
  ['bin/vk.mjs', 'shot', ...TAG_NAMES.map((tag) => `tests/pages/${tag}.html`), '--out-dir', dir, '--width', '640'],
  { stdio: 'pipe' }
);

fs.mkdirSync(path.join('out', 'c'), { recursive: true });
for (const tag of TAG_NAMES) fs.writeFileSync(path.join('out', 'c', `${tag}.html`), detail(tag));

const sections = [];
for (const layer of LAYERS) {
  const tags = TAG_NAMES.filter((t) => TAGS[t].layer === layer.id);
  if (!tags.length) continue;
  const cards = tags.map(
    (tag) =>
      `<a class="card" href="c/${tag}.html"><figure><img src="gallery/${tag}.png" alt="${tag}" loading="lazy"><figcaption><b>${tag}</b> · ${esc(TAGS[tag].name)}</figcaption></figure></a>`
  );
  sections.push(`<h2>${layer.label}</h2>\n<div class="grid">${cards.join('')}</div>`);
}

fs.writeFileSync(
  path.join('out', 'index.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>vk · 30 个标签</title><style>${CSS}</style></head><body><div class="wrap"><h1>vk · 30 个标签</h1><p class="lead">点任意一格看属性与最小写法。缩略图按手机尺度（640 宽）拍；详情页是实时渲染。</p>
${sections.join('\n')}</div></body></html>\n`
);
console.log(`gallery: out/index.html + out/c/*.html · ${TAG_NAMES.length} 个标签`);
