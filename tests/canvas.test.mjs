import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

test('vk-canvas 省略 w/h 时按子元素包围盒撑开', async () => {
  await page.goto(`${base}/index.html`, { waitUntil: 'load' });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body><vk-canvas><vk-box x="0" y="0" w="600" h="300"></vk-box></vk-canvas>
<script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  await page.evaluate(() => window.vk?.ready?.());
  await page.waitForTimeout(150);
  const dims = await page.$eval('vk-canvas', (el) => ({
    w: Math.round(el.getBoundingClientRect().width),
    h: Math.round(el.getBoundingClientRect().height),
  }));
  assert.ok(dims.w >= 600, `canvas 宽 ${dims.w}`);
  assert.ok(dims.h >= 300, `canvas 高 ${dims.h}`);
});

after(async () => {
  await browser.close();
  await close();
});
