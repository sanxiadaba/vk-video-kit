import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * 组合冒烟 —— 标本页一个标签一页，验的是"这个物单独成立"；
 * 但真实一帧是十几个物叠在一起：覆盖层压住正文、grid 与 stack 抢宽度、
 * 图与文字抢行高。这些问题只有拼起来才看得见。
 *
 * 这里用三个真实组合（代码+图、数据+标注、长文+外壳）跑：
 *   · 不报错
 *   · auditPage 无硬问题
 *   · 覆盖层（ring/pin/loupe）不遮住正文
 */
const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

after(async () => {
  await browser.close();
  await close();
});

const shell = (body) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${base}/vk/fonts.css"><link rel="stylesheet" href="${base}/vk/vk.css"></head>
<body><vk-page align="top"><vk-stack gap="md">
${body}
</vk-stack></vk-page><script src="${base}/dist/vk.js"></script></body></html>`;

async function mount(body) {
  errors.length = 0;
  await page.setContent(shell(body), { waitUntil: 'load' });
  await page.evaluate(() => window.vk?.ready?.());
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const a = window.vk.auditPage();
    const hard = a.issues.filter((i) => ['font', 'contrast', 'safe', 'clip', 'overlap', 'empty'].includes(i.type));
    return { issues: hard, focus: window.vk.focusRegions(document).length };
  });
}

test('代码 + 窗口 + 标注：覆盖层不遮正文', async () => {
  const r = await mount(`
    <vk-text size="title" weight="bold">一行 include 变成五万字节</vk-text>
    <vk-code lang="c" numbers="all">#include &lt;stdio.h&gt;
int main(void) { return 0; }</vk-code>
    <vk-ring for="vk-code .vk-line:nth-child(1)" variant="rect"></vk-ring>
    <vk-pin for="vk-code" side="right">这一行把整个头文件拉进来</vk-pin>
  `);
  assert.deepEqual(errors, []);
  assert.deepEqual(r.issues, []);
  assert.equal(r.focus, 1);
});

test('数据 + 指标 + 条形：grid 里不抢宽', async () => {
  const r = await mount(`
    <vk-grid cols="2" gap="md" align="start">
      <vk-stack gap="sm">
        <vk-text size="subhead" weight="bold">体积</vk-text>
        <vk-bars max="60000" unit="B">
          <li value="106" label="hello.c"></li>
          <li value="52980" label="hello.i"></li>
        </vk-bars>
      </vk-stack>
      <vk-stack gap="sm">
        <vk-text size="subhead" weight="bold">字符</vk-text>
        <vk-cells cols="4">
          <li value="72" label="r"></li>
          <li value="6C" label="l"></li>
          <li value="64" label="d"></li>
          <li value="21" label="!"></li>
        </vk-cells>
      </vk-stack>
    </vk-grid>
  `);
  assert.deepEqual(errors, []);
  assert.deepEqual(r.issues, []);
});

test('长文 + 外壳 + 列表：不溢出安全区', async () => {
  const r = await mount(`
    <vk-window chrome="min" title="main.c">
      <vk-list variant="bullet" gap="sm">
        <li>预处理器把 #include 展开成五万字节</li>
        <li>编译器把它变成汇编</li>
        <li>汇编器把汇编变成机器码</li>
      </vk-list>
    </vk-window>
    <vk-text size="body" ink="secondary">变的一直是工具，不是这五步。</vk-text>
  `);
  assert.deepEqual(errors, []);
  assert.deepEqual(r.issues, []);
});
