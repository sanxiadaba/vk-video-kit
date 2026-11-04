import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { THEME_NAMES } from './lib/surface-tokens.mjs';

/**
 * 主题 · 换颜色不换版
 *
 * 这一组只回答一个问题：同一块内容，三套主题下的几何是不是逐项相等？
 * 量的不是"看起来一样"，是每个元素的包围盒 / 字号 / 行高 / 字重 / 内距 /
 * 外距 / 间距 / 边框 / 圆角 / 字距——一项都不能差；同时颜色必须真的不同。
 *
 * 只换颜色的做法见 src/tokens/themes.css：主题层只有 --vk-theme-*，
 * 没有一条规则碰 font-size / padding / gap / width。
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
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css">
<style>html,body{margin:0;padding:0;background:#fff}
.probes{display:flex;flex-direction:column;gap:24px;width:560px}
.probe{background:var(--vk-paper-sf-0)}</style></head>
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
  await browser.close();
  await closeServer();
});

/** 同一块内容：把库里"会受颜色影响"的形态都放一遍。 */
const BLOCK = `
  <vk-text size="headline">纸与墨</vk-text>
  <vk-text size="body" ink="secondary">同一条正文，换纸不换版。</vk-text>
  <vk-stack direction="row" gap="xs" wrap>
    <vk-label variant="chip" tone="ok">成立</vk-label>
    <vk-label variant="chip" tone="warn">注意</vk-label>
    <vk-label variant="chip" tone="info">标注</vk-label>
  </vk-stack>
  <vk-panel variant="raised" pad="md" title="分区"><vk-text size="body">面板里的正文。</vk-text></vk-panel>
  <vk-code chrome="min" title="a.py" lang="py" size="caption" numbers="none">x = 1</vk-code>
  <vk-list variant="check"><li state="ok">甲</li><li state="err">乙</li></vk-list>
  <vk-steps current="1"><li>一</li><li>二</li><li>三</li></vk-steps>
  <vk-grid cols="3" gap="xs"><div class="cell">1</div><div class="cell">2</div><div class="cell">3</div></vk-grid>`;

const PROBES = `<div class="probes">${THEME_NAMES.map(
  (t) => `<div class="probe" data-theme="${t}" style="width:560px">${BLOCK}</div>`
).join('\n')}</div>`;

/** 每个元素的几何与排版属性（坐标相对 probe 左上角）。 */
const MEASURE = ({ theme }) => {
  const root = document.querySelector(`.probe[data-theme="${theme}"]`);
  const origin = root.getBoundingClientRect();
  const pick = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      x: +(r.x - origin.x).toFixed(2),
      y: +(r.y - origin.y).toFixed(2),
      w: +r.width.toFixed(2),
      h: +r.height.toFixed(2),
      fs: cs.fontSize,
      lh: cs.lineHeight,
      fw: cs.fontWeight,
      ls: cs.letterSpacing,
      pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '),
      mar: [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].join(' '),
      gap: `${cs.rowGap} ${cs.columnGap}`,
      border: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].join(' '),
      radius: cs.borderRadius,
      align: cs.textAlign,
    };
  };
  const rows = [root, ...root.querySelectorAll('*')].map(pick);
  // 标题默认 color:inherit（继承页面的墨），所以量正文那一行（ink="secondary"）。
  const bodyText = root.querySelectorAll('vk-text')[1] || root.querySelector('vk-text');
  const panel = root.querySelector('vk-panel');
  return {
    rows,
    theme: root.dataset.theme,
    paper: getComputedStyle(root).getPropertyValue('--vk-theme-paper').trim(),
    ink: getComputedStyle(root).getPropertyValue('--vk-theme-ink-1').trim(),
    accent: getComputedStyle(root).getPropertyValue('--vk-theme-accent').trim(),
    probeBg: getComputedStyle(root).backgroundColor,
    textColor: getComputedStyle(bodyText).color,
    panelBg: getComputedStyle(panel).backgroundColor,
  };
};

/** 找出两套主题的第一处几何差异（整份 deepEqual 的报错读不出东西）。 */
function diffGeometry(a, b) {
  const out = [];
  if (a.rows.length !== b.rows.length) out.push(`元素数不同：${a.rows.length} → ${b.rows.length}`);
  for (let i = 0; i < Math.min(a.rows.length, b.rows.length); i++) {
    const ra = a.rows[i];
    const rb = b.rows[i];
    for (const k of Object.keys(ra)) {
      if (String(ra[k]) !== String(rb[k])) out.push(`#${i} <${ra.tag}> ${k}: ${ra[k]} → ${rb[k]}`);
    }
  }
  return out;
}

test('主题 · 三套主题下同一页面的几何与字号逐项相等', async () => {
  const tab = await open(PROBES);
  const measured = {};
  for (const theme of THEME_NAMES) measured[theme] = await tab.evaluate(MEASURE, { theme });

  // 1. 几何：三套主题之间逐项相等（元素数也要相等）。
  for (let i = 1; i < THEME_NAMES.length; i++) {
    const a = measured[THEME_NAMES[0]];
    const b = measured[THEME_NAMES[i]];
    assert.deepEqual(diffGeometry(a, b), [], `paper 与 ${THEME_NAMES[i]} 的几何必须逐项相等`);
  }
  assert.ok(measured.paper.rows.length > 25, `应该量到 25+ 个元素，实际 ${measured.paper.rows.length}`);

  // 2. 颜色必须真的不同：主题没生效的话，上面那条也会"通过"。
  const bg = new Set(THEME_NAMES.map((t) => measured[t].probeBg));
  assert.equal(bg.size, 3, `三套主题的纸色必须互不相同：${[...bg].join(' / ')}`);
  for (const theme of THEME_NAMES) {
    assert.equal(measured[theme].theme, theme, `${theme} 的 data-theme 没落到宿主上`);
    assert.match(measured[theme].paper, /^#[0-9a-f]{6}$/i, `${theme} 的 --vk-theme-paper 应该是 hex`);
    assert.match(measured[theme].accent, /^#[0-9a-f]{6}$/i, `${theme} 的 --vk-theme-accent 应该是 hex`);
  }
  assert.notEqual(measured.paper.textColor, measured.graphite.textColor, '墨色必须随主题变');
  assert.notEqual(measured.paper.textColor, measured.blueprint.textColor, '墨色必须随主题变');
  assert.notEqual(measured.paper.panelBg, measured.graphite.panelBg, '面板底色必须随主题变');
});

test('主题 · vk-page 的 theme 属性换整套调色板（镜像到 data-theme）', async () => {
  const tab = await open(`<vk-page id="p" theme="graphite"><vk-text size="body">纸</vk-text></vk-page>`);
  const read = () =>
    tab.evaluate(() => {
      const p = document.getElementById('p');
      return {
        attr: p.getAttribute('theme'),
        data: p.dataset.theme ?? null,
        hostBg: getComputedStyle(p).backgroundColor,
        innerBg: getComputedStyle(p.querySelector('.vk-page')).backgroundColor,
        paper: getComputedStyle(p).getPropertyValue('--vk-theme-paper').trim(),
        ink: getComputedStyle(p).getPropertyValue('--vk-theme-ink-1').trim(),
      };
    });

  const graphite = await read();
  assert.equal(graphite.data, 'graphite', 'theme 属性要镜像到 data-theme（CSS 只有 [data-theme] 一种入口）');
  assert.equal(graphite.paper, '#fbfaf7', 'graphite 的纸是近白暖调');
  assert.equal(graphite.ink, '#191512', 'graphite 的墨是暖墨');
  assert.equal(graphite.hostBg, 'rgb(251, 250, 247)', 'vk-page 宿主底色跟着主题走');
  assert.equal(graphite.innerBg, 'rgb(251, 250, 247)', '画布底色跟着主题走');

  await tab.evaluate(() => {
    document.getElementById('p').setAttribute('theme', 'blueprint');
    window.vk.layout();
  });
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const blueprint = await read();
  assert.equal(blueprint.data, 'blueprint', '换属性就换主题（运行期）');
  assert.equal(blueprint.paper, '#f2f7fc', 'blueprint 的纸是极浅蓝');
  assert.equal(blueprint.hostBg, 'rgb(242, 247, 252)', '换主题后宿主底色立刻变');

  await tab.evaluate(() => {
    document.getElementById('p').removeAttribute('theme');
    window.vk.layout();
  });
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fallback = await read();
  assert.equal(fallback.data, null, '不写 theme 就不该有 data-theme（交给外层继承）');
  assert.equal(fallback.paper, '#ffffff', '不写 theme 时回到默认主题 paper');
  assert.equal(fallback.hostBg, 'rgb(255, 255, 255)', '默认主题下纸还是纯白');

  // 非法值：构建期会拦（registry 的枚举），运行期退回"不写"，不炸页面。
  await tab.evaluate(() => {
    document.getElementById('p').setAttribute('theme', 'neon');
    window.vk.layout();
  });
  await tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const invalid = await read();
  assert.equal(invalid.data, null, '非法主题值不该写进 data-theme');
  assert.equal(invalid.hostBg, 'rgb(255, 255, 255)', '非法值退回默认主题，页面照常');
});
