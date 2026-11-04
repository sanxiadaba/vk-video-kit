import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';
import {
  TONES,
  WASH_TOKENS,
  TINT_TOKENS,
  DARK_WASH_TOKENS,
  DARK_TINT_TOKENS,
  PANEL_BASE_TOKEN,
  PANEL_HEADER_BASE_TOKEN,
  readTokenCss,
  readHexTokens,
  rgbCss,
} from './lib/surface-tokens.mjs';

/**
 * L1 · vk-panel
 *
 *   1. 四档表面 × 六种 tone 的底色必须与 token 规范一致；
 *   2. 标题带里是 vk-label，title 改了字跟着改，没 title 就没有标题带；
 *   3. 底不透明，能当 vk-stack / vk-grid 的子项；
 *   4. 内距 / 圆角 / 描边真的落到样式；
 *   5. 非法 tone / variant 在构建期报错，不静默失效。
 */

const tokens = readHexTokens(readTokenCss());
const { base, close: closeServer } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const opened = [];

async function open(body) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tab = await ctx.newPage();
  opened.push(ctx);
  await tab.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body><vk-page>${body}</vk-page><script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return tab;
}

const bg = (tab, sel) => tab.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel);

const TOKEN_OF_BG = {
  plain: PANEL_BASE_TOKEN.plain,
  raised: PANEL_BASE_TOKEN.raised,
  inset: PANEL_BASE_TOKEN.inset,
  dark: PANEL_BASE_TOKEN.dark,
};

/**
 * 规范：tone 把底染成 wash / tint / 深色 wash；标题带抬一档。
 * plain 的 neutral 是 14.4 的新默认：没有底色（transparent），null 表示"必须透明"。
 */
function expectedBg(variant, tone) {
  if (tone === 'neutral') return variant === 'plain' ? null : TOKEN_OF_BG[variant];
  if (variant === 'dark') return DARK_WASH_TOKENS[tone];
  return variant === 'inset' ? TINT_TOKENS[tone] : WASH_TOKENS[tone];
}
function expectedHd(variant, tone) {
  if (tone === 'neutral') return variant === 'plain' ? null : PANEL_HEADER_BASE_TOKEN[variant];
  if (variant === 'dark') return DARK_TINT_TOKENS[tone];
  return TINT_TOKENS[tone];
}

function matrixBody(variant) {
  return `<vk-grid cols="4" gap="xs">${TONES.map(
    (tone) =>
      `<vk-panel id="p-${variant}-${tone}" variant="${variant}" tone="${tone}" title="${tone}"><vk-text size="label">${tone}</vk-text></vk-panel>`
  ).join('')}</vk-grid>`;
}

// 测试名是字面量：能力矩阵（tools/capabilities.mjs）按名字找测试，不看模板字符串。
const VARIANT_TESTS = {
  plain: 'vk-panel variant=plain：六种 tone 的底色',
  raised: 'vk-panel variant=raised：六种 tone 的底色',
  inset: 'vk-panel variant=inset：六种 tone 的底色',
  dark: 'vk-panel variant=dark：六种 tone 的底色',
};

for (const [variant, name] of Object.entries(VARIANT_TESTS)) {
  test(name, async () => {
    const tab = await open(matrixBody(variant));
    for (const tone of TONES) {
      const bgToken = expectedBg(variant, tone);
      const want = bgToken ? rgbCss(tokens[bgToken]) : 'rgba(0, 0, 0, 0)';
      assert.equal(await bg(tab, `#p-${variant}-${tone}`), want, `${variant}/${tone} 的块底色应为 ${want}`);
      const hdToken = expectedHd(variant, tone);
      const wantHd = hdToken ? rgbCss(tokens[hdToken]) : 'rgba(0, 0, 0, 0)';
      assert.equal(
        await bg(tab, `#p-${variant}-${tone} .vk-panel-hd`),
        wantHd,
        `${variant}/${tone} 的标题带底色应为 ${wantHd}`
      );
    }
  });
}

test('vk-panel：标题带用 vk-label，title 变了就跟着变', async () => {
  const tab = await open('<vk-panel id="p" title="源文件">x</vk-panel>');
  const info = await tab.evaluate(() => {
    const hd = document.querySelector('#p .vk-panel-hd');
    return {
      hd: !!hd,
      label: !!hd?.querySelector('vk-label'),
      upgraded: !!hd?.querySelector('vk-label .vk-label'),
      text: hd?.querySelector('.vk-label-t')?.textContent,
    };
  });
  assert.deepEqual(info, { hd: true, label: true, upgraded: true, text: '源文件' }, '标题带里必须是一个已经渲染的 vk-label');

  await tab.evaluate(() => document.querySelector('#p').setAttribute('title', 'hello.c'));
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  assert.equal(
    await tab.evaluate(() => document.querySelector('#p .vk-label-t').textContent),
    'hello.c',
    'title 改了，标题带要跟着改'
  );

  await tab.evaluate(() => document.querySelector('#p').removeAttribute('title'));
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  assert.equal(
    await tab.evaluate(() => !!document.querySelector('#p .vk-panel-hd')),
    false,
    '没有 title 就不该留下空标题带'
  );
});

test('vk-panel：底不透明，能放进 vk-stack / vk-grid', async () => {
  // plain 只有在显式 tone 时才有底（默认是透明的布局区域）。
  const tab = await open(
    '<vk-grid cols="2" gap="sm"><vk-panel id="a" variant="plain" tone="info"><vk-text size="body">a</vk-text></vk-panel>' +
      '<vk-panel id="b" variant="dark" tone="ok"><vk-text size="body">b</vk-text></vk-panel></vk-grid>'
  );
  for (const id of ['#a', '#b']) {
    const c = await bg(tab, id);
    assert.match(c, /^rgb\(\d+, \d+, \d+\)$/, `${id} 的底必须是实色（alpha=1），实际 ${c}`);
  }
  const boxes = await tab.evaluate(() =>
    ['#a', '#b'].map((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })
  );
  assert.ok(boxes[0].w > 500 && boxes[1].w > 500, `两列里每块应各占一列：${JSON.stringify(boxes)}`);
  assert.equal(boxes[0].w, boxes[1].w, '同一行的两块等宽（grid 决定宽度，panel 不排别人）');
});

test('vk-panel：内距 / 圆角 / 描边按档位落到样式', async () => {
  const tab = await open(
    '<vk-panel id="d"><vk-text size="body">d</vk-text></vk-panel>' +
      '<vk-panel id="x" pad="xl" radius="none" border="strong"><vk-text size="body">x</vk-text></vk-panel>' +
      '<vk-panel id="n" border="none"><vk-text size="body">n</vk-text></vk-panel>'
  );
  const read = (sel) =>
    tab.evaluate((s) => {
      const el = document.querySelector(s);
      const cs = getComputedStyle(el);
      const bd = getComputedStyle(el.querySelector('.vk-panel-bd'));
      return { pad: bd.paddingTop, radius: cs.borderTopLeftRadius, border: cs.borderTopWidth };
    }, sel);
  assert.deepEqual(await read('#d'), { pad: '32px', radius: '12px', border: '0px' }, '默认：md / lg / 无框');
  assert.deepEqual(await read('#x'), { pad: '64px', radius: '0px', border: '4px' }, 'xl / none / strong');
  assert.equal((await read('#n')).border, '0px', 'border=none 必须真的没有边');
});

test('vk-panel：非法 tone / variant 在构建期报错', async () => {
  const hl = await createVkHighlighter(['c']);
  for (const [html, re] of [
    ['<vk-panel tone="danger">x</vk-panel>', /的 tone 不在词表里/],
    ['<vk-panel variant="glass">x</vk-panel>', /的 variant 不在词表里/],
  ]) {
    await assert.rejects(() => transformHtml(html, { file: 'panel.html', highlighter: hl }), re);
  }
});

after(async () => {
  for (const ctx of opened) await ctx.close().catch(() => {});
  await browser.close();
  await closeServer();
});
