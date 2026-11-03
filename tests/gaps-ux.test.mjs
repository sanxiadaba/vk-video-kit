import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * demo 在「把画面讲清楚」时被逼出来的五个缺口。
 * 这里只断言"观众能不能看懂"的那一层：结构、几何、文字里有没有要说的话。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const opened = [];

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

/* ---------------------------------------------------------------- compare */

test('vk-compare：split / side / stack 三种结构，side/stack 两图都完整不裁切', async () => {
  const { tab } = await open(`<div style="width:800px">
    <vk-compare id="split" a="assets/sample-grid.svg" b="assets/sample-grid-b.svg" ratio="720 / 280" split="30"></vk-compare>
    <vk-compare id="side" mode="side" a="assets/sample-grid.svg" b="assets/sample-grid-b.svg" ratio="720 / 280" split="30"></vk-compare>
    <vk-compare id="stack" mode="stack" a="assets/sample-grid.svg" b="assets/sample-grid-b.svg" ratio="720 / 280"></vk-compare>
  </div>`);
  const r = await tab.evaluate(() => {
    const read = (id) => {
      const host = document.getElementById(id);
      const shell = host.querySelector('.vk-cmp');
      const a = host.querySelector('.vk-cmp-a');
      const b = host.querySelector('.vk-cmp-b');
      const div = host.querySelector('.vk-cmp-div');
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return {
        mode: shell.dataset.mode,
        display: getComputedStyle(shell).display,
        aspect: getComputedStyle(shell).aspectRatio,
        clipA: a.style.clipPath,
        clipB: b.style.clipPath,
        div: getComputedStyle(div).display,
        a: { w: ar.width, h: ar.height, left: ar.left, top: ar.top },
        b: { w: br.width, h: br.height, left: br.left, top: br.top },
      };
    };
    return { split: read('split'), side: read('side'), stack: read('stack') };
  });

  // split 保持旧行为：叠图 + 裁切 + 分割线。
  assert.equal(r.split.mode, 'split');
  assert.equal(r.split.display, 'block');
  assert.equal(r.split.clipA, 'inset(0px 70% 0px 0px)', `split=30 应只留 a 左边 30%：${r.split.clipA}`);
  assert.equal(r.split.clipB, '');
  assert.notEqual(r.split.div, 'none', 'split 必须有分割线');
  assert.ok(r.split.aspect.startsWith('720 / 280'), `split 要把 ratio 落到框上：${r.split.aspect}`);

  // side：左 a 右 b，各占一半，完整显示（没有 clipPath、没有分割线）。
  assert.equal(r.side.mode, 'side');
  assert.equal(r.side.display, 'grid');
  assert.equal(r.side.aspect, 'auto', 'side 的高度由两张图自己撑开，不能再锁整框比例');
  assert.equal(r.side.clipA, '');
  assert.equal(r.side.clipB, '');
  assert.equal(r.side.div, 'none', 'side 没有分割线');
  assert.ok(r.side.a.left < r.side.b.left, 'a 在左、b 在右');
  assert.ok(Math.abs(r.side.a.top - r.side.b.top) < 1, '并排时两张图顶边对齐');
  assert.ok(r.side.a.w > 300 && r.side.b.w > 300, `两张图都要完整占一格：${JSON.stringify(r.side)}`);
  assert.ok(r.side.a.h > 100 && r.side.b.h > 100, '两张图的高度不能被压成线');

  // stack：上 a 下 b，各占满宽。
  assert.equal(r.stack.mode, 'stack');
  assert.equal(r.stack.display, 'grid');
  assert.equal(r.stack.clipA, '');
  assert.equal(r.stack.clipB, '');
  assert.equal(r.stack.div, 'none', 'stack 没有分割线');
  assert.ok(r.stack.a.top < r.stack.b.top, 'a 在上、b 在下');
  assert.ok(Math.abs(r.stack.a.left - r.stack.b.left) < 1, '上下排列时左边对齐');
  assert.ok(r.stack.a.w > 600 && r.stack.b.w > 600, `两张图都要占满整宽：${JSON.stringify(r.stack)}`);
  assert.ok(r.stack.a.h > 100 && r.stack.b.h > 100, '两张图的高度不能被压成线');
});

test('vk-compare：side 下同时写 split 会警告，且不裁切', async () => {
  const { tab, logs } = await open(
    `<vk-compare id="c" mode="side" split="30" fit="cover" a="assets/sample-grid.svg" b="assets/sample-grid-b.svg"></vk-compare>`
  );
  const r = await tab.evaluate(() => ({
    mode: document.querySelector('.vk-cmp').dataset.mode,
    clip: document.querySelector('.vk-cmp-a').style.clipPath,
  }));
  assert.equal(r.mode, 'side');
  assert.equal(r.clip, '');
  assert.match(logs.join('\n'), /mode="side" 下 split 不起作用/);
  assert.match(logs.join('\n'), /mode="side" 下 fit="cover" 不起作用/);
});

test('vk-compare：side/stack 仍守同比例校验（>2% 报 compare-mismatch）', async () => {
  const square = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3C/svg%3E";
  const wide = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100'%3E%3C/svg%3E";
  const { tab } = await open(
    `<vk-page><vk-compare id="c" mode="side" a="${square}" b="${wide}" ratio="1 / 1"></vk-compare></vk-page>`
  );
  const r = await tab.evaluate(() => {
    const host = document.getElementById('c');
    return {
      mismatch: host.hasAttribute('data-mismatch'),
      audit: window.vk.auditPage().issues.filter((x) => x.type === 'compare-mismatch').length,
    };
  });
  assert.equal(r.mismatch, true, '比例差 >2% 要标 data-mismatch');
  assert.ok(r.audit >= 1, 'vk check 要能看到 compare-mismatch');
});

/* ------------------------------------------------------------------- bars */

test('vk-bars：ratio-to 在条旁标出 ×500；不写时行为不变，指空要警告', async () => {
  const rows = `<li label="启动" value="106"></li><li label="预处理" value="52980"></li><li label="优化后" value="43956"></li>`;
  const { tab, logs } = await open(`
    <vk-bars id="ratio" unit="B" ratio-to="0">${rows}</vk-bars>
    <vk-bars id="plain" unit="B">${rows}</vk-bars>
    <vk-bars id="bad" ratio-to="9">${rows}</vk-bars>`);
  const r = await tab.evaluate(() => {
    const state = (id) => {
      const host = document.getElementById(id);
      return {
        ratios: [...host.querySelectorAll('.vk-bar-x')].map((x) => x.textContent),
        bases: host.querySelectorAll('.vk-bar-x[data-ratio-base]').length,
        values: [...host.querySelectorAll('.vk-bar-v')].map((x) => x.textContent),
        widths: [...host.querySelectorAll('.vk-bar-fill')].map((x) => x.style.width),
      };
    };
    return { ratio: state('ratio'), plain: state('plain'), bad: state('bad') };
  });

  assert.deepEqual(r.ratio.ratios, ['×1', '×500', '×415'], `倍率应该是 ×1 / ×500 / ×415：${r.ratio.ratios}`);
  assert.equal(r.ratio.bases, 1, '基准行要能被认出来（data-ratio-base）');
  assert.deepEqual(r.plain.ratios, [], '不写 ratio-to 时不该冒出倍率标注');
  assert.equal(r.ratio.widths.length, 3);
  assert.deepEqual(r.plain.widths, r.ratio.widths, `ratio-to 不该改变条长：${r.plain.widths} vs ${r.ratio.widths}`);
  assert.deepEqual(r.bad.ratios, [], '指空的行号不能画出一个假倍率');
  assert.match(logs.join('\n'), /ratio-to="9" 指不到任何一行/);
});

/* -------------------------------------------------------------------- pin */

test('vk-pin：w 只量气泡，接受 200 / 200px，vk check 不报硬宽', async () => {
  const { tab, logs } = await open(`
    <vk-page><vk-stack gap="lg">
      <vk-box id="tgt" w="240" h="96" surface="soft"><vk-text size="body">目标</vk-text></vk-box>
    </vk-stack>
    <vk-pin id="num" for="#tgt" side="right" w="200">数字宽</vk-pin>
    <vk-pin id="px" for="#tgt" side="right" w="200px">带单位</vk-pin>
    <vk-pin id="def" for="#tgt" side="right">默认宽</vk-pin>
    </vk-page>`);
  const r = await tab.evaluate(() => {
    const host = (id) => document.getElementById(id);
    return {
      num: host('num').querySelector('.vk-pin-bd').getBoundingClientRect().width,
      px: host('px').querySelector('.vk-pin-bd').getBoundingClientRect().width,
      def: host('def').querySelector('.vk-pin-bd').getBoundingClientRect().width,
      hostW: host('num').offsetWidth,
      hardWidth: window.vk
        .auditPage()
        .issues.filter((x) => x.type === 'w')
        .filter((x) => /vk-pin/i.test(JSON.stringify(x))).length,
    };
  });
  assert.equal(r.num, 200, `w="200" 应落到 .vk-pin-bd：${r.num}`);
  assert.equal(r.px, 200, `w="200px" 也应落到 .vk-pin-bd：${r.px}`);
  assert.equal(r.def, 360, `不写 w 时仍是默认 360：${r.def}`);
  assert.ok(r.hostW > 1000, `pin 宿主本来就是整页宽，不能被当成 w 的载体：${r.hostW}`);
  assert.equal(r.hardWidth, 0, '覆盖层的 w 不该进硬宽检查');
  assert.doesNotMatch(logs.join('\n'), /w="200px" 不是/);
});

/* --------------------------------------------------------------- timeline */

test('vk-timeline：li 的 value/note 渲染大数字 + 小说明，并压过 label/date 的主次位', async () => {
  const { tab } = await open(`
    <vk-timeline id="t" start="1972" end="2024">
      <li date="2024" label="旧标签" value="52,980 B" note="预处理后">正文不该抢主位</li>
    </vk-timeline>
    <vk-timeline id="old" start="1972" end="2024">
      <li date="1972" label="C 诞生">Dennis Ritchie</li>
    </vk-timeline>`);
  const r = await tab.evaluate(() => {
    const t = document.getElementById('t');
    const value = t.querySelector('.vk-tl-value');
    const note = t.querySelector('.vk-tl-note');
    const old = document.getElementById('old');
    return {
      valueText: value?.textContent,
      noteText: note?.textContent,
      valueFs: value ? parseFloat(getComputedStyle(value).fontSize) : 0,
      noteFs: note ? parseFloat(getComputedStyle(note).fontSize) : 0,
      labelRendered: !!t.querySelector('.vk-tl-name'),
      oldName: old.querySelector('.vk-tl-name')?.textContent,
      oldDesc: old.querySelector('.vk-tl-desc')?.textContent,
    };
  });
  assert.equal(r.valueText, '52,980 B', 'value 要当主值画出来');
  assert.equal(r.noteText, '预处理后', 'note 要当说明画出来');
  assert.ok(r.valueFs > r.noteFs, `数字要比说明大（actual ${r.valueFs} vs ${r.noteFs}）`);
  assert.ok(r.valueFs >= 144, `value 按 hero 级：${r.valueFs}`);
  assert.ok(r.noteFs >= 28, `note 按 caption 级（地板 28）：${r.noteFs}`);
  assert.equal(r.labelRendered, false, '有 value 时 label 不该再占主位');
  assert.equal(r.oldName, 'C 诞生', '不写 value/note 的旧条目行为不变');
  assert.equal(r.oldDesc, 'Dennis Ritchie');
});

/* ----------------------------------------------------------------- window */

test('vk-window：480px 里 20 字长标题不溢出、不裁半字', async () => {
  const title = '12 B 有洞 · 8 B 没洞 · 这是一条很长的标题';
  const { tab } = await open(`
    <div style="width:480px">
      <vk-window id="w" title="${title}">
        <vk-text size="body">窗里的一句话。</vk-text>
      </vk-window>
    </div>`);
  const r = await tab.evaluate(() => {
    const win = document.querySelector('#w .vk-win');
    const file = document.querySelector('#w .vk-file');
    const inner = document.querySelector('#w .vk-file-t');
    const ir = inner.getBoundingClientRect();
    const wr = win.getBoundingClientRect();
    return {
      fullText: inner.textContent,
      titleAttr: file.getAttribute('title'),
      rightEdge: ir.right - wr.right,
      fileFits: file.scrollWidth <= file.clientWidth,
      innerClipped: inner.scrollWidth > inner.clientWidth,
      textOverflow: getComputedStyle(inner).textOverflow,
      whiteSpace: getComputedStyle(inner).whiteSpace,
      overflow: getComputedStyle(inner).overflow,
    };
  });
  assert.equal(r.fullText, title, '省略只是视觉，DOM 里要保留全文');
  assert.equal(r.titleAttr, title, '悬停时还能看到全文');
  assert.ok(r.rightEdge <= 1, `标题右缘不能超出窗口：${r.rightEdge}px`);
  assert.ok(r.fileFits, '标题容器自己不能横向溢出');
  assert.equal(r.textOverflow, 'ellipsis', '长标题要显示省略号，而不是裁半字');
  assert.equal(r.whiteSpace, 'nowrap');
  assert.equal(r.overflow, 'hidden');
  assert.ok(r.innerClipped, '标题应真的被省略（scrollWidth > clientWidth）');
});
