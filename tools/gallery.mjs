/**
 * 组件画廊：30 张 640 宽截图 + 一页索引。
 * 只用于看，不是模板；截图与测试基线条同一条（out/golden）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TAGS, TAG_NAMES, LAYERS } from '../src/schema.mjs';
import { SAMPLES, fixturePage } from './samples.mjs';

fs.mkdirSync('tests/pages', { recursive: true });
for (const tag of Object.keys(SAMPLES)) fs.writeFileSync(path.join('tests/pages', `${tag}.html`), fixturePage(tag));
execFileSync(process.execPath, ['bin/vk.mjs', 'build', 'tests/pages'], { stdio: 'inherit' });

const dir = path.join('out', 'gallery');
fs.mkdirSync(dir, { recursive: true });
execFileSync(
  process.execPath,
  ['bin/vk.mjs', 'shot', ...TAG_NAMES.map((tag) => `tests/pages/${tag}.html`), '--out-dir', dir, '--width', '640'],
  { stdio: 'pipe' }
);

const cards = [];
for (const layer of LAYERS) {
  const tags = TAG_NAMES.filter((t) => TAGS[t].layer === layer.id);
  if (!tags.length) continue;
  cards.push(`<h2>${layer.label}</h2>`);
  for (const tag of tags) {
    cards.push(`<figure><img src="gallery/${tag}.png" alt="${tag}"><figcaption><b>${tag}</b> · ${TAGS[tag].name}</figcaption></figure>`);
  }
}

fs.writeFileSync(
  path.join('out', 'index.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>vk · 30 个标签</title>
<style>
body{margin:0;padding:48px;background:#eef2f7;font-family:Inter,"Noto Sans SC",sans-serif;color:#0b0f14}
h1{font-size:28px;margin:0 0 8px}h2{font-size:18px;margin:48px 0 16px;color:#4b5563}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:24px}
figure{margin:0;background:#fff;border:1px solid #d8e2ee;border-radius:10px;overflow:hidden}
img{display:block;width:100%;height:auto}
figcaption{padding:10px 14px;font-size:13px;color:#4b5563;border-top:1px solid #edf2f8}
</style></head><body><h1>vk · 30 个标签</h1><p>640 宽（按手机尺度看）。样张只用于看与回归，不是模板。</p>
<div class="grid">${cards.join('\n')}</div></body></html>\n`
);
console.log(`gallery: out/index.html · ${TAG_NAMES.length} 张`);


