import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { startServer } from '../cli/serve.mjs';

/**
 * 库级默认值：
 *   1. vk-flow / vk-annotate 的箭头按容器高缩放，28–64；arrow-label 挂中轴词；
 *   2. vk-label variant="tag" 是 36px / .08em / 无底无框；
 *   3. vk-pair tone-a / tone-b 左右分色；
 *   4. vk-text fit 的 fit-min 是硬地板，放不下给 data-fit-overflow；
 *   5. 项目层 preset 的 copy 规则（level=warn，默认不跑）。
 *
 * 这些都是「默认值」而不是页面 CSS：下面每一页都不写 <style>、不写内联样式，
 * 只靠属性与库的规则。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
const opened = [];
const logs = [];

async function open(body) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tab = await ctx.newPage();
  opened.push(ctx);
  tab.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') logs.push(m.text());
  });
  await tab.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body>${body}<script src="dist/vk.js"></script></body></html>`,
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
  await close();
});

test('vk-flow 箭头：默认画，尺寸 = 容器高 × arrow-scale（28–64），线宽 = 尺寸 × 0.1', async () => {
  const tab = await open(`
<div style="width:1200px;height:480px;display:flex;flex-direction:column">
  <vk-flow id="f" fill arrow-scale="0.12">
    <li label="你写的" tone="info"><vk-text mono>printf</vk-text></li>
    <li label="机器写的" tone="ok"><vk-text mono>call _puts</vk-text></li>
  </vk-flow>
</div>
<div style="width:1200px;height:200px;display:flex;flex-direction:column">
  <vk-flow id="cap" fill arrow-scale="0.6">
    <li label="a" tone="info"><vk-text mono>a</vk-text></li>
    <li label="b" tone="ok"><vk-text mono>b</vk-text></li>
  </vk-flow>
</div>
<div style="width:1200px;height:100px;display:flex;flex-direction:column">
  <vk-flow id="floor" fill>
    <li label="a" tone="info"><vk-text mono>a</vk-text></li>
    <li label="b" tone="ok"><vk-text mono>b</vk-text></li>
  </vk-flow>
</div>
<vk-flow id="off" arrow="false">
  <li label="a"><vk-text mono>a</vk-text></li>
  <li label="b"><vk-text mono>b</vk-text></li>
</vk-flow>`);
  const r = await tab.evaluate(() => {
    const one = (id) => {
      const host = document.getElementById(id);
      const box = host.querySelector('.vk-flow');
      const arrow = host.querySelector('.vk-flow-arrow');
      const cs = getComputedStyle(box);
      return {
        h: box.getBoundingClientRect().height,
        arrowCount: host.querySelectorAll('.vk-flow-arrow').length,
        size: cs.getPropertyValue('--vk-flow-arrow-size').trim(),
        line: cs.getPropertyValue('--vk-flow-line-w').trim(),
        tip: cs.getPropertyValue('--vk-flow-tip').trim(),
        before: arrow ? getComputedStyle(arrow, '::before').height : null,
        after: arrow ? getComputedStyle(arrow, '::after').borderLeftWidth : null,
        dataArrow: host.dataset.arrow,
        dataSize: host.dataset.arrowSize,
      };
    };
    return { f: one('f'), cap: one('cap'), floor: one('floor'), off: one('off') };
  });
  assert.equal(r.f.arrowCount, 1, '两步之间必须画一根箭头');
  assert.equal(r.f.dataArrow, 'true', '不写 arrow 时默认就是 true');
  assert.ok(Math.abs(r.f.h - 480) < 1.5, `flow 应撑满 480：${r.f.h}`);
  const want = 480 * 0.12;
  assert.ok(Math.abs(parseFloat(r.f.size) - want) < 0.5, `尺寸应为 480 × 0.12 = 57.6：${r.f.size}`);
  assert.ok(Math.abs(parseFloat(r.f.line) - want * 0.1) < 0.1, `线宽应为尺寸 × 0.1：${r.f.line}`);
  assert.ok(Math.abs(parseFloat(r.f.before) - want * 0.1) < 0.6, `::before 高度就是线宽：${r.f.before}`);
  assert.ok(Math.abs(parseFloat(r.f.after) - want * 0.55) < 0.8, `三角进深也跟着尺寸：${r.f.after}`);
  assert.equal(parseFloat(r.cap.size), 64, '0.6 × 200 会撞到 64 上限');
  assert.equal(parseFloat(r.floor.size), 28, '0.12 × 100 会落回 28 下限');
  assert.equal(r.off.arrowCount, 0, 'arrow="false" 不画箭头');
  assert.equal(r.off.dataArrow, 'false');
});

test('vk-flow arrow-label：中轴挂词，字号 36（caption × 0.75），纸色底垫断轴线', async () => {
  const tab = await open(`
<vk-flow id="f" arrow-label="gcc" gap="48" arrow-scale="0.3">
  <li label="你写的" tone="info"><vk-text mono>printf("%s\\n", s);</vk-text></li>
  <li label="机器写的" tone="ok"><vk-text mono>call _puts</vk-text></li>
</vk-flow>`);
  const r = await tab.evaluate(() => {
    const host = document.querySelector('#f');
    const word = host.querySelector('.vk-flow-arrow-label');
    const span = word?.querySelector('.vk-label');
    const arrow = host.querySelector('.vk-flow-arrow');
    const wb = word?.getBoundingClientRect();
    const ab = arrow?.getBoundingClientRect();
    return {
      text: word?.textContent.trim(),
      fs: word ? getComputedStyle(word).fontSize : '',
      ls: word ? getComputedStyle(word).letterSpacing : '',
      bg: span ? getComputedStyle(span).backgroundColor : '',
      border: span ? getComputedStyle(span).borderTopWidth : '',
      centerX: wb ? wb.left + wb.width / 2 : 0,
      arrowX: ab ? ab.left + ab.width / 2 : 0,
    };
  });
  assert.equal(r.text, 'gcc', 'arrow-label 必须真的挂上去');
  assert.equal(r.fs, '36px', `字号 = caption 48 × 0.75 = 36：${r.fs}`);
  assert.ok(Math.abs(parseFloat(r.ls) - 36 * 0.08) < 0.2, `tag 档字距 .08em：${r.ls}`);
  assert.notEqual(r.bg, 'rgba(0, 0, 0, 0)', '纸色底必须垫住轴线');
  assert.equal(r.border, '0px', 'tag 档不加框');
  assert.ok(Math.abs(r.centerX - r.arrowX) < 1.5, '词挂在中轴正中');
});

test('vk-label variant="tag"：36px / .08em / 无底无框，tone 决定颜色', async () => {
  const tab = await open(`
<vk-label id="tag" variant="tag" tone="ok">你写的</vk-label>
<vk-label id="kick" variant="kicker">页眉</vk-label>`);
  const r = await tab.evaluate(() => {
    const one = (id) => {
      const host = document.getElementById(id);
      const box = host.querySelector('.vk-label');
      const cs = getComputedStyle(host);
      const bcs = getComputedStyle(box);
      return {
        fs: cs.fontSize,
        ls: cs.letterSpacing,
        color: cs.color,
        bg: bcs.backgroundColor,
        border: bcs.borderTopWidth,
        pad: bcs.paddingLeft,
      };
    };
    return { tag: one('tag'), kick: one('kick') };
  });
  assert.equal(r.tag.fs, '36px', `tag 是 36px：${r.tag.fs}`);
  assert.ok(Math.abs(parseFloat(r.tag.ls) - 36 * 0.08) < 0.2, `字距 .08em：${r.tag.ls}`);
  assert.equal(r.tag.bg, 'rgba(0, 0, 0, 0)', 'tag 不加底');
  assert.equal(r.tag.border, '0px', 'tag 不加框');
  assert.equal(r.tag.pad, '0px', 'tag 不加内距');
  assert.equal(r.tag.color, 'rgb(7, 84, 74)', 'tag 的颜色来自 tone=ok');
  assert.equal(r.kick.fs, '48px', 'kicker 仍是 caption 48，旧页不变');
});

test('vk-pair tone：左右分色 wash + 1px 同色描边；不写不改现状', async () => {
  const tab = await open(`
<vk-pair id="p" tone="info,ok" gap="24" symbol="→">
  <vk-text size="body">你写的</vk-text>
  <vk-text size="body">机器写的</vk-text>
</vk-pair>
<vk-pair id="plain" gap="24" symbol="→">
  <vk-text size="body">左</vk-text>
  <vk-text size="body">右</vk-text>
</vk-pair>`);
  const r = await tab.evaluate(() => {
    const one = (id) => {
      const host = document.getElementById(id);
      const left = host.querySelector('.vk-pair-l');
      const right = host.querySelector('.vk-pair-r');
      const lcs = getComputedStyle(left);
      const rcs = getComputedStyle(right);
      return {
        leftBg: lcs.backgroundColor,
        rightBg: rcs.backgroundColor,
        leftBorder: lcs.borderTopWidth,
        rightBorder: rcs.borderTopWidth,
        leftTone: left.dataset.tone || '',
        rightTone: right.dataset.tone || '',
      };
    };
    return { p: one('p'), plain: one('plain') };
  });
  assert.notEqual(r.p.leftBg, 'rgba(0, 0, 0, 0)', 'tone="info,ok" 的左段要给左块 wash 底');
  assert.notEqual(r.p.rightBg, 'rgba(0, 0, 0, 0)', 'tone="info,ok" 的右段要给右块 wash 底');
  assert.notEqual(r.p.leftBg, r.p.rightBg, '左右是两支不同的语义色');
  assert.equal(r.p.leftBorder, '1px', '左块 1px 描边');
  assert.equal(r.p.rightBorder, '1px', '右块 1px 描边');
  assert.equal(r.p.leftTone, 'info');
  assert.equal(r.p.rightTone, 'ok');
  assert.equal(r.plain.leftBg, 'rgba(0, 0, 0, 0)', '不写 tone 时左块仍透明');
  assert.equal(r.plain.rightBg, 'rgba(0, 0, 0, 0)', '不写 tone 时右块仍透明');
  assert.equal(r.plain.leftBorder, '0px', '不写 tone 时不加框');
  assert.equal(r.plain.leftTone, '', '不写 tone 时不落 data-tone');
});

test('vk-text fit="width"：fit-min 是硬地板，放不下加 data-fit-overflow 并提醒', async () => {
  logs.length = 0;
  const tab = await open(`
<div style="width:120px"><vk-text id="narrow" mono fit="width">printf("%s\\n", s);</vk-text></div>
<div style="width:900px"><vk-text id="wide" mono fit="width">printf("%s\\n", s);</vk-text></div>`);
  await tab.waitForTimeout(80);
  const r = await tab.evaluate(() => {
    const one = (id) => {
      const el = document.getElementById(id);
      const range = document.createRange();
      range.selectNodeContents(el);
      const rect = [...range.getClientRects()].find((x) => x.width > 0.5);
      return {
        fs: parseFloat(getComputedStyle(el).fontSize),
        overflow: el.hasAttribute('data-fit-overflow'),
        line: rect ? rect.width / (el.getBoundingClientRect().width / el.clientWidth) : 0,
        box: el.clientWidth,
      };
    };
    return { narrow: one('narrow'), wide: one('wide') };
  });
  assert.equal(r.narrow.fs, 40, `掉到地板 40 就不再缩：${r.narrow.fs}`);
  assert.equal(r.narrow.overflow, true, '放不下时宿主必须带 data-fit-overflow');
  assert.ok(r.narrow.line > r.narrow.box, `地板字号仍比 120 宽：${r.narrow.line} vs ${r.narrow.box}`);
  assert.ok(
    logs.some((s) => s.includes('容器太窄，建议减少并列块或换竖排')),
    `运行期要给出那句提醒：${logs.join(' | ')}`
  );
  assert.equal(r.wide.overflow, false, '放得下时不带 data-fit-overflow');
  assert.ok(r.wide.fs > 40, `900px 容器应放大到 40 以上：${r.wide.fs}`);
  assert.ok(Math.abs(r.wide.line - r.wide.box) <= 2, `放得下时要填满：${r.wide.line} vs ${r.wide.box}`);
});

test('预设 · 字幕短句：句号 / 超 18 字报提醒（level=warn，默认不跑）', async () => {
  const tab = await open(`
<vk-page><vk-stack gap="md">
  <vk-text size="caption">这一句有句号。</vk-text>
  <vk-text size="caption">这一行超过十八个字用来测试字幕规则是否真的会给出提醒</vk-text>
  <vk-text size="body">正文可以有句号，也不按字幕判。</vk-text>
</vk-stack></vk-page>`);
  const r = await tab.evaluate(() => {
    const pick = (style) =>
      (window.vk.auditPage(document, { style }).issues || [])
        .filter((x) => x.type === 'copy')
        .map((x) => ({ level: x.level, rule: x.rule, fix: x.fix || '', what: x.what }));
    return { off: pick(false), on: pick(true) };
  });
  assert.equal(r.off.length, 0, '默认路径不跑文案规则');
  assert.equal(r.on.length, 2, `句号 + 超 18 字各一条：${JSON.stringify(r.on)}`);
  assert.ok(r.on.every((x) => x.level === 'warn'), 'copy 是提醒，不是错误');
  assert.ok(r.on.every((x) => x.rule === 'copy'), '要带规则 id');
  assert.ok(r.on.some((x) => x.what.includes('句号')), '句号要报出来');
  assert.ok(r.on.some((x) => x.what.includes('上限 18')), '超 18 字要报出来');
  assert.ok(r.on.every((x) => x.fix.includes('18')), 'fix 要给出改法');
});
