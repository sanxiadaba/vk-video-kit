import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';

/**
 * L1 · vk-text 的 tone 与 vk-label 原语。
 *
 *   1. tone 五值各渲染出对应颜色，且与 vk-icon 同一套 token（同一组色值）；
 *   2. 不写 tone 时仍是墨阶 —— 旧页面的像素不变；
 *   3. 非法值在构建期报错，并把可用值列出来；
 *   4. vk-label 的四种组合（variant × tone × icon）与「没写 icon 就没有图标槽」。
 */

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
<body><vk-page><vk-stack gap="md">${body}</vk-stack></vk-page><script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return tab;
}

const color = (tab, sel) => tab.evaluate((s) => getComputedStyle(document.querySelector(s)).color, sel);
const bg = (tab, sel) => tab.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel);

/* --------------------------------------------------------------- vk-text tone */

/** 语义色的「文字档」：info / focus 复用原色，ok / err / warn 深一档到 ≥7:1。 */
const TEXT_TONE = {
  info: 'rgb(58, 68, 84)', // #3a4454
  focus: 'rgb(27, 63, 214)', // #1b3fd6
  ok: 'rgb(7, 84, 74)', // #07544a
  err: 'rgb(143, 29, 23)', // #8f1d17
  warn: 'rgb(110, 60, 0)', // #6e3c00
};

test('vk-text：tone 五值各渲染出对应颜色', async () => {
  const tabs = {};
  for (const tone of Object.keys(TEXT_TONE)) {
    const tab = await open(`<vk-text id="t" size="body" tone="${tone}">一段话</vk-text>`);
    tabs[tone] = await color(tab, '#t');
  }
  for (const [tone, want] of Object.entries(TEXT_TONE)) {
    assert.equal(tabs[tone], want, `tone="${tone}" 应为 ${want}，实际 ${tabs[tone]}`);
  }
});

test('vk-text：不写 tone 时保持墨阶（默认 primary）', async () => {
  const tab = await open('<vk-text id="t" size="body">一段话</vk-text>');
  assert.equal(await color(tab, '#t'), 'rgb(11, 15, 20)', '默认必须仍是 ink=primary，逐像素不变');
});

test('vk-text：tone 覆盖 ink，且与 vk-icon 同色', async () => {
  const tab = await open(
    '<vk-text id="t" size="body" ink="primary" tone="ok">对</vk-text><vk-icon id="i" name="circle-check" tone="ok"></vk-icon>'
  );
  assert.equal(await color(tab, '#t'), TEXT_TONE.ok);
  // 图标用的是原色（底/线/图标档），文字用的是文字档：同一语义、两个用途。
  const iconColor = await tab.evaluate(() => getComputedStyle(document.querySelector('#i .vk-icon')).color);
  assert.equal(iconColor, 'rgb(10, 107, 87)', 'vk-icon 的 ok 仍是 --vk-ok（#0a6b57）');
});

test('vk-text：act="focus" 与 strength 覆盖「高亮一段文字」', async () => {
  const strong = await open('<vk-text id="t" size="body" act="focus">这里</vk-text>');
  assert.equal(await color(strong, '#t'), TEXT_TONE.focus, 'solid：整段取焦点色');
  const soft = await open('<vk-text id="t" size="body" act="focus" strength="soft">这里</vk-text>');
  const softColor = await color(soft, '#t');
  assert.notEqual(softColor, TEXT_TONE.focus, 'soft：与主墨混一档，比 solid 淡');
  assert.notEqual(softColor, 'rgb(11, 15, 20)', 'soft 仍是语义色，不是纯墨色');
  const ghost = await open('<vk-text id="t" size="body" act="focus" strength="ghost">这里</vk-text>');
  assert.equal(await color(ghost, '#t'), 'rgb(11, 15, 20)', 'ghost：字回墨色');
  const bar = await ghost.evaluate(() => getComputedStyle(document.querySelector('#t')).boxShadow);
  assert.match(bar, /inset/, 'ghost 只剩一条左侧色条');
  assert.match(bar, /rgb\(27, 63, 214\)/, '色条用的是同一个焦点色');
});

test('vk-text：非法 tone 在构建期报错并列出可用值', async () => {
  const hl = await createVkHighlighter(['c']);
  await assert.rejects(
    () => transformHtml('<vk-text tone="danger">x</vk-text>', { file: 'tone.html', highlighter: hl }),
    (e) => {
      assert.match(e.message, /的 tone 不在词表里/);
      assert.match(e.message, /info \/ focus \/ ok \/ err \/ warn/);
      return true;
    }
  );
});

/* ------------------------------------------------------------------ vk-label */

test('vk-label：kicker / chip / badge 三种形态的底不一样', async () => {
  const tab = await open(
    '<vk-label id="k" variant="kicker">第 3 步</vk-label>' +
      '<vk-label id="c" variant="chip">已完成</vk-label>' +
      '<vk-label id="b" variant="badge" tone="focus">3</vk-label>'
  );
  assert.equal(await bg(tab, '#k .vk-label'), 'rgba(0, 0, 0, 0)', 'kicker 是纯文字，没有底');
  const chip = await bg(tab, '#c .vk-label');
  assert.notEqual(chip, 'rgba(0, 0, 0, 0)', 'chip 必须有浅底');
  const badge = await bg(tab, '#b .vk-label');
  assert.equal(badge, TEXT_TONE.focus, 'badge 是实色：底就是语义色');
  assert.equal(await color(tab, '#b .vk-label'), 'rgb(255, 255, 255)', '实色底上的字是白色');
});

test('vk-label：默认 ink=muted，tone 覆盖 ink', async () => {
  const tab = await open(
    '<vk-label id="d">默认</vk-label><vk-label id="o" ink="primary">主墨</vk-label><vk-label id="e" tone="err">越界</vk-label>'
  );
  assert.equal(await color(tab, '#d'), 'rgb(92, 102, 116)', '默认 muted（#5c6674）');
  assert.equal(await color(tab, '#o'), 'rgb(11, 15, 20)');
  assert.equal(await color(tab, '#e'), TEXT_TONE.err);
});

test('vk-label：写 icon 才有图标槽，不写就没有', async () => {
  const tab = await open(
    '<vk-label id="with" icon="circle-check" tone="ok">已完成</vk-label><vk-label id="without">没图标</vk-label>'
  );
  const withSlot = await tab.evaluate(() => {
    const el = document.querySelector('#with .vk-label');
    const slot = el.querySelector('.vk-label-ic');
    const kids = [...el.children];
    return {
      slot: !!slot,
      svg: !!slot?.querySelector('svg'),
      iconBeforeText: kids.indexOf(slot) >= 0 && kids.indexOf(slot) < kids.indexOf(el.querySelector('.vk-label-t')),
    };
  });
  assert.ok(withSlot.slot, 'icon="circle-check" 必须出现 .vk-label-ic');
  assert.ok(withSlot.svg, '图标槽里必须真有 svg');
  assert.equal(withSlot.iconBeforeText, true, '图标在文字前面（kicker 的 4px 色条更前）');
  const without = await tab.evaluate(() => ({
    slot: !!document.querySelector('#without .vk-label-ic'),
    text: document.querySelector('#without .vk-label-t')?.textContent,
  }));
  assert.equal(without.slot, false, '没写 icon 时不该有图标槽（不留空节点）');
  assert.equal(without.text, '没图标', '文字原样保留');
});

test('vk-label：badge 的序号用等宽数字', async () => {
  const tab = await open('<vk-label id="b" variant="badge">3</vk-label>');
  const ff = await tab.evaluate(() => getComputedStyle(document.querySelector('#b .vk-label')).fontFamily);
  assert.match(ff, /mono/i);
});

test('vk-label：非法 icon 在构建期报错', async () => {
  const hl = await createVkHighlighter(['c']);
  await assert.rejects(
    () => transformHtml('<vk-label icon="nope">x</vk-label>', { file: 'icon.html', highlighter: hl }),
    /vk-label> 的 icon 没有图标 "nope"/
  );
});

after(async () => {
  for (const ctx of opened) await ctx.close().catch(() => {});
  await browser.close();
  await closeServer();
});
