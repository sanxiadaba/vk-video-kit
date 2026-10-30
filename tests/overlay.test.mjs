import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

/**
 * 覆盖层与留白度量 —— 两条都在 12.x 修过，都是"看不出错、但一直错"的那类：
 *   · 聚光挂在 .vk-page-inner 上，遮罩跟着 1680 的盒子一起缩，纸边永远白的；
 *   · 留白度量把覆盖层算成内容，vk-edge 的 svg 铺满整页，"内容底"永远是画布底。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

const SHELL = (body) => `<!doctype html><html><head><meta charset="utf-8"><base href="${base}/">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body>${body}<script src="dist/vk.js"></script></body></html>`;

const ready = async () => {
  await page.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(120);
};

test('vk-spotlight 的遮罩盖满整张纸，洞对得准目标', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-cells id="mem" cols="4">
        <li value="48" label="H"></li><li value="65" label="e"></li>
        <li value="6C" label="l"></li><li value="00" filled></li>
      </vk-cells>
      <vk-spotlight for="#mem@cell:3" dim="0.3" feather="0"></vk-spotlight>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const r = await page.evaluate(() => {
    const page = document.querySelector('.vk-page');
    const ov = document.querySelector('vk-spotlight');
    const veil = document.querySelector('vk-spotlight .vk-ov-svg > rect');
    const ring = document.querySelector('.vk-spotlight-ring rect');
    const cell = document.querySelector('#mem .vk-cell[data-cell="3"]');
    const box = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height, cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
    };
    return {
      parentIsPage: ov.parentElement === page,
      page: box(page),
      veil: box(veil),
      ring: box(ring),
      cell: box(cell),
    };
  });
  assert.ok(r.parentIsPage, '聚光应该挂成 .vk-page 的子节点（不是 1680 宽的 .vk-page-inner）');
  assert.ok(Math.abs(r.veil.w - r.page.w) < 2, `遮罩宽 ${r.veil.w} 应等于纸宽 ${r.page.w}`);
  assert.ok(Math.abs(r.veil.h - r.page.h) < 2, `遮罩高 ${r.veil.h} 应等于纸高 ${r.page.h}`);
  assert.ok(Math.abs(r.veil.x - r.page.x) < 2 && Math.abs(r.veil.y - r.page.y) < 2, '遮罩要压到纸的左上角');
  assert.ok(Math.abs(r.ring.cx - r.cell.cx) < 12, `洞中线 ${r.ring.cx} 应落在格子中线 ${r.cell.cx}`);
  assert.ok(Math.abs(r.ring.cy - r.cell.cy) < 12, `洞中线 ${r.ring.cy} 应落在格子中线 ${r.cell.cy}`);
});

test('vk-spotlight mode="fade" 用纸色遮罩，不把纸弄脏', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-cells id="mem" cols="4"><li value="48" label="H"></li><li value="65" label="e"></li>
      <li value="6C" label="l"></li><li value="00" filled></li></vk-cells>
      <vk-spotlight for="#mem@cell:3" mode="fade" dim="0.4"></vk-spotlight>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const fill = await page.$eval('vk-spotlight .vk-ov-svg > rect', (el) => el.getAttribute('fill'));
  assert.equal(fill, '#ffffff', 'fade 只用纸色退背景；dim 才是墨色');
});

test('底部空带：量到的是最后一点墨，且不算覆盖层', async () => {
  await page.setContent(
    SHELL(`<vk-page>
      <vk-stack gap="md">
        <vk-text size="body">只有这一行字，下面全是空的。</vk-text>
        <vk-edge from="160,400" to="600,400"></vk-edge>
      </vk-stack>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const out = await page.evaluate(() => {
    const issues = window.vk.auditPage().issues.filter((x) => x.type === 'void');
    const m = window.vk.metrics()[0];
    return { issues, safeH: m.safeH, contentBottom: m.contentBottom, contentRight: m.contentRight };
  });
  assert.equal(out.safeH, 888, '安全区高 888');
  assert.equal(out.issues.length, 1, `应报一条留白，实际 ${JSON.stringify(out.issues)}`);
  const band = out.issues[0].box[3];
  assert.ok(band > 700, `空带应接近整页高，实际 ${band}`);
  // vk-edge 的 svg 铺满整张纸；它要是被算进内容，contentBottom 就是 888。
  assert.ok(out.contentBottom < 400, `覆盖层不该抬高内容底（实际 ${out.contentBottom}）`);
});

test('底部空带：贴底的页不报', async () => {
  await page.setContent(
    SHELL(`<vk-page align="bottom">
      <vk-text size="body">这一行贴着安全区底边，下面不该再报留白。</vk-text>
    </vk-page>`),
    { waitUntil: 'load' }
  );
  await ready();
  const out = await page.evaluate(() => ({
    issues: window.vk.auditPage().issues.filter((x) => x.type === 'void'),
    bottom: window.vk.metrics()[0].contentBottom,
  }));
  assert.ok(out.bottom > 800, `内容底应贴到底边，实际 ${out.bottom}`);
  assert.equal(out.issues.length, 0, `不该报留白：${JSON.stringify(out.issues)}`);
});

after(async () => {
  await browser.close();
  await close();
});
