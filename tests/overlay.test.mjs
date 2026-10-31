import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * 覆盖层与留白度量 —— 两条都在 12.x 修过，都是"看不出错、但一直错"的那类：
 *   · 聚光挂在 .vk-page-inner 上，遮罩跟着 1680 的盒子一起缩，纸边永远白的；
 *   · 留白度量把覆盖层算成内容，vk-edge 的 svg 铺满整页，"内容底"永远是画布底。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

const SHELL = (body) => `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body>${body}<script src="dist/vk.js"></script></body></html>`;

const ready = async () => {
  await page.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(120);
};

test('vk-ring variant=dim 是语境控制器：目标不动，兄弟退后', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-cells id="mem" cols="4">
        <li value="48" label="H"></li><li value="65" label="e"></li>
        <li value="6C" label="l"></li><li value="00" filled></li>
      </vk-cells>
      <vk-ring variant="dim" for="#mem@cell:3" dim="0.3"></vk-ring>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const r = await page.evaluate(() => {
    const paper = document.querySelector('.vk-page');
    const ov = document.querySelector('vk-ring');
    const cells = [...document.querySelectorAll('#mem .vk-cell')];
    return {
      parentIsPage: ov.parentElement === paper,
      opacities: cells.map((c) => Number(getComputedStyle(c).opacity)),
      target: document.querySelector('#mem .vk-cell[data-cell="3"]').hasAttribute('data-vk-focus'),
      veil: !!document.querySelector('vk-ring .vk-ov-svg > rect'),
    };
  });
  assert.ok(r.parentIsPage, '聚光应该挂成 .vk-page 的子节点');
  assert.equal(r.veil, false, '语境控制器不画白幕');
  assert.ok(r.target, '目标要打上 data-vk-focus');
  for (const [i, o] of r.opacities.entries()) {
    if (i === 3) assert.ok(o > 0.99, `目标不该退后（实际 ${o}）`);
    else assert.ok(Math.abs(o - 0.3) < 0.02, `第 ${i} 格应退到 0.3（实际 ${o}）`);
  }
});

test('vk-ring 的 dim 与 keep', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-stack gap="md">
        <vk-text id="a" size="body">甲</vk-text>
        <vk-text id="b" size="body">乙</vk-text>
        <vk-text id="c" size="body">丙</vk-text>
      </vk-stack>
      <vk-ring variant="dim" for="#b" dim="0.55" keep="#c"></vk-ring>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const r = await page.evaluate(() => ({
    a: Number(getComputedStyle(document.querySelector('#a')).opacity),
    c: Number(getComputedStyle(document.querySelector('#c')).opacity),
  }));
  assert.ok(Math.abs(r.a - 0.55) < 0.02, `dim 应该被读成 0.55（实际 ${r.a}）`);
  assert.ok(r.c > 0.99, `keep 里的节点不退后（实际 ${r.c}）`);
});
test('底部空带：量到的是最后一点墨，且不算覆盖层', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-stack gap="md">
        <vk-text size="body">只有这一行字，下面全是空的。</vk-text>
        <vk-edge from="160,400" to="600,400"></vk-edge>
      </vk-stack>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const out = await page.evaluate(() => {
    const issues = window.vk.auditPage().issues.filter((x) => x.type === 'void');
    const m = window.vk.metrics()[0];
    return { issues, safeH: m.safeH, contentBottom: m.contentBottom, contentRight: m.contentRight };
  });
  assert.equal(out.safeH, 888, '安全区高 888');
  assert.equal(out.issues.length, 1, `应报一条留白，实际 ${JSON.stringify(out.issues)}`);
  const band = out.issues[0].box[3];
  assert.ok(band > 700, `空带应接近整页高，实际 ${band}`);
  // vk-edge 的 svg 铺满整张纸；它要是被算进内容，contentBottom 就是 888。
  assert.ok(out.contentBottom < 400, `覆盖层不该抬高内容底（实际 ${out.contentBottom}）`);
});

test('空页必须报 empty：没有字也没有图', async () => {
  await page.setContent(SHELL(`<vk-page><vk-stack></vk-stack></vk-page>`), { waitUntil: 'load' });
  await ready();
  const out = await page.evaluate(() => window.vk.auditPage().issues.filter((x) => x.type === 'empty'));
  assert.equal(out.length, 1, `空页应报一条 empty，实际 ${JSON.stringify(out)}`);
});

test('有一句话的页不报 empty', async () => {
  await page.setContent(
    SHELL(`<vk-page><vk-text size="body">这一页有一整句话，不该被判成空帧，哪怕它很短。</vk-text></vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const out = await page.evaluate(() => window.vk.auditPage().issues.filter((x) => x.type === 'empty'));
  assert.equal(out.length, 0, `不该报 empty：${JSON.stringify(out)}`);
});

test('底部空带：贴底的页不报', async () => {
  await page.setContent(
    SHELL(`<vk-page align="bottom">
      <vk-text size="body">这一行贴着安全区底边，下面不该再报留白。</vk-text>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const out = await page.evaluate(() => ({
    issues: window.vk.auditPage().issues.filter((x) => x.type === 'void'),
    bottom: window.vk.metrics()[0].contentBottom,
  }));
  assert.ok(out.bottom > 800, `内容底应贴到底边，实际 ${out.bottom}`);
  assert.equal(out.issues.length, 0, `不该报留白：${JSON.stringify(out.issues)}`);
});



test('vk-compare 的 split 决定裁掉多少', async () => {
  await page.setContent(
    SHELL(`<vk-page><vk-grid cols="3">
      <vk-compare span="2" a="assets/sample-grid.svg" b="assets/sample-grid-b.svg" ratio="4 / 3" split="30"></vk-compare>
    </vk-grid></vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const r = await page.evaluate(() => {
    const a = document.querySelector('.vk-cmp-a');
    const div = document.querySelector('.vk-cmp-div');
    const box = document.querySelector('.vk-cmp');
    return { clip: a.style.clipPath, divLeft: div.style.left, ratio: getComputedStyle(box).aspectRatio };
  });
  // a 在左、b 在右：split=30 表示"左边 30% 是 a"，所以裁掉 a 的右边 70%。
  // 旧断言写的是 inset(0 0 0 30%)——那是"只留 a 的右半边"，图像与标签会左右错位。
  assert.equal(r.clip, 'inset(0px 70% 0px 0px)', `裁切应该留下左边 30%：${r.clip}`);
  assert.equal(r.divLeft, '30%');
  assert.ok(r.ratio.startsWith('4 / 3'), `比例应该写进 aspect-ratio：${r.ratio}`);
});

test('vk-compare：a 固定留左侧，label-a 与 a 同边', async () => {
  await page.setContent(
    SHELL(`<vk-page><vk-grid cols="3">
      <vk-compare span="2" a="assets/sample-grid.svg" b="assets/sample-grid-b.svg" ratio="4 / 3"
        split="50" label-a="改前" label-b="改后"></vk-compare>
    </vk-grid></vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const r = await page.evaluate(() => {
    const a = document.querySelector('.vk-cmp-a');
    const la = document.querySelector('.vk-cmp-la');
    const lb = document.querySelector('.vk-cmp-lb');
    return {
      clip: a.style.clipPath,
      aSrc: a.getAttribute('src'),
      la: la.textContent,
      lb: lb.textContent,
      laLeft: la.getBoundingClientRect().left,
      lbLeft: lb.getBoundingClientRect().left,
    };
  });
  // split=50：a 的裁切只留左半（右侧 inset 50%），右半露出 b。
  assert.equal(r.clip, 'inset(0px 50% 0px 0px)', `a 应留在左边：${r.clip}`);
  assert.match(r.aSrc, /sample-grid\.svg$/, 'a 属性必须落到上面那张图');
  assert.equal(r.la, '改前');
  assert.equal(r.lb, '改后');
  assert.ok(r.laLeft < r.lbLeft, 'label-a 在左下、label-b 在右下');
});

after(async () => {
  await browser.close();
  await close();
});

test('ring variant="dim"：目标不动、兄弟退后、keep 保住', async () => {
  await page.setContent(
    SHELL(`<vk-page><vk-stack gap="md">
      <vk-text id="t" size="body">重点</vk-text>
      <vk-text id="o" size="body">该退后</vk-text>
      <vk-text id="k" size="body">被保住</vk-text>
    </vk-stack><vk-ring for="#t" variant="dim" dim="0.4" keep="#k"></vk-ring></vk-page>`),
    { waitUntil: 'load' }
  );
  await page.evaluate(() => window.vk.ready());
  const r = await page.evaluate(() => ({
    t: getComputedStyle(document.querySelector('#t')).opacity,
    o: getComputedStyle(document.querySelector('#o')).opacity,
    k: getComputedStyle(document.querySelector('#k')).opacity,
  }));
  assert.equal(r.t, '1', '目标不该被压暗');
  assert.equal(r.o, '0.4', '兄弟要退后到 dim');
  assert.equal(r.k, '1', 'keep 里的元素不能退后');
});

test('批注泡自动选边：不压住正文', async () => {
  // 目标在上半页，上方只有标题：默认应该往右/下走，而不是盖住标题。
  await page.setContent(
    SHELL(`<vk-page align="top"><vk-stack gap="lg">
      <vk-text class="t" size="title" weight="bold">这一行不能被批注泡盖住</vk-text>
      <vk-box id="tgt" w="240" h="96" surface="soft"><vk-text size="body">目标</vk-text></vk-box>
    </vk-stack><vk-pin for="#tgt">这里是一条批注</vk-pin></vk-page>`),
    { waitUntil: 'load' }
  );
  await page.evaluate(() => window.vk.ready());
  const r = await page.evaluate(() => {
    const bd = document.querySelector('.vk-pin-bd').getBoundingClientRect();
    const t = document.querySelector('.t').getBoundingClientRect();
    const w = Math.min(bd.right, t.right) - Math.max(bd.left, t.left);
    const h = Math.min(bd.bottom, t.bottom) - Math.max(bd.top, t.top);
    return { w, h };
  });
  assert.ok(!(r.w > 60 && r.h > 20), `批注泡压住了标题：重叠 ${Math.round(r.w)}×${Math.round(r.h)}`);
});
