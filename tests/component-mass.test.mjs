import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { startServer } from '../cli/serve.mjs';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';

/**
 * 组件体量：字号档、角标、行高与气泡对比度。
 *
 * 四处共同点：这些本应是库的属性，而不是页内 CSS。
 * 这里逐条把它们变回库的属性，并且只断言观众能看见的那一层：
 * 字号档、角标与图像的重叠、行高与竖裁、气泡的不透明度与对比度。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
const opened = [];
const hl = await createVkHighlighter(['c']);

const SHELL = (body) => `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body>${body}<script src="dist/vk.js"></script></body></html>`;

async function open(body) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const tab = await ctx.newPage();
  opened.push(ctx);
  const logs = [];
  tab.on('console', (m) => logs.push(m.text()));
  tab.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await tab.setContent(SHELL(body), { waitUntil: 'load' });
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await tab.waitForTimeout(120);
  return { tab, logs };
}

after(async () => {
  for (const ctx of opened) await ctx.close().catch(() => {});
  await closeBrowser(browser);
  await close();
});

/* --------------------------------------------------------------- timeline */

test('vk-timeline：value 默认 200，size 三档严格递增（112 / 200 / 280）', async () => {
  const item = `<li date="1972" label="峰值" value="52,980">预处理前</li>`;
  const { tab } = await open(`
    <vk-timeline id="def">${item}</vk-timeline>
    <vk-timeline id="hero" size="hero">${item}</vk-timeline>
    <vk-timeline id="sub" size="subhead">${item}</vk-timeline>`);
  const r = await tab.evaluate(() => {
    const fs = (id) => parseFloat(getComputedStyle(document.querySelector(`#${id} .vk-tl-value`)).fontSize);
    return { def: fs('def'), hero: fs('hero'), sub: fs('sub') };
  });

  assert.equal(r.def, 200, `不写 size 时默认 title 200（一帧三个数字不撑爆）：${r.def}`);
  assert.equal(r.sub, 112, `size="subhead" 要降到 112：${r.sub}`);
  // hero 280 是补充档，显式写才用；title 别名到 display 200。
  assert.equal(r.hero, 280, `size="hero" 是最大一档 280：${r.hero}`);
  assert.ok(r.sub < r.def && r.def < r.hero, `三档必须严格递增：${r.sub} / ${r.def} / ${r.hero}`);
});

test('vk-timeline：size 非法值构建期失败，并列出可用档', async () => {
  await assert.rejects(
    () => transformHtml('<vk-timeline size="tiny"><li value="1"></li></vk-timeline>', { file: 'p.html', highlighter: hl }),
    /size="tiny"[\s\S]*应该写：mega \/ hero \/ display \/ headline/,
    '非法 value-size 必须在构建期报错，并把三档列出来'
  );
});

/* ---------------------------------------------------------------- compare */

test('vk-compare：label-position="top" 时角标在图像内容区之外，默认仍叠在图上', async () => {
  const args = 'a="assets/sample-grid.svg" b="assets/sample-grid-b.svg" ratio="720 / 280" labels="改前|改后"';
  const { tab } = await open(`
    <div style="width:900px">
      <vk-compare id="top" label-position="top" ${args}></vk-compare>
      <vk-compare id="inside" ${args}></vk-compare>
      <vk-compare id="sidetop" variant="side" label-position="top" ${args}></vk-compare>
    </div>`);
  const r = await tab.evaluate(() => {
    const rect = (el) => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height };
    };
    const read = (id) => {
      const host = document.getElementById(id);
      const shell = host.querySelector('.vk-cmp');
      return {
        pad: getComputedStyle(shell).paddingTop,
        shell: rect(shell),
        a: rect(host.querySelector('.vk-cmp-a')),
        b: rect(host.querySelector('.vk-cmp-b')),
        la: rect(host.querySelector('.vk-cmp-la')),
        lb: rect(host.querySelector('.vk-cmp-lb')),
      };
    };
    return { top: read('top'), inside: read('inside'), sidetop: read('sidetop') };
  });

  // top：两个角标的底边都在图像顶边之上 —— 一个字都不压。
  assert.equal(r.top.pad, '88px', `top 要在图上让出一条 88px 的带（caption 48 × 1.5 + 16）：${r.top.pad}`);
  assert.ok(r.top.la.bottom <= r.top.a.top + 0.5, `label-a 压住了图像：${r.top.la.bottom} > ${r.top.a.top}`);
  assert.ok(r.top.lb.bottom <= r.top.b.top + 0.5, `label-b 压住了图像：${r.top.lb.bottom} > ${r.top.b.top}`);
  // 角标仍在框内：不是靠"画到框外"来避免重叠的。
  assert.ok(r.top.la.top >= r.top.shell.top - 0.5, 'label-a 不能跑到框外');
  assert.ok(r.top.lb.top >= r.top.shell.top - 0.5, 'label-b 不能跑到框外');

  // 默认 inside：行为不变，角标仍然叠在图上（贴底）。
  assert.equal(r.inside.pad, '0px', `默认不该有顶带：${r.inside.pad}`);
  assert.ok(r.inside.la.bottom > r.inside.a.top && r.inside.la.top < r.inside.a.bottom, '默认仍要叠在图像上');
  assert.ok(r.inside.lb.bottom > r.inside.b.top && r.inside.lb.top < r.inside.b.bottom, '默认仍要叠在图像上');

  // side 也守同一条：两张图各自完整，角标在两张图之上。
  assert.ok(
    r.sidetop.la.bottom <= Math.min(r.sidetop.a.top, r.sidetop.b.top) + 0.5,
    `side 下角标也要让开图像：${r.sidetop.la.bottom} vs ${Math.min(r.sidetop.a.top, r.sidetop.b.top)}`
  );
});

/* -------------------------------------------------------------------- pin */

/** 相对亮度与对比度：和 audit.mjs 算法一致（WCAG AA）。 */
function luminance(r, g, b) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const l1 = luminance(...a);
  const l2 = luminance(...b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const rgb = (s) => s.match(/rgba?\(([^)]+)\)/)[1].split(/[ ,/]+/).filter(Boolean).map(Number);

test('vk-pin：strength="solid" 在深色底上不透明，文字/背景对比度 ≥ 4.5', async () => {
  const { tab } = await open(`
    <vk-canvas w="1200" h="480">
      <vk-box id="screen" x="40" y="80" w="680" h="320" style="background:#0d1117"></vk-box>
      <vk-note variant="bubble" id="p" for="#screen" strength="solid" w="260">越界写越界</vk-note>
    </vk-canvas>`);
  const r = await tab.evaluate(() => {
    const host = document.getElementById('p');
    const bd = host.querySelector('.vk-pin-bd');
    const t = host.querySelector('.vk-pin-t');
    const n = host.querySelector('.vk-pin-n');
    const cs = getComputedStyle(bd);
    const badge = getComputedStyle(n);
    const bg = cs.backgroundColor;
    const badgeBg = badge.backgroundColor;
    return {
      bg,
      // computed 颜色可能是 rgb(...)（alpha=1）也可能是 rgba(...,0.1)
      alpha: bg.startsWith('rgba') ? parseFloat(bg.split(',')[3]) : 1,
      badgeAlpha: badgeBg.startsWith('rgba') ? parseFloat(badgeBg.split(',')[3]) : 1,
      color: cs.color,
      badgeColor: badge.color,
      badgeBg,
      bgImage: cs.backgroundImage,
    };
  });

  assert.equal(r.alpha, 1, `solid 的气泡底色必须不透明：${r.bg}`);
  assert.equal(r.bgImage, 'none', 'solid 不该靠渐变/贴图伪装成实色');
  const ratio = contrast(rgb(r.color), rgb(r.bg));
  assert.ok(ratio >= 4.5, `solid 的字/底对比度 ${ratio.toFixed(2)} < 4.5（${r.color} on ${r.bg}）`);

  // 编号也是字：反白之后同样要过 4.5。
  assert.equal(r.badgeAlpha, 1, `solid 的编号底色也必须不透明：${r.badgeBg}`);
  const badgeRatio = contrast(rgb(r.badgeColor), rgb(r.badgeBg));
  assert.ok(badgeRatio >= 4.5, `编号的字/底对比度 ${badgeRatio.toFixed(2)} < 4.5`);
});

test('vk-pin：w=240 的短批注按内容自适应到不折行，长批注封顶 360', async () => {
  const long = '这一条批注确实比较长，需要按内容自适应加宽到上限为止，不能再折成三行来读';
  const { tab } = await open(`
    <vk-canvas w="1200" h="420">
      <vk-box id="t" x="40" y="60" w="400" h="280"></vk-box>
      <vk-note variant="bubble" id="short" for="#t" side="right" w="240">短批注三个字</vk-note>
      <vk-note variant="bubble" id="num" for="#t" side="right" w="240" n="1">越界</vk-note>
      <vk-note variant="bubble" id="long" for="#t" side="right" w="240">${long}</vk-note>
    </vk-canvas>`);
  const r = await tab.evaluate(() => {
    const read = (id) => {
      const host = document.getElementById(id);
      const bd = host.querySelector('.vk-pin-bd');
      const t = host.querySelector('.vk-pin-t');
      const cs = getComputedStyle(bd);
      const lineH = parseFloat(cs.lineHeight);
      const rect = t.getBoundingClientRect();
      return {
        w: bd.getBoundingClientRect().width,
        textW: rect.width,
        lines: Math.max(1, Math.round(rect.height / lineH)),
        lineH,
        badge: !host.querySelector('.vk-pin-n').hidden,
      };
    };
    return { short: read('short'), num: read('num'), long: read('long') };
  });

  // 短批注：作者写的 240 装不下一行，按内容加宽；上限跟着字阶走（body × 9）。
  const cap = await tab.evaluate(() => (window.vk.limits.fontBody || 56) * 9);
  assert.ok(r.short.w > 240, `短批注应从 240 加宽到一行装得下：${r.short.w}`);
  assert.ok(r.short.w <= cap + 1, `自适应加宽的上限是 ${cap}：${r.short.w}`);
  assert.ok(r.short.textW <= r.short.w, `一行必须装得下：文本 ${r.short.textW} > 气泡 ${r.short.w}`);
  assert.equal(r.short.lines, 1, `短批注不该折行（实测 ${r.short.lines} 行）`);

  // 带编号时也要把编号算进一行：宽度先量、编号后填会把编号挤到第二行。
  assert.equal(r.num.badge, true, 'n="1" 的编号要显示');
  assert.equal(r.num.lines, 1, `带编号的短批注也不该折行（实测 ${r.num.lines} 行）`);
  assert.ok(r.num.w <= cap + 1, `带编号的气泡也不超过 ${cap}：${r.num.w}`);

  // 长批注：内容再长也不无限变宽，封顶后正常折行。
  assert.equal(Math.round(r.long.w), cap, `长批注封顶 ${cap}：${r.long.w}`);
  assert.ok(r.long.lines > 1, '封顶之后该折行就折行，不能溢出气泡');
});
