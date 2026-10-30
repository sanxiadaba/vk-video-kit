import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * L6 求值器 —— 三条必须成立的性质：
 *   1. poster 逐像素等于不带动画的静态页；
 *   2. seek 是纯函数：结果只取决于 t，与到达路径无关；
 *   3. 求值只动 transform / opacity / clip-path，不改布局。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

const page = (dur, attrs = '') => `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body><vk-page dur="${dur}" beat="0.6" poster="${dur}">
  <vk-stack gap="md">
    <vk-title size="title" eyebrow="第 1 站" sub="副题" at="0" enter="rise" dur="0.3">一句主张</vk-title>
    <vk-cells id="c" cols="3" at="0.6" enter="rise" stagger="0.1">
      <li value="48" label="H"></li><li value="65" label="e"></li><li value="00" filled></li>
    </vk-cells>
  </vk-stack>
</vk-page><script src="dist/vk.js"></script></body></html>`;

const open = async (html) => {
  const tab = await ctx.newPage();
  await tab.setContent(html, { waitUntil: 'load' });
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return tab;
};

const seek = async (tab, t) => {
  await tab.evaluate(async (x) => {
    window.vk.seek(x);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, t);
};

test('poster 逐像素等于静态页', async () => {
  // 同一个页面：不 seek 的那种渲染 = 静态页；seek 到 dur = poster。两者必须一样。
  const tab = await open(page(2.4));
  const still = await tab.screenshot();
  await seek(tab, 2.4);
  const poster = await tab.screenshot();
  await tab.close();
  assert.equal(Buffer.compare(still, poster), 0, 'poster 与静态页必须逐像素一致');
});

test('seek 是纯函数：先到 2 再到 0.8，和直接到 0.8 一样', async () => {
  const direct = await open(page(2.4));
  await seek(direct, 0.8);
  const a = await direct.screenshot();
  await direct.close();

  const via = await open(page(2.4));
  await seek(via, 2.4);
  await seek(via, 0);
  await seek(via, 0.8);
  const b = await via.screenshot();
  await via.close();
  assert.equal(Buffer.compare(a, b), 0, '同一 t 必须得到同一张图，与到达路径无关');
});

test('时间表能导出，且 cue 数量与声明一致', async () => {
  const tab = await open(page(2.4));
  const scene = await tab.evaluate(() => window.vk.scene());
  await tab.close();
  assert.equal(scene.dur, 2.4);
  assert.equal(scene.beat, 0.6);
  // 标题 1 条 + 三格 stagger 3 条
  assert.equal(scene.cues.length, 4, JSON.stringify(scene.cues.map((c) => c.target)));
  assert.ok(scene.cues.every((c) => typeof c.t0 === 'number' && c.dur > 0 && c.ease && c.kind));
});

test('求值只动合成属性，不动布局', async () => {
  const tab = await open(page(2.4));
  await seek(tab, 1.0);
  const styles = await tab.evaluate(() =>
    [...document.querySelectorAll('.vk-cell')].map((el) => {
      const s = el.getAttribute('style') || '';
      return s;
    })
  );
  await tab.close();
  for (const s of styles) {
    assert.ok(!/width|height|top|left|margin|padding|font-size/.test(s), `布局属性被动画改了：${s}`);
  }
});

test('rise 的位移跟着体量走', async () => {
  // 同一个 24px 上移，对 48px 的正文是半个字高，对 320px 的数字只有 7%——
  // 大字几乎等于原地淡入。位移必须随元素高度放大，但封顶 48px。
  const tab = await ctx.newPage();
  await tab.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body><vk-page dur="2">
  <vk-stack gap="md">
    <vk-text id="small" size="body" at="0" enter="rise" dur="1">一行正文</vk-text>
    <vk-stat id="big" value="9" size="display-2xl" at="0" enter="rise" dur="1"></vk-stat>
    <vk-stack id="tall" at="0" enter="rise" dur="1" style="height:600px"></vk-stack>
  </vk-stack>
</vk-page><script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await seek(tab, 0.5);
  const ty = await tab.evaluate(() =>
    ['small', 'big', 'tall'].map((id) => {
      const el = document.querySelector('#' + id);
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return Math.abs(m.f);
    })
  );
  await tab.close();
  const [small, big, tall] = ty;
  assert.ok(big > small * 1.5, `大的应该动得更多：${small.toFixed(1)} vs ${big.toFixed(1)}`);
  assert.ok(tall > 0 && tall <= 48 * 0.875 + 0.5, `位移要封顶 48px：${tall.toFixed(1)}`);
});

after(async () => {
  await browser.close();
  await close();
});
