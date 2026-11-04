import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * 图示语汇的行为测试。
 *
 * 不截图、不看「好不好看」：只量默认版式的硬事实。
 *   compare  两块等宽 / 中轴 48 / 标签在上 / tone 生效
 *   steps    N 步等宽 / 当前步高亮 / 其余降墨 / 底部进度轨同步
 *   locate   地址在上 / 容器在下 / 指向线在中间
 *   measure  数字 ≥240px / 对比条在下 / 倍数牌在右
 *   cause    现象在左 / 结果在右 / 箭头词在中间
 *   cue      槽上写 cue，得到 before / on / after 三段
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

after(async () => {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
  await close();
});

async function open(file) {
  errors.length = 0;
  await page.goto(`${base}/specimen/${file}`, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await window.vk?.ready?.();
    await document.fonts?.ready;
    window.vk?.layout?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return page;
}

const box = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });

test('compare：左右等宽、中轴 48、标签在上、tone 生效', async () => {
  await open('vk-scene-compare.html');
  const r = await page.evaluate(() => {
    const host = document.querySelector('vk-scene');
    const sides = [...host.querySelectorAll('.vk-scene-side')];
    const labels = [...host.querySelectorAll('.vk-scene-label')];
    const label = (i) => labels[i].getBoundingClientRect();
    const side = (i) => sides[i].getBoundingClientRect();
    return {
      kind: host.dataset.kind,
      labels: labels.length,
      tones: labels.map((l) => l.getAttribute('tone')),
      colors: labels.map((l) => getComputedStyle(l).color),
      left: side(0),
      right: side(1),
      gap: side(1).left - side(0).right,
      labelTop: labels[0] ? label(0).top : 0,
      slotTop: sides[0].querySelector('.vk-scene-slot').getBoundingClientRect().top,
    };
  });
  assert.equal(r.kind, 'compare');
  assert.equal(r.labels, 2, 'compare 上方应有两枚 vk-label');
  assert.deepEqual(r.tones, ['info', 'ok']);
  assert.notEqual(r.colors[0], r.colors[1], 'info 与 ok 的标签必须同色不同调');
  assert.ok(Math.abs(r.left.width - r.right.width) < 1, `左右两块必须等宽：${r.left.width} vs ${r.right.width}`);
  assert.ok(Math.abs(r.gap - 48) < 1, `中轴必须留 48：${r.gap}`);
  assert.ok(r.labelTop < r.slotTop, '标签必须在上方');
  assert.deepEqual(errors, []);
});

test('steps：N 步等宽、当前步高亮、其余降墨、进度轨同步', async () => {
  await open('vk-scene-steps.html');
  const r = await page.evaluate(() => {
    const host = document.querySelector('vk-scene');
    const flow = host.querySelector('.vk-scene-flow');
    const steps = [...flow.querySelectorAll('.vk-flow-step')];
    const track = host.querySelector('.vk-scene-track');
    const trackSteps = host.querySelector('vk-steps');
    return {
      kind: host.dataset.kind,
      current: host.dataset.current,
      count: steps.length,
      widths: steps.map((s) => s.getBoundingClientRect().width),
      opacity: steps.map((s) => Number(getComputedStyle(s).opacity)),
      currentIndex: steps.findIndex((s) => s.hasAttribute('data-current')),
      trackCurrent: trackSteps.getAttribute('current'),
      flowBottom: flow.getBoundingClientRect().bottom,
      trackTop: track.getBoundingClientRect().top,
    };
  });
  assert.equal(r.kind, 'steps');
  assert.equal(r.current, '2');
  assert.equal(r.count, 4, 'hello.c 编译链是四步');
  assert.ok(Math.max(...r.widths) - Math.min(...r.widths) < 1, `四步必须等宽：${r.widths.join(' / ')}`);
  assert.equal(r.currentIndex, 1, 'current=2 应落在第 2 步（0 起 1）');
  assert.equal(r.opacity[r.currentIndex], 1, '当前步必须全亮');
  assert.ok(r.opacity.filter((_, i) => i !== r.currentIndex).every((v) => v < 0.8), '其余步必须降墨');
  assert.equal(r.trackCurrent, '2', '底部进度轨必须跟 current 同步');
  assert.ok(r.trackTop >= r.flowBottom - 1, '进度轨必须在步骤下方');
  assert.deepEqual(errors, []);
});

test('locate：地址在上、容器在下、指向线在两者之间', async () => {
  await open('vk-scene-locate.html');
  const r = await page.evaluate(() => {
    const host = document.querySelector('vk-scene');
    const where = host.querySelector('.vk-scene-where');
    const leader = host.querySelector('.vk-scene-leader');
    const map = host.querySelector('.vk-scene-map');
    const big = where.querySelector('vk-text');
    const wr = where.getBoundingClientRect();
    const lr = leader.getBoundingClientRect();
    const mr = map.getBoundingClientRect();
    return {
      kind: host.dataset.kind,
      where: { top: wr.top, bottom: wr.bottom },
      leader: { top: lr.top, bottom: lr.bottom, height: lr.height },
      map: { top: mr.top, bottom: mr.bottom },
      fontSize: parseFloat(getComputedStyle(big).fontSize),
      cells: !!map.querySelector('vk-cells'),
    };
  });
  assert.equal(r.kind, 'locate');
  assert.ok(r.fontSize >= 160, `地址必须是大字（≥160px）：${r.fontSize}`);
  assert.ok(r.where.bottom <= r.leader.top + 1, '地址必须在指向线上方');
  assert.ok(r.leader.height > 0, '指向线必须存在且有高度');
  assert.ok(r.map.top >= r.leader.bottom - 1, '容器必须在指向线下方');
  assert.ok(r.cells, '下方容器应能放 vk-cells');
  assert.deepEqual(errors, []);
});

test('measure：数字 ≥240px、对比条在下、倍数牌在右', async () => {
  await open('vk-scene-measure.html');
  const r = await page.evaluate(() => {
    const host = document.querySelector('vk-scene');
    const value = host.querySelector('.vk-scene-value');
    const chart = host.querySelector('.vk-scene-chart');
    const main = host.querySelector('.vk-scene-main');
    const ratio = host.querySelector('.vk-scene-ratio');
    const big = value.querySelector('vk-text');
    const vr = value.getBoundingClientRect();
    const cr = chart.getBoundingClientRect();
    const rr = ratio.getBoundingClientRect();
    const mr = main.getBoundingClientRect();
    return {
      kind: host.dataset.kind,
      fontSize: parseFloat(getComputedStyle(big).fontSize),
      valueBottom: vr.bottom,
      chartTop: cr.top,
      ratioLeft: rr.left,
      mainRight: mr.right,
      ratioText: ratio.textContent.replace(/\s+/g, ' ').trim(),
      bars: !!chart.querySelector('vk-bars'),
    };
  });
  assert.equal(r.kind, 'measure');
  assert.ok(r.fontSize >= 240, `主数字必须 ≥240px：${r.fontSize}`);
  assert.ok(r.chartTop >= r.valueBottom - 1, '对比条必须在数字下方');
  assert.ok(r.ratioLeft >= r.mainRight - 1, '倍数牌必须在主列右侧');
  assert.match(r.ratioText, /×457/);
  assert.ok(r.bars, '对比条应能放 vk-bars');
  assert.deepEqual(errors, []);
});

test('cause：现象在左、结果在右、箭头上的词在中间', async () => {
  await open('vk-scene-cause.html');
  const r = await page.evaluate(() => {
    const host = document.querySelector('vk-scene');
    const sides = [...host.querySelectorAll('.vk-scene-side')];
    const why = host.querySelector('.vk-scene-why');
    const symbol = host.querySelector('.vk-pair-sym');
    const pair = host.querySelector('.vk-pair');
    const labels = [...host.querySelectorAll('.vk-scene-label')];
    const l = sides[0].getBoundingClientRect();
    const rr = sides[1].getBoundingClientRect();
    const wr = why.getBoundingClientRect();
    const pr = pair.getBoundingClientRect();
    return {
      kind: host.dataset.kind,
      left: l,
      right: rr,
      why: { left: wr.left, right: wr.right, top: wr.top, center: wr.left + wr.width / 2 },
      pairCenter: pr.left + pr.width / 2,
      pairCenterY: pr.top + pr.height / 2,
      symbol: symbol?.textContent?.trim() || '',
      labels: labels.map((el) => el.textContent.trim()),
      tones: labels.map((el) => el.getAttribute('tone')),
      whyText: why.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  assert.equal(r.kind, 'cause');
  assert.ok(Math.abs(r.left.width - r.right.width) < 1, '现象 / 结果两块必须等宽');
  assert.deepEqual(r.labels, ['现象', '结果']);
  assert.deepEqual(r.tones, ['warn', 'info']);
  assert.equal(r.symbol, '→', '中间应有一条箭头');
  assert.match(r.whyText, /因为/);
  assert.ok(Math.abs(r.why.center - r.pairCenter) < 2, '箭头上的词必须在两块正中');
  assert.ok(r.why.top > r.pairCenterY, '箭头上的词应在箭头下方');
  assert.deepEqual(errors, []);
});

test('cue 分段：槽上写 cue，得到 before / on / after 三段', async () => {
  // 独立 context：字幕控制器挂在 window.vk 上，复用同一页会让上一页的轨道留下。
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  const cueErrors = [];
  tab.on('pageerror', (e) => cueErrors.push(e.message));
  await tab.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body><vk-page dur="6" cues='[{"start":0,"end":2,"text":"改前"},{"start":2,"end":4,"text":"改后"}]'>
  <vk-scene kind="compare" labels="改前|改后" tone="info,ok">
    <vk-box slot="a" id="cue-a" border="hair" pad="md" surface="paper" cue="1"><vk-text size="body">char s[] = "hello";</vk-text></vk-box>
    <vk-box slot="b" id="cue-b" border="hair" pad="md" surface="paper" cue="2"><vk-text size="body">s[0] = 'H';</vk-text></vk-box>
  </vk-scene>
</vk-page><script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  const r = await tab.evaluate(async () => {
    await window.vk?.ready?.();
    const read = (t) => {
      window.vk.seek(t);
      return {
        a: document.querySelector('#cue-a')?.dataset.vkCueState || '',
        b: document.querySelector('#cue-b')?.dataset.vkCueState || '',
      };
    };
    return { t1: read(1), t3: read(3), t5: read(5) };
  });
  await ctx.close();
  assert.deepEqual(cueErrors, []);
  assert.deepEqual(r.t1, { a: 'on', b: 'before' }, '第 1 段只应出现 a');
  assert.deepEqual(r.t3, { a: 'after', b: 'on' }, '第 2 段 a 退到 55%，b 全亮');
  assert.deepEqual(r.t5, { a: 'after', b: 'after' }, '讲完两条都留着');
});
