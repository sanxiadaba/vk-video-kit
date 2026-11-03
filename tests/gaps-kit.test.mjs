import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';

/**
 * demo 为塞进一页被迫"绕过"的四个能力缺口。
 *
 * 四处绕过的共同点：页内 CSS 补了库本该有的东西。
 * 这里逐条把它们变回库的属性，并且只断言观众能看见的那一层：
 * 字号档、角标与图像的重叠、行高与竖裁、气泡的不透明度与对比度。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
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
  await browser.close();
  await close();
});

/* --------------------------------------------------------------- timeline */

test('vk-timeline：value 默认 280，value-size 三档严格递增（112 / 200 / 280）', async () => {
  const item = `<li date="1972" label="峰值" value="52,980">预处理前</li>`;
  const { tab } = await open(`
    <vk-timeline id="def">${item}</vk-timeline>
    <vk-timeline id="title" value-size="title">${item}</vk-timeline>
    <vk-timeline id="sub" value-size="subhead">${item}</vk-timeline>`);
  const r = await tab.evaluate(() => {
    const fs = (id) => parseFloat(getComputedStyle(document.querySelector(`#${id} .vk-tl-value`)).fontSize);
    return { def: fs('def'), title: fs('title'), sub: fs('sub') };
  });

  assert.equal(r.def, 280, `不写 value-size 时必须还是 hero 280：${r.def}`);
  assert.equal(r.sub, 112, `value-size="subhead" 要降到 112：${r.sub}`);
  // title 别名到 display 200；subhead 别名到 headline 112。
  assert.equal(r.title, 200, `value-size="title" 是中间一档 200：${r.title}`);
  assert.ok(r.sub < r.title && r.title < r.def, `三档必须严格递增：${r.sub} / ${r.title} / ${r.def}`);
});

test('vk-timeline：value-size 非法值构建期失败，并列出可用档', async () => {
  await assert.rejects(
    () => transformHtml('<vk-timeline value-size="tiny"><li value="1"></li></vk-timeline>', { file: 'p.html', highlighter: hl }),
    /value-size="tiny"[\s\S]*应该写：hero \/ title \/ subhead/,
    '非法 value-size 必须在构建期报错，并把三档列出来'
  );
});

/* ---------------------------------------------------------------- compare */

test('vk-compare：label-position="top" 时角标在图像内容区之外，默认仍叠在图上', async () => {
  const args = 'a="assets/sample-grid.svg" b="assets/sample-grid-b.svg" ratio="720 / 280" label-a="改前" label-b="改后"';
  const { tab } = await open(`
    <div style="width:900px">
      <vk-compare id="top" label-position="top" ${args}></vk-compare>
      <vk-compare id="inside" ${args}></vk-compare>
      <vk-compare id="sidetop" mode="side" label-position="top" ${args}></vk-compare>
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

/* ----------------------------------------------------------------- window */

const DIFF = `-    char a;
+    char b;`;

test('vk-window：mass 三档真正压到 diff 行高，compact 不竖裁', async () => {
  const win = (mass) =>
    `<vk-window id="${mass}" mass="${mass}" chrome="none" pad="md"><vk-diff chrome="none" numbers="none" summary="none">${DIFF}</vk-diff></vk-window>`;
  const { tab } = await open(win('compact') + win('normal') + win('hero'));
  const r = await tab.evaluate(() => {
    const read = (id) => {
      const host = document.getElementById(id);
      const diff = host.querySelector('vk-diff');
      const lines = [...host.querySelectorAll('.vk-dline')];
      const lens = lines.map((l) => {
        const a = l.getBoundingClientRect();
        const src = l.querySelector('.vk-dsrc').getBoundingClientRect();
        return {
          h: a.height,
          inside: src.top >= a.top - 0.5 && src.bottom <= a.bottom + 0.5,
          scroll: l.scrollHeight - l.clientHeight,
        };
      });
      return {
        win: host.getBoundingClientRect().height,
        diff: diff.getBoundingClientRect().height,
        line: lens[0].h,
        inside: lens.every((x) => x.inside),
        scroll: Math.max(...lens.map((x) => x.scroll)),
      };
    };
    return { compact: read('compact'), normal: read('normal'), hero: read('hero') };
  });

  assert.ok(
    r.compact.diff < r.normal.diff && r.normal.diff < r.hero.diff,
    `同一份 diff 的三档高度必须严格递增：${r.compact.diff} / ${r.normal.diff} / ${r.hero.diff}`
  );
  assert.ok(
    r.compact.win < r.normal.win && r.normal.win < r.hero.win,
    `窗的总高也要跟着变：${r.compact.win} / ${r.normal.win} / ${r.hero.win}`
  );
  // 15.x：56px 字下三档行高 = max(58/70/88, 56 × 1.35/1.55/1.9) → 76 / 87 / 106。
  assert.equal(Math.round(r.compact.line), 76, `compact 的 diff 行高应是 76：${r.compact.line}`);
  assert.equal(Math.round(r.normal.line), 87, `normal 是 87：${r.normal.line}`);
  assert.equal(Math.round(r.hero.line), 106, `hero 是 106：${r.hero.line}`);
  // 竖裁：行盒比字矮时字会被 overflow:hidden 切掉上下沿。
  assert.ok(r.compact.inside, 'compact 下正文必须完整落在行盒里');
  assert.ok(r.compact.scroll <= 3, `compact 行盒的纵向溢出应可忽略：${r.compact.scroll}`);
});

test('vk-window：窗的 mass 也传给代码行（vk-code 不写自己的 mass 时跟随窗）', async () => {
  const code = (mass) =>
    `<vk-window id="c-${mass}" mass="${mass}" chrome="none" pad="md"><vk-code lang="c" chrome="none">${`int main(void) { return 0; }`}</vk-code></vk-window>`;
  const { tab } = await open(code('compact') + code('normal') + code('hero'));
  const r = await tab.evaluate(() => {
    const h = (mass) => {
      const host = document.getElementById('c-' + mass);
      const line = host.querySelector('.vk-line');
      const b = line.getBoundingClientRect();
      return { h: b.height, fs: parseFloat(getComputedStyle(line).fontSize) };
    };
    return { compact: h('compact'), normal: h('normal'), hero: h('hero') };
  });
  assert.ok(
    r.compact.h < r.normal.h && r.normal.h < r.hero.h,
    `代码行高必须随窗的体量递增：${r.compact.h} / ${r.normal.h} / ${r.hero.h}`
  );
  assert.ok(r.compact.h >= r.compact.fs, `compact 行高不能小于字号（否则竖裁）：${r.compact.h} vs ${r.compact.fs}`);
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

test('vk-pin：emphasis="solid" 在深色底上不透明，文字/背景对比度 ≥ 4.5', async () => {
  const { tab } = await open(`
    <vk-canvas w="1200" h="480">
      <vk-box id="screen" x="40" y="80" w="680" h="320" style="background:#0d1117"></vk-box>
      <vk-pin id="p" for="#screen" emphasis="solid" w="260">越界写越界</vk-pin>
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
      <vk-pin id="short" for="#t" side="right" w="240">短批注三个字</vk-pin>
      <vk-pin id="num" for="#t" side="right" w="240" n="1">越界</vk-pin>
      <vk-pin id="long" for="#t" side="right" w="240">${long}</vk-pin>
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
