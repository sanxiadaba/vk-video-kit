import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * 780×439 回归：手机横屏的实际观看尺寸。
 *
 * 把 1920×1080 的标本页放进一个 1920 宽的 iframe，再把 iframe 整体
 * transform: scale(780/1920) 到 780×439 的视口里。iframe 内部的布局视口
 * 仍是 1920，所以 fit / resize 不会被外层缩放打断；scrollWidth / clientWidth
 * 也仍是设计 px，量到的是"容器放不放得下内容"，不是缩放的副作用。
 *
 * 只看第一屏的 .vk-page；状态带在第二屏，由状态带测试单独管。
 * 只报可见元素；KaTeX 的 MathML 是给读屏器的隐藏副本，不参与画面。
 */

const files = fs.existsSync('_site/specimen')
  ? fs.readdirSync('_site/specimen').filter((f) => f.endsWith('.html')).sort()
  : [];
assert.ok(files.length > 0, '没有标本页：先运行 npm run build');

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 780, height: 439 }, deviceScaleFactor: 1 });

const offenders = [];
for (const file of files) {
  const tag = file.replace(/\.html$/, '');
  await page.setContent(
    `<!doctype html><html><head><style>
      html,body{margin:0;width:780px;height:439px;overflow:hidden;background:#fff}
      iframe{display:block;width:1920px;height:1080px;border:0;transform:scale(0.40625);transform-origin:0 0}
    </style></head><body><iframe id="paper" src="${base}/specimen/${file}"></iframe></body></html>`,
    { waitUntil: 'load' }
  );
  const handle = await page.$('#paper');
  const frame = await handle.contentFrame();
  try {
    await frame.waitForFunction(() => !!window.vk, null, { timeout: 10000 });
  } catch {
    offenders.push({ tag, bad: [{ what: '运行时未就绪', sw: 0, cw: 0 }] });
    continue;
  }
  await frame.evaluate(() => window.vk?.ready?.());
  await frame.evaluate(() => document.fonts?.ready);
  await frame.waitForTimeout(80);
  const bad = await frame.evaluate(() => {
    const root = document.querySelector('.vk-page');
    if (!root) return [{ what: '没有 .vk-page', sw: 0, cw: 0 }];
    const out = [];
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.closest('svg')) continue;
      if (el.closest('.katex-mathml')) continue;
      if (el.hasAttribute('data-ellipsis')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (el.clientWidth < 4) continue;
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      out.push({
        what: `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(/\s+/)[0] : ''}`,
        sw: el.scrollWidth,
        cw: el.clientWidth,
      });
    }
    // 同一个宿主只留第一条：父级裁切往往只是子级溢出的连带。
    const seen = new Set();
    return out.filter((x) => {
      const k = `${x.what}:${x.sw}:${x.cw}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });
  if (bad.length) offenders.push({ tag, bad });
}

await browser.close();
await close();

for (const o of offenders) {
  console.log(`✗ ${o.tag}  ${o.bad.length} 处横向溢出`);
  for (const b of o.bad.slice(0, 6)) console.log(`    ${b.what}  ${b.sw} > ${b.cw}`);
}
console.log(
  `780 回归：${files.length} 页，${offenders.length} 页不合格${offenders.length ? `（${offenders.map((o) => o.tag).join(', ')}）` : ''}`
);

test('780×439 下没有元素横向溢出', () => {
  assert.deepEqual(
    offenders.map((o) => o.tag),
    [],
    `780 宽不合格页：\n${offenders
      .map((o) => `${o.tag}: ${o.bad.map((b) => `${b.what} ${b.sw}>${b.cw}`).join('; ')}`)
      .join('\n')}`
  );
});

after(async () => {
  try {
    await browser.close();
  } catch {
    /* 已关闭 */
  }
});

