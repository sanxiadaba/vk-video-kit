#!/usr/bin/env node
/**
 * vk shot —— 把一帧 HTML 截成图，给作者（或 AI）看。
 *
 *   node cli/shot.mjs page.html                  → page.png（1920×1080）
 *   node cli/shot.mjs page.html --phone          → page.phone.png（640×360，近似手机横屏）
 *   node cli/shot.mjs page.html --crop 900,300,600,300  → page.crop.png（1:1 局部）
 *   node cli/shot.mjs page.html --at 2.4                → 求值到 2.4s 再截
 *   node cli/shot.mjs page.html --scene out.json        → 只导时间表，不截图
 *   node cli/shot.mjs page.html --fps 30 --out-dir dir/ → 帧序列（本页整段）
 *   node cli/shot.mjs page.html --fps 30 --range 0-2.4 --out-dir dir/
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
  console.error('用法：node cli/shot.mjs <page.html> [--phone] [--crop x,y,w,h] [--out f.png] [--at 秒] [--scene f.json] [--fps 30 --range 0-4.6 --out-dir dir/]');
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

  // 时间表：不截图，只把「时刻 → 姿态」的绝对值导给下游（剪辑 / Remotion / ffmpeg）。
  const sceneOut = valueOf('--scene');
  if (sceneOut) {
    const scene = await tab.evaluate(() => window.vk?.scene?.() || null);
    const target = path.resolve(sceneOut);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!scene || !scene.cues.length) {
      console.error(`✗ ${path.relative(process.cwd(), target)}  这一页没有时间轴（vk-page 上没有 dur）`);
      process.exitCode = 1;
    } else {
      fs.writeFileSync(target, JSON.stringify(scene, null, 2) + '\n');
      console.log(`✓ ${path.relative(process.cwd(), target)}  ${scene.cues.length} 个 cue · ${scene.dur}s · beat ${scene.beat}s`);
    }
    await browser.close();
    process.exit(process.exitCode || 0);
  }

  // 帧序列：一次加载、循环 seek、写 PNG 序列。库只出帧，不管编码。
  const fpsRaw = valueOf('--fps');
  const outDir = valueOf('--out-dir');
  if (fpsRaw || outDir) {
    const fps = Math.min(120, Math.max(1, Math.round(Number(fpsRaw || 30)) || 30));
    const scene0 = await tab.evaluate(() => window.vk?.scene?.() || null);
    if (!scene0 || !scene0.dur) {
      console.error('✗ 这一页没有时间轴（vk-page 上没有 dur），出不了帧序列');
      await browser.close();
      process.exit(1);
    }
    const rangeRaw = valueOf('--range');
    let from = 0;
    let to = scene0.dur;
    if (rangeRaw) {
      const m = String(rangeRaw).match(/^([0-9.]+)\s*-\s*([0-9.]+)$/);
      if (!m) {
        console.error('[vk] --range 要写 起-止（秒），例如 --range 0-4.6');
        await browser.close();
        process.exit(1);
      }
      from = Number(m[1]);
      to = Number(m[2]);
    }
    const dir = path.resolve(outDir || path.join(path.dirname(abs), 'frames'));
    fs.mkdirSync(dir, { recursive: true });
    const n = Math.max(1, Math.round((to - from) * fps));
    for (let i = 0; i < n; i++) {
      const t = from + i / fps;
      await tab.evaluate(async (tt) => {
        window.vk?.seek?.(tt);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, t);
      await tab.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.png') });
    }
    console.log(`✓ ${path.relative(process.cwd(), dir)}/  ${n} 帧 · ${fps}fps · ${from}–${to}s`);
    await browser.close();
    process.exit(0);
  }

  // 时刻：先求值再截图。seek 是纯函数，同一 t 永远得到同一张。
  const atRaw = valueOf('--at');
  // 没写 --at 时取 poster：poster 默认等于 dur，所以老页面行为不变；
  // 写了 poster="2.0" 的页面，vk shot 出的就是封面那一刻，而不是静态终态。
  let at = atRaw === null ? null : Number(atRaw);
  if (at === null) {
    const sc = await tab.evaluate(() => window.vk?.scene?.() || null);
    if (sc && sc.dur) at = sc.poster ?? sc.dur;
  }
  if (at !== null) {
    await tab.evaluate(async (t) => {
      window.vk?.seek?.(t);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, Number.isFinite(at) ? at : 0);
  }
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
    else if (it.type === 'font') lines.push(`字号 ${it.fs} < 36：${it.what}`);
    else if (it.type === 'font-content') lines.push(`正文落在 ${it.fs}（应 ≥48）：${it.what}`);
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


