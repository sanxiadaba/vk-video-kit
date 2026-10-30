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

test('vk-spotlight 是语境控制器：目标不动，兄弟退后', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-cells id="mem" cols="4">
        <li value="48" label="H"></li><li value="65" label="e"></li>
        <li value="6C" label="l"></li><li value="00" filled></li>
      </vk-cells>
      <vk-spotlight for="#mem@cell:3" dim="0.3"></vk-spotlight>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const r = await page.evaluate(() => {
    const paper = document.querySelector('.vk-page');
    const ov = document.querySelector('vk-spotlight');
    const cells = [...document.querySelectorAll('#mem .vk-cell')];
    return {
      parentIsPage: ov.parentElement === paper,
      opacities: cells.map((c) => Number(getComputedStyle(c).opacity)),
      target: document.querySelector('#mem .vk-cell[data-cell="3"]').hasAttribute('data-vk-focus'),
      veil: !!document.querySelector('vk-spotlight .vk-ov-svg > rect'),
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

test('vk-spotlight 的 dim 与 keep', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-stack gap="md">
        <vk-text id="a" size="body">甲</vk-text>
        <vk-text id="b" size="body">乙</vk-text>
        <vk-text id="c" size="body">丙</vk-text>
      </vk-stack>
      <vk-spotlight for="#b" dim="0.55" keep="#c"></vk-spotlight>
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


test('vk-loupe 放大的就是我们指定的那一点', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-box id="shot" x="120" y="120" w="600" h="200" surface="soft"></vk-box>
      <vk-loupe for="#shot" src="assets/sample-grid.svg" point="25%,40%" size="200" zoom="3" side="right"></vk-loupe>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const r = await page.evaluate(() => {
    const l = document.querySelector('.vk-loupe');
    const size = parseFloat(l.style.width);
    const [bw, bh] = l.style.backgroundSize.split(' ').map(parseFloat);
    const [px, py] = l.style.backgroundPosition.split(' ').map(parseFloat);
    return { size, bw, bh, px, py };
  });
  // 面板 200，放大 3×：底图宽 = 目标宽 × 3
  assert.equal(r.bw, 600 * 3, `底图宽应该是 1800，实际 ${r.bw}`);
  assert.equal(r.bh, 200 * 3);
  // 指定点 25%,40% 要落在面板正中
  assert.ok(Math.abs(r.px - (r.size / 2 - 0.25 * r.bw)) < 2, `x 偏移不对：${r.px}`);
  assert.ok(Math.abs(r.py - (r.size / 2 - 0.4 * r.bh)) < 2, `y 偏移不对：${r.py}`);
});

test('vk-loupe 的面板落在舞台里，源点圈照着同一个点', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-box id="shot" x="120" y="120" w="600" h="200" surface="soft"></vk-box>
      <vk-loupe for="#shot" src="assets/sample-grid.svg" point="25%,40%" size="200" zoom="4"></vk-loupe>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const r = await page.evaluate(() => {
    const box = document.querySelector('.vk-loupe').getBoundingClientRect();
    const spot = document.querySelector('.vk-loupe-spot').getBoundingClientRect();
    const shot = document.querySelector('#shot').getBoundingClientRect();
    const page = document.querySelector('.vk-page').getBoundingClientRect();
    return {
      box: { l: box.left, t: box.top, r: box.right, b: box.bottom },
      spot: { l: spot.left, t: spot.top, w: spot.width, h: spot.height },
      shot: { l: shot.left, t: shot.top },
      page: { l: page.left, t: page.top, r: page.right, b: page.bottom },
    };
  });
  // 没有被 0 高的舞台夹到顶上——这是它上一次的毛病
  assert.ok(r.box.t > r.page.t + 100, `面板不该贴在纸顶：top=${r.box.t}`);
  assert.ok(
    r.box.l >= r.page.l && r.box.r <= r.page.r && r.box.t >= r.page.t && r.box.b <= r.page.b,
    `面板跑出纸外：${JSON.stringify(r.box)}`
  );
  // 源点圈：圆心就是目标上的 25%,40%，直径 = 面板 / zoom
  const cx = r.shot.l + 0.25 * 600;
  const cy = r.shot.t + 0.4 * 200;
  assert.ok(Math.abs(r.spot.l + r.spot.w / 2 - cx) < 2, `源点圈圆心 x 不对：${r.spot.l + r.spot.w / 2} vs ${cx}`);
  assert.ok(Math.abs(r.spot.t + r.spot.h / 2 - cy) < 2, `源点圈圆心 y 不对：${r.spot.t + r.spot.h / 2} vs ${cy}`);
  assert.ok(Math.abs(r.spot.w - 200 / 4) < 2, `源点圈直径应该 = 面板/zoom = 50，实际 ${r.spot.w}`);
});

test('vk-loupe 在没高度的画布里也不会被夹到顶上', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-canvas w="900" h="400">
        <vk-box id="shot" x="60" y="120" w="300" h="160" surface="soft"></vk-box>
        <vk-loupe for="#shot" src="assets/sample-grid.svg" size="120" side="bottom"></vk-loupe>
      </vk-canvas>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  // setContent 不重载文档：上一个测试留下的 ready 状态会让 ready() 立刻返回，
  // 这一帧的覆盖层还没画。等它画出来再量几何。
  await page.waitForSelector('.vk-loupe', { timeout: 2000 });
  const r = await page.evaluate(() => {
    const box = document.querySelector('.vk-loupe').getBoundingClientRect();
    const canvas = document.querySelector('vk-canvas').getBoundingClientRect();
    return { top: box.top, boxBottom: box.bottom, canvas: { t: canvas.top, b: canvas.bottom } };
  });
  // 画布元素自己 offsetHeight=0，旧实现把 top 夹成 0；现在应该落在目标下方、画布里。
  assert.ok(r.top > r.canvas.t + 200, `面板被夹到画布顶上了：top=${r.top}`);
  assert.ok(r.boxBottom <= r.canvas.b + 1, `面板跑出画布：bottom=${r.boxBottom} canvas=${r.canvas.b}`);
});

test('vk-loupe 不写 src 就放大目标自己那张图', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-img id="pic" src="assets/sample-grid.svg" ratio="720 / 280" fit="cover"></vk-img>
      <vk-loupe for="#pic" size="200" zoom="3"></vk-loupe>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const bg = await page.evaluate(() => document.querySelector('.vk-loupe').style.backgroundImage);
  assert.ok(bg.includes('sample-grid.svg'), `应该默认用目标那张图，实际：${bg}`);
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
  assert.equal(r.clip, 'inset(0px 0px 0px 30%)', `裁切位置应该跟 split 一致：${r.clip}`);
  assert.equal(r.divLeft, '30%');
  assert.ok(r.ratio.startsWith('4 / 3'), `比例应该写进 aspect-ratio：${r.ratio}`);
});

after(async () => {
  await browser.close();
  await close();
});

