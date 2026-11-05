import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { startServer } from '../cli/serve.mjs';

/* vk-stack 的权重分高：weights / ratio 把「剩余高度」按权重分给前 N 个直接子项。
   这里量的是真实布局：1:2:1 必须落成 1/4·1/2·1/4，列表之外的孩子必须保住内容高。 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

const height = (sel) =>
  page.$eval(sel, (el) => Math.round(el.getBoundingClientRect().height));

const open = async (body) => {
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css">
<style>vk-stack{gap:0}</style></head>
<body>${body}
<script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  await page.evaluate(() => window.vk?.ready?.());
  await page.waitForTimeout(120);
};

/* 720 = 624（三带）+ 96（字幕带）。剩余 624 按 1:2:1 → 156 / 312 / 156。 */
const BANDS = (attr = 'weights') => `
<vk-stack id="s" ${attr}="1 2 1" h="720">
  <vk-box id="a" surface="none"></vk-box>
  <vk-box id="b" surface="none"></vk-box>
  <vk-box id="c" surface="none"></vk-box>
  <vk-box id="d" h="96" surface="none"></vk-box>
</vk-stack>`;

test('weights="1 2 1"：三带按 1:2:1 分剩余高度，列表外的字幕带保持 96', async () => {
  await open(BANDS('weights'));
  const s = await height('#s');
  const [a, b, c, d] = await Promise.all(['#a', '#b', '#c', '#d'].map(height));
  assert.equal(s, 720, `容器高 ${s}`);
  assert.equal(d, 96, `字幕带高 ${d}`);
  assert.equal(a + b + c, 624, `三带高 ${a + b + c}`);
  assert.equal(a, 156, `上带 ${a}`);
  assert.equal(b, 312, `中带 ${b}`);
  assert.equal(c, 156, `下带 ${c}`);
  assert.equal(a + b + c + d, 720, '四段之和必须等于容器');
});

test('ratio 是 weights 的别名：同样的 1:2:1 落成同样的高度', async () => {
  await open(BANDS('ratio'));
  const [a, b, c] = await Promise.all(['#a', '#b', '#c'].map(height));
  assert.deepEqual([a, b, c], [156, 312, 156], `ratio 分高 ${[a, b, c].join('/')}`);
});

test('没写进权重列表的孩子保持内容高：不参与分剩余', async () => {
  await open(`
<vk-stack id="s" weights="1 1" h="600">
  <vk-box id="a" surface="none"></vk-box>
  <vk-box id="b" surface="none"></vk-box>
  <vk-box id="band" surface="none"><vk-text size="body">字幕带</vk-text></vk-box>
</vk-stack>`);
  const band = await height('#band');
  const [a, b] = await Promise.all(['#a', '#b'].map(height));
  assert.ok(band > 40, `未列入权重的字幕带保住了内容高（${band}）`);
  assert.equal(a + b + band, 600, `三段之和 ${a + b + band}`);
  assert.equal(a, b, `两个权重项等高：${a} / ${b}`);
});

test('没有确定高度的 stack 不做权重分配：孩子不会被压成 0', async () => {
  await open(`
<vk-stack id="s" weights="1 2 1">
  <vk-box id="a" surface="none" pad="md"><vk-text size="body">一</vk-text></vk-box>
  <vk-box id="b" surface="none" pad="md"><vk-text size="body">二</vk-text></vk-box>
  <vk-box id="c" surface="none" pad="md"><vk-text size="body">三</vk-text></vk-box>
</vk-stack>`);
  const a = await height('#a');
  assert.ok(a > 80, `自动高的 stack 里孩子保持内容高（${a}）`);
  assert.equal(await page.$$eval('[data-vk-weight]', (els) => els.length), 0, '不该打权重标记');
});

test('去掉 weights 后回到默认等距（属性可撤）', async () => {
  await open(BANDS('weights'));
  await page.$eval('#s', (el) => el.removeAttribute('weights'));
  await page.evaluate(() => window.vk?.layout?.());
  await page.waitForTimeout(80);
  const d = await height('#d');
  const a = await height('#a');
  assert.equal(d, 96, `字幕带仍是 96（${d}）`);
  assert.equal(a, 0, `撤掉权重后 #a 回到内容高 0（${a}）`);
  assert.equal(await page.$$eval('[data-vk-weight]', (els) => els.length), 0, '标记要撤干净');
});

after(async () => {
  await closeBrowser(browser);
  await close();
});
