import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { startServer } from '../cli/serve.mjs';

/**
 * R3 · 流程由组件画。
 *
 * vk-steps 的连接线不是作者连的：每一步等宽、连接线等长、箭头统一指向下一步。
 * 这里量的是几何，不是感觉：
 *   · 5 步 → 4 根线，端点 x 等距（误差 ≤1px）；
 *   · 指向 current 的那一根线是钴蓝，当前步的编号方块是实心钴蓝；
 *   · connector="line" 没有箭头，connector="none" 一条都不画；
 *   · 竖排仍是同一套（只是方向转了 90°）。
 */

const { base, close: closeServer } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
const opened = [];

const STEPS = ['预处理', '编译', '汇编', '链接', '运行'];
const LIS = STEPS.map((t) => `<li>${t}</li>`).join('');

async function open(body) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tab = await ctx.newPage();
  opened.push(ctx);
  await tab.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body><vk-page><vk-box class="w" surface="none" style="width:1680px">${body}</vk-box></vk-page><script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return tab;
}

const geo = (tab, sel) =>
  tab.evaluate((s) => {
    const rects = [...document.querySelectorAll(s)].map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    });
    const nums = [...document.querySelectorAll('#s .vk-step-n')].map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, width: r.width, top: r.top, height: r.height };
    });
    return { rects, nums };
  }, sel);

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}（${a.toFixed(2)} vs ${b.toFixed(2)}，容差 ${tol}）`);

test('5 步流程：4 根连接线，端点 x 等距（≤1px）', async () => {
  const tab = await open(`<vk-steps id="s" current="3" connector="arrow">${LIS}</vk-steps>`);
  const { rects, nums } = await geo(tab, '#s .vk-step-line');
  assert.equal(rects.length, 4, '5 步之间只有 4 根线（末步后面不画）');

  // 每一根线一样长。
  for (let i = 1; i < rects.length; i++) near(rects[i].width, rects[0].width, 1, `第 ${i + 1} 根线长度`);

  // 端点等距：右端（箭头尖）与左端各成等差。
  const dRight = rects.slice(1).map((r, i) => r.right - rects[i].right);
  const dLeft = rects.slice(1).map((r, i) => r.left - rects[i].left);
  for (let i = 1; i < dRight.length; i++) near(dRight[i], dRight[0], 1, '箭头端点 x 间距');
  for (let i = 1; i < dLeft.length; i++) near(dLeft[i], dLeft[0], 1, '连线起点 x 间距');

  // 五步等宽：不等宽的话，上面两条不可能同时成立。
  for (let i = 1; i < nums.length; i++) near(nums[i].left - nums[i - 1].left, nums[1].left - nums[0].left, 1, '步骤中心距');
});

test('current 那一步：编号实心钴蓝，指向它的线也是钴蓝', async () => {
  const tab = await open(`<vk-steps id="s" current="3" connector="arrow">${LIS}</vk-steps>`);
  const r = await tab.evaluate(() => {
    const cur = document.querySelector('#s .vk-step[data-state="current"]');
    const num = cur.querySelector('.vk-step-n');
    const line = document.querySelector('#s .vk-step-line[data-conn="current"]');
    const done = document.querySelectorAll('#s .vk-step-line[data-conn="done"]');
    return {
      stepState: cur.dataset.state,
      numBg: getComputedStyle(num).backgroundColor,
      numColor: getComputedStyle(num).color,
      hasLine: !!line,
      lineBg: line ? getComputedStyle(line).backgroundColor : '',
      doneCount: done.length,
      todoCount: document.querySelectorAll('#s .vk-step-line[data-conn="todo"]').length,
      numRect: num.getBoundingClientRect().toJSON(),
      lineRect: line.getBoundingClientRect().toJSON(),
    };
  });
  assert.equal(r.stepState, 'current');
  assert.equal(r.numBg, 'rgb(27, 63, 214)', '当前步的编号方块是 --vk-focus');
  assert.equal(r.numColor, 'rgb(255, 255, 255)', '实心蓝上的数字是白的');
  assert.ok(r.hasLine, '必须有一根「指向当前步」的线');
  assert.equal(r.lineBg, 'rgb(27, 63, 214)', '指向当前步的线也是钴蓝');
  assert.equal(r.doneCount, 1, '两个已完成步骤之间的线是 done（绿）');
  assert.equal(r.todoCount, 2, '当前步之后的线是 todo（灰）');
  // 线垂直居中在编号方块上：否则箭头看起来「歪」。
  near(r.lineRect.y + r.lineRect.height / 2, r.numRect.y + r.numRect.height / 2, 2, '连接线与编号中心对齐');
});

test('connector="line" 只有线没有箭头；"none" 一条都不画', async () => {
  const arrow = await open(`<vk-steps id="s" current="1" connector="arrow">${LIS}</vk-steps>`);
  const arrowTip = await arrow.evaluate(
    () => getComputedStyle(document.querySelector('#s .vk-step-line'), '::after').borderLeftWidth
  );
  assert.equal(arrowTip, '12px', 'arrow：箭头尖是 12px 的三角');

  const line = await open(`<vk-steps id="s" current="1" connector="line">${LIS}</vk-steps>`);
  const lineTip = await line.evaluate(
    () => getComputedStyle(document.querySelector('#s .vk-step-line'), '::after').display
  );
  assert.equal(lineTip, 'none', 'line：不画箭头');
  const lineWidth = await line.evaluate(() => document.querySelector('#s .vk-step-line').getBoundingClientRect().width);
  assert.ok(lineWidth > 0, 'line：线本身还在');

  const none = await open(`<vk-steps id="s" current="1" connector="none">${LIS}</vk-steps>`);
  const noneShown = await none.evaluate(
    () => [...document.querySelectorAll('#s .vk-step-line')].filter((el) => el.getBoundingClientRect().width > 0).length
  );
  assert.equal(noneShown, 0, 'none：一根都不显示');
  const noneData = await none.evaluate(() => document.querySelector('#s .vk-steps').dataset.connector);
  assert.equal(noneData, 'none', 'connector 落到 data-connector，CSS 只认它');
});

test('current="-1"：纯地图，五步等权，一个"当前步"都不标', async () => {
  const tab = await open(`<vk-steps id="s" current="-1" connector="arrow">${LIS}</vk-steps>`);
  const r = await tab.evaluate(() => {
    const step = (s) => document.querySelectorAll(`#s .vk-step[data-state="${s}"]`).length;
    const num = document.querySelector('#s .vk-step-n');
    return {
      current: step('current'),
      done: step('done'),
      todo: step('todo'),
      conn: [...document.querySelectorAll('#s .vk-step-line')].map((el) => el.dataset.conn),
      nums: [...document.querySelectorAll('#s .vk-step-n')].map((el) => el.textContent),
      aria: document.querySelectorAll('#s [aria-current]').length,
      numBg: getComputedStyle(num).backgroundColor,
      label: document.querySelector('#s .vk-step-t').textContent,
    };
  });
  assert.equal(r.current, 0, 'current="-1" 不许有当前步');
  assert.equal(r.done, 0, '也不许有已完成步：五步同一态');
  assert.equal(r.todo, 5, '五步全部是 todo（同一个态）');
  assert.deepEqual(r.conn, ['todo', 'todo', 'todo', 'todo'], '连接线也不带状态色');
  assert.equal(r.aria, 0, '没有「当前步」就不该有 aria-current');
  assert.equal(r.numBg, 'rgb(255, 255, 255)', '编号方块回到纸色，不涂焦点蓝');
  assert.deepEqual(r.nums, ['01', '02', '03', '04', '05'], '地图仍要有步号（等权不等于无编号）');
  assert.equal(r.label, '预处理');
});

test('竖排：连接线转 90°，箭头朝下', async () => {
  const tab = await open(`<vk-steps id="s" current="1" direction="vertical" connector="arrow">${LIS}</vk-steps>`);
  const r = await tab.evaluate(() => {
    const root = document.querySelector('#s .vk-steps');
    const line = document.querySelector('#s .vk-step-line');
    const after = getComputedStyle(line, '::after');
    return {
      dir: getComputedStyle(root).flexDirection,
      h: line.getBoundingClientRect().height,
      w: line.getBoundingClientRect().width,
      borderTop: after.borderTopWidth,
      borderLeft: after.borderLeftWidth,
    };
  });
  assert.equal(r.dir, 'column');
  assert.ok(r.h > r.w, '竖排的连接线高度大于宽度');
  assert.equal(r.borderTop, '12px', '箭头尖朝下（border-top 三角）');
  assert.equal(r.borderLeft, '7px', '左右是对称透明边');
});

after(async () => {
  for (const ctx of opened) await ctx.close().catch(() => {});
  await closeBrowser(browser);
  await closeServer();
});
