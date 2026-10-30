import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * L5 姿态：一处注意力词汇。
 *
 *   1. act="focus" 真的上色（行 → data-state=current，块 → tone=focus）；
 *   2. strength 只改响度：soft / ghost 比 solid 淡，但颜色仍是同一个钴蓝；
 *   3. act="mark" 是石墨，不是钴蓝——标注和「正在讲」必须能分开；
 *   4. 旧词（state="current"）还是能用。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

const li = (n, attrs) => `<li value="${n}" label="格${n}"${attrs ? ' ' + attrs : ''}></li>`;

const html = (mid) => `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body><vk-page><vk-stack gap="md">
  <vk-cells cols="3">${li(1, '')}${li(2, mid)}${li(3, '')}</vk-cells>
</vk-stack></vk-page><script src="dist/vk.js"></script></body></html>`;

const open = async (mid) => {
  const tab = await ctx.newPage();
  await tab.setContent(html(mid), { waitUntil: 'load' });
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return tab;
};

const bg = async (tab, i) => {
  const v = await tab.evaluate((n) => {
    const el = document.querySelectorAll('.vk-cell')[n];
    return el ? getComputedStyle(el).backgroundColor : 'missing';
  }, i);
  await tab.close();
  return v;
};

const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number).slice(0, 3);

test('act="focus" 给格子上了焦点色', async () => {
  assert.notEqual(await bg(await open(''), 1), await bg(await open('act="focus"'), 1), 'focus 必须改变底色');
});

test('行上的 focus 落成 data-state=current', async () => {
  const tab = await open('act="focus"');
  const state = await tab.evaluate(() => document.querySelectorAll('.vk-cell')[1].dataset.state);
  const act = await tab.evaluate(() => document.querySelectorAll('.vk-cell')[1].dataset.act);
  await tab.close();
  assert.equal(act, 'focus');
  assert.equal(state, 'current', '旧配方靠 data-state=current 生效');
});

test('strength 改响度不改颜色', async () => {
  const a = await bg(await open('act="focus"'), 1);
  const b = await bg(await open('act="focus" strength="soft"'), 1);
  const c = await bg(await open('act="focus" strength="ghost"'), 1);
  assert.notEqual(a, b, 'soft 应该和 solid 不同');
  assert.notEqual(a, c, 'ghost 应该和 solid 不同');
  const [ar, , ab] = rgb(a);
  assert.ok(ab > ar, `solid 应该偏蓝：${a}`);
});

test('act="mark" 用石墨，不用钴蓝', async () => {
  const v = await bg(await open('act="mark"'), 1);
  const [r, , b] = rgb(v);
  assert.ok(Math.abs(b - r) < 24, `mark 不该是钴蓝：${v}`);
});

test('旧词仍然可用：state="current"', async () => {
  assert.notEqual(await bg(await open(''), 1), await bg(await open('state="current"'), 1));
});

after(async () => {
  await browser.close();
  await close();
});
