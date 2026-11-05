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
const WORKERS = Number(process.env.VK_THUMB_WORKERS || 8);

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
// 页面、CSS、运行时、构建标识都是输入；只哈希 vk.css 会让运行时改动后的缩略图永远停在旧版。
const assetVersion = ['vk/vk.css', 'vk/fonts.css', 'dist/vk.js', 'dist/build.json']
  .map((f) => {
    try {
      const st = fs.statSync(f);
      return `${f}:${st.size}:${Math.round(st.mtimeMs)}`;
    } catch {
      return `${f}:none`;
    }
  })
  .join('|');

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('.vk-cache', { recursive: true });

const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const next = {};
const jobs = [];
for (const tag of TAG_NAMES) {
  const file = path.join(SITE, 'specimen', `${tag}.html`);
  if (!fs.existsSync(file)) continue;
  // 缩略图是组件本体，缓存键里带上 'body'：裁切方式变了也要跟着重截。
  const hash = sha1(fs.readFileSync(file, 'utf8') + assetVersion + 'body');
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
// launchServer + connect：关闭时能直接杀进程。browser.close() 在多个 context
// 下会逐个等 renderer 退出，实测这一项就要 10s 上下。
const server = await chromium.launchServer({ channel: 'msedge' }).catch(() => chromium.launchServer());
const browser = await chromium.connect(server.wsEndpoint());
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
    // 只截组件本体（.spec-body）＋一圈留白：整页缩到卡片里时，
    // 组件只有原来的 1/7，字全糊了，索引等于没缩略图。
    const box = await page.locator('.spec-body').first().boundingBox().catch(() => null);
    const clip = box
      ? {
          x: Math.max(0, box.x - PAD),
          y: Math.max(0, box.y - PAD),
          width: Math.min(1920 - Math.max(0, box.x - PAD), box.width + PAD * 2),
          height: Math.min(1080 - Math.max(0, box.y - PAD), box.height + PAD * 2),
        }
      : { x: 0, y: 0, width: 1920, height: 1080 };
    await page.screenshot({ path: job.out, clip });
  }
  await ctx.close();
}

await Promise.all(chunks.map(worker));
try {
  const session = await browser.newBrowserCDPSession();
  await session.send('Browser.close').catch(() => {});
} catch {
  /* 已经断开 */
}
const proc = server.process?.();
if (proc && proc.exitCode === null) {
  if (process.platform === 'win32') {
    const { spawn } = await import('node:child_process');
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore', detached: true }).unref();
  } else {
    proc.kill('SIGKILL');
  }
}
fs.writeFileSync(CACHE, JSON.stringify(next));
console.log(`thumbs: ${jobs.length} 张（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
