import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { transformHtml } from '../src/highlight.mjs';

/**
 * 批次 G + H：注解原语、图标白名单、深色限量，五条硬审计。
 *
 * G1 vk-note：两种形态都"不是气泡"——边注是 1px 细线 + 栏间空白里的 caption，
 *    与目标正文同基线；图例是目标角上的编号点 + 页角的对照表。
 * G2 图标白名单：vk-icon 只表达 ✓ / ! / ✗ / 方向，白名单外在构建期就红。
 * G3 深色块 ≤1：一页只能有一块"重"。
 * H1 强调色 ≤1；H4 页眉不许含文件名/页号；H5 内容必须在 120 边距内。
 *
 * 几何都在真浏览器里量：细线的 1px、基线的像素差、编号点与目标角的重合，
 * 不是读一遍 CSS 就宣布"对了"。
 */

const { base, close: closeServer } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const opened = [];

async function open(body, pageAttr = '') {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tab = await ctx.newPage();
  opened.push(ctx);
  await tab.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body style="margin:0"><vk-page ${pageAttr}>${body}</vk-page><script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return tab;
}

after(async () => {
  for (const ctx of opened) await ctx.close().catch(() => {});
  await browser.close();
  await closeServer();
});

/** 页面内的独立测量：行盒 + canvas 字体度量 = 真实基线（与组件实现无关）。 */
const probeInPage = () => {
  window.__vkBaseline = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rect = [...range.getClientRects()].find((r) => r.width > 0.5 && r.height > 0.5);
      if (!rect) continue;
      const cs = getComputedStyle(n.parentElement);
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText('国Hg');
      return rect.top + (m.fontBoundingBoxAscent || m.actualBoundingBoxAscent);
    }
    return null;
  };
};

const auditTypes = (tab, style = false) =>
  tab.evaluate(
    (s) => (window.vk.auditPage?.(document, { style: s }).issues || []).map((x) => ({ ...x, fix: x.fix || '' })),
    style
  );

/* ------------------------------------------------------------- G1 边注 */

const MARGIN_BODY = `
<vk-canvas w="1680" h="840">
  <vk-box id="n1" x="380" y="40" w="560" h="200" surface="soft" border="hair" radius="lg" pad="md">
    <vk-text size="body" mono>int main(void)</vk-text>
    <vk-text size="body" mono ink="secondary">{ return 0; }</vk-text>
  </vk-box>
  <vk-note id="n" kind="margin" for="#n1" side="auto" leader="line" w="240">这一段只讲入口：返回值说明程序有没有跑完。</vk-note>
</vk-canvas>`;

test('vk-note kind="margin"：1px 细线、文字 caption、与目标正文同基线', async () => {
  const tab = await open(MARGIN_BODY);
  await tab.evaluate(probeInPage);
  const r = await tab.evaluate(() => {
    const note = document.querySelector('#n');
    const line = note.querySelector('.vk-note-line');
    const box = note.querySelector('.vk-note-m');
    const text = note.querySelector('.vk-note-t');
    const target = document.querySelector('#n1');
    const targetText = target.querySelector('vk-text');
    const lcs = getComputedStyle(line);
    const bcs = getComputedStyle(box);
    const nb = note.getBoundingClientRect();
    const lb = box.getBoundingClientRect();
    const tb = target.getBoundingClientRect();
    return {
      stroke: lcs.strokeWidth,
      d: line.getAttribute('d') || '',
      arrow: !!note.querySelector('.vk-note-tip, marker'),
      font: bcs.fontSize,
      color: bcs.color,
      bg: bcs.backgroundColor,
      border: bcs.borderTopWidth,
      noteTextTop: text.getBoundingClientRect().top,
      noteBaseline: window.__vkBaseline(text),
      targetBaseline: window.__vkBaseline(targetText),
      gap: Math.round(lb.left - tb.right),
      host: { w: Math.round(nb.width), h: Math.round(nb.height) },
      box: [Math.round(lb.left), Math.round(lb.top), Math.round(lb.right), Math.round(lb.bottom)],
    };
  });
  assert.equal(r.stroke, '1px', `细线必须是 1px：${r.stroke}`);
  assert.match(r.d, /^M /, `细线要有路径：${r.d}`);
  assert.equal(r.arrow, false, '边注不许出现箭头');
  assert.equal(r.font, '48px', `边注文字用 caption（48）：${r.font}`);
  assert.equal(r.color, 'rgb(51, 61, 75)', `文字用墨阶 secondary：${r.color}`);
  assert.equal(r.bg, 'rgba(0, 0, 0, 0)', '边注没有底色块');
  assert.equal(r.border, '0px', '边注没有描边');
  assert.equal(r.gap, 24, `细线从目标右侧 24px 处接上文字：${r.gap}`);
  const delta = Math.abs(r.noteBaseline - r.targetBaseline);
  assert.ok(delta <= 2, `边注首行必须与目标正文同基线，差 ${delta.toFixed(2)}px`);
  assert.ok(r.box[0] > 0 && r.box[2] < 1920, '边注落在画布里');
});

test('vk-note 自动选边：有空间的一侧才放文字，显式 side 按指定侧', async () => {
  const tab = await open(`
<vk-canvas w="1680" h="840">
  <vk-box id="mid" x="380" y="40" w="560" h="160" surface="soft"></vk-box>
  <vk-box id="edge" x="1500" y="40" w="140" h="160" surface="soft"></vk-box>
  <vk-note id="a" kind="margin" for="#mid" w="200">自动选边：这一侧有空间。</vk-note>
  <vk-note id="b" kind="margin" for="#edge" w="200">靠右的目标要往左放。</vk-note>
  <vk-note id="c" kind="margin" for="#mid" side="left" w="200">显式贴左侧。</vk-note>
</vk-canvas>`);
  const r = await tab.evaluate(() => {
    const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
    const box = (sel) => {
      const b = document.querySelector(sel).querySelector('.vk-note-m').getBoundingClientRect();
      return { l: b.left, r: b.right, t: b.top };
    };
    const host = document.querySelector('vk-canvas').getBoundingClientRect();
    const mid = rect('#mid');
    const edge = rect('#edge');
    return {
      a: box('#a'),
      b: box('#b'),
      c: box('#c'),
      mid: { l: mid.left, r: mid.right },
      edge: { l: edge.left, r: edge.right },
      host: { l: host.left, r: host.right },
    };
  });
  assert.ok(Math.abs(r.a.l - (r.mid.r + 24)) <= 1, `#mid 两侧都有空间时贴右：${r.a.l} vs ${r.mid.r + 24}`);
  assert.ok(r.b.r <= r.edge.l - 24 + 1, `靠右的目标要贴左：${r.b.r} vs ${r.edge.l}`);
  assert.ok(r.b.l >= r.host.l, '边注不许出画布');
  assert.ok(Math.abs(r.c.r - (r.mid.l - 24)) <= 1, `显式 side="left" 贴在目标左侧：${r.c.r} vs ${r.mid.l - 24}`);
});

test('vk-note leader="dot"：细线 + 目标端圆点，没有箭头', async () => {
  const tab = await open(`
<vk-canvas w="1680" h="840">
  <vk-box id="d1" x="380" y="120" w="480" h="160" surface="soft"></vk-box>
  <vk-note id="dn" kind="margin" for="#d1" leader="dot" w="220">圆点标出这一行从哪里引出来。</vk-note>
</vk-canvas>`);
  const r = await tab.evaluate(() => {
    const note = document.querySelector('#dn');
    const mark = note.querySelector('.vk-note-mark');
    const line = note.querySelector('.vk-note-line');
    const t = document.querySelector('#d1').getBoundingClientRect();
    const host = document.querySelector('vk-canvas').getBoundingClientRect();
    const d = (line.getAttribute('d') || '').match(/^M\s+(-?[\d.]+)\s+(-?[\d.]+)/) || [];
    return {
      display: getComputedStyle(mark).display,
      cx: Number(mark.getAttribute('cx')),
      cy: Number(mark.getAttribute('cy')),
      r: Number(mark.getAttribute('r')),
      startX: Number(d[1]),
      startY: Number(d[2]),
      targetRight: Math.round(t.right - host.left),
      targetCy: Math.round(t.top - host.top + t.height / 2),
      arrows: note.querySelectorAll('.vk-note-tip, [marker-end]').length,
      stroke: getComputedStyle(line).strokeWidth,
    };
  });
  assert.notEqual(r.display, 'none', 'leader="dot" 必须有圆点');
  assert.equal(r.r, 4, `圆点是小圆点（r=4）：${r.r}`);
  assert.ok(Math.abs(r.cx - r.targetRight) <= 1, `圆点落在目标端：${r.cx} vs ${r.targetRight}`);
  assert.ok(Math.abs(r.cy - r.startY) <= 1, '圆点与细线同高');
  assert.equal(r.startX, r.cx, '细线从圆点出发');
  assert.equal(r.stroke, '1px', '圆点引线仍是 1px');
  assert.equal(r.arrows, 0, '没有箭头');
});

/* ------------------------------------------------------------- G1 图例 */

test('vk-note kind="legend"：编号点钉在目标右上角，页角图例表编号对齐', async () => {
  const tab = await open(`
<vk-canvas w="1680" h="840">
  <vk-box id="l1" x="380" y="120" w="420" h="120" surface="none" border="hair" radius="lg" pad="md">
    <vk-text size="body">第一步</vk-text>
  </vk-box>
  <vk-box id="l2" x="1040" y="120" w="420" h="120" surface="none" border="hair" radius="lg" pad="md">
    <vk-text size="body">第二步</vk-text>
  </vk-box>
  <vk-note id="lg" kind="legend" for="#l1;#l2" place="br">
    <li>只把 include 抄进来</li>
    <li>到这一步才检查语法</li>
  </vk-note>
</vk-canvas>`);
  const r = await tab.evaluate(() => {
    const note = document.querySelector('#lg');
    const host = document.querySelector('vk-canvas').getBoundingClientRect();
    const dots = [...note.querySelectorAll('.vk-note-dot')].map((d) => {
      const b = d.getBoundingClientRect();
      return { text: d.textContent, cx: b.left - host.left + b.width / 2, cy: b.top - host.top + b.height / 2 };
    });
    const targets = ['#l1', '#l2'].map((s) => {
      const b = document.querySelector(s).getBoundingClientRect();
      return { right: b.right - host.left, top: b.top - host.top };
    });
    const legend = note.querySelector('.vk-note-legend');
    const lb = legend.getBoundingClientRect();
    const items = [...note.querySelectorAll('.vk-note-item')].map((li) => ({
      n: li.querySelector('.vk-note-n').textContent,
      t: li.querySelector('.vk-note-t').textContent,
    }));
    return {
      dots,
      targets,
      items,
      legend: { l: lb.left - host.left, t: lb.top - host.top, r: lb.right - host.left, b: lb.bottom - host.top },
      host: { w: Math.round(host.width), h: Math.round(host.height) },
      font: getComputedStyle(note.querySelector('.vk-note-t')).fontSize,
      bg: getComputedStyle(legend).backgroundColor,
    };
  });
  assert.equal(r.dots.length, 2, `两个目标两枚编号点：${r.dots.length}`);
  assert.deepEqual(
    r.dots.map((d) => d.text),
    ['1', '2'],
    '编号从 1 起，与图例条目顺序一致'
  );
  for (const [i, d] of r.dots.entries()) {
    assert.ok(Math.abs(d.cx - r.targets[i].right) <= 1, `点 ${i + 1} 钉在目标右上角（x）：${d.cx} vs ${r.targets[i].right}`);
    assert.ok(Math.abs(d.cy - r.targets[i].top) <= 1, `点 ${i + 1} 钉在目标右上角（y）：${d.cy} vs ${r.targets[i].top}`);
  }
  assert.deepEqual(
    r.items.map((x) => x.n),
    ['1', '2'],
    '图例的编号列与目标上的编号点同号'
  );
  assert.ok(r.items.every((x) => x.t.length > 4), '每条图例都有说明文字');
  assert.equal(r.font, '48px', `图例也是 caption（48）：${r.font}`);
  assert.equal(r.bg, 'rgba(0, 0, 0, 0)', '图例没有底色块');
  assert.ok(Math.abs(r.host.w - 24 - r.legend.r) <= 2, `图例贴右下角（右）：${r.legend.r} vs ${r.host.w - 24}`);
  assert.ok(Math.abs(r.host.h - 24 - r.legend.b) <= 2, `图例贴右下角（下）：${r.legend.b} vs ${r.host.h - 24}`);
});

test('vk-note 不占焦点名额：页上唯一的答案仍是那处 tone="focus"', async () => {
  const tab = await open(`
<vk-canvas w="1680" h="840">
  <vk-box id="q" x="380" y="120" w="420" h="120" surface="soft"></vk-box>
  <vk-text id="ans" x="380" y="300" size="headline" tone="focus">答案</vk-text>
  <vk-note kind="margin" for="#q" w="200">辅助信息不抢焦点。</vk-note>
</vk-canvas>`);
  const n = await tab.evaluate(() => window.vk.focusRegions(document.querySelector('.vk-page')).length);
  assert.equal(n, 1, `vk-note 不该被算成焦点：${n}`);
});

/* --------------------------------------------------------- G1/G2 构建期 */

test('vk-note：构建期找不到目标 / 缺 for / 条目数对不上时直接报错', async () => {
  await assert.rejects(
    () => transformHtml('<vk-canvas><vk-box id="a"></vk-box><vk-note kind="margin" for="#nope">注</vk-note></vk-canvas>', { file: 'g1.html' }),
    /找不到 #nope/,
    '找不到目标必须构建期报错'
  );
  await assert.rejects(
    () => transformHtml('<vk-note kind="margin">注</vk-note>', { file: 'g2.html' }),
    /缺 for/,
    '边注没有 for 必须构建期报错'
  );
  await assert.rejects(
    () => transformHtml('<vk-canvas><vk-box id="a"></vk-box><vk-box id="b"></vk-box><vk-note kind="legend" for="#a;#b"><li>一</li></vk-note></vk-canvas>', {
      file: 'g3.html',
    }),
    /数量必须相同/,
    '图例的条目数与目标数必须一致'
  );
  const ok = await transformHtml(
    '<vk-canvas w="600" h="400"><vk-box id="a" x="40" y="40" w="200" h="120"></vk-box><vk-note kind="margin" for="#a">注</vk-note></vk-canvas>',
    { file: 'g4.html' }
  );
  assert.ok(ok.html.includes('<vk-note'), '找得到目标时构建通过');
});

test('vk-icon 白名单外：构建期只提醒，不再拦构建', async () => {
  const ok = await transformHtml('<vk-icon name="check"></vk-icon>', { file: 'icon.html' });
  assert.ok(ok.html.includes('data-vk-name="check"'), '白名单内的图标要内联');
  const warn = console.warn;
  const got = [];
  console.warn = (...a) => got.push(a.join(' '));
  let out;
  try {
    out = await transformHtml('<vk-icon name="rocket"></vk-icon>', { file: 'icon.html' });
  } finally {
    console.warn = warn;
  }
  assert.ok(out.html.includes('data-vk-name="rocket"'), '白名单外的图标也要内联，不拦构建');
  // 减法第一波：vk-icon 已是别名，构建期先给一条"已合并到 vk-text"的提示；
  // 图标白名单本身的提醒仍在（console 只摘首条，详情见 warnings）。
  assert.match(got.join('\n'), /已合并到 <vk-text>/, '旧名先给一条迁移提示');
  await assert.rejects(
    () => transformHtml('<vk-icon name="not-a-real-icon"></vk-icon>', { file: 'icon.html' }),
    /没有图标/,
    '不存在的图标仍是"没有图标"（客观错误）'
  );
  // 新写法把白名单从"提醒"收紧成"错误"：vk-text 的 icon 是字形，不是装饰。
  await assert.rejects(
    () => transformHtml('<vk-text icon="rocket">x</vk-text>', { file: 'icon.html' }),
    /不在语义图标白名单/,
    'vk-text 的 icon 白名单外要报错'
  );
});

/* ------------------------------------------------- 项目层审美 preset（默认关） */

test('审美 preset 默认不跑：强调色 / 深色 / 页眉 / 120 边距都不进 auditPage', async () => {
  const tab = await open(`
<vk-text size="headline" tone="focus">第一处答案</vk-text>
<vk-text size="headline" tone="focus">第二处答案</vk-text>
<vk-panel variant="dark" pad="md"><vk-text size="body">第一块深色</vk-text></vk-panel>
<vk-panel variant="dark" pad="md"><vk-text size="body">第二块深色</vk-text></vk-panel>
<vk-label variant="kicker">源码 · hello.c</vk-label>`);
  const types = (await auditTypes(tab)).map((x) => x.type);
  assert.deepEqual(
    types.filter((t) => ['accent', 'dark', 'icon', 'header', 'margin'].includes(t)),
    [],
    `默认路径里不该有审美判定：${JSON.stringify(types)}`
  );
});

test('预设 · 强调色 ≤1：--style 下两处报一条，第二处 err / warn 不算', async () => {
  const two = await open(`
<vk-stack gap="md">
  <vk-text size="headline" tone="focus">第一处答案</vk-text>
  <vk-text size="headline" tone="focus">第二处答案</vk-text>
</vk-stack>`);
  const bad = (await auditTypes(two, true)).filter((x) => x.type === 'accent');
  assert.equal(bad.length, 1, '两处强调色要报一条');
  assert.equal(bad[0].count, 2, `报错要带处数：${JSON.stringify(bad[0])}`);
  assert.equal(bad[0].rule, 'accent', '要带上规则 id');
  assert.ok(bad[0].fix.includes('tone="err"'), `fix 要说明 err/warn 的例外：${bad[0].fix}`);

  const one = await open(`
<vk-stack gap="md">
  <vk-text size="headline" tone="focus">答案</vk-text>
  <vk-text size="body" tone="err">反例</vk-text>
  <vk-text size="body" tone="warn">警告</vk-text>
  <vk-label variant="kicker" tone="focus">页眉</vk-label>
</vk-stack>`);
  const clean = (await auditTypes(one, true)).filter((x) => x.type === 'accent');
  assert.equal(clean.length, 0, `一处答案 + err/warn + label 不算超限：${JSON.stringify(clean)}`);
});

test('预设 · 深色块 ≤1：--style 下两块报一条，一块通过', async () => {
  const two = await open(`
<vk-stack gap="md">
  <vk-panel variant="dark" pad="md"><vk-text size="body" ink="primary">第一块深色</vk-text></vk-panel>
  <vk-panel variant="dark" pad="md"><vk-text size="body" ink="primary">第二块深色</vk-text></vk-panel>
</vk-stack>`);
  const bad = (await auditTypes(two, true)).filter((x) => x.type === 'dark');
  assert.equal(bad.length, 1, '两块深色要报一条');
  assert.equal(bad[0].count, 2, `报错要带块数：${JSON.stringify(bad[0])}`);
  assert.ok(
    bad[0].what.includes('一页最多一块深色区域，它应该是本页唯一的"重"'),
    `文案必须是那句：${bad[0].what}`
  );

  const one = await open(`
<vk-stack gap="md">
  <vk-panel variant="dark" pad="md"><vk-text size="body" ink="primary">唯一的深色</vk-text></vk-panel>
  <vk-panel variant="plain" border="hair" pad="md"><vk-text size="body">浅色分区</vk-text></vk-panel>
</vk-stack>`);
  const clean = (await auditTypes(one, true)).filter((x) => x.type === 'dark');
  assert.equal(clean.length, 0, `一块深色必须通过：${JSON.stringify(clean)}`);
});

test('预设 · 图标白名单降级为提醒（level=warn，不是错误）', async () => {
  const tab = await open('<vk-icon name="rocket" size="lg"></vk-icon>');
  const bad = (await auditTypes(tab, true)).filter((x) => x.type === 'icon');
  assert.equal(bad.length, 1, `白名单外的图标只提醒一次：${JSON.stringify(bad)}`);
  assert.equal(bad[0].level, 'warn', `图标提醒不能是 error：${bad[0].level}`);
  assert.ok(bad[0].what.includes('rocket'), `提醒要写出名字：${bad[0].what}`);
  assert.ok(bad[0].fix.includes('circle-check'), `fix 要给出可用名：${bad[0].fix}`);

  const ok = await open('<vk-icon name="check" size="lg"></vk-icon>');
  const clean = (await auditTypes(ok, true)).filter((x) => x.type === 'icon');
  assert.equal(clean.length, 0, `白名单内的图标不该提醒：${JSON.stringify(clean)}`);
});

test('预设 · 页眉不许含文件名/页号（--style）', async () => {
  const file = await open('<vk-label variant="kicker">源码 · hello.c</vk-label>');
  const f = (await auditTypes(file, true)).filter((x) => x.type === 'header');
  assert.equal(f.length, 1, `页眉里的文件名要报：${JSON.stringify(f)}`);
  assert.ok(f[0].what.includes('hello.c'), f[0].what);

  const page = await open('<vk-label variant="kicker">第 3 页 · 汇编</vk-label>');
  assert.equal((await auditTypes(page, true)).filter((x) => x.type === 'header').length, 1, '页眉里的页号要报');

  const good = await open('<vk-label variant="kicker" index="3" total="5" section="汇编"></vk-label>');
  const clean = (await auditTypes(good, true)).filter((x) => x.type === 'header');
  assert.equal(clean.length, 0, `工序进度不是页号：${JSON.stringify(clean)}`);
});

test('预设 · 内容落在 120 边距内（--style，覆盖层豁免）', async () => {
  // 红：内容贴着 96 顶带（vk-page 的网格行），不在 120 以内。
  const bad = await open('<vk-text size="body">内容贴着顶带。</vk-text>');
  const badIssues = (await auditTypes(bad, true)).filter((x) => x.type === 'margin');
  assert.equal(badIssues.length, 1, `贴着 96 顶带的正文要报：${JSON.stringify(badIssues)}`);
  assert.ok(badIssues[0].what.includes('120 边距'), badIssues[0].what);
  assert.ok(badIssues[0].fix.includes('120'), `fix 要指出改法：${badIssues[0].fix}`);

  // 绿：把内容压到 120 以内。
  const good = await open('<div style="height:24px"></div><vk-text size="body">内容在 120 以内。</vk-text>');
  const clean = (await auditTypes(good, true)).filter((x) => x.type === 'margin');
  assert.equal(clean.length, 0, `120 以内的内容不该报：${JSON.stringify(clean)}`);

  // 覆盖层豁免：边注文字故意落到 120 边距外，也不算"内容越界"。
  const overlay = await open(`
<div style="height:24px"></div>
<vk-canvas w="1680" h="840">
  <vk-box id="mo" x="0" y="0" w="400" h="160" surface="soft" border="hair"></vk-box>
  <vk-note kind="margin" for="#mo" side="left" w="240">这段边注故意落在 120 边距外。</vk-note>
</vk-canvas>`);
  const overlayIssues = (await auditTypes(overlay, true)).filter((x) => x.type === 'margin');
  assert.equal(overlayIssues.length, 0, `覆盖层不受 120 边距约束：${JSON.stringify(overlayIssues)}`);
});
