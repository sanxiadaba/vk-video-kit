/**
 * vk box-tree —— 打印一帧的盒子树，排查"为什么它摆成这样"。
 *
 *   node tools/box-tree.mjs slice/frames/07.html
 *   node tools/box-tree.mjs some/page.html
 *
 * 输出：标签、x..right、y、高宽、flex、min-height，越出安全区的行标 ⚠ x/y 偏移量。
 */
import path from 'node:path';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

const ROOT = process.cwd();
const file = (process.argv.slice(2).find((a) => !a.startsWith('--')) || 'slice/frames/07.html').replace(/\\/g, '/');

const { base, close } = await startServer({ port: 0, root: ROOT, transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const resp = await page.goto(`${base}/${file}`, { waitUntil: 'load' });
if (!resp || !resp.ok()) {
  console.error(`✗ ${file}: HTTP ${resp?.status()}`);
  await browser.close();
  await close();
  process.exit(1);
}
await page.evaluate(() => window.vk?.ready?.());
await page.evaluate(() => window.vk?.freeze?.());

const tree = await page.evaluate(() => {
  const bd = document.querySelector('.vk-page-bd');
  if (!bd) return { error: 'no .vk-page-bd' };
  const bdBox = bd.getBoundingClientRect();
  const rows = [];
  const walk = (el, depth) => {
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    rows.push({
      depth,
      tag: el.tagName.toLowerCase(),
      cls: el.className && typeof el.className === 'string' ? el.className.slice(0, 24) : '',
      x: Math.round(b.left),
      r: Math.round(b.right),
      y: Math.round(b.top),
      h: Math.round(b.height),
      w: Math.round(b.width),
      flex: cs.flex,
      minH: cs.minHeight,
      overX: Math.round(b.right - bdBox.right),
      overY: Math.round(b.bottom - bdBox.bottom),
    });
    for (const c of el.children) {
      const t = c.tagName.toLowerCase();
      if (t === 'svg' || t === 'script') continue;
      walk(c, depth + 1);
    }
  };
  walk(bd, 0);
  return { height: Math.round(bdBox.height), right: Math.round(bdBox.right), rows };
});

if (tree.error) {
  console.error(`✗ ${tree.error}`);
} else {
  console.log(`bd ${tree.height}px 高 · 右缘 ${tree.right}`);
  for (const r of tree.rows) {
    const flag = r.overX > 0 || r.overY > 0 ? `  ⚠ x+${r.overX} y+${r.overY}` : '';
    console.log(
      `${'  '.repeat(r.depth)}${r.tag}${r.cls ? '.' + r.cls : ''}  x=${r.x}..${r.r} y=${r.y} h=${r.h} w=${r.w} flex=${r.flex} minH=${r.minH}${flag}`
    );
  }
}

await browser.close();
await close();
