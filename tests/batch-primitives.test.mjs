import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * 根因批次 R：把 demo 第 06 页靠页内 CSS 硬做的五件事补成原语。
 *
 *   R1 vk-pair      两块并置 + 中轴 + 可选中轴符号
 *   R2 vk-text       fit="width"：单行塞满容器
 *   R3 vk-caption   贴在目标块上方/下方，左边界对齐首字符
 *   R4 surface      代码窗 / 终端的 paper / dark / inset，与 current 共存
 *   R5 paper        默认纸色是纯白
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const opened = [];

async function open(body) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tab = await ctx.newPage();
  opened.push(ctx);
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

const rect = (el) => el.getBoundingClientRect();

test('vk-pair：两块并置、轴居中、split=30 比例正确、symbol 在轴中点', async () => {
  const tab = await open(`
<vk-page><div style="width:1200px">
  <vk-pair id="p50" split="50" gap="40" axis="line" axis-width="2" symbol="→" symbol-size="64">
    <vk-box id="pa" surface="soft"><vk-text size="body">左</vk-text></vk-box>
    <vk-box id="pb" surface="soft"><vk-text size="body">右</vk-text></vk-box>
  </vk-pair>
  <vk-pair id="p30" split="30" gap="24">
    <vk-box id="pc" surface="soft"><vk-text size="body">左</vk-text></vk-box>
    <vk-box id="pd" surface="soft"><vk-text size="body">右</vk-text></vk-box>
  </vk-pair>
</div></vk-page>`);
  const r = await tab.evaluate(() => {
    const q = (sel) => document.querySelector(sel);
    const pair = q('#p50');
    const box = pair.querySelector('.vk-pair');
    const left = pair.querySelector('.vk-pair-l');
    const right = pair.querySelector('.vk-pair-r');
    const axis = pair.querySelector('.vk-pair-axis');
    const sym = pair.querySelector('.vk-pair-sym');
    const br = box.getBoundingClientRect();
    const lr = left.getBoundingClientRect();
    const rr = right.getBoundingClientRect();
    const ar = axis.getBoundingClientRect();
    const sr = sym.getBoundingClientRect();
    const cs = getComputedStyle(box);
    const gap = parseFloat(cs.getPropertyValue('--vk-pair-gap'));
    const pair30 = q('#p30');
    const l30 = pair30.querySelector('.vk-pair-l').getBoundingClientRect().width;
    const r30 = pair30.querySelector('.vk-pair-r').getBoundingClientRect().width;
    return {
      containerW: br.width,
      containerLeft: br.left,
      containerTop: br.top,
      containerH: br.height,
      leftW: lr.width,
      rightW: rr.width,
      axisCenterX: ar.left + ar.width / 2,
      axisWidth: ar.width,
      symText: sym.textContent,
      symCenterX: sr.left + sr.width / 2,
      symCenterY: sr.top + sr.height / 2,
      gap,
      left30: l30,
      right30: r30,
    };
  });
  assert.equal(r.symText, '→', 'symbol="→" 必须真的出现在轴上');
  assert.equal(Math.round(r.axisWidth), 2, 'axis-width="2" 是 2px');
  assert.ok(
    Math.abs(r.leftW + r.rightW - (r.containerW - 2 * r.gap)) <= 1.5,
    `两块宽度和应 = 容器宽 - 2×gap：${r.leftW} + ${r.rightW} vs ${r.containerW} - ${2 * r.gap}`
  );
  assert.ok(
    Math.abs(r.axisCenterX - (r.containerLeft + r.leftW + r.gap)) <= 1.5,
    `轴应在 2×gap 沟槽正中：轴 ${r.axisCenterX}，期望 ${r.containerLeft + r.leftW + r.gap}`
  );
  assert.ok(Math.abs(r.symCenterX - r.axisCenterX) <= 1.5, '符号必须落在轴中线上');
  assert.ok(
    Math.abs(r.symCenterY - (r.containerTop + r.containerH / 2)) <= 1.5,
    '符号必须落在容器高度的中点'
  );
  assert.ok(
    Math.abs(r.left30 / (r.left30 + r.right30) - 0.3) < 0.01,
    `split=30 时左块应占 30%：${(r.left30 / (r.left30 + r.right30)).toFixed(3)}`
  );
});

test('vk-pair：symbol 的三种写法都出现，axis="none" 只剩空轴', async () => {
  const tab = await open(`
<vk-page><div style="width:1200px">
  <vk-pair id="arrow" symbol="→"><vk-text size="body">a</vk-text><vk-text size="body">b</vk-text></vk-pair>
  <vk-pair id="eq" symbol="="><vk-text size="body">a</vk-text><vk-text size="body">b</vk-text></vk-pair>
  <vk-pair id="vs" symbol="vs"><vk-text size="body">a</vk-text><vk-text size="body">b</vk-text></vk-pair>
  <vk-pair id="bare" symbol="none"><vk-text size="body">a</vk-text><vk-text size="body">b</vk-text></vk-pair>
  <vk-pair id="off" axis="none" symbol="→"><vk-text size="body">a</vk-text><vk-text size="body">b</vk-text></vk-pair>
</div></vk-page>`);
  const r = await tab.evaluate(() => {
    const out = {};
    for (const id of ['arrow', 'eq', 'vs', 'bare', 'off']) {
      const el = document.getElementById(id);
      const sym = el.querySelector('.vk-pair-sym');
      const axis = el.querySelector('.vk-pair-axis');
      out[id] = {
        sym: sym ? sym.textContent : null,
        symVisible: !!(sym && getComputedStyle(sym).display !== 'none'),
        axisVisible: !!axis && getComputedStyle(axis).display !== 'none',
        axisAttr: el.dataset.axis,
      };
    }
    return out;
  });
  assert.equal(r.arrow.sym, '→');
  assert.equal(r.eq.sym, '=');
  assert.equal(r.vs.sym, 'vs');
  assert.equal(r.bare.sym, null, 'symbol="none" 不生成符号节点');
  assert.equal(r.off.sym, null, 'axis="none" 时连符号也不画');
  assert.equal(r.off.axisVisible, false, 'axis="none" 时轴不可见');
  assert.equal(r.off.axisAttr, 'none');
  for (const id of ['arrow', 'eq', 'vs']) {
    assert.equal(r[id].symVisible, true, `${id} 的符号应可见`);
    assert.equal(r[id].axisVisible, true, `${id} 的轴应可见`);
  }
});

test('vk-text fit="width"：780px 容器差 ≤2px，fit-max 封顶', async () => {
  const tab = await open(`
<vk-page>
  <div style="width:780px"><vk-text id="fit" mono fit="width" fit-max="120">printf("%s\\n", s);</vk-text></div>
  <div style="width:780px"><vk-text id="cap" mono fit="width" fit-max="40">printf("%s\\n", s);</vk-text></div>
  <div style="width:780px"><vk-text id="plain" mono size="body" style="font-size:56px">printf("%s\\n", s);</vk-text></div>
</vk-page>`);
  const r = await tab.evaluate(() => {
    const textWidth = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return Math.max(...[...range.getClientRects()].filter((x) => x.width > 0.5).map((x) => x.width));
    };
    const fit = document.getElementById('fit');
    const cap = document.getElementById('cap');
    const plain = document.getElementById('plain');
    return {
      fitW: textWidth(fit),
      fitBox: fit.clientWidth,
      fitFs: parseFloat(getComputedStyle(fit).fontSize),
      capW: textWidth(cap),
      capFs: parseFloat(getComputedStyle(cap).fontSize),
      plainFs: parseFloat(getComputedStyle(plain).fontSize),
    };
  });
  assert.ok(
    Math.abs(r.fitW - r.fitBox) <= 2,
    `fit="width" 后文本宽应等于 780 容器：${r.fitW} vs ${r.fitBox}（字号 ${r.fitFs}）`
  );
  assert.ok(r.fitFs > 56, `短代码行应被放大，实际字号 ${r.fitFs}`);
  assert.equal(Math.round(r.capFs * 100) / 100, 40, `fit-max="40" 必须封顶，实际 ${r.capFs}`);
  assert.ok(r.capW <= r.fitBox + 1, '封顶后文本不应超过容器');
  assert.equal(r.plainFs, 56, '不写 fit 时字号行为不变');
});

test('vk-caption：左边界对齐目标块首字符（above / below）', async () => {
  const tab = await open(`
<vk-page><div style="width:1200px">
  <vk-box id="tgt" surface="none" pad="lg">
    <vk-text size="headline" mono>printf("%s\\n", s);</vk-text>
  </vk-box>
  <vk-caption id="c1" for="#tgt" anchor="above">你写的</vk-caption>
  <vk-caption id="c2" for="#tgt" anchor="below">编译器给的</vk-caption>
</div></vk-page>`);
  const r = await tab.evaluate(() => {
    const target = document.getElementById('tgt');
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    let first = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((x) => x.width > 0.5);
      if (rects.length) {
        first = rects[0];
        break;
      }
    }
    const tr = target.getBoundingClientRect();
    const cap = (id) => {
      const span = document.getElementById(id).querySelector('.vk-caption');
      const cr = span.getBoundingClientRect();
      return { left: cr.left, top: cr.top, bottom: cr.bottom, text: span.textContent };
    };
    return { firstCharX: first.left, targetTop: tr.top, targetBottom: tr.bottom, above: cap('c1'), below: cap('c2') };
  });
  assert.equal(r.above.text, '你写的');
  assert.equal(r.below.text, '编译器给的');
  assert.ok(
    Math.abs(r.above.left - r.firstCharX) <= 1,
    `above 左边界应对齐首字符：${r.above.left} vs ${r.firstCharX}`
  );
  assert.ok(
    Math.abs(r.below.left - r.firstCharX) <= 1,
    `below 左边界应对齐首字符：${r.below.left} vs ${r.firstCharX}`
  );
  assert.ok(r.above.bottom <= r.targetTop, `above 应在目标上方：${r.above.bottom} <= ${r.targetTop}`);
  assert.ok(r.below.top >= r.targetBottom, `below 应在目标下方：${r.below.top} >= ${r.targetBottom}`);
});

test('vk-term / vk-code surface="dark"：反白底 + current 高亮同时成立', async () => {
  const tab = await open(`
<vk-page>
  <vk-term id="term" surface="dark" current="2">$ gcc -E hello.c -o hello.i
warning: unused variable
Hello, World!</vk-term>
  <vk-code id="code" lang="text" surface="dark" current="2">int main(void) {
  return 0;
}</vk-code>
  <vk-term id="inset" surface="inset" current="1">$ echo hi
hi</vk-term>
  <vk-term id="darktitle" surface="dark" chrome="none" title="steps.txt" title-show current="1">$ echo hi
hi</vk-term>
</vk-page>`);
  const r = await tab.evaluate(() => {
    const parse = (s) => {
      const m = String(s).match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
    };
    const lum = (c) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const bg = (el) => parse(getComputedStyle(el).backgroundColor);
    const fg = (el) => parse(getComputedStyle(el).color);
    const term = document.getElementById('term');
    const termWin = term.querySelector('.vk-win');
    const termLines = [...term.querySelectorAll('.vk-line')];
    const normal = termLines[0];
    const current = termLines[1];
    const code = document.getElementById('code');
    const codeWin = code.querySelector('.vk-win');
    const codeLines = [...code.querySelectorAll('.vk-line')];
    const cNormal = codeLines[0];
    const cCurrent = codeLines[1];
    const inset = document.getElementById('inset');
    const insetWin = inset.querySelector('.vk-win');
    const darkTitle = document.getElementById('darktitle');
    const darkTitleWin = darkTitle.querySelector('.vk-win');
    return {
      termBg: bg(termWin),
      termText: fg(normal.querySelector('.vk-txt')),
      termNormalBg: bg(normal),
      termCurrentBg: bg(current),
      termCurrentLeft: getComputedStyle(current.querySelector('.vk-txt')).boxShadow,
      codeBg: bg(codeWin),
      codeText: fg(cNormal.querySelector('.vk-src')),
      codeNormalBg: bg(cNormal),
      codeCurrentBg: bg(cCurrent),
      codeCurrentLeft: getComputedStyle(cCurrent.querySelector('.vk-src')).boxShadow,
      insetBg: bg(insetWin),
      insetText: fg(inset.querySelector('.vk-txt')),
      darkTitleBg: bg(darkTitleWin),
      darkTitleColor: fg(darkTitle.querySelector('.vk-term-title')),
    };
  });
  const dark = { r: 11, g: 15, b: 20 };
  assert.deepEqual(r.termBg, { ...dark, a: 1 }, 'term surface=dark 的窗底应是墨色');
  assert.deepEqual(r.codeBg, { ...dark, a: 1 }, 'code surface=dark 的窗底应是墨色');
  assert.ok(r.termText && r.termText.a > 0.9, 'term 正文应有明确前景色');
  assert.ok(r.termText.r > 180 && r.termText.g > 180, 'term 正文在深色底上应是浅色');
  assert.ok(r.codeText.r > 180 && r.codeText.g > 180, 'code 正文在深色底上应是浅色');
  assert.ok(r.termNormalBg.a < 0.01, '普通行不应有底色');
  assert.ok(r.termCurrentBg.a > 0.1, `term 当前行应有可见底色：${JSON.stringify(r.termCurrentBg)}`);
  assert.notDeepEqual(r.termCurrentBg, r.termNormalBg, 'term 当前行与普通行必须不同');
  assert.match(r.termCurrentLeft, /122, 162, 255/, 'term 当前行的左缘条应换成亮蓝');
  assert.ok(r.codeNormalBg.a < 0.01, 'code 普通行不应有底色');
  assert.ok(r.codeCurrentBg.a > 0.1, `code 当前行应有可见底色：${JSON.stringify(r.codeCurrentBg)}`);
  assert.match(r.codeCurrentLeft, /122, 162, 255/, 'code 当前行的左缘条应换成亮蓝');
  assert.equal(r.insetBg.r, 238, 'surface=inset 应是浅灰凹面');
  assert.ok(r.insetText.r < 80, 'inset 上的字仍应是墨色');
  assert.deepEqual(r.darkTitleBg, { ...dark, a: 1 }, 'surface=dark + chrome="none" 时底色不能一起消失');
  assert.ok(r.darkTitleColor.r > 150 && r.darkTitleColor.g > 150, 'dark 下的 title-show 标题也应是浅色');
});

test('vk-page / body：空文档里的默认底色是纯白', async () => {
  const tab = await open('<vk-page><vk-text size="body">纸</vk-text></vk-page>');
  const r = await tab.evaluate(() => {
    const css = (el) => getComputedStyle(el).backgroundColor;
    const page = document.querySelector('vk-page');
    return {
      body: css(document.body),
      host: css(page),
      canvas: css(page.querySelector('.vk-page')),
      token: getComputedStyle(document.documentElement).getPropertyValue('--vk-paper-sf-0').trim(),
    };
  });
  assert.equal(r.body, 'rgb(255, 255, 255)', `body 默认底色应为纯白，实际 ${r.body}`);
  assert.equal(r.host, 'rgb(255, 255, 255)', `vk-page 宿主默认底色应为纯白，实际 ${r.host}`);
  assert.equal(r.canvas, 'rgb(255, 255, 255)', `vk-page 画布默认底色应为纯白，实际 ${r.canvas}`);
  assert.equal(r.token, '#ffffff', '纸色 token 本身必须是 #ffffff');
});

after(async () => {
  for (const ctx of opened) await ctx.close().catch(() => {});
  await browser.close();
  await close();
});
