import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { startServer } from '../cli/serve.mjs';

/**
 * 六处「库缺口」的回归：
 *
 *   1. vk-bytes 窄卡片按「单格」量，不再把整行十六进制当成一格；
 *   2. vk-steps 的等权地图：done="none" / mark="N"；
 *   3. vk-term chrome="none" 不再画第二个标题，title-show 才是显式开关；
 *   4. vk-annotate note 的显式落点与「引线不穿目标」的自动避让；
 *   5. vk-compare zoom="mark" 的差异放大块。
 *
 * 这些全部只断言观众能看见的那一层：报错类型、data-state、DOM 文本、
 * 矩形是否相交、引线是否进目标、放大块的背景几何与像素。
 */

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(m.text()));

await page.goto(`${base}/specimens/vk-bytes.html`, { waitUntil: 'load' });
await page.evaluate(() => window.vk?.ready?.());

const open = async (body) => {
  await page.evaluate(async (markup) => {
    document.querySelector('main').innerHTML = markup;
    await window.vk?.ready?.();
    window.vk?.layout?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, body);
  await page.waitForTimeout(80);
};

/* ------------------------------------------------------------------ bytes */

const BYTES = (id, width) => `<div style="width:${width}px"><vk-bytes id="${id}" cols="8" chrome="none"
  addr="0x7ffc" offset="0" length="16">
  <script type="application/json" data-vk-bytes>{"file":"hello.bin","start":0,"end":15,"base":32764,"bytes":["48","65","6c","6c","6f","2c","20","57","6f","72","6c","64","21","00","01","02"]}</script>
</vk-bytes></div>`;

const capacity = () =>
  page.evaluate(() =>
    window.vk.auditPage().issues
      .filter((x) => ['collision', 'narrow', 'audit-overflow', 'clip'].includes(x.type))
      .map((x) => ({ type: x.type, what: x.what, fix: x.fix, sw: x.sw, cw: x.cw }))
  );

test('vk-bytes 窄卡片：逐格测量，400px 8 列不报文本超出，200px 报格太窄', async () => {
  await open(`<vk-page>${BYTES('b', 400)}</vk-page>`);
  const wide = await capacity();
  assert.deepEqual(wide, [], `400px 的 8 列 bytes 不该报撞字/裁切：${JSON.stringify(wide)}`);
  const geo = await page.evaluate(() => {
    const row = document.querySelector('#b .vk-bytes-row');
    const x = document.querySelector('#b .vk-bytes-x');
    return { row: [row.scrollWidth, row.clientWidth], x: [x.scrollWidth, x.clientWidth], cells: document.querySelectorAll('#b .vk-bytes-x i').length };
  });
  assert.equal(geo.cells, 16, '8 列应有 16 个字节格');
  assert.ok(geo.x[0] <= geo.x[1] + 3, `400px 里十六进制格要自己换行、不横向溢出：${geo.x}`);
  assert.ok(geo.row[0] <= geo.row[1] + 3, `400px 里整行不能横向溢出：${geo.row}`);

  await open(`<vk-page>${BYTES('b', 200)}</vk-page>`);
  const narrow = await capacity();
  assert.equal(
    narrow.filter((x) => x.type === 'collision').length,
    0,
    `200px 的 bytes 不能伪装成"文本超出单元格"：${JSON.stringify(narrow)}`
  );
  assert.equal(
    narrow.filter((x) => x.type === 'audit-overflow').length,
    0,
    `200px 的 bytes 不该再报整块内容溢出：${JSON.stringify(narrow)}`
  );
  const tight = narrow.filter((x) => x.type === 'narrow');
  assert.equal(tight.length, 1, `200px 必须且只能报一条格太窄：${JSON.stringify(narrow)}`);
  assert.equal(tight[0].what, 'vk-bytes');
  assert.match(tight[0].fix, /格太窄[\s\S]*cols[\s\S]*ascii[\s\S]*宽容器/, `修复建议要能执行：${tight[0].fix}`);
});

/* ------------------------------------------------------------------ steps */

const STEPS = (id, extra = '') =>
  `<vk-steps id="${id}" ${extra}><li>一</li><li>二</li><li>三</li><li>四</li></vk-steps>`;

test('vk-steps done="none"：不标已完成，只有第 3 步是 current；默认行为不变', async () => {
  await open(`<vk-page>${STEPS('def', 'current="2"')}${STEPS('none', 'current="2" done="none"')}</vk-page>`);
  const r = await page.evaluate(() => {
    const read = (id) => {
      const host = document.getElementById(id);
      return {
        done: host.querySelector('.vk-steps').dataset.done,
        states: [...host.querySelectorAll('.vk-step')].map((s) => s.dataset.state),
        conns: [...host.querySelectorAll('.vk-step-line')].map((s) => s.dataset.conn),
      };
    };
    return { def: read('def'), none: read('none') };
  });
  assert.deepEqual(r.def.states, ['done', 'done', 'current', 'todo'], '默认行为必须一个字不改');
  assert.deepEqual(r.none.states, ['todo', 'todo', 'current', 'todo'], `done="none" 前两步不能有 done：${r.none.states}`);
  assert.equal(r.none.states.filter((s) => s === 'current').length, 1, '只有第 3 步是 current');
  assert.deepEqual(r.none.conns, ['todo', 'current', 'todo'], `连线也不能伪装成已完成：${r.none.conns}`);
  assert.equal(r.none.done, 'none');
});

test('vk-steps mark="N"：只强调第 N 步，不给其它步打勾', async () => {
  await open(`<vk-page>${STEPS('m', 'mark="2"')}</vk-page>`);
  const r = await page.evaluate(() => {
    const host = document.getElementById('m');
    return {
      mark: host.querySelector('.vk-steps').dataset.mark,
      states: [...host.querySelectorAll('.vk-step')].map((s) => s.dataset.state),
      conns: [...host.querySelectorAll('.vk-step-line')].map((s) => s.dataset.conn),
    };
  });
  assert.equal(r.mark, '2');
  assert.deepEqual(r.states, ['todo', 'todo', 'current', 'todo'], `mark 只强调第 3 步：${r.states}`);
  assert.equal(r.states.includes('done'), false, 'mark 不能让前面的步骤变成 done');
  assert.deepEqual(r.conns, ['todo', 'current', 'todo']);
});

/* ------------------------------------------------------------------- term */

test('vk-term chrome="none"：title 只作无障碍名，title-show 才显示', async () => {
  await open(`<vk-page>
    <vk-panel title="真实命令"><vk-term id="silent" title="steps.txt" chrome="none" src="../assets/hello/build/steps.txt" lines="1-2"></vk-term></vk-panel>
    <vk-term id="shown" title="steps.txt" chrome="none" title-show src="../assets/hello/build/steps.txt" lines="1-2"></vk-term>
    <vk-term id="legacy" title="steps.txt" src="../assets/hello/build/steps.txt" lines="1-2"></vk-term>
  </vk-page>`);
  const r = await page.evaluate(() => {
    const read = (id) => {
      const t = document.getElementById(id);
      const title = t.querySelector('.vk-term-title');
      return {
        aria: t.getAttribute('aria-label'),
        role: t.getAttribute('role'),
        hd: t.querySelectorAll('.vk-hd').length,
        file: t.querySelectorAll('.vk-file').length,
        title: title?.textContent || '',
        titleShown: title ? getComputedStyle(title).display !== 'none' && title.getBoundingClientRect().height > 1 : false,
        textHasName: t.textContent.includes('steps.txt'),
      };
    };
    return { silent: read('silent'), shown: read('shown'), legacy: read('legacy') };
  });
  assert.equal(r.silent.aria, 'steps.txt', 'chrome="none" 时 title 要留作无障碍名');
  assert.equal(r.silent.role, 'group');
  assert.equal(r.silent.hd, 0, 'chrome="none" 不能有窗头');
  assert.equal(r.silent.file, 0, 'chrome="none" 不能有文件名标签');
  assert.equal(r.silent.textHasName, false, 'chrome="none" 的可见文字里不能出现标题');
  assert.equal(r.silent.title, '', '没有 title-show 就不该有可见标题块');

  assert.equal(r.shown.title, 'steps.txt', 'title-show 是显式开关，写了才显示');
  assert.equal(r.shown.titleShown, true, 'title-show 的标题必须真的可见');
  assert.equal(r.shown.hd, 0, 'title-show 仍然是无壳终端，不该再画窗头');

  assert.equal(r.legacy.title, '', '默认 chrome="min" 的标题仍在窗头，不是 term-title');
  assert.equal(r.legacy.hd, 1, '默认窗头必须保留');
  assert.equal(r.legacy.file, 1, '默认窗头要有文件名标签');
  assert.equal(r.legacy.textHasName, true, '默认窗头要显示文件名');
  assert.equal(r.silent.titleShown, false);
});

/* --------------------------------------------------------------- annotate */

const overlap = (a, b) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;

test('vk-annotate note：自动避让不压目标行、引线不穿行；side="bottom" 按指定侧', async () => {
  await open(`<vk-page><vk-stack gap="lg">
    <vk-text size="title" weight="bold">标题在上</vk-text>
    <vk-code id="code" lang="c" src="../code/hello.c" lines="1-6"></vk-code>
    <vk-annotate id="auto" mode="note" for="#code@line:2">这一行有批注</vk-annotate>
    <vk-annotate id="bottom" mode="note" side="bottom" for="#code@line:2">指定下侧</vk-annotate>
    <vk-annotate id="xy" mode="note" x="80" y="80" for="#code@line:2">坐标落点</vk-annotate>
  </vk-stack></vk-page>`);
  const r = await page.evaluate(() => {
    const line = document.querySelector('#code .vk-line[data-line="2"]');
    const lr = line.getBoundingClientRect();
    const read = (id) => {
      const host = document.getElementById(id);
      const svg = host.querySelector('.vk-ov-svg');
      const sr = svg.getBoundingClientRect();
      const bd = host.querySelector('.vk-pin-bd').getBoundingClientRect();
      const path = host.querySelector('.vk-pin-leader');
      const d = path?.getAttribute('d') || '';
      const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
      const pts = [];
      for (let i = 0; i < nums.length; i += 2) pts.push({ x: nums[i] + sr.left, y: nums[i + 1] + sr.top });
      return { bd: bd.toJSON(), pts, side: path?.getAttribute('data-side') || '' };
    };
    return { line: lr.toJSON(), auto: read('auto'), bottom: read('bottom') };
  });
  const inside = (p, rect) => p.x > rect.left + 2 && p.x < rect.right - 2 && p.y > rect.top + 2 && p.y < rect.bottom - 2;

  assert.equal(overlap(r.auto.bd, r.line), false, `自动落点压住了目标行：${JSON.stringify(r.auto.bd)} vs ${JSON.stringify(r.line)}`);
  assert.equal(r.auto.bd.bottom <= r.line.top || r.auto.bd.top >= r.line.bottom, true, '气泡要在目标行的上侧或下侧');
  const cross = r.auto.pts.filter((p) => inside(p, r.line));
  assert.equal(cross.length, 0, `引线穿过了目标行：${r.auto.pts.map((p) => `${p.x},${p.y}`).join(' ')}`);

  assert.equal(r.bottom.side, 'bottom');
  assert.ok(Math.abs(r.bottom.bd.top - (r.line.bottom + 24)) <= 2, `side="bottom" 应贴在下侧：${r.bottom.bd.top} vs ${r.line.bottom}`);
  assert.ok(Math.abs((r.bottom.bd.left + r.bottom.bd.width / 2) - (r.line.left + r.line.width / 2)) <= 2, '指定下侧应水平居中在目标上');
  assert.equal(overlap(r.bottom.bd, r.line), false, '指定下侧也不能压住目标行');
  assert.equal(r.bottom.pts.filter((p) => inside(p, r.line)).length, 0, '指定下侧的引线不能穿行');

  // x / y 与旧 vk-pin 同语义：覆盖层局部坐标，给了就按坐标放。
  const xy = await page.evaluate(() => {
    const bd = document.querySelector('#xy .vk-pin-bd');
    return { left: bd.style.left, top: bd.style.top };
  });
  assert.equal(xy.left, '80px', `x="80" 应落在覆盖层左边 80px：${xy.left}`);
  assert.equal(xy.top, '80px', `y="80" 应落在覆盖层顶边 80px：${xy.top}`);
});

test('vk-annotate note：四个方向都不干净时警告，并选压字最少的一侧', async () => {
  logs.length = 0;
  await open(`<vk-canvas w="600" h="300">
    <vk-box id="big" x="20" y="20" w="560" h="260"></vk-box>
    <vk-annotate id="tight" mode="note" for="#big">挤不下了</vk-annotate>
  </vk-canvas>`);
  assert.ok(
    logs.some((l) => l.includes('找不到既避开正文') && l.includes('side / x / y')),
    `没有干净位置时要说明怎么改：${logs.join(' | ')}`
  );
  const bd = await page.evaluate(() => document.querySelector('#tight .vk-pin-bd').getBoundingClientRect().toJSON());
  assert.ok(bd.width > 0 && bd.height > 0, '警告之后仍然要画在压字最少的一侧');
});

/* ------------------------------------------------------------------ zoom */

test('vk-compare zoom="mark"：生成差异放大块，内容与 mark 区域一致', async () => {
  await open(`<vk-page><div style="width:640px">
    <vk-compare id="c" split="10" ratio="720 / 280" a="../assets/sample-grid.svg" b="../assets/sample-grid-b.svg"
      mark="3,63,45,80" zoom="mark"></vk-compare>
    <vk-compare id="z2" ratio="720 / 280" a="../assets/sample-grid.svg" b="../assets/sample-grid-b.svg"
      zoom="2"></vk-compare>
    <vk-compare id="c2" split="46" ratio="1440 / 900" a="../assets/hello/o0.png" b="../assets/hello/o2.png"
      mark="58,73,93,84" zoom="mark"></vk-compare>
  </div></vk-page>`);
  const r = await page.evaluate(() => {
    const host = document.getElementById('c');
    const shell = host.querySelector('.vk-cmp');
    const img = host.querySelector('.vk-cmp-b');
    const v = host.querySelector('.vk-cmp-zoom-v');
    const ir = img.getBoundingClientRect();
    const sr = shell.getBoundingClientRect();
    const vr = v.getBoundingClientRect();
    const W = ir.width;
    const H = ir.height;
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const RW = img.naturalWidth * s;
    const RH = img.naturalHeight * s;
    // object-position 默认 50% 50%。
    const ox = (W - RW) / 2;
    const oy = (H - RH) / 2;
    return {
      exists: !!host.querySelector('.vk-cmp-zoom'),
      caption: host.querySelector('.vk-cmp-zoom-c')?.textContent || '',
      zoom: host.dataset.zoom,
      v: vr.toJSON(),
      shell: sr.toJSON(),
      expected: {
        size: [RW * 2, RH * 2],
        pos: [-(W * 0.03 - ox) * 2, -(H * 0.63 - oy) * 2],
      },
      actual: {
        size: getComputedStyle(v).backgroundSize,
        pos: getComputedStyle(v).backgroundPosition,
        image: getComputedStyle(v).backgroundImage,
      },
      box: v.dataset.zoomBox,
    };
  });
  assert.equal(r.exists, true, 'zoom="mark" 必须生成放大块');
  assert.equal(r.caption, '差异放大 ×2', `小标题由组件给：${r.caption}`);
  assert.equal(r.zoom, 'mark');
  assert.equal(r.box, '3,63,42,17');
  assert.match(r.actual.image, /sample-grid-b\.svg/, 'split=10 时 mark 落在右半，放大要取 b 图');
  const size = r.actual.size.match(/([\d.]+)px\s+([\d.]+)px/).slice(1).map(Number);
  assert.ok(Math.abs(size[0] - r.expected.size[0]) <= 1 && Math.abs(size[1] - r.expected.size[1]) <= 1, `放大 2× 的背景尺寸不对：${size} vs ${r.expected.size}`);
  const pos = r.actual.pos.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/).slice(1).map(Number);
  assert.ok(Math.abs(pos[0] - r.expected.pos[0]) <= 1.5 && Math.abs(pos[1] - r.expected.pos[1]) <= 1.5, `背景位移不对：${pos} vs ${r.expected.pos}`);
  assert.ok(r.v.width > 100 && r.v.height > 30, `放大块要有真实面积：${JSON.stringify(r.v)}`);

  // 只写倍数、没写 mark：不逼作者先补一个框，放大整张对照。
  const plainZoom = await page.evaluate(() => {
    const host = document.getElementById('z2');
    const v = host.querySelector('.vk-cmp-zoom-v');
    return {
      exists: !!host.querySelector('.vk-cmp-zoom'),
      caption: host.querySelector('.vk-cmp-zoom-c')?.textContent || '',
      box: v?.dataset.zoomBox || '',
    };
  });
  assert.equal(plainZoom.exists, true, 'zoom="2" 没有 mark 时也要能放大整张');
  assert.equal(plainZoom.caption, '差异放大 ×2');
  assert.equal(plainZoom.box, '0,0,100,100');

  // 需求里的真实坐标：58,73,93,84。
  const exact = await page.evaluate(() => {
    const host = document.getElementById('c2');
    return {
      exists: !!host.querySelector('.vk-cmp-zoom'),
      caption: host.querySelector('.vk-cmp-zoom-c')?.textContent || '',
      box: host.querySelector('.vk-cmp-zoom-v')?.dataset.zoomBox || '',
      image: host.querySelector('.vk-cmp-zoom-v') ? getComputedStyle(host.querySelector('.vk-cmp-zoom-v')).backgroundImage : '',
    };
  });
  assert.equal(exact.exists, true, 'zoom="mark" + mark="58,73,93,84" 要出现放大块');
  assert.equal(exact.caption, '差异放大 ×2');
  assert.equal(exact.box, '58,73,35,11');
  assert.match(exact.image, /o2\.png/, '框心在右半（split=46），放大取 b 图');

  // 像素采样：mark 框住的是 b 图里那块 #dbe4ff 的差异区，放大后中心必须还是它。
  await page.waitForTimeout(120);
  const shot = await page.screenshot({
    clip: { x: r.v.x, y: r.v.y, width: r.v.width, height: r.v.height },
  });
  const png = PNG.sync.read(shot);
  const i = (png.width * Math.floor(png.height / 2) + Math.floor(png.width / 2)) * 4;
  const rgb = [png.data[i], png.data[i + 1], png.data[i + 2]];
  assert.ok(
    Math.abs(rgb[0] - 219) <= 8 && Math.abs(rgb[1] - 228) <= 8 && Math.abs(rgb[2] - 255) <= 8,
    `放大块中心应与 mark 区域一致（#dbe4ff）：${rgb}`
  );
});

after(async () => {
  await browser.close();
  await close();
});
