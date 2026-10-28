/**
 * 索引缩略图：裁组件本体（场景根 + 留白），卡片端 contain 完整显示。
 * 增量：哈希 = 场景内容 + vk.css 版本。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SITE = '_site';
const OUT = path.join(SITE, 'thumbs');
const CACHE = '.vk-cache/thumbs.json';
const PAD = 24;
const WORKERS = 6;

const { TAG_NAMES } = await import('../src/registry.mjs');
const { SCENES } = await import('../src/scenes/scenes.mjs');
const SCENE_OF = new Map(SCENES.map((s) => [s.tag, s.body.trim()]));

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('playwright-core'));
}

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const cssVersion = (() => {
  try {
    const st = fs.statSync('vk/vk.css');
    return `${st.size}:${Math.round(st.mtimeMs)}`;
  } catch {
    return 'none';
  }
})();

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('.vk-cache', { recursive: true });

const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const next = {};
const jobs = [];
for (const tag of TAG_NAMES) {
  const file = path.join(SITE, 'specimen', `${tag}.html`);
  if (!fs.existsSync(file)) continue;
  // 缩略图是整个标本页，所以缓存键必须是页面本身：页头/页脚变了也要跟着重截。
  const hash = sha1(fs.readFileSync(file, 'utf8') + cssVersion + 'page');
  next[tag] = hash;
  const out = path.join(OUT, `${tag}.png`);
  if (cache[tag] === hash && fs.existsSync(out)) continue;
  jobs.push({ tag, file, out });
}

if (!jobs.length) {
  fs.writeFileSync(CACHE, JSON.stringify(next));
  console.log('thumbs: 全部命中缓存');
  process.exit(0);
}

const t0 = Date.now();
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const chunks = Array.from({ length: WORKERS }, (_, i) => jobs.filter((_, j) => j % WORKERS === i));

async function worker(list) {
  if (!list.length) return;
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  for (const job of list) {
    await page.goto(pathToFileURL(path.resolve(job.file)).href, { waitUntil: 'load' });
    await page.evaluate(async () => {
      if (window.vk?.ready) await window.vk.ready();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    // 整页，不裁：索引里看到的就是点进去那一页。
    await page.screenshot({ path: job.out, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  }
  await ctx.close();
}

await Promise.all(chunks.map(worker));
await browser.close();
fs.writeFileSync(CACHE, JSON.stringify(next));
console.log(`thumbs: ${jobs.length} 张（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
