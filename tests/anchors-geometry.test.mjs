/**
 * 几何锚点：只验原语落在哪，不验"怎么排一帧"。
 *
 * 用两个盒子 + 一条连线 + 一个圈选，断言坐标。画面怎么组织是调用方的事，
 * 这里只保证 `@side` / `@point` / `@region` 真的算在百分比位置上。
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${base}/specimens/vk-cells.html`, { waitUntil: 'load' });
await page.evaluate(() => window.vk.ready());

const reset = (html) =>
  page.evaluate(async (markup) => {
    document.querySelector('main').innerHTML = markup;
    await window.vk.ready();
    await new Promise((r) => requestAnimationFrame(r));
  }, html);

const numbers = (d) => (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

after(async () => {
  await browser.close();
  await close();
});

test('@side 起点 + @point 终点：落在盒子的百分比位置', async () => {
  await reset(`<vk-canvas w="600" h="300">
    <vk-box id="a" x="0" y="0" w="100" h="60"></vk-box>
    <vk-box id="b" x="300" y="100" w="200" h="100"></vk-box>
    <vk-edge from="#a@side:right" to="#b@point:0%,50%"></vk-edge>
  </vk-canvas>`);
  const d = await page.$eval('vk-edge .vk-edge-path', (e) => e.getAttribute('d'));
  const n = numbers(d);
  assert.ok(near(n[0], 100) && near(n[1], 30), `起点应是 a 右边中点，实际 ${n.slice(0, 2)}`);
  assert.ok(near(n[n.length - 2], 300) && near(n[n.length - 1], 150), `终点应是 b 左边中点，实际 ${n.slice(-2)}`);
  assert.deepEqual(pageErrors, []);
});

test('@side:top 决定出线方向，不是自动选边', async () => {
  await reset(`<vk-canvas w="600" h="300">
    <vk-box id="a" x="0" y="0" w="100" h="60"></vk-box>
    <vk-box id="b" x="300" y="100" w="200" h="100"></vk-box>
    <vk-edge from="#b@side:top" to="#a@point:100%,100%"></vk-edge>
  </vk-canvas>`);
  const d = await page.$eval('vk-edge .vk-edge-path', (e) => e.getAttribute('d'));
  const n = numbers(d);
  assert.ok(near(n[0], 400) && near(n[1], 100), `应从上边中点出线，实际 ${n.slice(0, 2)}`);
  assert.ok(near(n[n.length - 2], 100) && near(n[n.length - 1], 60), `应落在 a 的右下角，实际 ${n.slice(-2)}`);
});

test('@region 圈住的是盒子里的百分比区域，不是整个盒子', async () => {
  await reset(`<vk-canvas w="600" h="300">
    <vk-box id="b" x="300" y="100" w="200" h="100"></vk-box>
    <vk-ring for="#b@region:50%,50%,50%,50%" variant="rect" pad-px="0"></vk-ring>
  </vk-canvas>`);
  const box = await page.$eval('vk-ring .vk-ring-shape', (e) => ({
    x: Number(e.getAttribute('x')),
    y: Number(e.getAttribute('y')),
    w: Number(e.getAttribute('width')),
    h: Number(e.getAttribute('height')),
  }));
  assert.ok(near(box.x, 400) && near(box.y, 150), `区域左上角应在 (400,150)，实际 (${box.x},${box.y})`);
  assert.ok(near(box.w, 100) && near(box.h, 50), `区域应是 100×50，实际 ${box.w}×${box.h}`);
});
