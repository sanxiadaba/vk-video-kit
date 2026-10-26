/**
 * 目录缩略图：取 specimen 的完整内容包围盒，补呼吸，再裁成 16:9。
 * 组件索引用它做媒体位——不展示被切断的标签文字。
 *
 *   node tools/thumbs.mjs          # 只补缺的
 *   node tools/thumbs.mjs --force  # 全部重做
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { SITE } from './lib/paths.mjs';

const force = process.argv.includes('--force');
const dir = `${SITE}/shots/thumbs`;
fs.mkdirSync(dir, { recursive: true });
const files = fs.readdirSync(`${SITE}/specimens`).filter((f) => f.endsWith('.html')).sort();
const pending = force
  ? files
  : files.filter((file) => {
      const tag = path.basename(file, '.html');
      const out = path.join(dir, `${tag}.png`);
      const specPath = path.join(`${SITE}/specimens`, file);
      return !fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(specPath).mtimeMs;
    });
if (!pending.length) {
  console.log('thumbs: 0 stale, skip browser');
  process.exit(0);
}
const { base, close } = await startServer({ port: 0, root: SITE, transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
let made = 0;
let skipped = 0;

for (const file of files) {
  const tag = path.basename(file, '.html');
  const out = path.join(dir, `${tag}.png`);
  const specPath = path.join(`${SITE}/specimens`, file);
  const fresh = fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(specPath).mtimeMs;
  if (!force && fresh) {
    skipped++;
    continue;
  }
  await page.goto(`${base}/specimens/${file}`, { waitUntil: 'load' });
  await page.evaluate(() => window.vk?.ready?.());
  await page.evaluate(() => window.vk?.freeze?.());
  await page.waitForTimeout(80);

  const box = await page.evaluate((tagName) => {
    const root = tagName === 'vk-page' ? document.querySelector('vk-page') : document.querySelector('.vk-stage');
    if (!root) return null;
    const nodes = tagName === 'vk-page' ? [root] : [...root.children].filter((n) => n.getBoundingClientRect().width > 0);
    if (!nodes.length) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const node of nodes) {
      const r = node.getBoundingClientRect();
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    return { left, top, right, bottom, vw: innerWidth, vh: innerHeight };
  }, tag);
  if (!box) {
    skipped++;
    continue;
  }

  // 内容四周留白，再补成 16:9；小元件不顶满卡片，大元件不切边。
  const pad = 80;
  let w = box.right - box.left + pad * 2;
  let h = box.bottom - box.top + pad * 2;
  if (w / h < 16 / 9) w = (h * 16) / 9;
  else h = (w * 9) / 16;
  w = Math.min(w, box.vw);
  h = Math.min(h, box.vh);

  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const x = Math.max(0, Math.min(box.vw - w, cx - w / 2));
  const y = Math.max(0, Math.min(box.vh - h, cy - h / 2));
  const clip = { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
  await page.screenshot({ path: out, clip });
  made++;
  console.log(`✓ ${tag}  ${clip.width}×${clip.height}`);
}

await browser.close();
await close();
console.log(`thumbs: ${made} made, ${skipped} skipped`);
