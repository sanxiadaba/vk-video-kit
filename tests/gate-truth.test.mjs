import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { run } from '../tools/lib/run.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * 门禁能不能失败 —— 14.0 的第一性问题。
 *
 * 13.0 的门禁有 382 个属性被跳过、三份审计阈值打架、空页一律通过。
 * 这里的五页是"必须被拦下"的：只要有一页畅通，后面的删除就没有安全网。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
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

const issues = async () =>
  page.evaluate(() => window.vk.auditPage().issues.map((x) => ({ type: x.type, what: x.what, need: x.need, cr: x.cr })));

test('坏页 1：空页 → empty', async () => {
  await page.setContent(SHELL(`<vk-page><vk-stack></vk-stack></vk-page>`), { waitUntil: 'load' });
  await ready();
  const list = await issues();
  assert.ok(list.some((i) => i.type === 'empty'), `空页必须报 empty：${JSON.stringify(list)}`);
});

test('坏页 2：超宽的字 → 溢出/裁切', async () => {
  await page.setContent(
    SHELL(`<vk-page align="top">
      <div style="width:200px;overflow:hidden">
        <vk-text size="body" measure="none" style="white-space:nowrap">这一句故意写得很长很长很长很长很长很长很长很长很长很长，看它会不会撑破盒子。</vk-text>
      </div>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const list = await issues();
  assert.ok(
    list.some((i) => ['overflow', 'clip', 'content-clip'].includes(i.type)),
    `超宽的字必须被拦：${JSON.stringify(list)}`
  );
});

test('坏页 3：两处焦点 → blue 报告 2 处', async () => {
  await page.setContent(
    SHELL(`<vk-page align="top">
      <vk-text class="a" act="focus">第一处焦点，这里在讲它。</vk-text>
      <vk-text class="b" act="focus">第二处焦点，这里也在讲它。</vk-text>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const list = await issues();
  const blue = list.find((i) => i.type === 'blue');
  assert.ok(blue, `两处焦点必须报 blue：${JSON.stringify(list)}`);
});

test('坏页 4：压到安全区外 → safe', async () => {
  await page.setContent(
    SHELL(`<vk-page align="top">
      <vk-stack style="margin-left:-60px">
        <vk-text size="body">这一行故意往左顶出安全区，门禁必须拦住它。</vk-text>
      </vk-stack>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const list = await issues();
  assert.ok(list.some((i) => i.type === 'safe'), `越安全区必须报 safe：${JSON.stringify(list)}`);
});

test('坏页 5：灰字太浅 → contrast（正文门槛 7:1）', async () => {
  await page.setContent(
    SHELL(`<vk-page align="top">
      <vk-text size="body" style="color:#8a93a3">这一句的颜色故意压到看不清，门禁必须拦住它。</vk-text>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const list = await issues();
  const bad = list.find((i) => i.type === 'contrast');
  assert.ok(bad, `浅灰字必须报 contrast：${JSON.stringify(list)}`);
  assert.ok(bad.need === 7, `正文门槛应该是 7:1，实际 ${bad.need}`);
});

test('vk check 对坏页返回非零', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-bad-'));
  const file = path.join(dir, 'bad.html');
  fs.writeFileSync(
    file,
    SHELL(`<vk-page><vk-stack></vk-stack></vk-page>`).replace(/<base href="[^"]*">/, '')
  );
  // 用绝对地址引静态资源，页面在临时目录里也能跑起来。
  const html = fs
    .readFileSync(file, 'utf8')
    .replace('rel="stylesheet" href="vk/fonts.css"', `rel="stylesheet" href="${base}/vk/fonts.css"`)
    .replace('rel="stylesheet" href="vk/vk.css"', `rel="stylesheet" href="${base}/vk/vk.css"`)
    .replace('src="dist/vk.js"', `src="${base}/dist/vk.js"`);
  fs.writeFileSync(file, html);
  // 必须用异步 spawn：这个测试服务器跑在本进程里，spawnSync 会卡住事件循环，
  // 子进程的请求得不到响应，整整等 30 秒超时（曾经就是这么慢的）。
  const r = await run(process.execPath, [path.resolve('bin/vk.mjs'), 'check', file]);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.notEqual(r.code, 0, `vk check 对空页应返回非零，实际 ${r.code}\n${r.out}\n${r.err}`);
});

after(async () => {
  await browser.close();
  await close();
});
