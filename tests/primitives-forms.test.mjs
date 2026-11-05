import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { startServer } from '../cli/serve.mjs';
import { transformHtml } from '../src/highlight.mjs';

/**
 * 基础原语各自的形态：图标、描边环、贴块标签、气泡注解、窗头分区。
 *
 * 每个形态至少一条断言：这些是标签自己的属性，不是另一个标签。
 */

const { base, close: closeServer } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
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
  await closeBrowser(browser);
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

test('vk-note variant="bubble"：泡 + 引线的几何', async () => {
  const tab = await open(`
<vk-canvas w="1200" h="600">
  <vk-box id="t" x="200" y="180" w="420" h="180" surface="soft" border="hair" radius="lg" pad="md">
    <vk-text size="subhead" mono>s[5]</vk-text>
  </vk-box>
  <vk-note id="n" variant="bubble" for="#t@side:right" side="right" n="1" tone="warn">这里越界</vk-note>
</vk-canvas>`);
  const r = await tab.evaluate(() => {
    const q = (sel) => document.querySelector(sel);
    const rect = (sel) => q(sel).getBoundingClientRect().toJSON();
    return {
      bubble: rect('#n .vk-pin-bd'),
      target: rect('#t'),
      text: q('#n .vk-pin-t').textContent.trim(),
      leader: !!q('#n .vk-pin-leader'),
      variant: q('#n').dataset.variant,
      side: q('#n').dataset.side,
      badge: q('#n .vk-pin-n').textContent.trim(),
    };
  });
  assert.equal(r.variant, 'bubble', 'variant 落到 data-variant');
  assert.equal(r.side, 'right', 'side 落到 data-side');
  assert.ok(r.bubble.left > r.target.right, `气泡应在目标右侧：${r.bubble.left} vs ${r.target.right}`);
  assert.ok(Math.abs(r.bubble.top + r.bubble.height / 2 - (r.target.top + r.target.height / 2)) <= 2, '气泡与目标同高');
  assert.equal(r.text, '这里越界');
  assert.ok(r.leader, '气泡要有引线');
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
