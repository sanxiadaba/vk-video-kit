import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * 15.x 机制层：放大 / 构图 / 色阶。
 *
 *   content-size   size="160" 的字号与行高成比例；不写 size 像素不变
 *   bleed          bleed="x" 的元素左右边到画布 0
 *   fill-mode      vk-img fill="cover" 用 object-fit 铺满、不拉伸
 *   layer-overlay  vk-layer 第一个铺底、其余叠上；文字有可读性保护
 *   surface-tones  五档底 paper / wash / tint / dark / accent
 *
 * 这一组是机制测试，不是 demo：全部用真实 DOM 计算样式量，不截图。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const opened = [];

async function open(body) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tab = await ctx.newPage();
  opened.push(ctx);
  await tab.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body>${body}<script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.vk?.layout?.();
  });
  return tab;
}

const CODE = 'int main(void) { return 0; }';

test('内容组件 size：160px 字号与行高成比例，不写 size 像素不变', async () => {
  const tab = await open(`
<vk-page><div style="width:1200px">
  <vk-code id="big" size="160" lang="c">${CODE}</vk-code>
  <vk-code id="base" lang="c">${CODE}</vk-code>
</div></vk-page>`);
  const r = await tab.evaluate(() => {
    const read = (id) => {
      const host = document.querySelector(id);
      const bd = host.querySelector('.vk-bd');
      const line = host.querySelector('.vk-line');
      const ln = host.querySelector('.vk-ln');
      return {
        fs: parseFloat(getComputedStyle(bd).fontSize),
        lineH: parseFloat(getComputedStyle(line).minHeight),
        lnFs: parseFloat(getComputedStyle(ln).fontSize),
        padLeft: parseFloat(getComputedStyle(bd).paddingLeft),
      };
    };
    return { big: read('#big'), base: read('#base') };
  });
  assert.ok(Math.abs(r.big.fs - 160) <= 0.6, `size=160 的正文字号应是 160：${r.big.fs}`);
  assert.ok(
    Math.abs(r.big.lineH / r.big.fs - r.base.lineH / r.base.fs) < 0.005,
    `行高应与字号成同一比例：${r.big.lineH}/${r.big.fs} vs ${r.base.lineH}/${r.base.fs}`
  );
  assert.ok(r.big.lnFs > r.base.lnFs, `行号也要一起放大：${r.big.lnFs} vs ${r.base.lnFs}`);
  assert.ok(r.big.padLeft > r.base.padLeft, `内距也要一起放大：${r.big.padLeft} vs ${r.base.padLeft}`);
  // 不写 size 时逐像素等于今天：正文 56、行高 70、行号 48。
  assert.ok(Math.abs(r.base.fs - 56) <= 0.2, `默认正文字号仍是 56：${r.base.fs}`);
  assert.ok(Math.abs(r.base.lineH - 70) <= 0.5, `默认行高仍是 70：${r.base.lineH}`);
  assert.ok(Math.abs(r.base.lnFs - 48) <= 0.2, `默认行号仍是 48：${r.base.lnFs}`);
  assert.ok(Math.abs(r.base.padLeft - 32) <= 0.2, `默认左内距仍是 32：${r.base.padLeft}`);
});

test('vk-asm fit="width"：最宽一行不差 2px 地填满容器', async () => {
  const tab = await open(`
<vk-page><div style="width:1200px">
<vk-asm id="a" fit="width" title="x.s">
<script type="text/plain" data-vk-asm>{"file":"x.s","base":"401000","rows":[{"text":"mov    $0x1,%eax","m":"mov","o":"$0x1,%eax","line":1,"addr":"401000","bytes":"b8 01 00 00 00"}]}</script>
</vk-asm>
</div></vk-page>`);
  const r = await tab.evaluate(() => {
    const host = document.querySelector('#a');
    const bd = host.querySelector('.vk-asm-bd');
    const target = bd.parentElement.clientWidth;
    const prev = bd.style.width;
    bd.style.width = 'max-content';
    const natural = bd.offsetWidth;
    bd.style.width = prev;
    return { target, natural, fs: parseFloat(getComputedStyle(bd).fontSize) };
  });
  assert.ok(r.fs > 48, `内容变宽时 fit 应放大字号（默认 48）：${r.fs}`);
  assert.ok(Math.abs(r.natural - r.target) <= 2, `fit 后自然宽应等于容器宽（≤2px）：${r.natural} vs ${r.target}`);
});

test('出血 bleed="x"：元素左右边到画布 0', async () => {
  const tab = await open(`
<vk-page>
  <vk-box id="bl" bleed="x" h="120" surface="tint" pad="sm"><vk-text size="body">出血</vk-text></vk-box>
  <vk-box id="in" h="120" surface="paper" pad="sm"><vk-text size="body">版心内</vk-text></vk-box>
</vk-page>`);
  const r = await tab.evaluate(() => {
    const page = document.querySelector('vk-page .vk-page').getBoundingClientRect();
    const a = document.querySelector('#bl').getBoundingClientRect();
    const b = document.querySelector('#in').getBoundingClientRect();
    const el = document.querySelector('#bl');
    return {
      pageLeft: page.left,
      pageRight: page.right,
      a,
      b,
      bleed: el.dataset.bleed,
      parent: el.parentElement.className,
      marginLeft: getComputedStyle(el).marginLeft,
      width: getComputedStyle(el).width,
    };
  });
  assert.equal(r.bleed, 'x', `bleed 应镜像到 data-bleed：${JSON.stringify(r)}`);
  assert.ok(Math.abs(r.a.left - r.pageLeft) <= 1, `出血元素左边应到 0：${r.a.left} vs ${r.pageLeft} ${JSON.stringify(r)}`);
  assert.ok(Math.abs(r.a.right - r.pageRight) <= 1, `出血元素右边应到画布右缘：${r.a.right} vs ${r.pageRight}`);
  assert.ok(r.b.left > r.pageLeft + 100, `不写 bleed 的元素仍在版心里：${r.b.left}`);
});

test('vk-pair split="30"：左右两块 30 / 70', async () => {
  const tab = await open(`
<vk-page><div style="width:1200px">
  <vk-pair split="30" gap="24" axis="line">
    <vk-box surface="soft"><vk-text size="body">左</vk-text></vk-box>
    <vk-box surface="soft"><vk-text size="body">右</vk-text></vk-box>
  </vk-pair>
</div></vk-page>`);
  const r = await tab.evaluate(() => {
    const l = document.querySelector('.vk-pair-l').getBoundingClientRect().width;
    const rr = document.querySelector('.vk-pair-r').getBoundingClientRect().width;
    return { l, r: rr };
  });
  const total = r.l + r.r;
  assert.ok(Math.abs(r.l / total - 0.3) < 0.01, `左块应占 30%：${(r.l / total).toFixed(3)}`);
  assert.ok(Math.abs(r.r / total - 0.7) < 0.01, `右块应占 70%：${(r.r / total).toFixed(3)}`);
});

test('铺满 fill：cover 的图用 object-fit 填满且不变形', async () => {
  const tab = await open(`
<vk-page><div id="box" style="width:400px;height:225px">
  <vk-img id="im" fill="cover" w="400" h="225" src="../assets/img/sample.svg" alt="示例"></vk-img>
</div></vk-page>`);
  const r = await tab.evaluate(() => {
    const host = document.querySelector('#im');
    const img = host.querySelector('img');
    const hr = host.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    return {
      fit: getComputedStyle(img).objectFit,
      hostW: hr.width,
      hostH: hr.height,
      imgW: ir.width,
      imgH: ir.height,
      radius: getComputedStyle(host.querySelector('.vk-img')).overflow,
    };
  });
  assert.equal(r.fit, 'cover', 'fill="cover" 必须落到 object-fit: cover');
  assert.ok(Math.abs(r.imgW - r.hostW) <= 1 && Math.abs(r.imgH - r.hostH) <= 1, `图片应铺满 400×225：${r.imgW}×${r.imgH}`);
  assert.ok(Math.abs(r.imgW / r.imgH - 400 / 225) < 0.02, `外框仍是 400×225，不因 fill 变形：${r.imgW}×${r.imgH}`);
  assert.equal(r.radius, 'hidden', '铺满时超出部分由 .vk-img 裁掉');
});

test('叠层 vk-layer：第一个铺底、其余叠上，文字有可读性保护', async () => {
  const tab = await open(`
<vk-page>
  <vk-layer id="ly" style="height:420px" surface="wash">
    <vk-img src="../assets/img/sample.svg" alt="底图" fill="cover" radius="none"></vk-img>
    <vk-text id="top" size="body">叠在图上的一句话</vk-text>
  </vk-layer>
  <vk-layer id="plain" style="height:200px" readable="off" surface="wash">
    <vk-text id="off" size="body">不加保护</vk-text>
  </vk-layer>
</vk-page>`);
  const r = await tab.evaluate(() => {
    const ly = document.querySelector('#ly');
    const kids = [...ly.children];
    const top = document.querySelector('#top');
    const tr = top.getBoundingClientRect();
    const hit = document.elementFromPoint(tr.left + 24, tr.top + 24);
    return {
      z: kids.map((k) => getComputedStyle(k).zIndex),
      pos: kids.map((k) => getComputedStyle(k).position),
      height: ly.getBoundingClientRect().height,
      shadow: getComputedStyle(top).textShadow,
      offShadow: getComputedStyle(document.querySelector('#off')).textShadow,
      onTop: hit === top || top.contains(hit),
    };
  });
  assert.deepEqual(r.pos, ['absolute', 'absolute'], '所有子元素都绝对定位铺满');
  assert.ok(Number(r.z[0]) < Number(r.z[1]), `第一个铺底、第二个叠上：${r.z}`);
  assert.ok(Math.abs(r.height - 420) <= 1, `layer 高度由 h 决定：${r.height}`);
  assert.notEqual(r.shadow, 'none', `默认给文字加可读性描边：${r.shadow}`);
  assert.equal(r.offShadow, 'none', `readable="off" 关掉描边：${r.offShadow}`);
  assert.ok(r.onTop, '叠在上面的文字应是最上层命中元素');
});

test('五档底色 surface：paper / wash / tint / dark / accent 的底与字色', async () => {
  const tab = await open(`
<vk-page><vk-stack gap="sm">
  <vk-panel id="paper" surface="paper" pad="sm"><vk-text size="body">paper</vk-text></vk-panel>
  <vk-panel id="wash" surface="wash" tone="info" pad="sm"><vk-text size="body">wash</vk-text></vk-panel>
  <vk-panel id="tint" surface="tint" tone="focus" pad="sm"><vk-text size="body">tint</vk-text></vk-panel>
  <vk-panel id="dark" surface="dark" pad="sm"><vk-text size="body">dark</vk-text></vk-panel>
  <vk-panel id="accent" surface="accent" tone="ok" pad="sm"><vk-text size="body">accent</vk-text></vk-panel>
</vk-stack></vk-page>`);
  const r = await tab.evaluate(() =>
    ['paper', 'wash', 'tint', 'dark', 'accent'].map((id) => {
      const el = document.querySelector('#' + id);
      const cs = getComputedStyle(el);
      return { id, bg: cs.backgroundColor, color: cs.color };
    })
  );
  const by = Object.fromEntries(r.map((x) => [x.id, x]));
  const rgb = (s) => s.replace(/\s+/g, '');
  assert.equal(rgb(by.paper.bg), 'rgb(255,255,255)', `paper 底应为纯白：${by.paper.bg}`);
  assert.equal(rgb(by.wash.bg), 'rgb(237,238,240)', `wash(info) 底：${by.wash.bg}`);
  assert.equal(rgb(by.tint.bg), 'rgb(205,213,246)', `tint(focus) 底：${by.tint.bg}`);
  assert.equal(rgb(by.dark.bg), 'rgb(11,15,20)', `dark 底应为墨：${by.dark.bg}`);
  assert.equal(rgb(by.accent.bg), 'rgb(10,107,87)', `accent + tone=ok 应为实色 ok：${by.accent.bg}`);
  // 深色底必须用浅字；accent 也反白。
  assert.equal(rgb(by.dark.color), 'rgb(255,255,255)', `dark 的字应为纸色：${by.dark.color}`);
  assert.equal(rgb(by.accent.color), 'rgb(255,255,255)', `accent 的字应反白：${by.accent.color}`);
  // 浅底仍是墨字。
  for (const id of ['paper', 'wash', 'tint']) {
    assert.equal(rgb(by[id].color), 'rgb(11,15,20)', `${id} 的字应仍是墨色：${by[id].color}`);
  }
});

after(async () => {
  for (const ctx of opened) await ctx.close().catch(() => {});
  await browser.close();
  await close();
});
