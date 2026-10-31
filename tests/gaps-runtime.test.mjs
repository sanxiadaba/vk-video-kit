import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';

/* 运行期才能知道的缺口：要让 DOM / console 留下可断言的状态。 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const opened = [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-gaps-runtime-'));
const hl = await createVkHighlighter(['asm']);

const SHELL = (body) => `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body>${body}<script src="dist/vk.js"></script></body></html>`;

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
  await tab.waitForTimeout(100);
  return { tab, logs };
}

after(async () => {
  for (const ctx of opened) await ctx.close().catch(() => {});
  await browser.close();
  await close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('① vk-asm：objdump 表头不画成指令，并说明跳过了几行', async () => {
  const asm = [
    'hello.exe:     file format pei-i386',
    '',
    'Disassembly of section .text:',
    '',
    '00401000 <_main>:',
    '  401000: 55                    push   %rbp',
    '  401001: 48 89 e5              mov    %rsp,%rbp',
    'objdump: warning: something to know',
  ].join('\n');
  const file = path.join(tmp, 'asm.txt');
  fs.writeFileSync(file, asm);
  const out = await transformHtml('<vk-asm src="asm.txt"></vk-asm>', {
    file: path.join(tmp, 'page.html'),
    highlighter: hl,
  });
  const { tab, logs } = await open(out.html);
  const r = await tab.evaluate(() => {
    const host = document.querySelector('vk-asm');
    return {
      rows: host.querySelectorAll('.vk-asm-row:not(.is-blank)').length,
      labels: host.querySelectorAll('.vk-asm-label').length,
      skipped: host.dataset.vkSkipped,
      text: host.textContent,
    };
  });
  assert.equal(r.rows, 2, '只该画 2 条指令');
  assert.equal(r.labels, 1);
  assert.equal(r.skipped, '3');
  assert.doesNotMatch(r.text, /file format|Disassembly of section|objdump: warning/);
  assert.match(logs.join('\n'), /跳过了 3 行非指令行/);
});

test('② vk-code / vk-term：ANSI 不露到画面上，文本正确', async () => {
  const { tab, logs } = await open(
    '<vk-code id="c" lang="text">\u001b[31mred\u001b[0m line</vk-code>' +
      '<vk-term id="t">\u001b[32m$ echo hi\u001b[0m\nhi</vk-term>'
  );
  const r = await tab.evaluate(() => ({
    code: document.querySelector('#c .vk-bd')?.textContent || '',
    term: document.querySelector('#t .vk-bd')?.textContent || '',
    codeCmd: document.querySelectorAll('#t .vk-line.is-cmd').length,
  }));
  assert.ok(!r.code.includes('\u001b'), 'vk-code 里还留着 \u001b');
  assert.ok(!r.term.includes('\u001b'), 'vk-term 里还留着 \u001b');
  assert.match(r.code, /red line/);
  assert.match(r.term, /echo hi/);
  assert.equal(r.codeCmd, 1);
  assert.match(logs.join('\n'), /已忽略终端颜色控制符/);
});

test('③ vk-term：识别盘符 / PowerShell / [user@host] 提示符，price > 5 仍是输出', async () => {
  const { tab, logs } = await open(
    '<vk-term id="t">C:\\src\\demo&gt; gcc hello.c -o hello\n' +
      'PS C:\\src&gt; dir\n' +
      '[user@host ~]$ ls -la\n' +
      'price &gt; 5 units</vk-term>'
  );
  const r = await tab.evaluate(() => ({
    prompts: [...document.querySelectorAll('#t .vk-prompt')].map((e) => e.textContent),
    cmds: [...document.querySelectorAll('#t .vk-line.is-cmd .vk-txt')].map((e) => e.textContent),
    outs: [...document.querySelectorAll('#t .vk-line.is-out .vk-txt')].map((e) => e.textContent),
  }));
  assert.deepEqual(r.prompts, ['C:\\src\\demo>', 'PS C:\\src>', '[user@host ~]$']);
  assert.deepEqual(r.cmds, ['gcc hello.c -o hello', 'dir', 'ls -la']);
  assert.ok(r.outs.some((s) => s.includes('price > 5 units')));
  assert.doesNotMatch(logs.join('\n'), /没有认出任何命令行/);
});

test('⑥ vk-table / vk-list / vk-steps 空数据：stale、没有空框、audit 报出来', async () => {
  const { tab, logs } = await open(
    '<vk-page><vk-list id="l"></vk-list><vk-steps id="s"></vk-steps>' +
      '<vk-table id="t"><table></table></vk-table></vk-page>'
  );
  const r = await tab.evaluate(() => {
    const q = (id) => document.getElementById(id);
    const state = (id) => ({
      stale: q(id).hasAttribute('data-vk-stale'),
      text: q(id).textContent.trim(),
      kids: q(id).children.length,
    });
    const audit = window.vk.auditPage(document);
    return {
      l: state('l'),
      s: state('s'),
      t: state('t'),
      audit: audit.issues.filter((x) => x.type === 'empty-component').map((x) => x.what),
    };
  });
  for (const id of ['l', 's', 't']) {
    assert.equal(r[id].stale, true, `${id} 该标 stale`);
    assert.equal(r[id].text, '', `${id} 不该画空框`);
    assert.equal(r[id].kids, 0, `${id} 不该留下空壳`);
  }
  assert.deepEqual(r.audit.sort(), ['vk-list', 'vk-steps', 'vk-table']);
  assert.match(logs.join('\n'), /列表还没有条目/);
  assert.match(logs.join('\n'), /步骤还没有条目/);
  assert.match(logs.join('\n'), /这个表还没有行/);
});

test('⑨ vk-code 长行溢出同步测量：不跑 rAF 也有渐隐标记', async () => {
  const { tab } = await open('<main></main>');
  const r = await tab.evaluate(() => {
    // 故意不 await ready / 不等 rAF：渲染函数返回时就必须量好。
    document.querySelector('main').innerHTML =
      `<vk-code lang="text" long="clip" w="320">${'x'.repeat(400)}</vk-code>`;
    const el = document.querySelector('vk-code');
    const bd = el.querySelector('.vk-bd');
    return { over: el.hasAttribute('data-vk-overflow'), sw: bd.scrollWidth, cw: bd.clientWidth };
  });
  assert.equal(r.over, true, `sw=${r.sw} cw=${r.cw}`);
});

test('⑩ vk-timeline steps 与 at+span 矛盾：不静默撑大，warn 且留 data-*', async () => {
  const { tab, logs } = await open(
    '<vk-timeline id="bad" variant="lanes" steps="3" lanes="主线程">' +
      '<li lane="主线程" at="2" span="2" label="读 x">x</li></vk-timeline>' +
      '<vk-timeline id="ok" variant="lanes" steps="6" lanes="主线程">' +
      '<li lane="主线程" at="2" span="2" label="读 x">x</li></vk-timeline>'
  );
  const r = await tab.evaluate(() => ({
    bad: document.getElementById('bad').dataset.stepsOverflow,
    ok: document.getElementById('ok').dataset.stepsOverflow,
    steps: document.querySelectorAll('#bad .vk-tl-step-hd span').length,
  }));
  assert.equal(r.bad, '4');
  assert.equal(r.ok, undefined);
  assert.equal(r.steps, 4);
  assert.match(logs.join('\n'), /steps="3" 小于条目实际占到的 4 步/);
});
