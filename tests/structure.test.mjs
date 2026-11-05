import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { measurePage } from '../tools/structure.mjs';

/**
 * "主角"统计不能只认 vk-text / p / li：像 "14 字节" 这种只用 span 装大数字的帧，
 * 以前整帧被判成没有主角。文字行盒要纳入统计，但单位、角标这类小字不能跟着算。
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-structure-'));
const shell = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0}
.vk-page{width:1920px;height:1080px;position:relative;overflow:hidden}
.vk-page-bd{position:absolute;inset:0}
.f-stat{position:absolute;left:120px;top:120px;display:flex;align-items:baseline;gap:16px}
.f-stat-value{font:700 320px/1 sans-serif;letter-spacing:-.03em}
.f-stat-unit{font-size:36px;line-height:1.33;color:#555}
.f-note{position:absolute;left:120px;top:700px;font-size:36px;line-height:1.33;color:#555}
</style></head><body>
<div class="vk-page"><div class="vk-page-bd">${body}</div></div>
</body></html>`;
const statFile = path.join(dir, 'stat.html');
const noteFile = path.join(dir, 'note.html');
fs.writeFileSync(
  statFile,
  shell(
    '<div class="f-stat"><span class="f-stat-value">52,980</span><span class="f-stat-unit">字节</span></div>' +
      '<span class="f-note">小标注：这一行不该抢主角</span>'
  )
);
// 只有小标注的对照页：证明 36px 装饰字不会被行盒统计抬成主角。
fs.writeFileSync(noteFile, shell('<span class="f-stat-unit">字节</span><span class="f-note">小标注：这一行不该抢主角</span>'));

const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());

after(async () => {
  await closeBrowser(browser);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('主角统计纳入 span 文字行盒：大数字当家时面积 ≥10%，小标注被字号阈值挡住', async () => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const big = await measurePage(page, statFile);
  const onlySmall = await measurePage(page, noteFile);
  await page.close();
  assert.equal(big.error, undefined, big.error);
  assert.ok(big.hero >= 0.1, `大数字应成为主角（实际 ${(big.hero * 100).toFixed(1)}%）`);
  assert.equal(onlySmall.hero, 0, `只有 36px 小标注时不该凭空出现主角（实际 ${onlySmall.hero}）`);
});
