#!/usr/bin/env node
/**
 * 交付尺度实测 —— 把 1920×1080 缩到 0.38 倍，量"手机上还看不看得清"。
 *
 * 为什么需要它：库里所有阈值（字号 36、线宽 2px、对比度 7:1）都是**设计像素**。
 * 真实观看是手机横屏、1080p 放进 6 寸屏，缩放约 0.38。2px 的线缩完只剩 0.76 个设备像素，
 * 会被抗锯齿抹成半灰；36px 的字缩完是 13.7px。这些在 1:1 的截图里永远看不出来。
 *
 * 做法：截图 → 在浏览器里用 canvas 缩到 0.38（浏览器的高质量降采样）→
 * 统计"墨"像素相对页面底色的对比度，报 P5（最淡的那 5% 墨）与中位数。
 *
 * 阈值是量出来的，不是拍的：先跑一遍现状，把 P5 的最低值当地板。
 *
 *   node tools/legibility.mjs frames/*.html
 *   node tools/legibility.mjs --json <files…>
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const SCALE = Number(process.env.VK_DELIVERY_SCALE || 0.38);
/** 校准出来的地板：0.38 倍下，最淡的 5% 墨仍要与底色差 ≥ 1.9:1。 */
const MIN_P5 = Number(process.env.VK_LEGIBILITY_P5 || 1.9);

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const asJson = process.argv.includes('--json');
if (!files.length) {
  console.error('用法：node tools/legibility.mjs <文件…>');
  process.exit(2);
}

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const probe = await browser.newPage();

const lum = (r, g, b) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const rows = [];
for (const file of files) {
  await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load' });
  await page.evaluate(() => window.vk?.ready?.());
  const shot = await page.screenshot({ type: 'png' });
  const data = shot.toString('base64');

  const r = await probe.evaluate(
    async ({ data, scale }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + data;
      await img.decode();
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const L = [];
      for (let i = 0; i < px.length; i += 4) {
        L.push(0.2126 * f(px[i]) + 0.7152 * f(px[i + 1]) + 0.0722 * f(px[i + 2]));
      }
      const sorted = [...L].sort((a, b) => a - b);
      const bg = sorted[Math.floor(sorted.length * 0.6)]; // 页面底色 = 偏亮那半的中位
      const ink = L.filter((v) => v < bg * 0.55).sort((a, b) => a - b);
      if (!ink.length) return { p5: 0, med: 0, ink: 0, px: L.length };
      const cr = (v) => (Math.max(v, bg) + 0.05) / (Math.min(v, bg) + 0.05);
      const p5 = cr(ink[Math.floor(ink.length * 0.95)]); // 最淡的 5% 墨
      const med = cr(ink[Math.floor(ink.length * 0.5)]);
      return { p5: +p5.toFixed(2), med: +med.toFixed(2), ink: ink.length, px: L.length };
    },
    { data, scale: SCALE }
  );
  rows.push({ file: path.basename(file), ...r });
}

await browser.close();

const problems = rows
  .filter((r) => r.p5 < MIN_P5)
  .map((r) => `${r.file}: 0.38 倍下最淡的墨只有 ${r.p5}:1（地板 ${MIN_P5}:1）`);

if (asJson) console.log(JSON.stringify({ rows, problems, scale: SCALE, minP5: MIN_P5 }, null, 2));
else {
  for (const r of rows) {
    console.log(
      `${r.p5 >= MIN_P5 ? '✓' : '✗'} ${r.file.padEnd(14)} P5 ${String(r.p5).padStart(5)}:1   中位 ${String(r.med).padStart(5)}:1   墨 ${((r.ink / r.px) * 100).toFixed(1)}%`
    );
  }
  for (const p of problems) console.log('  · ' + p);
}
process.exitCode = problems.length ? 1 : 0;
