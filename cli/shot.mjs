#!/usr/bin/env node
/**
 * vk shot —— 把一帧 HTML 截成图，给作者（或 AI）看。
 *
 *   node cli/shot.mjs page.html                  → page.png（1920×1080）
 *   node cli/shot.mjs page.html --phone          → page.phone.png（640×360，近似手机横屏）
 *   node cli/shot.mjs page.html --crop 900,300,600,300  → page.crop.png（1:1 局部）
 *   node cli/shot.mjs page.html --out shots/a.png
 *
 * 只读 file://：先 `npx vk build page.html`，产物是自包含的。
 * playwright 是开发依赖；没装就明确报错，不静默失败。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const page = args.find((a) => !a.startsWith('-') && !/^\d+,\d+,\d+,\d+$/.test(a));
const flag = (name) => args.includes(name);
const valueOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

if (!page) {
  console.error('用法：node cli/shot.mjs <page.html> [--phone] [--crop x,y,w,h] [--out file.png]');
  process.exit(1);
}

const abs = path.resolve(page);
if (!fs.existsSync(abs)) {
  console.error(`[vk] 找不到 ${page}`);
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('\n[vk] 缺少 playwright（截图需要它）。在仓库里 npm i -D playwright。\n');
    process.exit(1);
  }
}

const cropRaw = valueOf('--crop');
const crop = cropRaw
  ? (() => {
      const [x, y, w, h] = cropRaw.split(',').map(Number);
      return [x, y, w, h].every(Number.isFinite) ? { x, y, width: w, height: h } : null;
    })()
  : null;
if (cropRaw && !crop) {
  console.error('[vk] --crop 要写 x,y,w,h 四个数字');
  process.exit(1);
}

const phone = flag('--phone');
const width = phone ? 640 : 1920;
const height = phone ? 360 : 1080;

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
try {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  const url = pathToFileURL(abs).href;
  await tab.goto(url, { waitUntil: 'load' });
  // vk.ready() 等字体、图片、布局、连线；没有它就退化成等一帧。
  await tab.evaluate(async () => {
    if (window.vk?.ready) await window.vk.ready();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  const out = valueOf('--out')
    ? path.resolve(valueOf('--out'))
    : path.join(path.dirname(abs), `${path.basename(abs, path.extname(abs))}${phone ? '.phone' : crop ? '.crop' : ''}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });

  await tab.screenshot({
    path: out,
    clip: crop || { x: 0, y: 0, width, height },
  });

  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`✓ ${path.relative(process.cwd(), out)}  ${width}×${height}${crop ? '（crop）' : ''}  ${kb} KB`);
} finally {
  await browser.close();
}
