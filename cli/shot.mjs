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
const strict = flag('--strict');
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
const keep = flag('--keep');
const scaleRaw = Number(valueOf('--scale') || 1);
const scale = Number.isFinite(scaleRaw) && scaleRaw >= 1 && scaleRaw <= 4 ? scaleRaw : 1;
const width = phone ? 640 : 1920;
const height = phone ? 360 : 1080;

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
try {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const tab = await ctx.newPage();
  const runtimeErrors = [];
  tab.on('console', (m) => {
    if (m.type() === 'error') runtimeErrors.push(`console: ${m.text()}`);
  });
  tab.on('pageerror', (e) => runtimeErrors.push(`pageerror: ${e.message}`));
  const url = pathToFileURL(abs).href;
  await tab.goto(url, { waitUntil: 'load' });
  // vk.ready() 等字体、图片、布局、连线；没有它就退化成等一帧。
  const ready = await tab.evaluate(async () => {
    if (window.vk?.ready) await window.vk.ready();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return document.documentElement.getAttribute('data-vk-ready');
  });

  const out = valueOf('--out')
    ? path.resolve(valueOf('--out'))
    : path.join(path.dirname(abs), `${path.basename(abs, path.extname(abs))}${phone ? '.phone' : crop ? '.crop' : ''}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });

  /**
   * 渲染自检：与 `vk check` 共用 VK.auditPage()。
   * 覆盖层（edge/pin/ring/spotlight）不算重叠，避免每页都误报。
   */
  const report = await tab.evaluate(() => window.vk?.auditPage?.() || { issues: [], special: ['缺少 vk.auditPage'] });
  const metrics = await tab.evaluate(() => window.vk?.metrics?.()?.[0] || null);

  await tab.screenshot({
    path: out,
    clip: crop || { x: 0, y: 0, width, height },
  });

  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(
    `✓ ${path.relative(process.cwd(), out)}  ${width * scale}×${height * scale}${crop ? '（crop）' : ''}  ${kb} KB`
  );
  if (metrics && !crop) {
    const { contentTop, contentBottom, contentLeft, contentRight, focus, safeH } = metrics;
    console.log(`  度量：内容 y ${contentTop}–${contentBottom}（底距 ${(safeH ?? 888) - (contentBottom ?? 0)}）· x ${contentLeft}–${contentRight} · 焦点 ${focus}`);
  }

  const lines = [];
  const warns = new Set(['orphan', 'blue', 'pin-overlap']);
  let errors = 0;
  for (const it of report.issues || []) {
    if (it.type === 'no-payload') lines.push(`缺预编译数据：${it.what}`);
    else if (it.type === 'font') lines.push(`字号 ${it.fs} < 40：${it.what}`);
    else if (it.type === 'font-content') lines.push(`正文落在 ${it.fs}（应 ≥52）：${it.what}`);
    else if (it.type === 'contrast') lines.push(`对比度 ${it.cr} < ${it.need}：${it.what}`);
    else if (it.type === 'safe') lines.push(`超出安全区：${it.what}`);
    else if (it.type === 'overflow') lines.push(`超出画布：${it.what}`);
    else if (it.type === 'clip') lines.push(`横向被裁：${it.what}（${it.sw} > ${it.cw}）`);
    else if (it.type === 'clip-y') lines.push(`纵向被裁：${it.what}（${it.sh} > ${it.ch}）`);
    else if (it.type === 'content-clip') lines.push(`内容被裁：${it.what}（内容 ${it.sh} > 盒子 ${it.ch}）`);
    else if (it.type === 'overlap') lines.push(`重叠 ${it.size?.join('×') || ''}：${it.what}`);
    else if (it.type === 'zero') lines.push(`空锚点：${it.what}`);
    else if (it.type === 'ln-overlap') lines.push(`行号压住代码：${it.what}（+${it.gap}px）`);
    else if (it.type === 'bleed-text') lines.push(`出血层里不能放正文：${it.what}`);
    else if (it.type === 'collision') lines.push(`文本超出单元格：${it.what}（${it.sw} > ${it.cw}）`);
    else if (it.type === 'orphan') lines.push(`提醒·孤行 ${it.chars} 字：${it.what}`);
    else if (it.type === 'blue') lines.push(`提醒·${it.count} 处焦点蓝：${it.what}`);
    else if (it.type === 'pin-overlap') lines.push(`提醒·${it.what}`);
    else lines.push(`${it.type}：${it.what || ''}`);
    if (!warns.has(it.type)) errors++;
  }
  for (const s of report.special || []) lines.push(s);
  if (ready === 'timeout') lines.push('渲染未就绪：vk.ready() 超时');
  for (const e of runtimeErrors.slice(0, 6)) lines.push(e);
  if (ready === 'timeout' || runtimeErrors.length) errors++;

  if (lines.length) {
    console.log(errors || report.special?.length ? '自检（有 error）：' : '自检（只有提醒）：');
    for (const line of lines.slice(0, 16)) console.log(`  · ${line}`);
    const bad = !!(errors || report.special?.length);
    if (bad && !phone && !crop) process.exitCode = 1;
    if (bad && (strict || !keep)) {
      fs.rmSync(out, { force: true });
      console.log('[vk] 自检有 error，已删除截图；加 --keep 可以保留坏图排查');
      process.exitCode = 1;
    }
  } else {
    console.log('自检：干净（无重叠 / 无裁切 / 无溢出 / 无空锚点）');
  }
} finally {
  await browser.close();
}

