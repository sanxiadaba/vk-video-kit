import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { startServer } from '../cli/serve.mjs';
import {
  parseClock,
  parseCueJson,
  parseCueRef,
  parseCueSource,
  parseSrt,
} from '../src/shared/cues.mjs';

/**
 * 视频维度的四条行为：
 *   1. cue 时间点 seek 后，目标可见、同层其它元件降墨；
 *   2. 同页多态：state 切了，DOM 属性与几何都真的变了；
 *   3. 焦点过渡默认 200ms 完成，focus-transition="off" 能关；
 *   4. 页间转场 fade 有过渡，cut 立即切页。
 * 外加字幕源（JSON / SRT）的纯函数解析。
 */

const { base, close: closeServer } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

const doc = (inner, attrs = '') => `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body><vk-page ${attrs}>${inner}</vk-page><script src="dist/vk.js"></script></body></html>`;

const open = async (html) => {
  const tab = await ctx.newPage();
  await tab.setContent(html, { waitUntil: 'load' });
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return tab;
};

const seek = async (tab, t) => {
  await tab.evaluate(async (time) => {
    window.vk.seek(time);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, t);
};

const settle = (tab, ms = 260) => tab.waitForTimeout(ms);

/* ------------------------------------------------------------------ 纯函数 */

test('字幕源：JSON / SRT 解析成同一条轨道，focus / state 进 cue', () => {
  const json = parseCueJson(
    JSON.stringify([
      { start: '0:00', end: '0:03', text: '第一句', focus: '#s1', state: 'a' },
      { start: '0:03', end: '0:06', text: '第二句' },
    ])
  );
  assert.equal(json.length, 2);
  assert.equal(json[0].index, 1);
  assert.equal(json[0].focus, '#s1');
  assert.equal(json[0].state, 'a');
  assert.equal(json[1].start, 3);

  const srt = parseSrt(`1
00:00:00,000 --> 00:00:03,000
字符串不是值，是一块内存。
focus=#s1
state=a

2
00:00:03,500 --> 00:00:06,000
每个字节都有自己的地址。`);
  assert.equal(srt.length, 2);
  assert.equal(srt[0].text, '字符串不是值，是一块内存。', 'focus/state 元数据不能混进字幕文本');
  assert.equal(srt[0].focus, '#s1');
  assert.equal(srt[0].state, 'a');
  assert.equal(srt[1].start, 3.5);

  assert.equal(parseClock('1:02:03.250'), 3723.25);
  assert.deepEqual(parseCueRef('3'), { kind: 'index', index: 3 });
  assert.deepEqual(parseCueRef('0:06-0:09'), { kind: 'range', start: 6, end: 9 });
  assert.deepEqual(parseCueRef('0:06'), { kind: 'from', start: 6 });
  assert.deepEqual(parseCueSource('这不是一条字幕'), [], '认不出字幕时返回空轨道，而不是抛错');
});

/* ------------------------------------------------------- ① cue 时间点 seek */

test('字幕 cue：按时间点 seek 后目标可见、其它降墨', async () => {
  const cues = [
    { start: 0, end: 3, text: '第一句', focus: '#s1' },
    { start: 3, end: 6, text: '第二句', focus: '#s2' },
    { start: 6, end: 9, text: '第三句', focus: '#s3' },
  ];
  const tab = await open(
    doc(
      `<vk-text id="s1" cue="1">第一块</vk-text>
       <vk-text id="s2" cue="2">第二块</vk-text>
       <vk-text id="s3" cue="3">第三块</vk-text>
       <script type="application/json" data-vk-cues>${JSON.stringify(cues)}</script>`,
      'dur="9"'
    )
  );

  await seek(tab, 1.5);
  await settle(tab, 260);
  const first = await tab.evaluate(() => {
    const read = (id) => {
      const el = document.querySelector(id);
      const cs = getComputedStyle(el);
      return {
        cue: el.dataset.vkCueState || null,
        focus: el.getAttribute('data-focus'),
        visibility: cs.visibility,
        filter: cs.filter,
      };
    };
    return { s1: read('#s1'), s2: read('#s2'), s3: read('#s3'), cue: window.vk.cue(), state: window.vk.state() };
  });

  assert.equal(first.s1.visibility, 'visible', '正在讲的那一件必须可见');
  assert.equal(first.s1.focus, 'on', '主语必须拿到 data-focus="on"');
  assert.equal(first.s1.cue, 'on');
  assert.equal(first.s2.focus, 'off', '同层其它元件要降墨');
  assert.match(first.s2.filter, /opacity\(0\.35\)/, `降墨应落在 filter: ${first.s2.filter}`);
  assert.equal(first.s3.cue, 'before', '还没讲到的元件先不出现');
  assert.equal(first.cue.text, '第一句');

  await seek(tab, 4.5);
  const second = await tab.evaluate(() => {
    const read = (id) => {
      const el = document.querySelector(id);
      return { cue: el.dataset.vkCueState || null, focus: el.getAttribute('data-focus') };
    };
    return { s1: read('#s1'), s2: read('#s2'), s3: read('#s3'), cue: window.vk.cue() };
  });
  assert.equal(second.s2.focus, 'on');
  assert.equal(second.s1.focus, 'off');
  assert.equal(second.s1.cue, 'after', '讲过的那一件退到 after，但仍留着');
  assert.equal(second.s2.cue, 'on');
  assert.equal(second.s3.cue, 'before');
  assert.equal(second.cue.text, '第二句');
  await tab.close();
});

/* ----------------------------------------------------------- ② 同页多态 */

test('同页多态：state 切换改 DOM 属性，几何跟着变', async () => {
  const cues = [
    { start: 0, end: 3, text: 'a 态', state: 'a' },
    { start: 3, end: 6, text: 'b 态', state: 'b' },
  ];
  const states = {
    a: {
      '#banner': { attrs: { hidden: false } },
      '#detail': { style: { height: '160px' } },
      '#steps': { attrs: { current: '1' } },
    },
    b: {
      '#banner': { attrs: { hidden: true } },
      '#detail': { style: { height: '320px' } },
      '#steps': { attrs: { current: '3' } },
    },
  };
  const tab = await open(
    doc(
      `<vk-box id="banner" border="hair" pad="md">这一块只在 a 态出现</vk-box>
       <vk-box id="detail" border="hair" pad="md" style="width:600px">高度由 state 决定</vk-box>
       <vk-steps id="steps" current="1"><li>一</li><li>二</li><li>三</li></vk-steps>
       <script type="application/json" data-vk-states>${JSON.stringify(states)}</script>
       <script type="application/json" data-vk-cues>${JSON.stringify(cues)}</script>`,
      'dur="6" states="a,b"'
    )
  );

  await seek(tab, 1);
  await settle(tab);
  const before = await tab.evaluate(() => ({
    state: document.querySelector('vk-page').dataset.state,
    bannerHidden: document.querySelector('#banner').hasAttribute('hidden'),
    detailHeight: Math.round(document.querySelector('#detail').getBoundingClientRect().height),
    current: document.querySelector('#steps').getAttribute('current'),
  }));
  assert.equal(before.state, 'a');
  assert.equal(before.bannerHidden, false);
  assert.equal(before.detailHeight, 160);
  assert.equal(before.current, '1');

  await seek(tab, 4);
  const during = await tab.evaluate(() => ({
    state: document.querySelector('vk-page').dataset.state,
    bannerHidden: document.querySelector('#banner').hasAttribute('hidden'),
    detailStyleHeight: document.querySelector('#detail').style.height,
    current: document.querySelector('#steps').getAttribute('current'),
    animations: document.querySelector('.vk-page').getAnimations().map((a) => a.effect.getTiming().duration),
  }));
  assert.equal(during.state, 'b', '页面要进入 b 态');
  assert.equal(during.bannerHidden, true, 'b 态要真的把 banner 加上 hidden');
  assert.equal(during.detailStyleHeight, '320px', 'b 态要改 detail 的属性组');
  assert.equal(during.current, '3', 'b 态的当前项要跟着换');
  assert.ok(during.animations.some((d) => d === 200), `切态要有 200ms 过渡：${during.animations}`);

  await settle(tab, 320);
  const after = await tab.evaluate(() => ({
    bannerHeight: Math.round(document.querySelector('#banner').getBoundingClientRect().height),
    detailHeight: Math.round(document.querySelector('#detail').getBoundingClientRect().height),
  }));
  assert.equal(after.bannerHeight, 0, 'hidden 的元素几何必须归零');
  assert.equal(after.detailHeight, 320, 'detail 的几何要真的变到 320');
  await tab.close();
});

/* --------------------------------------------------------- ③ 焦点过渡 */

test('焦点过渡：默认 200ms 完成，focus-transition="off" 可关', async () => {
  const cues = [
    { start: 0, end: 2, text: '看 A', focus: '#a' },
    { start: 2, end: 4, text: '看 B', focus: '#b' },
  ];
  const body = `<vk-text id="a">A</vk-text><vk-text id="b">B</vk-text>
    <script type="application/json" data-vk-cues>${JSON.stringify(cues)}</script>`;

  const tab = await open(doc(body, 'dur="4"'));
  await seek(tab, 0.5);
  await settle(tab, 280);
  await seek(tab, 2.5);
  const anim = await tab.evaluate(() => {
    const durations = [];
    for (const id of ['#a', '#b']) {
      for (const a of document.querySelector(id).getAnimations()) durations.push(a.effect.getTiming().duration);
    }
    return { durations, a: getComputedStyle(document.querySelector('#a')).filter, b: getComputedStyle(document.querySelector('#b')).filter };
  });
  assert.ok(anim.durations.length > 0, '焦点切换必须产生过渡');
  assert.ok(anim.durations.every((d) => d <= 200), `过渡不能超过 200ms：${anim.durations}`);

  await settle(tab, 280);
  const done = await tab.evaluate(() => ({
    a: getComputedStyle(document.querySelector('#a')).filter,
    b: getComputedStyle(document.querySelector('#b')).filter,
  }));
  assert.match(done.a, /opacity\(0\.35\)/, '200ms 内旧焦点要降到位');
  assert.equal(done.b, 'none', '新焦点不降墨');
  await tab.close();

  const off = await open(doc(body, 'dur="4" focus-transition="off"'));
  await seek(off, 0.5);
  await settle(off, 280);
  await seek(off, 2.5);
  const noAnim = await off.evaluate(() => {
    const durations = [];
    for (const id of ['#a', '#b']) {
      for (const a of document.querySelector(id).getAnimations()) durations.push(a.effect.getTiming().duration);
    }
    return {
      durations,
      a: getComputedStyle(document.querySelector('#a')).filter,
      b: getComputedStyle(document.querySelector('#b')).filter,
    };
  });
  assert.equal(noAnim.durations.length, 0, 'focus-transition="off" 时不能有过渡');
  assert.match(noAnim.a, /opacity\(0\.35\)/, '关掉过渡也应立即降墨');
  assert.equal(noAnim.b, 'none');
  await off.close();
});

/* --------------------------------------------------------- ④ 页间转场 */

test('页间转场：fade 有过渡，cut 立即切页', async () => {
  const tab = await open(`<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body>
<vk-page id="p1" transition="fade"><vk-text size="headline">第一页</vk-text></vk-page>
<vk-page id="p2" transition="fade"><vk-text size="headline">第二页</vk-text></vk-page>
<script src="dist/vk.js"></script></body></html>`);

  const fading = await tab.evaluate(async () => {
    const promise = window.vk.goto(1, 'fade');
    window.__vkGoto = promise;
    await new Promise((r) => setTimeout(r, 60));
    return {
      animations: document.getAnimations().map((a) => a.effect.getTiming().duration),
      hidden: [...document.querySelectorAll('vk-page')].map((p) => p.hidden),
    };
  });
  assert.ok(fading.animations.some((d) => d >= 200), `fade 要有 200ms 以上的过渡：${fading.animations}`);
  assert.equal(fading.hidden[0], false, '过渡中旧页还应在场');
  await tab.evaluate(() => window.__vkGoto);
  const settled = await tab.evaluate(() => [...document.querySelectorAll('vk-page')].map((p) => p.hidden));
  assert.deepEqual(settled, [true, false], 'fade 结束后只留新页');

  await tab.evaluate(() => window.vk.goto(0, 'cut'));
  const cut = await tab.evaluate(() => ({
    hidden: [...document.querySelectorAll('vk-page')].map((p) => p.hidden),
    animations: document.getAnimations().length,
  }));
  assert.deepEqual(cut.hidden, [false, true], 'cut 立即切回第一页');
  assert.equal(cut.animations, 0, 'cut 不应留下转场动画');
  await tab.close();
});

after(async () => {
  await closeBrowser(browser);
  await closeServer();
});
