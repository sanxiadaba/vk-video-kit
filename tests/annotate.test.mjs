import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * 批次 C：关系 / 图示。
 *
 * 三件事必须同时成立，否则"合并成 vk-annotate"只是换了个名字：
 *   1. 四种形态各自真的画出来（arrow / circle / note / badge）；
 *   2. 旧标签是别名，走线与气泡位置和新标签逐像素一致；
 *   3. vk-compare 的差异框按百分比换算成像素，split 下只标在所属的一半。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const warnings = [];
page.on('console', (m) => {
  if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text());
});

// 一次导航、之后只换 main.innerHTML：setContent 会重跑一套模块实例，
// 旧元素留在上一份 EDGES 里，后半段的用例会互相污染。
await page.goto(`${base}/specimens/vk-annotate.html`, { waitUntil: 'load' });
await page.evaluate(() => window.vk?.ready?.());

const open = async (body) => {
  await page.evaluate(async (markup) => {
    const main = document.querySelector('main');
    main.innerHTML = markup;
    await window.vk?.ready?.();
    window.vk?.layout?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, body);
  await page.waitForTimeout(80);
};

const CANVAS = (extra = '') => `<vk-canvas id="cv" w="1000" h="420">
  <vk-box id="a" x="40" y="60" w="220" h="100" surface="soft" radius="lg"><vk-text size="body" mono>a</vk-text></vk-box>
  <vk-box id="b" x="700" y="240" w="220" h="100" surface="paper" border="hair" radius="lg"><vk-text size="body" mono>b</vk-text></vk-box>
  ${extra}
</vk-canvas>`;

test('vk-annotate arrow：三种 shape 各走一种路径，实虚/线宽/端点各自生效', async () => {
  await open(
    CANVAS(`
    <vk-annotate id="straight" mode="arrow" shape="straight" from="#a@side:right" to="#b@side:left"></vk-annotate>
    <vk-annotate id="ortho" mode="arrow" shape="ortho" from="#a@side:right" to="#b@side:left"></vk-annotate>
    <vk-annotate id="curve" mode="arrow" shape="curve" from="#a@side:right" to="#b@side:left"></vk-annotate>
    <vk-annotate id="dashed" mode="arrow" dash="dashed" from="#a@side:right" to="#b@side:left"></vk-annotate>
    <vk-annotate id="wide" mode="arrow" width="10" head="none" from="#a@side:right" to="#b@side:left"></vk-annotate>
    <vk-annotate id="dot" mode="arrow" head="dot" from="#a@side:right" to="#b@side:left"></vk-annotate>`)
  );
  const r = await page.evaluate(() => {
    const q = (id) => document.querySelector(`#${id}`);
    const d = (id) => q(id).querySelector('.vk-edge-path').getAttribute('d');
    const cs = (id) => getComputedStyle(q(id).querySelector('.vk-edge-path'));
    const tip = (id) => q(id).querySelector('.vk-edge-tip').getAttribute('d') || '';
    const cap = (id) => {
      const c = q(id).querySelector('.vk-edge-cap');
      return { shown: c.style.display !== 'none', cx: c.getAttribute('cx'), cy: c.getAttribute('cy') };
    };
    return {
      straight: d('straight'),
      ortho: d('ortho'),
      curve: d('curve'),
      dashed: cs('dashed').strokeDasharray,
      solid: cs('ortho').strokeDasharray,
      wide: cs('wide').strokeWidth,
      wideTip: tip('wide'),
      dotTip: tip('dot'),
      dotCap: cap('dot'),
      orthoCap: cap('ortho'),
    };
  });
  assert.match(r.straight, /^M/, 'straight 要有路径');
  assert.equal((r.straight.match(/Q/g) || []).length, 0, `straight 不该有圆角：${r.straight}`);
  assert.ok((r.ortho.match(/Q/g) || []).length >= 1, `ortho 应该有圆角拐点：${r.ortho}`);
  assert.match(r.curve, /C/, `curve 要画贝塞尔：${r.curve}`);
  assert.notEqual(r.straight, r.ortho);
  assert.notEqual(r.ortho, r.curve);
  assert.notEqual(r.dashed, 'none', 'dash="dashed" 必须落成虚线');
  assert.equal(r.solid, 'none', 'dash="solid" 是实线');
  assert.equal(r.wide, '10px', `width=10 应落到 stroke-width：${r.wide}`);
  assert.equal(r.wideTip, '', 'head="none" 不画箭头');
  assert.equal(r.dotTip, '', 'head="dot" 不画三角箭头');
  assert.equal(r.dotCap.shown, true, 'head="dot" 要在终点画圆点');
  assert.equal(r.orthoCap.shown, false, '默认 head="arrow" 没有圆点');
});

test('vk-annotate circle：椭圆 / 矩形 / 双圈各不相同，且圈住目标', async () => {
  await open(
    CANVAS(`
    <vk-annotate id="ell" mode="circle" ring="ellipse" for="#b"></vk-annotate>
    <vk-annotate id="rect" mode="circle" ring="rect" for="#b"></vk-annotate>
    <vk-annotate id="two" mode="circle" ring="ellipse" double for="#b"></vk-annotate>`)
  );
  const r = await page.evaluate(() => {
    const q = (id) => document.querySelector(`#${id}`);
    const shapes = (id) => [...q(id).querySelectorAll('.vk-ring-shape')].map((n) => ({
      tag: n.tagName.toLowerCase(),
      box: n.getBoundingClientRect().toJSON(),
      inner: n.classList.contains('vk-annot-ring-inner'),
    }));
    const target = document.querySelector('#b').getBoundingClientRect().toJSON();
    return { ell: shapes('ell'), rect: shapes('rect'), two: shapes('two'), target };
  });
  assert.equal(r.ell.length, 1);
  assert.equal(r.ell[0].tag, 'ellipse');
  assert.equal(r.rect[0].tag, 'rect');
  assert.equal(r.two.length, 2, 'double 要画内外两圈');
  assert.ok(r.two.some((s) => s.inner), '内圈要有标记');
  const outer = r.two.find((s) => !s.inner).box;
  assert.ok(outer.left < r.target.left && outer.right > r.target.right, '外圈要把目标包住');
  assert.ok(outer.top < r.target.top && outer.bottom > r.target.bottom, '外圈要把目标包住');
});

test('vk-annotate note：泡 / 引线标签 / 编号点三种写法，且不压住正文', async () => {
  await open(`<vk-page align="top"><vk-stack gap="lg">
    <vk-text id="title" class="t" size="title" weight="bold">这一行不能被批注压住</vk-text>
    <vk-box id="tgt" w="240" h="96" surface="soft"><vk-text size="body">目标</vk-text></vk-box>
    <vk-annotate id="bubble" mode="note" note="bubble" for="#tgt">这里是一条批注</vk-annotate>
    <vk-annotate id="label" mode="note" note="label" for="#tgt@side:right">少 3 行</vk-annotate>
    <vk-annotate id="badge" mode="note" note="badge" for="#tgt@side:right" n="3"></vk-annotate>
  </vk-stack></vk-page>`);
  const r = await page.evaluate(() => {
    const q = (id) => document.querySelector(`#${id}`);
    const bd = (id) => q(id).querySelector('.vk-pin-bd');
    const t = document.querySelector('.t').getBoundingClientRect();
    const b = bd('bubble').getBoundingClientRect();
    const w = Math.min(b.right, t.right) - Math.max(b.left, t.left);
    const h = Math.min(b.bottom, t.bottom) - Math.max(b.top, t.top);
    return {
      cover: { w, h },
      bubble: { text: q('bubble').querySelector('.vk-pin-t').textContent.trim(), note: bd('bubble').dataset.note },
      label: {
        note: bd('label').dataset.note,
        text: q('label').querySelector('.vk-pin-t').textContent.trim(),
        border: getComputedStyle(bd('label')).borderLeftWidth,
        leader: !!q('label').querySelector('.vk-pin-leader'),
      },
      badge: {
        note: bd('badge').dataset.note,
        n: q('badge').querySelector('.vk-pin-n').textContent.trim(),
        radius: getComputedStyle(bd('badge')).borderRadius,
        textHidden: getComputedStyle(q('badge').querySelector('.vk-pin-t')).display === 'none',
      },
    };
  });
  assert.ok(!(r.cover.w > 60 && r.cover.h > 20), `批注泡压住了标题：${JSON.stringify(r.cover)}`);
  assert.equal(r.bubble.note, 'bubble');
  assert.equal(r.bubble.text, '这里是一条批注');
  assert.equal(r.label.note, 'label');
  assert.equal(r.label.text, '少 3 行');
  assert.equal(r.label.border, '0px', '引线标签没有气泡边框');
  assert.ok(r.label.leader, '引线标签仍有引线');
  assert.equal(r.badge.note, 'badge');
  assert.equal(r.badge.n, '3');
  assert.match(r.badge.radius, /50%|20px/, `编号点应该是圆的：${r.badge.radius}`);
  assert.ok(r.badge.textHidden, '编号点不显示正文');
});

test('vk-annotate badge：编号点钉在任意锚点上，位置跟着锚点走', async () => {
  await open(
    CANVAS(`<vk-annotate id="n" mode="badge" n="7" for="#b@side:right"></vk-annotate>`)
  );
  const r = await page.evaluate(() => {
    const b = document.querySelector('#b').getBoundingClientRect();
    const bd = document.querySelector('#n .vk-pin-bd').getBoundingClientRect();
    return {
      n: document.querySelector('#n .vk-pin-n').textContent.trim(),
      gap: bd.left - b.right,
      cy: bd.top + bd.height / 2 - (b.top + b.height / 2),
    };
  });
  assert.equal(r.n, '7');
  assert.ok(r.gap > 0 && r.gap < 80, `编号点应贴在锚点右侧：gap=${r.gap}`);
  assert.ok(Math.abs(r.cy) < 4, `编号点应与锚点同高：dy=${r.cy}`);
});

test('旧标签是别名：vk-edge / vk-pin 与 vk-annotate 同几何；vk-ring 变成带环的面', async () => {
  await open(
    CANVAS(`
    <vk-edge id="edge" from="#a@side:right" to="#b@side:left" label="x"></vk-edge>
    <vk-annotate id="ann" mode="arrow" shape="ortho" from="#a@side:right" to="#b@side:left" label="x"></vk-annotate>
    <vk-pin id="pin" for="#b@side:top">同一句话</vk-pin>
    <vk-annotate id="note" mode="note" note="bubble" for="#b@side:top" gap-px="24">同一句话</vk-annotate>
    <vk-ring id="ring" for="#b" variant="ellipse" pad-px="12" stroke="4"></vk-ring>`)
  );
  const r = await page.evaluate(() => {
    const d = (sel) => document.querySelector(sel).getAttribute('d');
    const box = (sel) => document.querySelector(sel).getBoundingClientRect().toJSON();
    const target = document.querySelector('#b').getBoundingClientRect().toJSON();
    const ring = document.querySelector('#ring');
    return {
      edge: d('#edge .vk-edge-path'),
      annot: d('#ann .vk-edge-path'),
      pin: box('#pin .vk-pin-bd'),
      note: box('#note .vk-pin-bd'),
      target,
      ring: box('#ring'),
      ringBorder: getComputedStyle(ring).borderTopWidth,
      ringRadius: getComputedStyle(ring).borderTopLeftRadius,
    };
  });
  assert.equal(r.edge, r.annot, 'vk-edge 的走线必须和 vk-annotate 一致');
  for (const k of ['left', 'top', 'width', 'height']) {
    assert.ok(Math.abs(r.pin[k] - r.note[k]) <= 1, `vk-pin 的气泡 ${k} 应和 vk-annotate 一致：${r.pin[k]} vs ${r.note[k]}`);
  }
  // vk-ring 不再是 SVG 形状库：它是一块带描边的面，几何 = 目标盒 + 两侧 pad-px（12）。
  assert.ok(Math.abs(r.ring.width - (r.target.width + 24)) <= 1, `环宽 = 目标 + 2×pad：${r.ring.width} vs ${r.target.width}+24`);
  assert.ok(Math.abs(r.ring.height - (r.target.height + 24)) <= 1, `环高 = 目标 + 2×pad：${r.ring.height}`);
  assert.equal(r.ringBorder, '4px', 'stroke 落到描边宽度');
  assert.equal(r.ringRadius, '50%', 'variant="ellipse" 是椭圆环');
});

test('vk-compare mark：百分比换成像素，split 下只标在所属的一半', async () => {
  await open(`<vk-page><vk-grid cols="2">
    <vk-compare id="c" a="../assets/sample-grid.svg" b="../assets/sample-grid-b.svg" ratio="4 / 3" split="40"
      mark="10,20,30,50;70,60,90,80" mark-label="左;右"></vk-compare>
  </vk-grid></vk-page>`);
  const r = await page.evaluate(() => {
    const cmp = document.querySelector('#c .vk-cmp');
    // 标注层是 inset:0 的绝对定位层：坐标相对它的盒子（不含 2px 边框）。
    const layer = document.querySelector('#c .vk-cmp-marks-a').getBoundingClientRect();
    const marks = [...document.querySelectorAll('#c .vk-cmp-mark')];
    return {
      cmp: cmp.getBoundingClientRect().toJSON(),
      layer: layer.toJSON(),
      marks: marks.map((m) => ({
        parent: m.parentElement.className,
        box: m.getBoundingClientRect().toJSON(),
        label: m.querySelector('.vk-cmp-mark-l')?.textContent || '',
      })),
      aClip: getComputedStyle(document.querySelector('#c .vk-cmp-marks-a')).clipPath,
      bClip: getComputedStyle(document.querySelector('#c .vk-cmp-marks-b')).clipPath,
    };
  });
  assert.equal(r.marks.length, 2, '两组 mark 应画出两个框');
  const [m1, m2] = r.marks;
  // 10% 左边 → a 层；70% → b 层（split=40）。
  assert.match(m1.parent, /vk-cmp-marks-a/);
  assert.match(m2.parent, /vk-cmp-marks-b/);
  assert.equal(m1.label, '左');
  assert.equal(m2.label, '右');
  const near = (a, b) => Math.abs(a - b) <= 1.5;
  assert.ok(near(m1.box.left - r.layer.left, r.layer.width * 0.1), `x1 换算错：${m1.box.left - r.layer.left}`);
  assert.ok(near(m1.box.top - r.layer.top, r.layer.height * 0.2), `y1 换算错：${m1.box.top - r.layer.top}`);
  assert.ok(near(m1.box.width, r.layer.width * 0.2), `宽换算错：${m1.box.width}`);
  assert.ok(near(m1.box.height, r.layer.height * 0.3), `高换算错：${m1.box.height}`);
  assert.ok(near(m2.box.left - r.layer.left, r.layer.width * 0.7), `x2 换算错`);
  assert.ok(r.aClip.includes('inset') && r.bClip.includes('inset'), 'split 下两层各自被裁到所属一半');
});

test('vk-compare mark：写错的坐标不画框，也不炸页面', async () => {
  await open(`<vk-page><vk-compare id="c" a="../assets/sample-grid.svg" b="../assets/sample-grid-b.svg" ratio="4 / 3"
    mark="10,20,30;nope;80,80,80,10" mark-label="x;y;z"></vk-compare></vk-page>`);
  const n = await page.evaluate(() => document.querySelectorAll('#c .vk-cmp-mark').length);
  assert.equal(n, 0, '非法 / 零面积 mark 不画框');
  assert.ok(warnings.some((w) => w.includes('[vk]') && w.includes('mark')), `应给出 mark 警告：${warnings.join(' | ')}`);
});

after(async () => {
  await browser.close();
  await close();
});

