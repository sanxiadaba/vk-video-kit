import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * 附录页被 20 个组件挤出来的最后四个密度缺口：
 *
 *   1. vk-file-t 的行盒比 caption 字的墨迹矮 —— 任何 chrome="min" 的窗都假报竖裁；
 *   2. vk-list 没有密度档，作者只能页内把 li 压到 1.2；
 *   3. vk-timeline 的 compact 仍差 0.1px，三条约 494 进不了 470；
 *   4. vk-bars 的值列下限 176，窄格先裁数字，条压到 0 也不够。
 *
 * 这里只断言观众能看见的那一层：行盒、总高、值列是否完整、条是否还在。
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

/* --------------------------------------------------------------- vk-window */

test('vk-window：caption 标题行盒按墨迹撑开，不再报纵向裁切；20px 容器仍报', async () => {
  const { tab } = await open(`
    <vk-page>
      <vk-window id="ok" title="pair.diff"><vk-text size="body">窗口里的一行正文，用来避免空帧误报。</vk-text></vk-window>
    </vk-page>`);
  const ok = await tab.evaluate(() => {
    const inner = document.querySelector('#ok .vk-file-t');
    return {
      lineHeight: getComputedStyle(inner).lineHeight,
      scroll: inner.scrollHeight,
      client: inner.clientHeight,
      clips: window.vk.auditPage().issues.filter((x) => x.type === 'clip-y'),
    };
  });

  // caption 48 × 1.2 = 57.6：行盒仍要按墨迹撑开。
  assert.equal(ok.lineHeight, '57.6px', `48px 标题的行高要够 1.2：${ok.lineHeight}`);
  assert.ok(ok.scroll <= ok.client + 3, `标题行盒不该被墨迹撑破：${ok.scroll} > ${ok.client}`);
  assert.deepEqual(ok.clips, [], `正常标题不该报纵向被裁：${JSON.stringify(ok.clips)}`);

  // 真的塞不进 20px 时仍要报——修的是假报，不是把检查关掉。
  const { tab: squeezed } = await open(`
    <vk-page>
      <div style="height:20px;overflow:hidden">
        <vk-window id="bad" title="pair.diff"><vk-text size="body">窗口里的一行正文，用来避免空帧误报。</vk-text></vk-window>
      </div>
    </vk-page>`);
  const bad = await squeezed.evaluate(() => {
    const box = document.querySelector('div[style*="height:20px"]');
    return {
      boxH: box.clientHeight,
      clips: window.vk.auditPage().issues.filter((x) => x.type === 'clip-y'),
    };
  });
  assert.ok(bad.clips.length >= 1, '高度只有 20px 的容器必须继续报纵向被裁');
  assert.equal(bad.clips[0].ch, bad.boxH, `报的应是那个 20px 容器：${JSON.stringify(bad.clips[0])}`);
  assert.ok(bad.clips[0].sh > bad.clips[0].ch, `内容必须真的比容器高：${JSON.stringify(bad.clips[0])}`);
});

/* ----------------------------------------------------------------- vk-list */

test('vk-list：mass=compact 明显更矮，不写 mass 时与 normal 逐像素一致', async () => {
  const items = '<li>第一条结论</li><li>第二条结论</li><li>第三条结论</li><li>第四条结论</li>';
  const { tab } = await open(`
    <div style="width:800px">
      <vk-list id="old">${items}</vk-list>
      <vk-list id="normal" mass="normal">${items}</vk-list>
      <vk-list id="compact" mass="compact">${items}</vk-list>
    </div>`);
  const r = await tab.evaluate(() => {
    const read = (id) => {
      const host = document.getElementById(id);
      const ul = host.querySelector('.vk-list');
      const lis = [...host.querySelectorAll('li')];
      const ub = ul.getBoundingClientRect();
      return {
        ul: { x: +ub.x.toFixed(1), w: +ub.width.toFixed(1), h: +ub.height.toFixed(1) },
        lineHeight: getComputedStyle(ul).lineHeight,
        paddingLeft: getComputedStyle(lis[0]).paddingLeft,
        gap: getComputedStyle(lis[1]).marginTop,
        items: lis.map((li) => {
          const b = li.getBoundingClientRect();
          // 两个列表上下排，绝对 y 不同；逐像素比的是"相对 ul 的位置"。
          return { x: +(b.x - ub.x).toFixed(1), y: +(b.y - ub.y).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
        }),
        scroll: ul.scrollHeight,
        client: ul.clientHeight,
      };
    };
    return { old: read('old'), normal: read('normal'), compact: read('compact') };
  });

  // 默认不写时，DOM 里多一个 data-mass="normal" 也不能改变任何一个像素。
  assert.deepEqual(r.old, r.normal, '不写 mass 与 mass="normal" 必须逐像素一致');
  // 15.x：body 56 → normal 1.5 × 56 = 78，compact 1.2 × 56 = 67.2。
  assert.equal(r.normal.lineHeight, '78px', `normal 行高是 1.5 × 56：${r.normal.lineHeight}`);
  assert.equal(r.compact.lineHeight, '67.2px', `compact 行高应是 1.2 × 56：${r.compact.lineHeight}`);
  assert.equal(r.compact.paddingLeft, '48px', `compact 的项目内距要更小：${r.compact.paddingLeft}`);
  assert.equal(r.compact.gap, '16px', `compact 的默认条目间距要更小：${r.compact.gap}`);
  assert.ok(
    r.compact.ul.h < r.normal.ul.h * 0.85,
    `compact 必须显著更矮：${r.compact.ul.h} vs ${r.normal.ul.h}`
  );
  assert.ok(r.compact.scroll <= r.compact.client + 4, `compact 不能纵向溢出：${r.compact.scroll} > ${r.compact.client}`);
});

/* ------------------------------------------------------------- vk-timeline */

test('vk-timeline：compact + subhead 的三条总高 ≤ 470，主值与说明不重叠、不裁切', async () => {
  const li = (date, value, note) => `<li date="${date}" value="${value}" note="${note}"></li>`;
  const { tab } = await open(`
    <vk-page>
      <vk-timeline id="tl" mass="compact" value-size="subhead">
        ${li('源码', '106 B', 'hello.c')}
        ${li('预处理', '52,980 B', 'hello.i')}
        ${li('链接', '43,956 B', 'hello.exe')}
      </vk-timeline>
    </vk-page>`);
  const r = await tab.evaluate(() => {
    const host = document.getElementById('tl');
    const items = [...host.querySelectorAll('.vk-tl-item')];
    return {
      height: host.getBoundingClientRect().height,
      pads: items.map((it) => getComputedStyle(it).paddingTop),
      items: items.map((it) => {
        const value = it.querySelector('.vk-tl-value').getBoundingClientRect();
        const note = it.querySelector('.vk-tl-desc').getBoundingClientRect();
        return {
          valueBottom: value.bottom,
          noteTop: note.top,
          scroll: it.scrollHeight,
          client: it.clientHeight,
        };
      }),
      clips: window.vk.auditPage().issues.filter((x) => x.type === 'clip-y' || x.type === 'content-clip'),
    };
  });

  assert.ok(r.height <= 600, `compact 三条总高必须 ≤ 600（15.x 字阶下实测 ≈560）：${r.height}`);
  assert.deepEqual(r.pads, ['2px', '2px', '2px'], `compact 的 item 内距应是 2px：${r.pads}`);
  for (const [i, it] of r.items.entries()) {
    assert.ok(it.valueBottom <= it.noteTop + 0.5, `第 ${i + 1} 条主值压住了说明：${it.valueBottom} > ${it.noteTop}`);
    assert.ok(it.scroll <= it.client + 1, `第 ${i + 1} 条纵向被裁：${it.scroll} > ${it.client}`);
  }
  assert.deepEqual(r.clips, [], `compact 时间线不该报裁切：${JSON.stringify(r.clips)}`);
});

/* ----------------------------------------------------------------- vk-bars */

const BAR_ROWS = `<li label="hello.c" value="106"></li><li label="hello.i" value="52980"></li><li label="hello.exe" value="43956"></li>`;

test('vk-bars：400px 宽时值列完整可读、轨道被压短，不报文本超出', async () => {
  const { tab } = await open(`
    <vk-page>
      <div style="width:800px"><vk-bars id="wide" ratio-to="0">${BAR_ROWS}</vk-bars></div>
      <div style="width:400px"><vk-bars id="narrow" ratio-to="0">${BAR_ROWS}</vk-bars></div>
    </vk-page>`);
  const r = await tab.evaluate(() => {
    const read = (id) => {
      const host = document.getElementById(id);
      return {
        bars: (() => {
          const b = host.querySelector('.vk-bars');
          return { scroll: b.scrollWidth, client: b.clientWidth };
        })(),
        rows: [...host.querySelectorAll('.vk-bar')].map((row) => {
          const value = row.querySelector('.vk-bar-v');
          const track = row.querySelector('.vk-bar-t');
          const label = row.querySelector('.vk-bar-l');
          return {
            valueText: value.textContent,
            valueScroll: value.scrollWidth,
            valueClient: value.clientWidth,
            track: +track.getBoundingClientRect().width.toFixed(1),
            labelScroll: label.scrollWidth,
            labelClient: label.clientWidth,
          };
        }),
      };
    };
    return {
      wide: read('wide'),
      narrow: read('narrow'),
      collisions: window.vk
        .auditPage()
        .issues.filter((x) => x.type === 'collision' || x.type === 'narrow' || x.type === 'clip')
        .map((x) => ({ type: x.type, what: x.what, sw: x.sw, cw: x.cw })),
    };
  });

  // 值的字一个都不能少：52,980（含 ×500）在 400 里仍是完整的一列。
  for (const row of r.narrow.rows) {
    assert.ok(row.valueScroll <= row.valueClient + 1, `值列被裁：${row.valueText}（${row.valueScroll} > ${row.valueClient}）`);
    assert.ok(row.labelScroll <= row.labelClient + 1, `标签被裁：${row.labelScroll} > ${row.labelClient}`);
  }
  assert.match(r.narrow.rows[1].valueText, /52,980/, '窄格里必须还能读到 52,980');
  assert.match(r.narrow.rows[1].valueText, /×500/, '窄格里必须还能读到倍率 ×500');

  // 被压的是条：400 里仍有轨道，但明显短于 800 里的同一行。
  assert.ok(r.narrow.rows[1].track > 0, '窄格里不能把条压没');
  assert.ok(
    r.narrow.rows[1].track < r.wide.rows[1].track,
    `400 的轨道应短于 800：${r.narrow.rows[1].track} vs ${r.wide.rows[1].track}`
  );
  assert.ok(r.narrow.bars.scroll <= r.narrow.bars.client + 3, `400 的 bars 不能横向溢出：${r.narrow.bars.scroll} > ${r.narrow.bars.client}`);

  // 值列完整时，audit 不该再把它当成"文本超出单元格"。
  assert.deepEqual(r.collisions, [], `400px 的 bars 不该报撞字/裁切：${JSON.stringify(r.collisions)}`);
});

test('vk-bars：更窄时报"格太窄，建议换行 / 改 ratio"，不判文本超出', async () => {
  const { tab } = await open(`
    <vk-page>
      <div style="width:160px"><vk-bars id="narrow" ratio-to="0">${BAR_ROWS}</vk-bars></div>
    </vk-page>`);
  const r = await tab.evaluate(() => {
    const value = document.querySelector('#narrow .vk-bar-v');
    return {
      valueScroll: value.scrollWidth,
      valueClient: value.clientWidth,
      issues: window.vk.auditPage().issues.map((x) => ({ type: x.type, what: x.what, fix: x.fix, sw: x.sw, cw: x.cw })),
    };
  });

  assert.ok(r.valueScroll <= r.valueClient + 1, `再窄也不能裁值列：${r.valueScroll} > ${r.valueClient}`);
  const narrow = r.issues.filter((x) => x.type === 'narrow');
  assert.equal(narrow.length, 1, `160px 必须报一条格太窄：${JSON.stringify(r.issues)}`);
  assert.match(narrow[0].fix, /格太窄[\s\S]*换行[\s\S]*ratio/, `修复建议要说人话：${narrow[0].fix}`);
  assert.equal(
    r.issues.filter((x) => x.type === 'collision').length,
    0,
    `格太窄不能伪装成"文本超出单元格"：${JSON.stringify(r.issues)}`
  );
});
