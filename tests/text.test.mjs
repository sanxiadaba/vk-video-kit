import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * M7 文本机制：行宽与断行。
 *
 *   1. measure 写的是「一行几个字」，运行期折成 Nem——所以换字号不用改行宽；
 *   2. measure="none" 真的放开；
 *   3. wrap 能改断行策略（标题的规则要落到 .vk-title-main 才生效）。
 */

const { base, close: closeServer } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const opened = [];

/** 每一页都记下来，最后统一关；只关 page 会留下 context，浏览器就退不出去。 */
async function open(body) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tab = await ctx.newPage();
  opened.push(ctx);
  await tab.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body><vk-page><vk-stack gap="md">${body}</vk-stack></vk-page><script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return tab;
}

const maxW = (tab, sel) => tab.evaluate((s) => getComputedStyle(document.querySelector(s)).maxWidth, sel);

test('measure 按字数算行宽，不随字号变', async () => {
  const a = await open('<vk-text id="a" size="body" measure="20">一行二十个字</vk-text>');
  const w1 = await maxW(a, '#a');

  const b = await open('<vk-text id="a" size="title" measure="20">一行二十个字</vk-text>');
  const w2 = await maxW(b, '#a');

  assert.equal(w1, '960px', `48px × 20 = 960px，实际 ${w1}`);
  assert.equal(w2, '2880px', `144px × 20 = 2880px，实际 ${w2}`);
});

test('measure="none" 放开行宽', async () => {
  const tab = await open('<vk-text id="a" size="body" measure="none">铺满</vk-text>');
  assert.equal(await maxW(tab, '#a'), 'none');
});

test('wrap 改断行策略（标题落在 .vk-title-main 上）', async () => {
  const tab = await open('<vk-title id="t" size="title" wrap="nowrap">一个很长的标题</vk-title>');
  const v = await tab.evaluate(() => getComputedStyle(document.querySelector('.vk-title-main')).getPropertyValue('text-wrap'));
  assert.equal(v, 'nowrap');
});

after(async () => {
  for (const ctx of opened) await ctx.close().catch(() => {});
  await browser.close();
  await closeServer();
});

