import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * 三个"真的坏了"的件：vk-note / vk-annotate / vk-label。
 *
 * 这些用例量的是画面事实，不是读了哪条 CSS：
 *   1. vk-note 的文字块永远在目标那一侧的富余空间里，不越出画布；
 *   2. vk-note 的引线终点落在目标边上（不是"和目标同 x 的空白"），不穿目标；
 *   3. vk-annotate 的圈选 = 目标矩形 + 2×pad，且不出目标自己的容器；
 *   4. vk-annotate 的编号点默认落在目标里（左上角 + 内距）；
 *   5. vk-annotate 的引线两端各自贴住目标边与标注框边（≤1px）；
 *   6. vk-label 的锚定标签与目标留 ≥12px 净空（gap-px 可配）、自带纸色底；
 *   7. 两行目标时标签只贴第一行，不压到第二行。
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
<body style="margin:0"><vk-page align="top">${body}</vk-page><script src="dist/vk.js"></script></body></html>`,
    { waitUntil: 'load' }
  );
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    await window.vk?.layout?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return tab;
}

after(async () => {
  for (const ctx of opened) await ctx.close().catch(() => {});
  await browser.close();
  await closeServer();
});

/** 页面里的公共测量：局部坐标、路径点、线段采样。 */
const HELPERS = () => {
  window.__box = (el, host) => {
    const r = el.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    return { left: r.left - h.left, top: r.top - h.top, right: r.right - h.left, bottom: r.bottom - h.top, width: r.width, height: r.height };
  };
  window.__points = (path) => {
    const d = path?.getAttribute('d') || '';
    const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
    return pts;
  };
  window.__onSegment = (pts, steps = 40) => {
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t });
      }
    }
    return out;
  };
  window.__inside = (p, r, pad = 2) =>
    p.x > r.left + pad && p.x < r.right - pad && p.y > r.top + pad && p.y < r.bottom - pad;
  /** 点到矩形边界的距离：在矩形内→到最近边的距离；在外→0（本例只关心"是不是落在边上"）。 */
  window.__edgeGap = (p, r) => {
    const inside = p.x >= r.left - 1 && p.x <= r.right + 1 && p.y >= r.top - 1 && p.y <= r.bottom + 1;
    if (!inside) return Infinity;
    return Math.min(
      Math.abs(p.x - r.left),
      Math.abs(p.x - r.right),
      Math.abs(p.y - r.top),
      Math.abs(p.y - r.bottom)
    );
  };
};

/* --------------------------------------------------------------- vk-note */

const NOTE_CANVAS = (y = 40, h = 160) => `<vk-canvas id="cv" w="1680" h="840">
  <vk-box id="edge" x="1520" y="${y}" w="140" h="${h}" surface="soft"></vk-box>
  <vk-box id="mid" x="380" y="${y}" w="560" h="${h}" surface="soft"></vk-box>
  <vk-note id="n1" variant="margin" for="#edge" w="360">这一段只讲入口：返回值说明程序有没有跑完。</vk-note>
  <vk-note id="n2" variant="margin" for="#mid" w="360">这一段只讲入口：返回值说明程序有没有跑完。再加一句更长的中文，看它会不会顶穿卡片跑到画布外面去。</vk-note>
  <vk-note id="n3" variant="margin" for="#edge" side="right" w="360">显式写右侧，但那一侧只有 20px 富余。</vk-note>
</vk-canvas>`;

test('vk-note：目标贴右边缘时边注翻到左侧，文字不出画布', async () => {
  const tab = await open(NOTE_CANVAS());
  await tab.evaluate(HELPERS);
  const r = await tab.evaluate(() => {
    const cv = document.querySelector('#cv');
    const host = window.__box(cv, cv);
    const read = (id) => {
      const box = window.__box(document.querySelector(`#${id} .vk-note-m`), cv);
      const target = window.__box(document.querySelector('#edge'), cv);
      const lines = [...document.querySelectorAll(`#${id} .vk-note-t`)].flatMap((t) =>
        [...t.getClientRects()].filter((q) => q.width > 0.5).map((q) => window.__box({ getBoundingClientRect: () => q }, cv))
      );
      return { box, target, lines, side: document.querySelector(`#${id} .vk-note-line`).getAttribute('data-side') };
    };
    return { host: { left: 0, top: 0, right: host.width, bottom: host.height }, a: read('n1'), b: read('n3') };
  });
  for (const [name, one] of [
    ['auto', r.a],
    ['显式 side="right"', r.b],
  ]) {
    assert.equal(one.side, 'left', `${name}：贴右边缘的目标，边注要翻到左侧：${one.side}`);
    assert.ok(one.box.right <= one.target.left - 12, `${name}：边注要落在目标左侧：${one.box.right} vs ${one.target.left}`);
    assert.ok(one.box.left >= 0 && one.box.right <= r.host.right, `${name}：边注不许出画布：${JSON.stringify(one.box)}`);
    assert.ok(one.box.top >= 0 && one.box.bottom <= r.host.bottom, `${name}：边注不许纵向出画布：${JSON.stringify(one.box)}`);
    for (const l of one.lines) {
      assert.ok(l.left >= one.box.left - 0.5 && l.right <= one.box.right + 0.5, `${name}：文字越出了边注框：${JSON.stringify(l)}`);
      assert.ok(l.right <= r.host.right, `${name}：文字越出了画布`);
    }
  }
  assert.ok(r.a.lines.length >= 2, `21 个字的句子在 360 宽里必须换行：${r.a.lines.length}`);
});

test('vk-note：长中文句子与长 token 都不越界，宽度不超 w', async () => {
  const tab = await open(NOTE_CANVAS());
  await tab.evaluate(HELPERS);
  const r = await tab.evaluate(() => {
    const cv = document.querySelector('#cv');
    const host = window.__box(cv, cv);
    const box = window.__box(document.querySelector('#n2 .vk-note-m'), cv);
    const cs = getComputedStyle(document.querySelector('#n2 .vk-note-m'));
    const lines = [...document.querySelectorAll('#n2 .vk-note-t')].flatMap((t) =>
      [...t.getClientRects()].filter((q) => q.width > 0.5).map((q) => window.__box({ getBoundingClientRect: () => q }, cv))
    );
    return {
      host: { right: host.width, bottom: host.height },
      box,
      lines,
      maxWidth: cs.maxWidth,
      wrap: cs.overflowWrap || cs.wordWrap,
    };
  });
  assert.equal(r.maxWidth, '100%', `边注文字块必须有 max-width：${r.maxWidth}`);
  assert.equal(r.wrap, 'anywhere', `边注必须 overflow-wrap:anywhere：${r.wrap}`);
  assert.ok(Math.abs(r.box.width - 360) <= 1, `宽度要按 w=360 落：${r.box.width}`);
  assert.ok(r.box.right <= r.host.right && r.box.bottom <= r.host.bottom, '边注不许出画布');
  for (const l of r.lines) assert.ok(l.right <= r.box.right + 0.5, `文字越出了边注框：${JSON.stringify(l)}`);
});

test('vk-note：引线终点落在目标边上，不穿目标矩形', async () => {
  const tab = await open(`<vk-canvas id="cv" w="1680" h="360">
  <vk-box id="t" x="380" y="220" w="560" h="40" surface="soft"></vk-box>
  <vk-note id="n" variant="margin" for="#t" w="360" leader="dot">这一段只讲入口：返回值说明程序有没有跑完。</vk-note>
</vk-canvas>`);
  await tab.evaluate(HELPERS);
  const r = await tab.evaluate(() => {
    const cv = document.querySelector('#cv');
    const host = window.__box(cv, cv);
    const box = window.__box(document.querySelector('#n .vk-note-m'), cv);
    const target = window.__box(document.querySelector('#t'), cv);
    const pts = window.__points(document.querySelector('#n .vk-note-line'));
    const samples = window.__onSegment(pts);
    return {
      host: { right: host.width, bottom: host.height },
      box,
      target,
      pts,
      head: pts[0],
      tail: pts[pts.length - 1],
      headGap: window.__edgeGap(pts[0], target),
      tailGap: window.__edgeGap(pts[pts.length - 1], box),
      crossing: samples.filter((p) => window.__inside(p, target)).length,
      dot: (() => {
        const c = document.querySelector('#n .vk-note-mark');
        return { x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')), shown: c.style.display !== 'none' };
      })(),
    };
  });
  assert.ok(r.box.bottom <= r.host.bottom, `边注不许纵向出画布：${r.box.bottom}`);
  assert.ok(r.headGap <= 1, `引线终点必须落在目标边上：差 ${r.headGap}px（点 ${r.head.x},${r.head.y} 目标 ${JSON.stringify(r.target)}）`);
  assert.ok(r.tailGap <= 1, `引线起点必须落在标注框边上：差 ${r.tailGap}px`);
  assert.equal(r.crossing, 0, `引线穿过了目标矩形：${JSON.stringify(r.pts)}`);
  assert.equal(r.dot.shown, true, 'leader="dot" 要有圆点');
  assert.ok(Math.abs(r.dot.x - r.head.x) <= 1 && Math.abs(r.dot.y - r.head.y) <= 1, '圆点落在目标端');
});

/* ----------------------------------------------------------- vk-annotate */

const BIG = `<vk-canvas id="cv" w="1680" h="840">
  <vk-box id="big" x="40" y="40" w="1000" h="200" surface="soft" radius="lg"><vk-text size="body">矩形目标</vk-text></vk-box>
  <vk-annotate id="c" mode="circle" ring="ellipse" for="#big"></vk-annotate>
  <vk-annotate id="cd" mode="circle" ring="ellipse" double for="#big"></vk-annotate>
  <vk-annotate id="b0" mode="badge" n="2" for="#big"></vk-annotate>
  <vk-annotate id="b1" mode="note" note="badge" n="3" for="#big"></vk-annotate>
  <vk-annotate id="nt" mode="note" note="bubble" side="bottom" for="#big">这里少了一行</vk-annotate>
</vk-canvas>`;

test('vk-annotate circle：椭圆 = 目标 + 2×pad，且不出目标宽度', async () => {
  const tab = await open(BIG);
  await tab.evaluate(HELPERS);
  const r = await tab.evaluate(() => {
    const cv = document.querySelector('#cv');
    const target = window.__box(document.querySelector('#big'), cv);
    const shape = (id) => {
      const n = document.querySelector(`#${id} .vk-ring-shape`);
      const b = window.__box(n, cv);
      return { tag: n.tagName.toLowerCase(), ...b, rx: Number(n.getAttribute('rx')), ry: Number(n.getAttribute('ry')) };
    };
    const shapes = [...document.querySelectorAll('#cd .vk-ring-shape')].map((n) => window.__box(n, cv));
    return { target, one: shape('c'), double: shape('cd'), both: shapes };
  });
  const pad = 12;
  assert.equal(r.one.tag, 'ellipse');
  assert.ok(Math.abs(r.one.width - (r.target.width + pad * 2)) <= 1, `椭圆宽 = 目标 + 2×pad：${r.one.width} vs ${r.target.width}+24`);
  assert.ok(Math.abs(r.one.height - (r.target.height + pad * 2)) <= 1, `椭圆高 = 目标 + 2×pad：${r.one.height} vs ${r.target.height}+24`);
  assert.ok(Math.abs(r.one.left - (r.target.left - pad)) <= 1, `椭圆左边 = 目标左边 - pad：${r.one.left}`);
  assert.ok(Math.abs(r.one.top - (r.target.top - pad)) <= 1, `椭圆上边 = 目标上边 - pad：${r.one.top}`);
  assert.equal(r.both.length, 2, 'double 要画内外两圈');
  for (const b of r.both) {
    assert.ok(b.left < r.target.left && b.right > r.target.right, '每一圈都要把目标包住');
    assert.ok(b.width <= r.target.width + pad * 2 + 1, `圈不许比目标 + 2×pad 还宽：${b.width}`);
  }
});

test('vk-annotate circle：贴边的目标不把圈顶出容器', async () => {
  // 代码行 / 满宽文本块这类目标，rect 本身就贴着容器边：pad 再往外扩就出框了。
  const tab = await open(`<vk-canvas id="cv" w="1680" h="840">
  <vk-box id="frame" x="100" y="100" w="420" h="160" pad="none" surface="soft">
    <vk-text id="row" size="body">一行贴边的字</vk-text>
  </vk-box>
  <vk-annotate id="c" mode="circle" ring="ellipse" double for="#row"></vk-annotate>
</vk-canvas>`);
  await tab.evaluate(HELPERS);
  const r = await tab.evaluate(() => {
    const cv = document.querySelector('#cv');
    return {
      frame: window.__box(document.querySelector('#frame'), cv),
      row: window.__box(document.querySelector('#row'), cv),
      rings: [...document.querySelectorAll('#c .vk-ring-shape')].map((n) => ({
        ...window.__box(n, cv),
        inner: n.classList.contains('vk-annot-ring-inner'),
      })),
    };
  });
  assert.equal(r.rings.length, 2, 'double 要画内外两圈');
  const outer = r.rings.find((b) => !b.inner);
  assert.ok(outer.left <= r.row.left + 0.5 && outer.right >= r.row.right - 0.5, '外圈要把目标包住');
  assert.ok(outer.top <= r.row.top + 0.5 && outer.bottom >= r.row.bottom - 0.5, '外圈要把目标包住');
  for (const b of r.rings) {
    assert.ok(b.left >= r.frame.left - 0.5, `圈向左顶出了容器：${b.left} < ${r.frame.left}`);
    assert.ok(b.right <= r.frame.right + 0.5, `圈向右顶出了容器：${b.right} > ${r.frame.right}`);
    assert.ok(b.top >= r.frame.top - 0.5 && b.bottom <= r.frame.bottom + 0.5, '圈纵向顶出了容器');
  }
});

test('vk-annotate badge：编号点默认落在目标里（左上角 + 内距）', async () => {
  const tab = await open(BIG);
  await tab.evaluate(HELPERS);
  const r = await tab.evaluate(() => {
    const cv = document.querySelector('#cv');
    const target = window.__box(document.querySelector('#big'), cv);
    const badge = (id) => window.__box(document.querySelector(`#${id} .vk-pin-bd`), cv);
    return {
      target,
      badge: badge('b0'),
      noteBadge: badge('b1'),
      leader: !!document.querySelector('#b0 .vk-pin-leader'),
    };
  });
  const t = r.target;
  for (const [name, b] of [
    ['mode="badge"', r.badge],
    ['mode="note" note="badge"', r.noteBadge],
  ]) {
    assert.ok(b.left >= t.left - 0.5, `${name} 的编号点向左出了目标：${b.left} < ${t.left}`);
    assert.ok(b.top >= t.top - 0.5, `${name} 的编号点向上出了目标：${b.top} < ${t.top}`);
    assert.ok(b.right <= t.right + 0.5, `${name} 的编号点向右出了目标：${b.right} > ${t.right}`);
    assert.ok(b.bottom <= t.bottom + 0.5, `${name} 的编号点向下出了目标：${b.bottom} > ${t.bottom}`);
    assert.ok(Math.abs(b.left - (t.left + 12)) <= 1, `${name} 的内距应是 12：${b.left - t.left}`);
    assert.ok(Math.abs(b.top - (t.top + 12)) <= 1, `${name} 的内距应是 12：${b.top - t.top}`);
  }
  assert.equal(r.leader, false, '编号点在目标里，不该再画一条穿进目标的引线');
});

test('vk-annotate note：引线两端各自贴住目标边与标注框边（≤1px）', async () => {
  const tab = await open(BIG);
  await tab.evaluate(HELPERS);
  const r = await tab.evaluate(() => {
    const cv = document.querySelector('#cv');
    const target = window.__box(document.querySelector('#big'), cv);
    const box = window.__box(document.querySelector('#nt .vk-pin-bd'), cv);
    const pts = window.__points(document.querySelector('#nt .vk-pin-leader'));
    const samples = window.__onSegment(pts);
    return {
      target,
      box,
      pts,
      // 引线从标注框出发（pts[0]）、落在目标边上（最后一点）。
      fromGap: window.__edgeGap(pts[0], box),
      toGap: window.__edgeGap(pts[pts.length - 1], target),
      crossing: samples.filter((p) => window.__inside(p, target)).length,
      side: document.querySelector('#nt .vk-pin-leader').getAttribute('data-side'),
    };
  });
  assert.equal(r.side, 'bottom');
  assert.ok(r.toGap <= 1, `引线终点要落在目标边上：差 ${r.toGap}px（点 ${JSON.stringify(r.pts[r.pts.length - 1])} 目标 ${JSON.stringify(r.target)}）`);
  assert.ok(r.fromGap <= 1, `引线起点要落在标注框边上：差 ${r.fromGap}px`);
  assert.equal(r.crossing, 0, '引线不许穿进目标');
});

/* -------------------------------------------------------------- vk-label */

test('vk-label：锚定标签与目标的净空 ≥12px，gap-px 可配', async () => {
  const tab = await open(`<vk-stack gap="lg">
  <vk-box id="t" surface="none" pad="sm"><vk-text size="subhead">目标内容</vk-text></vk-box>
  <vk-label id="d" for="#t" side="top">你写的</vk-label>
  <vk-label id="g" for="#t" side="top" gap-px="12">编译器给的</vk-label>
</vk-stack>`);
  await tab.evaluate(HELPERS);
  const r = await tab.evaluate(() => {
    const target = document.querySelector('#t').getBoundingClientRect();
    const one = (id) => {
      const span = document.querySelector(`#${id} .vk-caption`).getBoundingClientRect();
      return { gap: target.top - span.bottom, bottom: span.bottom, top: span.top };
    };
    return { d: one('d'), g: one('g'), targetTop: target.top };
  });
  assert.ok(r.d.gap >= 12, `默认净空必须 ≥12：${r.d.gap}`);
  assert.ok(Math.abs(r.d.gap - 16) <= 1, `默认净空是 16：${r.d.gap}`);
  assert.ok(r.g.gap >= 12, `gap-px 也不能低于 12：${r.g.gap}`);
  assert.ok(Math.abs(r.g.gap - 12) <= 1, `gap-px="12" 要落到 12：${r.g.gap}`);
});

test('vk-label：锚定标签自带纸色底与 1px 内距', async () => {
  const tab = await open(`<vk-stack gap="lg">
  <vk-box id="t" surface="none" pad="sm"><vk-text size="subhead">目标内容</vk-text></vk-box>
  <vk-label id="d" for="#t">你写的</vk-label>
</vk-stack>`);
  const r = await tab.evaluate(() => {
    const span = document.querySelector('#d .vk-label');
    const cs = getComputedStyle(span);
    const page = getComputedStyle(document.querySelector('.vk-page'));
    return { bg: cs.backgroundColor, pad: cs.paddingTop, all: cs.padding, pageBg: page.backgroundColor, color: cs.color };
  });
  assert.notEqual(r.bg, 'rgba(0, 0, 0, 0)', `标签必须有纸色底：${r.bg}`);
  assert.equal(r.bg, r.pageBg, `底色要是纸本身：${r.bg} vs ${r.pageBg}`);
  assert.equal(r.pad, '1px', `1px 内距：${r.all}`);
  assert.equal(r.color, 'rgb(51, 61, 75)', `墨阶 secondary：${r.color}`);
});

test('vk-label：两行目标时标签只贴第一行，不压第二行', async () => {
  const tab = await open(`<vk-stack gap="lg">
  <vk-box id="t" surface="none" pad="sm">
    <vk-text size="subhead">printf("%s\\n", s);</vk-text>
    <vk-text size="subhead" mono>call 4026cc &lt;_puts&gt;</vk-text>
  </vk-box>
  <vk-label id="d" for="#t" side="top">你写的</vk-label>
</vk-stack>`);
  await tab.evaluate(HELPERS);
  const r = await tab.evaluate(() => {
    const target = document.querySelector('#t');
    const lines = [];
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) if (q.width > 0.5) lines.push(q);
    }
    lines.sort((a, b) => a.top - b.top);
    const span = document.querySelector('#d .vk-caption').getBoundingClientRect();
    return {
      lines: lines.map((q) => ({ top: q.top, bottom: q.bottom, left: q.left })),
      span: { left: span.left, top: span.top, bottom: span.bottom },
    };
  });
  assert.ok(r.lines.length >= 2, `这一块要有两行字：${r.lines.length}`);
  const [l1, l2] = r.lines;
  assert.ok(r.span.bottom <= l1.top - 11, `标签要贴在第一行上方且留 ≥12px：${r.span.bottom} vs ${l1.top}`);
  assert.ok(Math.abs(r.span.left - l1.left) <= 1, `左边界对齐首字符：${r.span.left} vs ${l1.left}`);
  assert.ok(r.span.bottom <= l2.top, '标签不许压到第二行');
  assert.ok(r.span.top < l2.top && r.span.bottom < l2.top, '标签只贴第一行');
});
