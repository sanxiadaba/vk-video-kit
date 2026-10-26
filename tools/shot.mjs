/**
 * 画面截图 —— 给人看的，不是基线。
 *
 *   node tools/shot.mjs                  # _site/specimens/*.html → _site/shots/
 *   node tools/shot.mjs _site/frames     # 8 个成品帧
 *   node tools/shot.mjs --force          # 忽略时间戳，全部重拍
 *
 * 只有 1920×1080 一个画布；手机横屏由播放端缩放。截图读 _site/ 里构建好的
 * 页面，和门禁看到的是同一份产物。
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { SITE } from './lib/paths.mjs';

const force = process.argv.includes('--force');
const arg = process.argv.slice(2).find((a) => !a.startsWith('-')) || `${SITE}/specimens`;
const outRoot = `${SITE}/shots`;

const files = (() => {
  if (arg.endsWith('.html')) return [arg.replace(/\\/g, '/')];
  return fs
    .readdirSync(arg)
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => path.posix.join(arg, f));
})();

const deps = [`${SITE}/dist/vk.js`, `${SITE}/vk/vk.css`].map((f) => {
  try {
    return fs.statSync(f).mtimeMs;
  } catch {
    return 0;
  }
});
const dir = path.resolve(outRoot);
fs.mkdirSync(dir, { recursive: true });

const pending = files.filter((file) => {
  if (force) return true;
  const out = path.join(dir, `${path.basename(file, '.html')}.png`);
  if (!fs.existsSync(out)) return true;
  const stamp = Math.max(fs.statSync(file).mtimeMs, ...deps);
  return fs.statSync(out).mtimeMs < stamp;
});

if (!pending.length) {
  console.log('shot: 0 stale, skip browser');
  process.exit(0);
}

const { base, close } = await startServer({ port: 0, root: SITE, transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

for (const file of pending) {
  const name = path.basename(file, '.html');
  const urlPath = file.replace(new RegExp(`^${SITE}/`), '');
  const resp = await page.goto(`${base}/${urlPath}`, { waitUntil: 'load' });
  if (!resp || !resp.ok()) {
    console.error(`✗ ${name}: HTTP ${resp?.status()}`);
    process.exitCode = 1;
    continue;
  }
  await page.evaluate(() => window.vk?.ready?.());
  const ok = await page.evaluate(() => !!window.vk);
  if (!ok) {
    console.error(`✗ ${name}: 运行时未就绪`);
    process.exitCode = 1;
    continue;
  }
  await page.evaluate(() => window.vk?.freeze?.());
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
  console.log(`✓ ${name}  1920`);
}

await browser.close();
await close();
console.log(`shot: ${pending.length} made, ${files.length - pending.length} skipped`);
