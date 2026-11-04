import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { transformHtml } from '../src/highlight.mjs';

/**
 * 减法第一波：六个"能被更基础标签替代"的标签并掉，旧名保留为别名。
 *
 *   vk-icon    → vk-text（icon="名称"）
 *   vk-rule    → vk-box（border="hair" / 1px 高的面）
 *   vk-caption → vk-label（for + anchor）
 *   vk-pin     → vk-note（variant="bubble"）
 *   vk-ring    → vk-box（ring）
 *   vk-window  → vk-panel（chrome="dots"）
 *
 * 每个新属性至少一条断言；旧名再验一次"还能用 + 构建期有一条迁移提示"。
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
<body style="margin:0"><vk-page>${body}</vk-page><script src="dist/vk.js"></script></body></html>`,
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

test('vk-text icon：字形与文字共存，白名单外构建期报错', async () => {
  const tab = await open(`
<vk-stack gap="md">
  <vk-text id="with" size="body" icon="check">已通过</vk-text>
  <vk-text id="without" size="body">已通过</vk-text>
</vk-stack>`);
  const r = await tab.evaluate(() => {
    const withIcon = document.querySelector('#with');
    const without = document.querySelector('#without');
    const ic = withIcon.querySelector('.vk-text-ic');
    const ir = ic?.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(withIcon).fontSize);
    return {
      hasSlot: !!ic,
      hasOther: !!without.querySelector('.vk-text-ic'),
      svg: (ic?.querySelector('svg')?.innerHTML || '').length > 20,
      text: withIcon.textContent.trim(),
      iconH: ir ? ir.height : 0,
      fs,
      // 图标在文字前面，且与文字同处一个行盒。
      firstIsIcon: withIcon.firstElementChild === ic,
    };
  });
  assert.ok(r.hasSlot, '写了 icon 就该有图标槽');
  assert.ok(!r.hasOther, '没写 icon 就没有空槽');
  assert.ok(r.svg, '图标槽里要真的内联 svg');
  assert.equal(r.text, '已通过', '图标不带字：textContent 仍是这一行文字');
  assert.ok(Math.abs(r.iconH - r.fs) <= 2, `图标是 1em：${r.iconH} vs ${r.fs}`);
  assert.ok(r.firstIsIcon, '图标是这个字形的开头');

  await assert.rejects(
    () => transformHtml('<vk-text icon="rocket">x</vk-text>', { file: 'icon.html' }),
    /不在语义图标白名单/,
    'vk-text 的 icon 白名单外要报错'
  );
  await assert.rejects(
    () => transformHtml('<vk-text icon="not-a-real-icon">x</vk-text>', { file: 'icon.html' }),
    /没有图标/,
    '不存在的图标仍是客观错误'
  );
});

test('vk-box ring：描边环不占布局，tone 换环色', async () => {
  const tab = await open(`
<vk-stack gap="md">
  <vk-box id="plain" pad="md" border="hair"><vk-text size="body">一块面</vk-text></vk-box>
  <vk-box id="ringed" ring pad="md" border="hair"><vk-text size="body">一块面</vk-text></vk-box>
  <vk-box id="warn" ring tone="warn" pad="md" border="hair"><vk-text size="body">一块面</vk-text></vk-box>
</vk-stack>`);
  const r = await tab.evaluate(() => {
    const box = (id) => document.querySelector(id);
    const rect = (id) => box(id).getBoundingClientRect().toJSON();
    return {
      plain: getComputedStyle(box('#plain')).boxShadow,
      ringed: getComputedStyle(box('#ringed')).boxShadow,
      warn: getComputedStyle(box('#warn')).boxShadow,
      plainRect: rect('#plain'),
      ringedRect: rect('#ringed'),
    };
  });
  assert.equal(r.plain, 'none', '不写 ring 就没有环');
  assert.notEqual(r.ringed, 'none', 'ring 要给一圈 box-shadow');
  assert.notEqual(r.ringed, r.warn, 'tone 换环色');
  assert.ok(Math.abs(r.plainRect.width - r.ringedRect.width) < 0.6, '环不占布局：宽不变');
  assert.ok(Math.abs(r.plainRect.height - r.ringedRect.height) < 0.6, '环不占布局：高不变');
});

test('vk-label for：贴块说明的左边界对齐目标首字符', async () => {
  const tab = await open(`
<vk-stack gap="lg">
  <vk-box id="a" surface="none" pad="lg"><vk-text size="headline" mono>printf("%s\\n", s);</vk-text></vk-box>
  <vk-box id="b" surface="none" pad="lg"><vk-text size="body" mono>call 4026cc</vk-text></vk-box>
  <vk-label id="la" for="#a">你写的</vk-label>
  <vk-label id="lb" for="#b">编译器给的</vk-label>
</vk-stack>`);
  const r = await tab.evaluate(() => {
    const measure = (id) => {
      const host = document.querySelector(id);
      const span = host.querySelector('.vk-caption');
      const target = document.querySelector(host.getAttribute('for'));
      const tr = target.getBoundingClientRect();
      const sr = span.getBoundingClientRect();
      // 目标块里第一个真正要读的字（与实现无关的量法）。
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      let glyph = null;
      for (let n = walker.nextNode(); n && !glyph; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const rects = [...range.getClientRects()].filter((x) => x.width > 0.5);
        if (rects.length) glyph = rects[0];
      }
      return {
        dx: Math.abs(sr.left - glyph.left),
        gap: tr.top - sr.bottom,
        anchor: host.dataset.side,
        visible: getComputedStyle(span).visibility,
        remainsInFlow: getComputedStyle(host).position,
      };
    };
    return { a: measure('#la'), b: measure('#lb'), text: document.querySelector('#la .vk-label-t').textContent };
  });
  assert.equal(r.text, '你写的');
  assert.ok(r.a.dx <= 2, `左边界应贴目标首字符，差 ${r.a.dx}px`);
  assert.ok(r.b.dx <= 2, `第二个目标的左边界也应贴首字符，差 ${r.b.dx}px`);
  assert.ok(r.a.gap >= 10 && r.a.gap <= 24, `上方说明与目标间净空 16，实际 ${r.a.gap}`);
  assert.equal(r.a.anchor, 'top', '默认贴上方');
  assert.equal(r.a.visible, 'visible');
  assert.equal(r.a.remainsInFlow, 'absolute', '贴块的 label 是覆盖层，不占正文布局');
});

test('vk-label side：top / bottom 换方向', async () => {
  const tab = await open(`
<vk-stack gap="lg">
  <vk-box id="t" surface="none" pad="lg"><vk-text size="body">目标块</vk-text></vk-box>
  <vk-label id="below" for="#t" side="bottom">贴在下面</vk-label>
</vk-stack>`);
  const r = await tab.evaluate(() => {
    const host = document.querySelector('#below');
    const span = host.querySelector('.vk-caption');
    const tr = document.querySelector('#t').getBoundingClientRect();
    const sr = span.getBoundingClientRect();
    return { gap: sr.top - tr.bottom, anchor: host.dataset.side };
  });
  assert.ok(r.gap >= 10 && r.gap <= 24, `below 的净空也应是 16，实际 ${r.gap}`);
  assert.equal(r.anchor, 'bottom');
});

test('vk-note variant="bubble"：泡 + 引线与旧 vk-pin 同几何', async () => {
  const tab = await open(`
<vk-canvas w="1200" h="600">
  <vk-box id="t" x="200" y="180" w="420" h="180" surface="soft" border="hair" radius="lg" pad="md">
    <vk-text size="subhead" mono>s[5]</vk-text>
  </vk-box>
  <vk-note id="n" variant="bubble" for="#t@side:right" side="right" n="1" tone="warn">这里越界</vk-note>
  <vk-pin id="p" for="#t@side:right" side="right" n="1" tone="warn">这里越界</vk-pin>
</vk-canvas>`);
  const r = await tab.evaluate(() => {
    const box = (sel) => document.querySelector(sel).getBoundingClientRect().toJSON();
    const q = (id) => document.querySelector(id);
    return {
      bubble: box('#n .vk-pin-bd'),
      pin: box('#p .vk-pin-bd'),
      bubbleText: q('#n .vk-pin-t').textContent.trim(),
      pinText: q('#p .vk-pin-t').textContent.trim(),
      bubbleLeader: !!q('#n .vk-pin-leader'),
      pinLeader: !!q('#p .vk-pin-leader'),
      variant: q('#n').dataset.variant,
      alias: q('#p').dataset.vkAlias,
      badge: q('#n .vk-pin-n').textContent.trim(),
    };
  });
  for (const k of ['left', 'top', 'width', 'height']) {
    assert.ok(Math.abs(r.bubble[k] - r.pin[k]) <= 1, `气泡 ${k} 应与旧 vk-pin 一致：${r.bubble[k]} vs ${r.pin[k]}`);
  }
  assert.equal(r.bubbleText, '这里越界');
  assert.equal(r.pinText, '这里越界');
  assert.ok(r.bubbleLeader && r.pinLeader, '两者都该有引线');
  assert.equal(r.variant, 'bubble', 'variant 落到 data-variant');
  assert.equal(r.alias, 'vk-note', '旧名自己标明转发给谁');
  assert.equal(r.badge, '1', '编号 n 仍是编号');
});

test('vk-panel chrome="dots"：三点窗头与标题带', async () => {
  const tab = await open(`
<vk-stack gap="md">
  <vk-panel id="win" chrome="dots" title="main.c"><vk-text size="body">窗里的内容</vk-text></vk-panel>
  <vk-panel id="plain" title="一块分区"><vk-text size="body">分区里的内容</vk-text></vk-panel>
</vk-stack>`);
  const r = await tab.evaluate(() => {
    const win = document.querySelector('#win');
    const plain = document.querySelector('#plain');
    const dots = win.querySelectorAll('.vk-panel-hd .vk-dots i');
    const hd = win.querySelector('.vk-panel-hd');
    return {
      dots: dots.length,
      plainDots: plain.querySelectorAll('.vk-dots').length,
      chrome: win.dataset.chrome,
      title: win.querySelector('.vk-panel-hd .vk-label-t').textContent.trim(),
      hdH: hd.getBoundingClientRect().height,
      border: getComputedStyle(win).borderTopWidth,
    };
  });
  assert.equal(r.dots, 3, 'chrome="dots" 要真的有三枚点');
  assert.equal(r.plainDots, 0, '默认 chrome="none" 没有三点');
  assert.equal(r.chrome, 'dots');
  assert.equal(r.title, 'main.c', '标题仍在标题带里');
  assert.ok(r.hdH >= 60, `窗头应按窗的令牌撑高，实际 ${r.hdH}`);
  assert.equal(r.border, '2px', '窗体要有窗的边框');
});

test('六个旧标签是别名：转发到新标签并给一条构建期提示', async () => {
  // 构建期：每条旧名一条迁移提示，不拦构建。
  const warn = console.warn;
  const got = [];
  console.warn = (...a) => got.push(a.join(' '));
  try {
    await transformHtml(
      `<vk-page><vk-box id="a" pad="md"><vk-text size="body">目标</vk-text></vk-box>
        <vk-icon name="check"></vk-icon><vk-rule></vk-rule>
        <vk-window title="main.c"><vk-text size="body">窗</vk-text></vk-window>
        <vk-caption for="#a">注</vk-caption><vk-pin for="#a">注</vk-pin><vk-ring for="#a"></vk-ring></vk-page>`,
      { file: 'aliases.html' }
    );
  } finally {
    console.warn = warn;
  }
  const log = got.join('\n');
  assert.match(log, /已合并到/, '旧标签要有一条迁移提示');
  assert.match(log, /旧名保留/, '提示要说清旧名仍然可用');

  // 运行期：六个旧名都还有自己的 DOM 与行为。
  const tab = await open(`
<vk-canvas w="1200" h="600">
  <vk-box id="a" x="200" y="160" w="360" h="160" surface="soft" border="hair" radius="lg" pad="md">
    <vk-text size="body">目标</vk-text>
  </vk-box>
  <vk-icon id="i" name="check" size="lg"></vk-icon>
  <vk-rule id="r"></vk-rule>
  <vk-window id="w" title="main.c"><vk-text size="body">窗里的内容</vk-text></vk-window>
  <vk-caption id="c" for="#a">注</vk-caption>
  <vk-pin id="p" for="#a" side="right">注</vk-pin>
  <vk-ring id="g" for="#a" variant="rect" pad-px="8"></vk-ring>
</vk-canvas>`);
  const r = await tab.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const rect = (el) => el.getBoundingClientRect();
    return {
      aliases: ['#i', '#r', '#w', '#c', '#p', '#g'].map((s) => q(s)?.dataset.vkAlias),
      iconSvg: !!q('#i .vk-icon svg'),
      ruleH: rect(q('#r')).height,
      winBd: !!q('#w .vk-win-bd'),
      caption: q('#c .vk-caption')?.textContent.trim(),
      pinBd: !!q('#p .vk-pin-bd'),
      ringW: rect(q('#g')).width,
      targetW: rect(q('#a')).width,
    };
  });
  assert.deepEqual(r.aliases, ['vk-text', 'vk-box', 'vk-panel', 'vk-label', 'vk-note', 'vk-box']);
  assert.ok(r.iconSvg, 'vk-icon 仍画出图标');
  assert.ok(r.ruleH > 0 && r.ruleH <= 4, `vk-rule 是一条 1px 级的线，实际 ${r.ruleH}`);
  assert.ok(r.winBd, 'vk-window 仍有窗壳');
  assert.equal(r.caption, '注', 'vk-caption 仍是一行归属说明');
  assert.ok(r.pinBd, 'vk-pin 仍有气泡');
  // 一个环 = 目标盒 + 两侧 pad-px（8）。
  assert.ok(Math.abs(r.ringW - (r.targetW + 16)) <= 1, `vk-ring 应套住目标：${r.ringW} vs ${r.targetW}+16`);
});
