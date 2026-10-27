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

  /**
   * 渲染自检：截图之外，把"画面上看不出来但确实是坏了"的事说清楚。
   * 只看三件作者最容易踩的：重叠、被裁、溢出；外加 0 尺寸锚点。
   */
  const report = await tab.evaluate(() => {
    const out = { overlap: [], clipped: [], overflow: [], zero: [] };
    const root = document.querySelector('.vk-page-bd') || document.body;
    const rect = (el) => el.getBoundingClientRect();
    const name = (el) => {
      const id = el.id ? `#${el.id}` : '';
      return `<${el.tagName.toLowerCase()}${id}>`;
    };
    // 1. 顶层块之间的重叠（同一容器里两个组件压在一起）
    const kids = [...root.children].filter((el) => el.getClientRects().length);
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = rect(kids[i]);
        const b = rect(kids[j]);
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 2 && h > 2) out.overlap.push(`${name(kids[i])} × ${name(kids[j])} 重叠 ${w.toFixed(0)}×${h.toFixed(0)}`);
      }
    }
    // 2. 被裁：内容比盒子大、又设了 overflow
    for (const el of document.querySelectorAll('[class^="vk-"], [class*=" vk-"]')) {
      const cs = getComputedStyle(el);
      if (cs.overflow === 'visible') continue;
      if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
        out.clipped.push(`${name(el)}.${el.className.split(' ')[0]} 内容 ${el.scrollWidth}×${el.scrollHeight} > 盒 ${el.clientWidth}×${el.clientHeight}`);
      }
    }
    // 3. 组件级溢出（运行时自己扫的那套）
    if (window.vk?.auditOverflow) {
      for (const o of window.vk.auditOverflow(root)) out.overflow.push(`${o.tag}${o.cls ? '.' + o.cls : ''} ${o.sw}×${o.sh} > ${o.cw}×${o.ch}`);
    }
    // 4. 0 尺寸锚点：有 id、但量出来是空的（连线/批注会指向空气）
    for (const el of document.querySelectorAll('[id]')) {
      const r = rect(el);
      if (r.width < 1 || r.height < 1) out.zero.push(`#${el.id} 尺寸 ${r.width.toFixed(0)}×${r.height.toFixed(0)}`);
    }
    return out;
  });

  await tab.screenshot({
    path: out,
    clip: crop || { x: 0, y: 0, width, height },
  });

  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`✓ ${path.relative(process.cwd(), out)}  ${width}×${height}${crop ? '（crop）' : ''}  ${kb} KB`);

  const groups = [
    ['重叠', report.overlap],
    ['被裁', report.clipped.slice(0, 12)],
    ['溢出', report.overflow.slice(0, 12)],
    ['0 尺寸锚点', report.zero.slice(0, 12)],
  ];
  const total = groups.reduce((n, [, list]) => n + list.length, 0);
  if (total) {
    console.log('自检：');
    for (const [label, list] of groups) {
      if (!list.length) continue;
      console.log(`  ${label} ${list.length}`);
      for (const line of list) console.log(`    · ${line}`);
    }
    if (flag('--check')) process.exitCode = 1;
  } else {
    console.log('自检：干净（无重叠 / 无裁切 / 无溢出 / 无空锚点）');
  }
} finally {
  await browser.close();
}
