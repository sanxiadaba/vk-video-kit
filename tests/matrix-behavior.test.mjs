import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { startServer } from '../cli/serve.mjs';

/**
 * 能力矩阵的「行为级」测试。
 *
 * 这里每一条都对应 docs/capabilities.json 里的一个能力：断言的是观众能看见的
 * 结果（高度分配 / 端点坐标 / 语义标签 / 换行 / 零线 / 摆位），不是属性存在。
 * 标本页与契约宿主由 `npm run build` 生成；测试只读 `_site/`，不改源码。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

const settle = () =>
  page.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 24));
  });

async function openHost(tag) {
  await page.goto(`${base}/specimens/${tag}.html`, { waitUntil: 'load' });
  await settle();
}

async function reset(tag, markup) {
  await openHost(tag);
  await page.evaluate(async (html) => {
    document.querySelector('main').innerHTML = html;
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, markup);
  await settle();
  await page.waitForTimeout(60);
}

const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

/* ------------------------------------------------------------------ stack */

test('vk-stack weights：按 1:2:1 分配剩余高度', async () => {
  await reset(
    'vk-stack',
    `<div id="wrap" style="height:600px;display:flex">
      <vk-stack id="s" grow weights="1 2 1" gap="2xs">
        <vk-box id="w1" surface="soft">一</vk-box>
        <vk-box id="w2" surface="soft">二</vk-box>
        <vk-box id="w3" surface="soft">三</vk-box>
      </vk-stack>
    </div>`
  );
  const h = await page.evaluate(() =>
    ['w1', 'w2', 'w3'].map((id) => document.getElementById(id).getBoundingClientRect().height)
  );
  assert.ok(h[0] > 100, `三块都该分到高度：${h.map((n) => n.toFixed(1))}`);
  assert.ok(near(h[1], h[0] * 2, 12), `第二块应是第一块的两倍：${h.map((n) => n.toFixed(1))}`);
  assert.ok(near(h[2], h[0], 12), `第三块应与第一块等高：${h.map((n) => n.toFixed(1))}`);
});

/* ------------------------------------------------------------------- edge */

test('vk-edge：连线端点贴合 from / to 的锚点', async () => {
  await reset(
    'vk-edge',
    `<vk-canvas w="800" h="400">
      <vk-box id="a" x="40" y="40" w="120" h="80" surface="paper">A</vk-box>
      <vk-box id="b" x="520" y="240" w="160" h="80" surface="paper">B</vk-box>
      <vk-edge id="e" from="#a@side:right" to="#b@side:left"></vk-edge>
    </vk-canvas>`
  );
  const r = await page.evaluate(() => {
    const path = document.querySelector('#e .vk-edge-path');
    const m = path.getScreenCTM();
    const p0 = path.getPointAtLength(0).matrixTransform(m);
    const p1 = path.getPointAtLength(path.getTotalLength()).matrixTransform(m);
    const a = document.querySelector('#a').getBoundingClientRect();
    const b = document.querySelector('#b').getBoundingClientRect();
    return {
      start: { x: p0.x, y: p0.y },
      end: { x: p1.x, y: p1.y },
      from: { x: a.right, y: a.top + a.height / 2 },
      to: { x: b.left, y: b.top + b.height / 2 },
      d: path.getAttribute('d'),
    };
  });
  assert.match(r.d, /^M/, `path 必须有起点：${r.d}`);
  assert.ok(near(r.start.x, r.from.x), `起点 x 应贴右边缘：${r.start.x} vs ${r.from.x}`);
  assert.ok(near(r.start.y, r.from.y), `起点 y 应贴中点：${r.start.y} vs ${r.from.y}`);
  assert.ok(near(r.end.x, r.to.x), `终点 x 应贴左边缘：${r.end.x} vs ${r.to.x}`);
  assert.ok(near(r.end.y, r.to.y), `终点 y 应贴中点：${r.end.y} vs ${r.to.y}`);
});

/* ----------------------------------------------------------------- inline */

test('vk-inline：link 变真链接（role/tabindex/点击跳转），keys 拆成键帽', async () => {
  await reset(
    'vk-inline',
    `<vk-inline id="l" variant="link" href="#inline-target">链接</vk-inline>
     <vk-inline id="k" variant="keys">Ctrl + C</vk-inline>`
  );
  const before = await page.evaluate(() => {
    const l = document.getElementById('l');
    return {
      role: l.getAttribute('role'),
      tabindex: l.getAttribute('tabindex'),
      cursor: getComputedStyle(l).cursor,
      keys: document.querySelectorAll('#k kbd').length,
    };
  });
  assert.equal(before.role, 'link');
  assert.equal(before.tabindex, '0');
  assert.equal(before.cursor, 'pointer');
  assert.equal(before.keys, 2, 'Ctrl + C 应拆成两枚键帽');
  await page.click('#l');
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => location.hash), '#inline-target', '点击链接触发 hash 导航');
});

/* ------------------------------------------------------------------- list */

test('vk-list：ordered 生成真 <ol>（编号语义），check 仍是 <ul> 并换标记', async () => {
  await reset(
    'vk-list',
    `<vk-list id="o" variant="ordered"><li>一</li><li>二</li></vk-list>
     <vk-list id="c" variant="check"><li>甲</li><li>乙</li></vk-list>`
  );
  const r = await page.evaluate(() => {
    const read = (id) => {
      const root = document.querySelector(`#${id} .vk-list`);
      return {
        tag: root.tagName,
        mode: root.dataset.mode,
        ordered: root.hasAttribute('data-ordered'),
      };
    };
    return { o: read('o'), c: read('c') };
  });
  assert.equal(r.o.tag, 'OL', 'ordered 必须是真 <ol>（编号语义）');
  assert.equal(r.o.ordered, true);
  assert.equal(r.c.tag, 'UL', 'check 仍是 <ul>');
  assert.equal(r.c.mode, 'check');
  assert.equal(r.o.mode, 'bullet');
});

/* ------------------------------------------------------------------ table */

test('vk-table：stripe 给斑马纹，variant=spec 换列距', async () => {
  await openHost('vk-table');
  const read = () =>
    page.evaluate(() => {
      const rows = [...document.querySelectorAll('vk-table tbody tr')];
      return {
        bgs: rows.map((tr) => getComputedStyle(tr).backgroundColor),
        pad: getComputedStyle(document.querySelector('vk-table tbody td')).paddingTop,
      };
    });
  const plain = await read();
  await page.evaluate(() => document.querySelector('vk-table').setAttribute('stripe', ''));
  await settle();
  const striped = await read();
  assert.ok(
    striped.bgs.some((c) => c !== 'rgba(0, 0, 0, 0)'),
    `stripe 必须让行有底色：${JSON.stringify(striped.bgs)}`
  );
  assert.ok(
    striped.bgs.some((c, i) => c !== plain.bgs[i]),
    `stripe 必须真的改变某一行：${JSON.stringify(plain.bgs)} → ${JSON.stringify(striped.bgs)}`
  );
  await page.evaluate(() => document.querySelector('vk-table').setAttribute('variant', 'spec'));
  await settle();
  const spec = await read();
  assert.notEqual(spec.pad, striped.pad, `variant=spec 应改列距：${spec.pad} vs ${striped.pad}`);
});

/* ------------------------------------------------------------------- math */

test('vk-math：display 切换行内/块级，size 改公式字号', async () => {
  await openHost('vk-math');
  const host = 'vk-math';
  const read = () =>
    page.evaluate(() => ({
      inner: getComputedStyle(document.querySelector('vk-math .vk-math')).display,
      font: parseFloat(getComputedStyle(document.querySelector('vk-math .katex')).fontSize),
    }));
  const block = await read();
  await page.evaluate(() => document.querySelector('vk-math').removeAttribute('display'));
  await settle();
  const inline = await read();
  assert.notEqual(block.inner, inline.inner, `display 应改变公式盒：${block.inner} / ${inline.inner}`);
  await page.evaluate(() => document.querySelector('vk-math').setAttribute('size', 'subhead'));
  await settle();
  const big = await read();
  await page.evaluate(() => document.querySelector('vk-math').setAttribute('size', 'label'));
  await settle();
  const small = await read();
  assert.ok(big.font > small.font, `size 应从 subhead 112 降到 label 48：${big.font} / ${small.font}`);
});

/* ------------------------------------------------------------------ cells */

test('vk-cells：cols 决定每行格数，current 标出第 N 格', async () => {
  const lis = Array.from({ length: 7 }, (_, i) => `<li value="${i}" label="s[${i}]"></li>`).join('');
  await reset('vk-cells', `<vk-cells id="c" cols="3" current="5" addr="0x1000">${lis}</vk-cells>`);
  const r = await page.evaluate(() => {
    const host = document.getElementById('c');
    const cells = [...host.querySelectorAll('.vk-cell')];
    const grid = getComputedStyle(host.querySelector('.vk-cells')).gridTemplateColumns.split(' ').length;
    const tops = [...new Set(cells.map((c) => Math.round(c.getBoundingClientRect().top)))];
    const cur = host.querySelector('.vk-cell[data-state="current"]');
    return { grid, rows: tops.length, cur: cur?.dataset.cell, count: cells.length };
  });
  assert.equal(r.count, 7);
  assert.equal(r.grid, 3, `cols=3 应有三条轨道：${r.grid}`);
  assert.equal(r.rows, 3, `7 格 3 列应排成 3 行：${r.rows}`);
  assert.equal(r.cur, '4', `current=5 应标第 5 格（下标 4）：${r.cur}`);
});

/* ------------------------------------------------------------------- bits */

test('vk-bits：bit-width 决定位数，sign 标出符号位', async () => {
  await openHost('vk-bits');
  const host = 'vk-bits';
  const count = () => page.evaluate(() => document.querySelectorAll('vk-bits .vk-bit').length);
  assert.equal(await count(), 32, '标本是 32 位');
  await page.evaluate(() => document.querySelector('vk-bits').setAttribute('bit-width', '8'));
  await settle();
  assert.equal(await count(), 8, 'bit-width=8 只画最后 8 位');
  const signOn = await page.evaluate(() => getComputedStyle(document.querySelector('vk-bits .vk-bit')).backgroundColor);
  await page.evaluate(() => document.querySelector('vk-bits').removeAttribute('sign'));
  await settle();
  const signOff = await page.evaluate(() => getComputedStyle(document.querySelector('vk-bits .vk-bit')).backgroundColor);
  assert.notEqual(signOn, signOff, `sign 必须给最高位换底：${signOn} / ${signOff}`);
});

/* ------------------------------------------------------------------- bars */

test('vk-bars：负值落在零线左边，ratio-to 标出倍率', async () => {
  await reset(
    'vk-bars',
    `<vk-bars id="b" ratio-to="0">
      <li value="100" label="A"></li><li value="-50" label="B"></li><li value="10" label="C"></li>
    </vk-bars>`
  );
  const r = await page.evaluate(() => {
    const host = document.getElementById('b');
    const zero = parseFloat(host.querySelector('.vk-bar-zero').style.left);
    const fill = host.querySelector('.vk-bar[data-negative="1"] .vk-bar-fill');
    const left = parseFloat(fill.style.left || '0');
    const width = parseFloat(fill.style.width || '0');
    const x = [...host.querySelectorAll('.vk-bar-x')].map((n) => n.textContent.trim());
    return { zero, right: left + width, left, x };
  });
  assert.ok(r.left < r.zero, '负值条必须从零线左侧起画');
  assert.ok(near(r.right, r.zero, 0.5), `负值条右端应贴零线：${r.right}% vs ${r.zero}%`);
  assert.deepEqual(r.x, ['×1', '×0.1'], `ratio-to=0 时每行都标倍率（基准行也标 ×1）：${JSON.stringify(r.x)}`);
});

/* --------------------------------------------------------------- timeline */

test('vk-timeline：lanes 按 at / lane 摆位，current 标出第 N 条', async () => {
  await reset(
    'vk-timeline',
    `<vk-timeline id="t" variant="lanes" steps="4" lanes="主,从" current="2" size="subhead">
      <li lane="主" at="0" span="2" label="A">A</li>
      <li lane="从" at="2" label="B">B</li>
    </vk-timeline>`
  );
  const r = await page.evaluate(() => {
    const host = document.getElementById('t');
    const chips = [...host.querySelectorAll('.vk-tl-chip')];
    const rect = (el) => el.getBoundingClientRect();
    return {
      lanes: !!host.querySelector('.vk-tl-lanes'),
      count: chips.length,
      current: chips.find((c) => c.dataset.state === 'current')?.dataset.event,
      a: { top: rect(chips[0]).top, left: rect(chips[0]).left },
      b: { top: rect(chips[1]).top, left: rect(chips[1]).left },
    };
  });
  assert.equal(r.lanes, true, 'variant=lanes 应生成泳道容器');
  assert.equal(r.count, 2);
  assert.equal(r.current, '1', `current=2 应标第 2 条（下标 1）：${r.current}`);
  assert.notEqual(r.a.top, r.b.top, '不同泳道必须在不同行');
  assert.ok(r.b.left > r.a.left, `at=2 的条目应在 at=0 右侧：${r.b.left} vs ${r.a.left}`);
});

/* ----------------------------------------------------------------- canvas */

test('vk-canvas：pad-px 内缩坐标原点，grid 画出栅格', async () => {
  await reset(
    'vk-canvas',
    `<vk-canvas id="c" w="800" h="400" pad-px="0" grid="0">
      <vk-box id="b" x="0" y="0" w="100" h="50" surface="soft">A</vk-box>
    </vk-canvas>`
  );
  const read = () =>
    page.evaluate(() => {
      const canvas = document.getElementById('c').getBoundingClientRect();
      const box = document.getElementById('b').getBoundingClientRect();
      return {
        left: box.left - canvas.left,
        top: box.top - canvas.top,
        bg: getComputedStyle(document.getElementById('c')).backgroundImage,
      };
    });
  const before = await read();
  await page.evaluate(() => {
    const c = document.getElementById('c');
    c.setAttribute('pad-px', '40');
    c.setAttribute('grid', '40');
  });
  await settle();
  const after = await read();
  assert.ok(near(after.left - before.left, 40), `pad-px=40 应把原点右移 40：${after.left} vs ${before.left}`);
  assert.ok(near(after.top - before.top, 40), `pad-px=40 应把原点下移 40：${after.top} vs ${before.top}`);
  assert.match(after.bg, /gradient|url\(/, `grid 必须画出栅格：${after.bg}`);
});

/* ------------------------------------------------------------------- tree */

test('vk-tree：limit 截断，但 current 分支不被截掉', async () => {
  await openHost('vk-tree');
  const read = () =>
    page.evaluate(() => {
      const tree = document.querySelector('vk-tree');
      const rows = [...tree.querySelectorAll('.vk-tree-row')];
      return {
        top: rows.filter((r) => r.dataset.depth === '0').length,
        all: rows.length,
        paths: rows.map((r) => r.dataset.nodePath),
        current: tree.querySelector('.vk-tree-row[data-current]')?.dataset.nodePath || '',
      };
    });
  const full = await read();
  assert.ok(full.top > 1, `标本应有多个顶层条目：${full.top}`);
  await page.evaluate(() => document.querySelector('vk-tree').setAttribute('limit', '1'));
  await settle();
  const limited = await read();
  assert.ok(limited.top < full.top, `limit=1 应只留一个顶层条目（+current）：${limited.top}/${full.top}`);
  assert.ok(!limited.paths.includes('Makefile'), `limit 外的顶层条目应消失：${limited.paths.join(',')}`);

  const deep = full.paths[full.paths.length - 1];
  await page.evaluate((path) => {
    const tree = document.querySelector('vk-tree');
    tree.setAttribute('limit', '1');
    tree.setAttribute('current', path);
  }, deep);
  await settle();
  await page.waitForFunction(() => !!document.querySelector('vk-tree .vk-tree-row[data-current]'), null, { timeout: 2000 });
  const r = await read();
  assert.equal(r.current, deep, `current 那一支必须画出来：${r.current} / ${deep}`);
  assert.ok(!r.paths.includes('hello.c'), `limit=1 时非 current 的顶层条目仍应被截掉：${r.paths.join(',')}`);
});

/* -------------------------------------------------------------------- img */

test('vk-img：ratio 决定盒高，加载失败露出可见占位', async () => {
  await openHost('vk-img');
  await page.evaluate(() => {
    const img = document.querySelector('vk-img');
    img.setAttribute('ratio', '2 / 1');
    img.setAttribute('fill', 'contain');
  });
  await settle();
  const box = await page.evaluate(() => {
    const host = document.querySelector('vk-img').getBoundingClientRect();
    const shell = document.querySelector('vk-img .vk-img');
    return {
      ratio: shell.getBoundingClientRect().width / shell.getBoundingClientRect().height,
      aspect: getComputedStyle(shell).aspectRatio,
      fit: getComputedStyle(document.querySelector('vk-img img')).objectFit,
      alt: document.querySelector('vk-img .vk-img-ph').textContent.trim(),
    };
  });
  assert.ok(near(box.ratio, 2, 0.05), `ratio="2 / 1" 盒高应是一半：${box.ratio}`);
  assert.equal(box.fit, 'contain', 'fill=contain 落到 img 的 object-fit');
  assert.ok(box.alt.length > 0, '占位层必须有可读文字（alt 或“图”）');

  await page.evaluate(() => document.querySelector('vk-img').setAttribute('src', 'assets/does-not-exist-vk.png'));
  await page.waitForFunction(() => document.querySelector('vk-img').hasAttribute('data-error'), null, { timeout: 4000 });
  const failed = await page.evaluate(() => {
    const host = document.querySelector('vk-img');
    const ph = host.querySelector('.vk-img-ph');
    return {
      error: host.hasAttribute('data-error'),
      visible: getComputedStyle(ph).visibility !== 'hidden' && getComputedStyle(ph).opacity !== '0',
    };
  });
  assert.equal(failed.error, true, '加载失败必须标 data-error');
  assert.equal(failed.visible, true, '失败占位必须可见');
});

/* ------------------------------------------------------------------- diff */

test('vk-diff：split 生成两窗，summary=none 关掉计数', async () => {
  await openHost('vk-diff');
  const read = () =>
    page.evaluate(() => {
      const host = document.querySelector('vk-diff');
      return {
        panes: [...host.querySelectorAll('.vk-diff-pane')].map((p) => p.dataset.label),
        meta: host.querySelectorAll('.vk-dmeta').length,
        split: !!host.querySelector('.vk-diff-split'),
        unified: !!host.querySelector('.vk-diff:not(.vk-diff-split)'),
      };
    });
  const unified = await read();
  assert.equal(unified.split, false, '默认是统一视图');
  assert.ok(unified.meta > 0, '默认显示改动计数');
  await page.evaluate(() => {
    const host = document.querySelector('vk-diff');
    host.setAttribute('variant', 'split');
    host.setAttribute('summary', 'none');
  });
  await settle();
  const split = await read();
  assert.equal(split.panes.length, 2, `split 必须生成两窗：${split.panes.join('/')}`);
  assert.deepEqual(split.panes, ['改前', '改后']);
  assert.equal(split.meta, 0, 'summary=none 必须关掉计数');
});

after(async () => {
  await page.close().catch(() => {});
  await closeBrowser(browser);
  await close();
});
