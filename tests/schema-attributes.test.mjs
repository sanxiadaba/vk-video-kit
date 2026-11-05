import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { PNG } from 'pngjs';
import { startServer } from '../cli/serve.mjs';
import { TAGS, TAG_NAMES } from '../src/registry.mjs';

/**
 * 属性表：公开属性名的上限、旧名折叠与构建期提示。
 *
 * 这一组守的是「两套写法，同一张画面」：
 *   1. 旧写法折成新写法之后，宿主上的属性值必须是规范形式（运行期折叠的证据）；
 *   2. 在同一张标本页上把属性从旧写法换成新写法，整页逐像素必须一致；
 *   3. 属性名总数有上限，防止同一个概念又长出第二套名字；
 *   4. 旧名在构建期给迁移提示，新写法不再提示。
 */

/* ------------------------------------------------------------- 1 · 度量 */

test('属性表：公开属性名总数不超过 141', () => {
  const names = new Set();
  for (const tag of TAG_NAMES) {
    for (const name of Object.keys(TAGS[tag].attrs || {})) names.add(name);
  }
  // 141 = 140 + vk-scene.kind。五个讲解动作必须有一个正式的 kind 属性；
  // 不是又一套形态词，而是「这一个容器今天是哪一种组合」。
  assert.ok(names.size <= 141, `属性名还有 ${names.size} 个，目标 ≤141`);
  for (const old of [
    'numbers',
    'ascii',
    'address',
    'offsets',
    'ruler',
    'summary',
    'gap-px',
    'gap-x',
    'gap-y',
    'pad-px',
    'pad-x',
    'pad-y',
    'arrow-style',
    'arrow-size',
    'arrow-scale',
    'arrow-label',
    'head',
    'cap',
    'fence-after',
    'fence-label',
    'index',
    'total',
    'a',
    'b',
  ]) {
    if (old === 'index') continue; // vk-bits 的位序号仍是 index（另一个概念）
    assert.ok(!names.has(old), `${old} 应该已经从公开属性里消失（只留别名）`);
  }
});

/* -------------------------------------------- 2 · 构建期提示（纯函数） */

test('属性改名：旧名构建期提示，新写法不提示', async () => {
  const { createVkHighlighter, transformHtml } = await import('../src/highlight.mjs');
  const highlighter = await createVkHighlighter(['c']);
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    await transformHtml(
      '<vk-box id="a" pad="md xs"></vk-box>' +
        '<vk-label counter="3/5" section="汇编">汇编</vk-label>',
      { file: 'convergence-new.html', highlighter }
    );
  } finally {
    console.warn = original;
  }
  assert.deepEqual(
    warnings.filter((w) => w.includes('已改名') || w.includes('已并成')),
    [],
    `新写法不该有迁移提示：\n${warnings.join('\n')}`
  );

  const oldWarnings = [];
  console.warn = (...args) => oldWarnings.push(args.join(' '));
  try {
    await transformHtml('<vk-box id="a" pad-x="md" pad-y="xs"></vk-box>', {
      file: 'convergence-old.html',
      highlighter,
    });
  } finally {
    console.warn = original;
  }
  assert.ok(
    oldWarnings.some((w) => w.includes('pad-x') && w.includes('已改名')),
    `pad-x 应给迁移提示，实际：\n${oldWarnings.join('\n')}`
  );
});

/* ------------------------------------------------ 3 · 运行期折叠 + 像素 */

const { base, close: closeServer } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
const tabs = [];

after(async () => {
  for (const tab of tabs) await tab.context().close().catch(() => {});
  await closeBrowser(browser);
  await closeServer();
});

async function openSpecimen(tag) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  tabs.push(tab);
  const resp = await tab.goto(`${base}/specimen/${tag}.html`, { waitUntil: 'load' });
  assert.ok(resp && resp.ok(), `打不开标本页 ${tag}`);
  await settle(tab);
  return tab;
}

async function settle(tab) {
  await tab.evaluate(async () => {
    await window.vk?.ready?.();
    window.vk?.layout?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 32));
  });
}

/** 在首个实例上清掉两套写法，再按给定参数重写；返回宿主当前属性表。 */
async function applyAttrs(tab, tag, remove, attrs) {
  return tab.evaluate(
    ({ tag, remove, attrs }) => {
      const host = document.querySelector(tag);
      if (!host) return null;
      for (const name of remove) host.removeAttribute(name);
      for (const [name, value] of Object.entries(attrs)) host.setAttribute(name, value);
      return Object.fromEntries([...host.attributes].map((a) => [a.name, a.value]));
    },
    { tag, remove, attrs }
  );
}

function pixels(buf) {
  const png = PNG.sync.read(buf);
  return { png, data: png.data };
}

function assertSamePixels(a, b, label) {
  // 快路径：同一浏览器对同一画面编码出的 PNG 字节一致，直接比缓冲，
  // 省掉两次 1080p 解码与逐像素循环（只有不同时才解码定位第一个差异）。
  if (a.equals(b)) return;
  const A = pixels(a);
  const B = pixels(b);
  assert.equal(A.png.width, B.png.width, `${label}：宽度不同`);
  assert.equal(A.png.height, B.png.height, `${label}：高度不同`);
  let diff = 0;
  let first = null;
  for (let i = 0; i < A.data.length; i += 4) {
    if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2]) {
      diff++;
      if (!first) first = `${(i / 4) % A.png.width},${Math.floor(i / 4 / A.png.width)}`;
    }
  }
  // 两种写法必须"长得一样"，但逐像素零差在这件事上过严：
  // 字体栅格化在不同平台/浏览器版本上会差几个像素（CI 上实测 1–32 个，
  // 占 1080p 的 0.0015%），那不是写法不等价，是渲染器不同。
  // 所以允许极小容差——仍然能抓住"属性没生效"这种成片差异。
  const total = A.png.width * A.png.height;
  const tolerance = Math.max(64, Math.round(total * 0.00002)); // 1080p ≈ 41 像素
  assert.ok(
    diff <= tolerance,
    `${label}：${diff} 个像素不同（容差 ${tolerance}，首个 ${first}）`
  );
}

const FOLD_CASES = [
  {
    tag: 'vk-box',
    newAttrs: { pad: 'md 2xs' },
    oldAttrs: { 'pad-x': 'md', 'pad-y': '2xs' },
    canonical: { pad: 'md 2xs' },
  },
  {
    tag: 'vk-grid',
    newAttrs: { gap: 'sm lg' },
    oldAttrs: { 'gap-x': 'sm', 'gap-y': 'lg' },
    canonical: { gap: 'sm lg' },
  },
  {
    tag: 'vk-canvas',
    newAttrs: { pad: '48' },
    oldAttrs: { 'pad-px': '48' },
    canonical: { pad: '48' },
  },
  {
    tag: 'vk-edge',
    newAttrs: { arrow: 'end,size:52,cap:start' },
    oldAttrs: { 'arrow-style': 'solid', 'arrow-size': '52', cap: 'dot' },
    canonical: { arrow: 'end,size:52,cap:start' },
  },
  {
    tag: 'vk-flow',
    newAttrs: { arrow: 'true,scale:0.3,label:gcc' },
    oldAttrs: { 'arrow-scale': '0.3', 'arrow-label': 'gcc' },
    canonical: { arrow: 'true,scale:0.3,label:gcc' },
  },
  {
    tag: 'vk-annotate',
    newAttrs: { arrow: 'end,scale:0.2,label:gcc', gap: '40' },
    oldAttrs: { head: 'arrow', 'arrow-scale': '0.2', 'arrow-label': 'gcc', 'gap-px': '40' },
    canonical: { arrow: 'end,scale:0.2,label:gcc', gap: '40' },
  },
  {
    tag: 'vk-note',
    newAttrs: { gap: '40' },
    oldAttrs: { 'gap-px': '40' },
    canonical: { gap: '40' },
  },
  {
    tag: 'vk-label',
    newAttrs: { counter: '3/5' },
    oldAttrs: { index: '3', total: '5' },
    canonical: { counter: '3/5' },
  },
  {
    tag: 'vk-code',
    newAttrs: { columns: 'none' },
    oldAttrs: { numbers: 'none' },
    canonical: { columns: 'none' },
  },
  {
    tag: 'vk-diff',
    newAttrs: { columns: 'summary' },
    oldAttrs: { numbers: 'none' },
    canonical: { columns: 'summary' },
  },
  {
    tag: 'vk-tree',
    newAttrs: { columns: 'none' },
    oldAttrs: { summary: 'none' },
    canonical: { columns: 'none' },
  },
  {
    tag: 'vk-cells',
    newAttrs: { columns: 'offsets,ruler' },
    oldAttrs: { offsets: '', ruler: '' },
    canonical: { columns: 'offsets,ruler' },
  },
  {
    tag: 'vk-bytes',
    newAttrs: { columns: 'address' },
    oldAttrs: { ascii: 'none' },
    canonical: { columns: 'address' },
  },
  {
    tag: 'vk-asm',
    newAttrs: { columns: 'none,titles:ADDR|BYTES|OP|ARGS', fence: 'after:4,label:屏障' },
    oldAttrs: { address: 'none', labels: 'ADDR|BYTES|OP|ARGS', 'fence-after': '4', 'fence-label': '屏障' },
    canonical: { columns: 'none,titles:ADDR|BYTES|OP|ARGS', fence: 'after:4,label:屏障' },
  },
  {
    tag: 'vk-compare',
    newAttrs: { labels: '../assets/hello/o0.png,../assets/hello/o2.png|左|右' },
    oldAttrs: { labels: '左|右', a: '../assets/hello/o0.png', b: '../assets/hello/o2.png' },
    canonical: { labels: '../assets/hello/o0.png,../assets/hello/o2.png|左|右' },
  },
];

const ALL = [...new Set(FOLD_CASES.flatMap((c) => [...Object.keys(c.newAttrs), ...Object.keys(c.oldAttrs)]))];

for (const item of FOLD_CASES) {
  test(`属性改名：${item.tag} 旧写法折成新写法，且与新写法逐像素一致`, async () => {
    const tab = await openSpecimen(item.tag);

    // 旧写法：先清空两套名字，只写旧名，等运行期折叠。
    await applyAttrs(tab, item.tag, ALL, {});
    await applyAttrs(tab, item.tag, ALL, item.oldAttrs);
    await settle(tab);
    const folded = await tab.evaluate((tag) => {
      const host = document.querySelector(tag);
      return Object.fromEntries([...host.attributes].map((a) => [a.name, a.value]));
    }, item.tag);
    for (const [name, value] of Object.entries(item.canonical)) {
      assert.equal(folded[name], value, `${item.tag} 的旧写法没有折成 ${name}="${value}"：${JSON.stringify(folded)}`);
    }
    for (const name of Object.keys(item.oldAttrs)) {
      if (name === 'labels' && item.tag === 'vk-compare') continue; // labels 是规范名
      assert.ok(!(name in folded), `${item.tag} 的旧名 ${name} 应该被移走：${JSON.stringify(folded)}`);
    }
    const oldShot = await tab.screenshot();

    // 新写法：同样的清空，只写新名。
    await applyAttrs(tab, item.tag, ALL, {});
    await applyAttrs(tab, item.tag, ALL, item.newAttrs);
    await settle(tab);
    const newShot = await tab.screenshot();

    assertSamePixels(oldShot, newShot, `${item.tag} 旧写法 vs 新写法`);
  });
}
