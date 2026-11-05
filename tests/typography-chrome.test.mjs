import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { startServer } from '../cli/serve.mjs';
import { transformHtml } from '../src/highlight.mjs';
import { WASH_TOKENS, readTokenCss, readHexTokens, rgbCss } from './lib/surface-tokens.mjs';

/**
 * 版式与窗头：字号、网格、版心、窗头与分区默认值。
 *
 * 四档主对比：display 200 / headline 112 / body 56 / caption 48（手机横屏基准）；
 *    旧名（label / data / subhead / title）别名到新档，hero / mega 是补充档。
 * 网格与版心：--vk-grid-cols 12 / --vk-grid-gutter 32 / --vk-margin 120；
 *    vk-grid cols="12" 的每栏宽可算（1680 - 11×32）/12。
 * 窗头：六个"外部内容"组件默认有三点；三点与窗头高度随 mass 缩放。
 * vk-panel plain 默认无框无底；底色只在 tone / border / 显式 variant 时出现。
 * kicker 是工序进度（工序 3/5 · 汇编），4px 焦点色条；不许写文件名 / 页号。
 */

const tokens = readHexTokens(readTokenCss());
const { base, close: closeServer } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
const opened = [];

async function open(body, pageAttr = '') {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tab = await ctx.newPage();
  opened.push(ctx);
  await tab.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body><vk-page ${pageAttr}>${body}</vk-page><script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return tab;
}

async function openSpecimen(tag) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tab = await ctx.newPage();
  opened.push(ctx);
  await tab.goto(`${base}/specimens/${tag}.html`, { waitUntil: 'load' });
  await tab.evaluate(() => window.vk.ready());
  return tab;
}

const settle = (tab) =>
  tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

after(async () => {
  for (const ctx of opened) await ctx.close().catch(() => {});
  await closeBrowser(browser);
  await closeServer();
});

/* --------------------------------------------------------------- E1 字号 */

test('四档字号：display / headline / body / caption 的字号与行高', async () => {
  const tab = await open(`
    <vk-text id="d" size="display">答案</vk-text>
    <vk-text id="h" size="headline">标题</vk-text>
    <vk-text id="b" size="body">正文</vk-text>
    <vk-text id="c" size="caption">标签</vk-text>`);
  const r = await tab.evaluate(() => {
    const read = (id) => {
      const cs = getComputedStyle(document.getElementById(id));
      return { size: cs.fontSize, lh: cs.lineHeight, weight: cs.fontWeight };
    };
    return {
      d: read('d'),
      h: read('h'),
      b: read('b'),
      c: read('c'),
      tokens: ['display', 'headline', 'body', 'caption'].map((n) =>
        getComputedStyle(document.documentElement).getPropertyValue(`--vk-t-${n}`).trim()
      ),
    };
  });
  // 字号：四档分别是 200 / 112 / 56 / 48（手机横屏基准）。
  assert.deepEqual(
    [r.d.size, r.h.size, r.b.size, r.c.size],
    ['200px', '112px', '56px', '48px'],
    `四档字号不对：${JSON.stringify([r.d.size, r.h.size, r.b.size, r.c.size])}`
  );
  // 行高：200→210 / 112→130 / 56→78 / 48→64。
  assert.deepEqual(
    [r.d.lh, r.h.lh, r.b.lh, r.c.lh],
    ['210px', '130px', '78px', '64px'],
    `四档行高不对：${JSON.stringify([r.d.lh, r.h.lh, r.b.lh, r.c.lh])}`
  );
  assert.deepEqual(r.tokens, ['200px', '112px', '56px', '48px'], '四个 --vk-t-* token 必须是这四档');
  assert.equal(r.d.weight, '600', 'display 是 bold（700 在 0.4× 下又黑又土）');
});

test('旧字号名仍解析到合理档位（label / data / subhead / title / hero / mega）', async () => {
  const tab = await open(`
    <vk-text id="label" size="label">行号</vk-text>
    <vk-text id="data" size="data" mono>0x2a</vk-text>
    <vk-text id="subhead" size="subhead">小标题</vk-text>
    <vk-text id="title" size="title">页标题</vk-text>
    <vk-text id="hero" size="hero">42</vk-text>
    <vk-text id="mega" size="mega">一词</vk-text>`);
  const r = await tab.evaluate(() => {
    const out = {};
    for (const id of ['label', 'data', 'subhead', 'title', 'hero', 'mega']) {
      const cs = getComputedStyle(document.getElementById(id));
      out[id] = { size: cs.fontSize, mono: /mono/i.test(cs.fontFamily) };
    }
    return out;
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.size])),
    { label: '48px', data: '56px', subhead: '112px', title: '200px', hero: '280px', mega: '400px' },
    `旧名必须落到合理档位：${JSON.stringify(r)}`
  );
  assert.equal(r.data.mono, true, 'data 是 body 的字号 + 等宽字体（这是它和 body 的唯一区别）');
});

test('display 在全库唯一：200px 只出现在 --vk-t-display 一处', () => {
  const css = fs.readFileSync('src/tokens/tokens.css', 'utf8');
  const hits = [...css.matchAll(/^\s*(--vk-t-[\w-]+)\s*:\s*200px\s*;/gm)].map((m) => m[1]);
  assert.deepEqual(hits, ['--vk-t-display'], `200px 只能有 --vk-t-display 一个来源：${JSON.stringify(hits)}`);
});

/* --------------------------------------------------------------- E2 网格 */

test('vk-grid cols="12"：每栏宽 = (1680 - 11 × 32) / 12', async () => {
  const cells = Array.from({ length: 12 }, (_, i) => `<div class="cell" data-i="${i}"></div>`).join('');
  const tab = await open(`<vk-grid id="g" cols="12">${cells}</vk-grid>`);
  const r = await tab.evaluate(() => {
    const grid = document.getElementById('g');
    const kids = [...grid.children].map((el) => el.getBoundingClientRect());
    const cs = getComputedStyle(grid);
    return {
      gridW: grid.getBoundingClientRect().width,
      gap: cs.columnGap,
      first: kids[0].width,
      span: kids[kids.length - 1].right - kids[0].left,
      tokens: ['--vk-grid-cols', '--vk-grid-gutter', '--vk-margin'].map((n) =>
        getComputedStyle(document.documentElement).getPropertyValue(n).trim()
      ),
    };
  });
  const want = (1680 - 11 * 32) / 12;
  assert.ok(Math.abs(r.gridW - 1680) < 0.6, `1680 版心里 grid 宽应为 1680：${r.gridW}`);
  assert.equal(r.gap, '32px', `默认沟槽应为 --vk-grid-gutter 32：${r.gap}`);
  assert.ok(Math.abs(r.first - want) < 0.6, `每栏宽应为 ${want.toFixed(3)}：${r.first}`);
  assert.ok(Math.abs(r.span - 1680) < 0.6, `12 栏首尾合计应为 1680：${r.span}`);
  assert.deepEqual(r.tokens, ['12', '32px', '120px'], `E2 三个 token 不对：${JSON.stringify(r.tokens)}`);
});

test('版心：vk-page 内距 120，.vk-frame 宽 1680', async () => {
  const tab = await open('<div class="vk-frame" id="f" style="height: 8px"></div>');
  const r = await tab.evaluate(() => ({
    pagePad: getComputedStyle(document.querySelector('.vk-page')).paddingLeft,
    frameW: document.querySelector('#f').getBoundingClientRect().width,
    bdW: document.querySelector('.vk-page-bd').getBoundingClientRect().width,
  }));
  assert.equal(r.pagePad, '120px', 'vk-page 的默认内距必须是 --vk-margin：120px');
  assert.ok(Math.abs(r.bdW - 1680) < 0.6, `版心列宽应为 1680：${r.bdW}`);
  assert.ok(Math.abs(r.frameW - 1680) < 0.6, `.vk-frame 最宽 1680：${r.frameW}`);
});

/* --------------------------------------------------------------- F1 窗头 */

const CONTENT = ['vk-code', 'vk-term', 'vk-asm', 'vk-tree', 'vk-bytes', 'vk-diff'];

test('六个内容组件默认都有三点窗头，vk-panel 没有', async () => {
  for (const tag of CONTENT) {
    const tab = await openSpecimen(tag);
    const r = await tab.evaluate((t) => {
      const host = document.querySelector(t);
      const dot = host?.querySelector('.vk-dots');
      return { dots: !!dot, count: dot ? dot.children.length : 0 };
    }, tag);
    assert.equal(r.dots, true, `${tag} 默认没有三点窗头`);
    assert.equal(r.count, 3, `${tag} 的点不是三个`);
    await tab.close();
  }
  const tab = await open(
    '<vk-panel id="p" title="分区"><vk-text size="body">x</vk-text></vk-panel>' +
      '<vk-panel id="d" variant="dark" title="深色"><vk-text size="body">y</vk-text></vk-panel>'
  );
  const n = await tab.evaluate(() => document.querySelectorAll('vk-panel .vk-dots').length);
  assert.equal(n, 0, 'vk-panel 是版面容器，永远不该带三点');
});

test('三点直径随 mass 缩放：compact 12 / normal 16 / hero 20', async () => {
  for (const tag of CONTENT) {
    const tab = await openSpecimen(tag);
    for (const [mass, dot, hd] of [
      ['compact', '12px', '56px'],
      ['normal', '16px', '72px'],
      ['hero', '20px', '88px'],
    ]) {
      await tab.evaluate(
        ({ t, m }) => {
          document.querySelector(t).setAttribute('mass', m);
        },
        { t: tag, m: mass }
      );
      await settle(tab);
      const r = await tab.evaluate((t) => {
        const host = document.querySelector(t);
        const dotEl = host.querySelector('.vk-dots i');
        const rootSel =
          t === 'vk-asm' ? 'vk-asm .vk-asm' : t === 'vk-tree' ? 'vk-tree .vk-tree' : `${t} .vk-win`;
        const root = document.querySelector(rootSel);
        return {
          dot: dotEl ? getComputedStyle(dotEl).width : '0px',
          hd: root ? getComputedStyle(root).getPropertyValue('--vk-win-hd').trim() : '0px',
          hdBox: root ? getComputedStyle(root).height : '',
        };
      }, tag);
      assert.equal(r.dot, dot, `${tag}/${mass} 的点直径应为 ${dot}，实际 ${r.dot}`);
      assert.equal(r.hd, hd, `${tag}/${mass} 的窗头高度变量应为 ${hd}，实际 ${r.hd}`);
    }
    await tab.close();
  }
});

test('chrome="none" 构建期提醒放到有上下文的容器里', async () => {
  const warn = console.warn;
  const got = [];
  console.warn = (...a) => got.push(a.join(' '));
  try {
    await transformHtml('<vk-term chrome="none" title="steps.txt">$ echo hi\nhi</vk-term>', { file: 'w.html' });
  } finally {
    console.warn = warn;
  }
  assert.match(got.join('\n'), /无窗头的代码\/终端应放在提供上下文的容器里（如 vk-panel 的 title）/, got.join('\n'));
});

/* --------------------------------------------------------------- F2 面板 */

test('vk-panel plain 默认无框无底，tone 才有 wash', async () => {
  const tab = await open(`
    <vk-panel id="plain" title="分区"><vk-text size="body">内容</vk-text></vk-panel>
    <vk-panel id="tone" tone="info" title="分区"><vk-text size="body">内容</vk-text></vk-panel>
    <vk-panel id="b" border="hair"><vk-text size="body">内容</vk-text></vk-panel>`);
  const r = await tab.evaluate(() => {
    const read = (id) => {
      const el = document.getElementById(id);
      const cs = getComputedStyle(el);
      const hd = el.querySelector('.vk-panel-hd');
      return {
        bg: cs.backgroundColor,
        border: cs.borderTopWidth,
        hd: hd ? getComputedStyle(hd).backgroundColor : null,
      };
    };
    return { plain: read('plain'), tone: read('tone'), border: read('b') };
  });
  assert.equal(r.plain.bg, 'rgba(0, 0, 0, 0)', `默认 panel 的底必须透明：${r.plain.bg}`);
  assert.equal(r.plain.border, '0px', `默认 panel 不能有边框：${r.plain.border}`);
  assert.equal(r.plain.hd, 'rgba(0, 0, 0, 0)', `默认 panel 的标题带也透明：${r.plain.hd}`);
  assert.equal(r.tone.bg, rgbCss(tokens[WASH_TOKENS.info]), `tone="info" 才是 wash 底：${r.tone.bg}`);
  assert.equal(r.border.border, '2px', `border="hair" 才出现描边：${r.border.border}`);
});

/* --------------------------------------------------------------- F3 页眉 */

test('vk-kicker 工序进度：工序 3/5 · 汇编，色条 4px', async () => {
  const tab = await open('<vk-label id="k" variant="kicker" index="3" total="5" section="汇编"></vk-label>');
  const r = await tab.evaluate(() => {
    const host = document.getElementById('k');
    const rule = host.querySelector('.vk-label-rule');
    const label = host.querySelector('.vk-label');
    return {
      text: host.querySelector('.vk-label-t')?.textContent,
      size: getComputedStyle(label).fontSize,
      ruleW: rule ? getComputedStyle(rule).width : '0px',
      ruleBg: rule ? getComputedStyle(rule).backgroundColor : '',
    };
  });
  assert.equal(r.text, '工序 3/5 · 汇编', `kicker 必须渲染成工序进度：${r.text}`);
  assert.equal(r.size, '48px', `kicker 用 caption 档（48px）：${r.size}`);
  assert.equal(r.ruleW, '4px', `左侧色条必须是 4px：${r.ruleW}`);
  assert.equal(r.ruleBg, 'rgb(27, 63, 214)', `色条用焦点色：${r.ruleBg}`);
});

test('kicker 含文件名 / 页号时构建期给出提醒', async () => {
  const warn = console.warn;
  const got = [];
  console.warn = (...a) => got.push(a.join(' '));
  try {
    await transformHtml('<vk-label variant="kicker">源码 · hello.c</vk-label>', { file: 'k1.html' });
    await transformHtml('<vk-label variant="kicker">第 3 页 · 汇编</vk-label>', { file: 'k2.html' });
  } finally {
    console.warn = warn;
  }
  const text = got.join('\n');
  assert.match(text, /出现了文件名（\.c \/ \.s \/ \.exe 等）/, text);
  assert.match(text, /写的是页号（第 N 页 \/ N 帧）/, text);
});
