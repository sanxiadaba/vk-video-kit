#!/usr/bin/env node
/**
 * vk series —— 一集的横尺子。
 *
 *   node cli/series.mjs --pages frames/*.html --shots shots/*.png
 *   node cli/series.mjs --pages ... --shots ... --json
 *
 * 为什么要有它：`vk check` 逐页看，看不见"12 帧连起来像不像一个视频"。
 * 那件事只能跨帧量：体量曲线、骨架重复、字阶分布、墨量与白占比、焦点面积。
 *
 * 两类输出，语气不同：
 *   ✗ 本层语义（可硬失败）：焦点不唯一 / 无焦点 / 焦点面积出界 / 字阶档数超限
 *   △ 编排判断（只报告）：主角过小 / 断层不足 / 连续同骨架 / 白过多 / 重心偏上
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const val = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const list = (name) => {
  const v = val(name);
  return v ? v.split(',').filter(Boolean) : [];
};
const pages = list('--pages');
const shots = list('--shots');
const PAGE_W = 1920;
const SAFE = { x: 120, y: 96, w: 1680, h: 888 };
const GOLDEN = 1080 / 1.618033988749895;

/* ------------------------------------------------------------------ 像素 */

const L = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function pixels(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width, height, data } = png;
  let ink = 0;
  let solid = 0;
  let white = 0;
  let sum = 0;
  let wy = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  // 2× 降采样网格，用来找最大连通块
  const dw = Math.ceil(width / 2);
  const dh = Math.ceil(height / 2);
  const grid = new Uint8Array(dw * dh);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = L(data[i], data[i + 1], data[i + 2]);
      const w = 255 - l;
      if (l >= 250) {
        white++;
        continue;
      }
      ink++;
      sum += w;
      wy += w * y;
      if (l < 170) solid++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (l < 170) {
        const gx = x >> 1;
        const gy = y >> 1;
        grid[gy * dw + gx] = 1;
      }
    }
  }
  const mass = biggestBlob(grid, dw, dh) * 4; // 每个降采格 = 4 像素
  return {
    ink: ink / (width * height),
    solid: solid / (width * height),
    white: white / (width * height),
    centroidY: sum ? wy / sum : 0,
    bbox: [minX, minY, maxX, maxY],
    mass: mass / (SAFE.w * SAFE.h),
  };
}

/** 8 连通域里最大的一块（降采样网格上数格子） */
function biggestBlob(grid, w, h) {
  const seen = new Uint8Array(w * h);
  let best = 0;
  const stack = [];
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i] || seen[i]) continue;
    let n = 0;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop();
      n++;
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (!grid[q] || seen[q]) continue;
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (n > best) best = n;
  }
  return best;
}

/* -------------------------------------------------------------------- DOM */

async function domFacts(browser, file) {
  const tab = await browser.newPage({ viewport: { width: PAGE_W, height: 1080 }, deviceScaleFactor: 1 });
  try {
    await tab.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load' });
    await tab.evaluate(async () => {
      await window.vk?.ready?.();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    return await tab.evaluate(() => {
      const stage = document.querySelector('.vk-page, .vk-stage') || document.body;
      const safe = stage.querySelector('.vk-page-bd') || stage;
      const sr = safe.getBoundingClientRect();
      const tiers = new Map();
      let focus = 0;
      let focusArea = 0;
      let blocks = 0;
      let dom = 0;
      let maxBottom = 0;
      let contentTop = null;
      for (const el of safe.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || r.width < 1 || r.height < 1) continue;
        if (el.closest('svg')) continue;
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (own) {
          const fs = Math.round(parseFloat(cs.fontSize));
          tiers.set(fs, (tiers.get(fs) || 0) + 1);
        }

        if (el.matches('vk-stack, vk-grid, vk-row, vk-canvas')) blocks++;
        // 主角体量按「帧级块的 bbox」算：一段 1680 宽的窗和一张满幅图都是块，
        // 区别在下面的实块面积（像素）。两个都小才是真的没有主角。
        if (el.matches('vk-stack > *, vk-grid > *') && r.width * r.height > dom) {
          dom = r.width * r.height;
        }
        if (r.bottom - sr.top > maxBottom) maxBottom = r.bottom - sr.top;
        if (contentTop === null && el.matches('vk-title, .vk-title')) contentTop = r.top - sr.top;
      }
      const sizes = [...tiers.entries()].sort((a, b) => b[0] - a[0]);
      const maxType = sizes.length ? sizes[0][0] : 0;
      const bodyType = sizes.find(([s]) => s <= 48)?.[0] || 48;
      // 焦点用运行期那一份归一实现（region 而不是 node）
      const regions = window.vk?.focusRegions?.(stage) || [];
      for (const el of regions) {
        // 焦点面积按「墨的包围盒」算，不按元素盒：
        // 文本焦点（tone=focus 的指标）与圈选（绝对定位铺满整页）按盒算会虚高到 30–139%。
        // 只给「会盖住东西的」焦点算面积：色字（tone=focus）不遮挡，描边（ring）只有 4px 线。
        if (el.matches('[tone="focus"], [data-tone="focus"], vk-ring')) continue;
        const shape = el.querySelector?.('.vk-ov-svg rect, .vk-ov-svg ellipse, .vk-ov-svg path');
        let r = null;
        if (shape) r = shape.getBoundingClientRect();
        else {
          // 数字焦点只量数字本体：标签在上、单位在右，整块包围盒会把面积撑到 35%。
          const numEl = el.querySelector?.('.vk-stat-v');
          const textEl = numEl || el;
          const text = (textEl.textContent || '').trim();
          if (text) {
            const range = document.createRange();
            range.selectNodeContents(textEl);
            const rects = [...range.getClientRects()].filter((x) => x.width > 1 && x.height > 1);
            if (rects.length) {
              const l = Math.min(...rects.map((x) => x.left));
              const t = Math.min(...rects.map((x) => x.top));
              const rr = Math.max(...rects.map((x) => x.right));
              const bb = Math.max(...rects.map((x) => x.bottom));
              r = { left: l, top: t, width: rr - l, height: bb - t };
            }
          }
        }
        if (!r) r = el.getBoundingClientRect();
        focusArea += r.width * r.height;
      }
      return {
        tiers: sizes.map(([s, n]) => `${s}×${n}`),
        tierCount: sizes.length,
        maxType,
        bodyType,
        focus: regions.length,
        focusArea: Math.round((focusArea / (sr.width * sr.height)) * 1000) / 10,
        blocks,
        items: safe.querySelectorAll('[data-vk-part]').length,
        dominant: Math.round((dom / (sr.width * sr.height)) * 1000) / 10,
        contentTop: contentTop === null ? null : Math.round(contentTop),
        contentBottom: Math.round(maxBottom),
        align: stage.getAttribute('align') || stage.dataset.align || 'top',
        bleed: !!stage.querySelector('.vk-page-bleed > *'),
      };
    });
  } finally {
    await tab.close();
  }
}

/* ------------------------------------------------------------------- run */

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('playwright-core'));
}
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());

const byName = new Map(
  shots.map((s) => [
    path.basename(s).replace(/^new/, '').replace(/\.png$/, ''),
    s,
  ])
);

const rows = [];
for (const page of pages) {
  const id = path.basename(page).replace(/\.html$/, '');
  const shot = byName.get(id);
  const dom = await domFacts(browser, page);
  const px = shot ? pixels(shot) : null;
  // 骨架签名：位置 + 块数 + 最大字号 + 对齐 + 内容项数。
  // 只前四项的话，「填满的终端」和「填满的文件树」会撞成同一张版。
  const skeleton = [Math.round((dom.contentTop ?? 0) / 24), Math.round(dom.contentBottom / 48), dom.blocks, dom.maxType, dom.align, dom.items].join('/');
  rows.push({ id, ...dom, px, skeleton });
}
await browser.close();

/* ----------------------------------------------------------------- 判定 */

const flags = [];
for (const r of rows) {
  if (r.focus === 0) flags.push({ id: r.id, level: 'warn', what: '没有焦点：这一帧没有"正在讲这里"' });
  if (r.focus > 1) flags.push({ id: r.id, level: 'fail', what: `${r.focus} 处焦点（应恰好 1 处 region）` });
  // 焦点面积：一条整行高亮本来就占 1680×70 ≈ 7.9%，所以上限是 10%（一页的十分之一），
  // 不是 4%。真正要拦的是 05 那种「指标框整块算焦点」的 30%+。
  if (r.focusArea > 10) flags.push({ id: r.id, level: 'fail', what: `焦点面积 ${r.focusArea}% > 10%（高亮比内容还重）` });
  if (r.tierCount > 4) flags.push({ id: r.id, level: 'warn', what: `${r.tierCount} 档字号（一帧 ≤4 档）` });
  // 断层：字号没跳开，且也没有一块大到能当主角的块。
  // 代码/表格这类帧，主角是「那一大块」而不是一个字，不该逼作者把标题放大。
  if (r.maxType / r.bodyType < 1.8 && r.dominant < 50)
    flags.push({ id: r.id, level: 'warn', what: `既没有字号断层（${(r.maxType / r.bodyType).toFixed(2)}×）也没有主角块（${r.dominant}%）` });
  if (r.px) {
    // 主角要两个都小才算没有：块占位 < 25% 且实块 < 3%。
    // 只数字号帧（一个 224 的数字实块也就 1–2%），也放过满幅窗（块占位大、墨很少）。
    if (r.dominant < 25 && r.px.mass < 0.03)
      flags.push({ id: r.id, level: 'warn', what: `没有主角：最大块 ${r.dominant}% 且实块 ${(r.px.mass * 100).toFixed(1)}%` });
    if (r.px.white > 0.92) flags.push({ id: r.id, level: 'warn', what: `白 ${(r.px.white * 100).toFixed(1)}%（近空页）` });
    // 重心只拦「头重脚轻」：带标题的帧，墨迹重心天然在上半页，黄金线对它们不适用。
    if (r.px.centroidY < 410) flags.push({ id: r.id, level: 'warn', what: `重心 y=${Math.round(r.px.centroidY)}，内容挤在上半页` });
  }
}
for (let i = 1; i < rows.length; i++) {
  if (rows[i].skeleton === rows[i - 1].skeleton) {
    flags.push({ id: `${rows[i - 1].id}→${rows[i].id}`, level: 'warn', what: '相邻两帧同一骨架' });
  }
}

if (json) {
  console.log(JSON.stringify({ rows, flags }, null, 2));
} else {
  const head = ['帧', '字阶', '最大/正文', '焦点', '焦点%', '块%', '实块%', '墨%', '白%', '重心', '骨架'];
  const body = rows.map((r) => [
    r.id,
    String(r.tierCount),
    `${r.maxType}/${r.bodyType}`,
    String(r.focus),
    r.focusArea.toFixed(1),
    String(r.dominant),
    r.px ? (r.px.mass * 100).toFixed(1) : '—',
    r.px ? (r.px.ink * 100).toFixed(1) : '—',
    r.px ? (r.px.white * 100).toFixed(1) : '—',
    r.px ? String(Math.round(r.px.centroidY)) : '—',
    r.skeleton,
  ]);
  const w = head.map((h, i) => Math.max(width(h), ...body.map((b) => width(b[i]))));
  const pad = (s, i) => s + ' '.repeat(w[i] - width(s));
  console.log(head.map(pad).join('  '));
  console.log(w.map((n) => '─'.repeat(n)).join('  '));
  for (const b of body) console.log(b.map(pad).join('  '));
  const bad = flags.filter((f) => f.level === 'fail').length;
  const warn = flags.filter((f) => f.level === 'warn').length;
  if (flags.length) {
    console.log('');
    for (const f of flags) console.log(`  ${f.level === 'fail' ? '✗' : '△'} ${f.id}  ${f.what}`);
  }
  console.log(`\n${rows.length} 帧 · ${bad} 条硬伤 · ${warn} 条提醒`);
  process.exitCode = bad ? 1 : 0;
}

function width(s) {
  let n = 0;
  for (const ch of String(s)) n += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 2 : 1;
  return n;
}













