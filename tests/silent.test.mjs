import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';

/**
 * 静默错误：画面上有一个"看起来没问题、其实是错"的东西，却没有任何检查报它。
 *
 * 这一组全是本轮在标本台里逼出来的：
 *   · vk-bits 空着 → 画一个 "?"（既不是数据也不是错误）
 *   · vk-text format → "不是数字" 被改写成 0
 *   · vk-asm chrome="none" → 留着一层壳，嵌进 vk-window 就是"窗里套窗"
 *   · vk-edge 两端重合 → 标签留在覆盖层左上角，同时抛 TypeError
 *   · vk-compare 缺图 → 只剩一块空灰板
 *   · vk-term 认不出提示符 → 整块掉成灰字
 *   · vk-cells addr 写错 → 地址列悄悄变空
 *   · vk-tree depth 截断 → 树看起来是完整的，连"几个文件"都是错的
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const opened = [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-silent-'));

const SHELL = (body) => `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body>${body}<script src="dist/vk.js"></script></body></html>`;

/** 每页一个 context，最后统一关；只关 page 会留下 context，浏览器退不出去。 */
async function open(body) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('vk-bits：没有可画的位就明说，不再画问号', async () => {
  const { tab } = await open(`
    <vk-bits id="empty"></vk-bits>
    <vk-bits id="labelOnly"><li label="标志位"></li></vk-bits>
    <vk-bits id="badDigit" value="10x101" bit-width="8"></vk-bits>
    <vk-bits id="badWord" value="hello"></vk-bits>
    <vk-bits id="ok" value="1010 1100"></vk-bits>`);
  const r = await tab.evaluate(() => {
    const q = (id) => document.getElementById(id);
    const state = (id) => ({
      stale: q(id).hasAttribute('data-vk-stale'),
      text: q(id).textContent.trim(),
      bits: q(id).querySelectorAll('.vk-bit').length,
    });
    return { empty: state('empty'), labelOnly: state('labelOnly'), badDigit: state('badDigit'), badWord: state('badWord'), ok: state('ok') };
  });
  for (const id of ['empty', 'labelOnly', 'badDigit', 'badWord']) {
    assert.equal(r[id].stale, true, `${id} 该标 stale`);
    assert.equal(r[id].text, '', `${id} 不该再画占位：${r[id].text}`);
    assert.equal(r[id].bits, 0, `${id} 不该画出一个假的位`);
  }
  assert.equal(r.ok.bits, 8, `合法的位串应该照画：${r.ok.bits}`);
});

test('vk-bits：位串比 bit-width 长时说明"只画了最后 N 位"', async () => {
  const { tab, logs } = await open('<vk-bits value="1111 0000 1111" bit-width="8"></vk-bits>');
  const bits = await tab.evaluate(() => document.querySelectorAll('.vk-bit').length);
  assert.equal(bits, 8);
  assert.match(logs.join('\n'), /只画最后 8 位/);
});

test('vk-text format：非数字原样保留，单位不被吞掉', async () => {
  const { tab } = await open(`
    <vk-text id="notnum" format="thousands">不是数字</vk-text>
    <vk-text id="mixed" format="thousands">52980 字节</vk-text>
    <vk-text id="num" format="thousands">52980</vk-text>`);
  const r = await tab.evaluate(() => ({
    notnum: document.getElementById('notnum').textContent,
    mixed: document.getElementById('mixed').textContent,
    num: document.getElementById('num').textContent,
  }));
  assert.equal(r.notnum, '不是数字', '非数字不能被改写成 0');
  assert.equal(r.mixed, '52,980 字节', '单位不能被吞掉');
  assert.equal(r.num, '52,980');
});

test('vk-asm chrome="none"：整个壳一起去掉（和 vk-code / vk-term 一致）', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  opened.push(ctx);
  const tab = await ctx.newPage();
  await tab.goto(`${base}/specimens/vk-asm.html`, { waitUntil: 'load' });
  await tab.evaluate(() => window.vk.ready());
  await tab.evaluate(() => document.querySelector('vk-asm').setAttribute('chrome', 'none'));
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await tab.waitForTimeout(120);
  const r = await tab.evaluate(() => {
    const el = document.querySelector('.vk-asm');
    const cs = getComputedStyle(el);
    return {
      chrome: el.dataset.chrome,
      border: cs.borderTopWidth,
      bg: cs.backgroundColor,
      radius: cs.borderTopLeftRadius,
      head: !!document.querySelector('.vk-asm-hd'),
    };
  });
  assert.equal(r.chrome, 'none');
  assert.equal(r.border, '0px', 'chrome="none" 还留着边框，就是"窗里套窗"');
  assert.equal(r.bg, 'rgba(0, 0, 0, 0)', 'chrome="none" 还留着底色');
  assert.equal(r.radius, '0px');
  assert.equal(r.head, false, 'chrome="none" 不该有窗头');
});

test('vk-edge：两端重合时不抛错，标签也不漂到画布角落', async () => {
  const { tab, logs } = await open(`
    <vk-text id="t1" size="body">目标一</vk-text>
    <vk-text id="t2" size="body">目标二</vk-text>
    <vk-edge id="e" from="#t1" to="#t2" label="相邻"></vk-edge>`);
  const r = await tab.evaluate(() => {
    const e = document.getElementById('e');
    const label = document.querySelector('.vk-edge-label');
    const b = label.getBoundingClientRect();
    return { err: e.hasAttribute('data-vk-error'), label: label.textContent, left: Math.round(b.left), top: Math.round(b.top) };
  });
  assert.equal(r.err, false, '两端重合不该让 draw() 抛错');
  assert.equal(r.label, '相邻');
  assert.ok(r.left >= 0 && r.top >= 0, `标签不该漂到画布外（${r.left},${r.top}）`);
  assert.match(logs.join('\n'), /起点和终点落在同一点/);
});

test('vk-compare：缺一张图要标 data-error，并在角标里说"未加载"', async () => {
  const { tab, logs } = await open('<vk-compare id="c" a="assets/sample-grid.svg"></vk-compare>');
  const r = await tab.evaluate(() => {
    const c = document.getElementById('c');
    return {
      err: c.hasAttribute('data-error'),
      shellErr: c.querySelector('.vk-cmp').hasAttribute('data-error'),
      labelB: c.querySelector('.vk-cmp-lb').textContent,
    };
  });
  assert.equal(r.err, true, '缺 b 图必须能被 audit / vk check 看见');
  assert.equal(r.shellErr, true);
  assert.match(r.labelB, /未加载/);
  assert.match(logs.join('\n'), /a 和 b/);
});

test('vk-compare：图 404 也要标 data-error，不能只剩一块空灰板', async () => {
  const { tab, logs } = await open('<vk-compare id="c" a="assets/nope-a.png" b="assets/nope-b.png"></vk-compare>');
  await tab.waitForFunction(() => document.getElementById('c').hasAttribute('data-error'), null, { timeout: 5000 });
  const r = await tab.evaluate(() => ({
    err: document.getElementById('c').hasAttribute('data-error'),
    la: document.querySelector('.vk-cmp-la').textContent,
    lb: document.querySelector('.vk-cmp-lb').textContent,
  }));
  assert.equal(r.err, true);
  assert.match(`${r.la}${r.lb}`, /未加载/);
  assert.match(logs.join('\n'), /图加载失败/);
});

test('vk-term：盘符路径提示符被识别成命令行，提示符原样显示', async () => {
  const { tab, logs } = await open('<vk-term title="cmd">C:\\src\\demo&gt; gcc hello.c -o hello</vk-term>');
  const r = await tab.evaluate(() => ({
    cmds: document.querySelectorAll('vk-term .vk-line.is-cmd').length,
    prompt: document.querySelector('vk-term .vk-prompt')?.textContent || '',
    text: document.querySelector('vk-term .vk-bd')?.textContent || '',
  }));
  assert.equal(r.cmds, 1);
  assert.equal(r.prompt, 'C:\\src\\demo>');
  assert.match(r.text, /gcc hello\.c/);
  assert.doesNotMatch(logs.join('\n'), /没有认出任何命令行/);
});

test('vk-term：仍然认不出的提示符要明说，不能整块静默掉灰', async () => {
  const { tab, logs } = await open('<vk-term>user@host:~$ cmd</vk-term>');
  const r = await tab.evaluate(() => ({
    cmds: document.querySelectorAll('vk-term .vk-line.is-cmd').length,
    outs: document.querySelectorAll('vk-term .vk-line.is-out').length,
  }));
  assert.equal(r.cmds, 0);
  assert.equal(r.outs, 1);
  assert.match(logs.join('\n'), /没有认出任何命令行/);
});

test('vk-term：普通输出里的 "price > 5" 不算提示符，不制造假警报', async () => {
  const { logs } = await open('<vk-term>price > 5 units\nrate &lt; 10</vk-term>');
  assert.doesNotMatch(logs.join('\n'), /没有认出任何命令行/);
});

test('vk-cells：addr 不是十六进制时说一声，不画一整列空地址', async () => {
  const { tab, logs } = await open(`
    <vk-cells id="bad" addr="0xZZ"><li label="a" value="1"></li><li label="b" value="2"></li></vk-cells>
    <vk-cells id="ok" addr="0x7ffc"><li label="a" value="1"></li><li label="b" value="2"></li></vk-cells>`);
  const r = await tab.evaluate(() => ({
    bad: document.querySelectorAll('#bad .vk-cell-a').length,
    ok: [...document.querySelectorAll('#ok .vk-cell-a')].map((el) => el.textContent),
  }));
  assert.equal(r.bad, 0, '写错的 addr 不该留下空地址列');
  assert.deepEqual(r.ok, ['0x7ffc', '0x7ffd']);
  assert.match(logs.join('\n'), /不是十六进制地址/);
});

test('vk-tree：depth 挡住的条目要报出来，计数按整棵树算', async () => {
  const { tab } = await open(`<vk-tree id="t" title="app">
    a/
      b/
        c/
          d/
            e/
              f.txt
      top.txt
  </vk-tree>`);
  const r = await tab.evaluate(() => ({
    more: document.querySelector('#t .vk-tree-more')?.textContent || '',
    meta: document.querySelector('#t .vk-tree-meta')?.textContent || '',
    paths: [...document.querySelectorAll('#t .vk-tree-row')].map((el) => el.dataset.nodePath),
  }));
  assert.ok(!r.paths.includes('a/b/c/d/e/f.txt'), '第 5 层默认不画');
  assert.match(r.meta, /2 文件/, '计数要按整棵树算（被 depth 挡住的文件也算）');
  assert.match(r.more, /还有 1 项/);
  assert.match(r.more, /depth="4"/);
});

test('vk-diff：以 -- 开头的删除行不能被当成表头吃掉', async () => {
  const hl = await createVkHighlighter(['diff']);
  const file = path.join(tmp, 'q.diff');
  fs.writeFileSync(
    file,
    '--- a/q.sql\n+++ b/q.sql\n@@ -1,2 +1,2 @@\n select 1;\n--- 这行是注释\n+-- 新的注释\n'
  );
  const out = await transformHtml('<vk-diff src="q.diff" lang="diff"></vk-diff>', {
    file: path.join(tmp, 'page.html'),
    highlighter: hl,
  });
  const { tab } = await open(out.html);
  const rows = await tab.evaluate(() =>
    [...document.querySelectorAll('.vk-dline')].map((el) => `${el.dataset.side}:${el.querySelector('.vk-dsrc')?.textContent}`)
  );
  assert.ok(rows.includes('del:-- 这行是注释'), `删掉的注释行消失了：${rows.join(' | ')}`);
  assert.ok(rows.includes('add:-- 新的注释'));
  assert.ok(!rows.some((r) => r.includes('q.sql')), '表头不该出现在正文里');
});
