import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${base}/specimens/vk-code.html`, { waitUntil: 'load' });
await page.evaluate(() => window.vk.ready());

const reset = (html) =>
  page.evaluate(async (markup) => {
    document.querySelector('main').innerHTML = markup;
    await window.vk.ready();
    await new Promise((r) => requestAnimationFrame(r));
  }, html);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('非法选择器只影响自己，不 reject ready，也不杀兄弟连线', async () => {
  await reset(`<vk-canvas w="600" h="300" >
    <vk-box id="a" x="0" y="0" w="100" h="60"></vk-box>
    <vk-box id="b" x="400" y="0" w="100" h="60"></vk-box>
    <vk-edge from="div[" to="#b"></vk-edge>
    <vk-edge from="#a" to="#b"></vk-edge>
  </vk-canvas>`);
  const paths = await page.$$eval('vk-edge .vk-edge-path', (els) => els.map((e) => e.getAttribute('d') || ''));
  assert.equal(paths[0], '');
  assert.match(paths[1], /^M/);
  assert.deepEqual(pageErrors, []);
});

test('numbers=none 真的隐藏行号并恢复源码内距', async () => {
  await reset('<vk-code lang="text" numbers="none">a\nb</vk-code>');
  const r = await page.evaluate(() => {
    const el = document.querySelector('vk-code');
    return {
      nums: el.querySelectorAll('.vk-ln').length,
      pad: getComputedStyle(el.querySelector('.vk-src')).paddingLeft,
    };
  });
  assert.equal(r.nums, 0);
  assert.equal(r.pad, '32px');
});

test('图窗加载失败显示自己的占位', async () => {
  await reset('<vk-figure src="/nope.png" alt="x" caption="cap"></vk-figure>');
  await sleep(300);
  const r = await page.evaluate(() => ({
    ph: getComputedStyle(document.querySelector('.vk-fig-ph')).display,
    imgError: document.querySelector('vk-img')?.hasAttribute('data-error'),
  }));
  assert.equal(r.imgError, true);
  assert.equal(r.ph, 'flex');
});

test('图标原型链名字不会把函数源码塞进 SVG', async () => {
  await reset('<vk-icon name="constructor"></vk-icon>');
  const html = await page.$eval('vk-icon svg', (e) => e.innerHTML);
  assert.ok(!html.includes('native code'));
  assert.match(html, /<circle/);
});

test('改 lines 不清空已内联源码', async () => {
  await reset('<vk-code lang="text">line1\nline2\nline3</vk-code>');
  await page.evaluate(() => document.querySelector('vk-code').setAttribute('lines', '2'));
  await sleep(50);
  const text = await page.$eval('vk-code .vk-bd', (e) => e.textContent);
  assert.ok(text.includes('line2'));
  assert.ok(text.includes('line3'));
});

test('src 竞态：后发请求赢，旧响应不能覆盖', async () => {
  await page.route('**/fake/*.txt', async (route) => {
    const name = route.request().url().split('/').pop();
    await sleep(name.startsWith('a') ? 250 : 40);
    await route.fulfill({ status: 200, body: name.startsWith('a') ? 'AAA\nAA2' : 'BBB\nBB2' });
  });
  await reset('<vk-code lang="text" src="/fake/a.txt"></vk-code>');
  const first = await page.$eval('vk-code .vk-bd', (e) => e.textContent);
  await page.evaluate(() => document.querySelector('vk-code').setAttribute('src', '/fake/b.txt'));
  await sleep(400);
  const last = await page.$eval('vk-code .vk-bd', (e) => e.textContent);
  await page.unroute('**/fake/*.txt');
  assert.ok(first.includes('AAA'));
  assert.ok(last.includes('BBB'));
  assert.ok(!last.includes('AAA'));
});

test('list 重渲染保留嵌套元素身份与 <li> 属性', async () => {
  await reset('<vk-list gap="sm"><li id="x"><vk-icon name="code"></vk-icon> one</li><li>two</li></vk-list>');
  const before = await page.$eval('vk-list li', (e) => ({ id: e.id, icon: !!e.querySelector('vk-icon svg') }));
  await page.evaluate(() => document.querySelector('vk-list').setAttribute('gap', 'xl'));
  await sleep(50);
  const after = await page.$eval('vk-list li', (e) => ({ id: e.id, icon: !!e.querySelector('vk-icon svg') }));
  assert.deepEqual(after, before);
});

test('晚到的 page / title 内容进入内容槽，而不是留在宿主外', async () => {
  await reset('<vk-page><vk-text>one</vk-text></vk-page>');
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = 'late';
    d.textContent = 'late';
    document.querySelector('vk-page').append(d);
  });
  await sleep(80);
  const inBd = await page.$eval('vk-page .vk-page-bd', (e) => !!e.querySelector('#late'));
  assert.equal(inBd, true);

  await reset('<vk-title>one</vk-title>');
  await page.evaluate(() => document.querySelector('vk-title').append(document.createTextNode(' two')));
  await sleep(80);
  const text = await page.$eval('vk-title .vk-title-main', (e) => e.textContent);
  assert.match(text, /two/);
});

test('几何属性移除后不留幽灵尺寸', async () => {
  await reset('<vk-box w="100" h="100"></vk-box>');
  const before = await page.$eval('vk-box', (e) => e.style.width);
  await page.evaluate(() => document.querySelector('vk-box').removeAttribute('w'));
  await sleep(30);
  const after = await page.$eval('vk-box', (e) => e.style.width);
  assert.equal(before, '100px');
  assert.equal(after, '');
});

test('page 重渲染不搬走代码窗，src 的 fetch 不会被 abort', async () => {
  await page.route('**/fake/slot.txt', async (route) => {
    await sleep(120);
    await route.fulfill({ status: 200, body: 'inside page\nsecond line' });
  });
  await reset('<vk-page w="800" h="450" footer="a | b"><vk-code lang="text" src="/fake/slot.txt"></vk-code></vk-page>');
  const before = await page.$eval('vk-page vk-code .vk-bd', (e) => e.textContent);
  await page.evaluate(() => document.querySelector('vk-page').setAttribute('footer', 'c | d'));
  await sleep(150);
  const after = await page.$eval('vk-page vk-code .vk-bd', (e) => e.textContent);
  await page.unroute('**/fake/slot.txt');
  assert.match(before, /inside page/);
  assert.match(after, /inside page/);
});

test('ready 会等 ready 开始之后才插入的慢 src', async () => {
  await page.route('**/fake/race.txt', async (route) => {
    await sleep(220);
    await route.fulfill({ status: 200, body: 'RACE\nsecond' });
  });
  const r = await page.evaluate(async () => {
    document.querySelector('main').innerHTML = '';
    const ready = window.vk.ready();
    const el = document.createElement('vk-code');
    el.setAttribute('lang', 'text');
    el.setAttribute('src', '/fake/race.txt');
    document.querySelector('main').append(el);
    const ok = await ready;
    return { ok, text: el.querySelector('.vk-bd')?.textContent || '' };
  });
  await page.unroute('**/fake/race.txt');
  assert.equal(r.ok, true);
  assert.match(r.text, /RACE/);
});

test('终端 src：从真实 transcript 文件读，不在 HTML 里手写', async () => {
  await page.route('**/fake/hi.term', async (route) => {
    await route.fulfill({ status: 200, body: '$ echo hi\nhi\n' });
  });
  const text = await page.evaluate(async () => {
    document.querySelector('main').innerHTML = '<vk-term lang="text" src="/fake/hi.term"></vk-term>';
    await window.vk.ready();
    return document.querySelector('vk-term .vk-bd')?.textContent || '';
  });
  await page.unroute('**/fake/hi.term');
  assert.match(text, /echo hi/);
  assert.match(text, /hi/);
});

test('终端 chrome=none 只去标题栏，窗体仍是白纸', async () => {
  await reset('<vk-term chrome="none">$ echo hi\nhi</vk-term>');
  const r = await page.evaluate(() => {
    const e = document.querySelector('vk-term .vk-win');
    return { bg: getComputedStyle(e).backgroundColor, hd: !!e.querySelector('.vk-hd') };
  });
  assert.equal(r.hd, false);
  assert.equal(r.bg, 'rgb(255, 255, 255)');
});

test('page 重渲染保留槽内焦点，不搬走作者节点', async () => {
  await reset('<vk-page><input id="f" /></vk-page>');
  await page.focus('#f');
  await page.evaluate(() => document.querySelector('vk-page').setAttribute('align', 'center'));
  await sleep(60);
  const id = await page.evaluate(() => document.activeElement?.id || '');
  assert.equal(id, 'f');
});

test('全库只有白纸：浅灰面上的 L3 文字仍是墨色', async () => {
  await reset('<vk-box surface="soft" pad="md"><vk-list><li>one</li><li>two</li></vk-list></vk-box>');
  const r = await page.evaluate(() => {
    const bg = getComputedStyle(document.querySelector('vk-box')).backgroundColor;
    const fg = getComputedStyle(document.querySelector('.vk-li-b')).color;
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--vk-ink-surface-1').trim();
    return { bg, fg, ink };
  });
  assert.notEqual(r.fg, r.bg);
  assert.equal(r.fg, 'rgb(11, 15, 20)');
  assert.equal(r.ink, '', '深色面 token 应该已经删除');
});

test('diff 并排模式：两个窗、空行对齐、左右标签', async () => {
  await reset(`<vk-diff lang="text" variant="split" w="1680">
 int a;
-int b;
+int c;
+int d;
 return 0;
</vk-diff>`);
  const r = await page.evaluate(() => {
    const split = document.querySelector('.vk-diff-split');
    return {
      panes: split.querySelectorAll('.vk-diff-pane').length,
      rows: split.querySelectorAll('.vk-dline').length,
      empty: split.querySelectorAll('.vk-dline.is-empty').length,
      tags: [...split.querySelectorAll('.vk-dsplit-tag')].map((e) => e.textContent),
    };
  });
  assert.equal(r.panes, 2);
  assert.equal(r.tags.join(','), '改前,改后');
  assert.equal(r.rows, 8);
  assert.equal(r.empty, 1);
});

test('代码行号对读屏隐藏', async () => {
  await reset('<vk-code lang="text">one\ntwo</vk-code>');
  const hidden = await page.$$eval('vk-code .vk-ln', (els) => els.every((e) => e.getAttribute('aria-hidden') === 'true'));
  assert.equal(hidden, true);
});

test('具名槽进入 eyebrow / sub，而不是被当成正文', async () => {
  await reset('<vk-title sub="属性副题"><span slot="eyebrow">眉题</span>主标题</vk-title>');
  const r = await page.evaluate(() => ({
    eyebrow: document.querySelector('.vk-eyebrow-t')?.textContent.trim(),
    sub: document.querySelector('.vk-title-sub')?.textContent.trim(),
    main: document.querySelector('.vk-title-main')?.textContent.trim(),
  }));
  assert.equal(r.eyebrow, '眉题');
  assert.equal(r.sub, '属性副题');
  assert.equal(r.main, '主标题');
});

test('fold 是真正的隐藏：被折叠行不渲染，只留一条范围说明', async () => {
  await reset('<vk-code lang="text" fold="2-3">a\nb\nc\nd</vk-code>');
  const r = await page.evaluate(() => ({
    lines: [...document.querySelectorAll('vk-code .vk-line:not(.is-fold)')].map((e) => e.dataset.line),
    fold: document.querySelector('vk-code .vk-fold-text')?.textContent.trim(),
  }));
  assert.deepEqual(r.lines, ['1', '4']);
  assert.match(r.fold, /2–3|2-3/);
});

test('页面固定 1920×1080，不再接受页面级宽高', async () => {
  await reset('<vk-page><vk-text>one</vk-text></vk-page>');
  const r = await page.evaluate(() => {
    const el = document.querySelector('.vk-page');
    const cs = getComputedStyle(el);
    return { w: cs.width, h: cs.height };
  });
  assert.equal(r.w, '1920px');
  assert.equal(r.h, '1080px');
});

test('diff 统一视图有旧/新双行号', async () => {
  await reset('<vk-diff lang="text" variant="unified">\n a\n-b\n+c\n</vk-diff>');
  const n = await page.$$eval('vk-diff .vk-dnums', (els) => els.length);
  assert.ok(n > 0);
});

test('figure 的原生 figcaption 进入图注，不混进媒体槽', async () => {
  await reset('<vk-figure src="../assets/img/sample.svg" alt="图"><figcaption>原生图注</figcaption></vk-figure>');
  const r = await page.evaluate(() => ({
    caption: document.querySelector('.vk-fig-caption')?.textContent.trim(),
    slot: document.querySelector('.vk-fig-slot')?.textContent.trim(),
  }));
  assert.equal(r.caption, '原生图注');
  assert.equal(r.slot, '');
});

test('tree 折叠的是子列表，数量来自未过滤的真实条目', async () => {
  await reset(`<vk-tree collapsed="src"><script type="application/json" data-vk-tree>{"root":"app","entries":[
    {"name":"src","path":"src","depth":0,"type":"dir","ext":"","size":0},
    {"name":"a.py","path":"src/a.py","depth":1,"type":"file","ext":"py","size":1},
    {"name":"b.py","path":"src/b.py","depth":1,"type":"file","ext":"py","size":1}
  ]}</script></vk-tree>`);
  const r = await page.evaluate(() => ({
    text: document.querySelector('.vk-tree-fold')?.textContent.trim(),
    child: document.querySelectorAll('vk-tree .vk-tree-list .vk-tree-list').length,
  }));
  assert.match(r.text, /2 项已收起/);
  assert.equal(r.child, 0);
});

test('7.0 深挖：bits 32 位字段、asm 顺序屏障', async () => {
  await page.goto(`${base}/specimens/vk-asm.html`, { waitUntil: 'load' });
  await page.evaluate(() => window.vk.ready());
  const asm = await page.evaluate(() => ({
    orders: document.querySelectorAll('.vk-asm-order').length,
    fence: document.querySelector('.vk-asm-fence')?.textContent || '',
  }));
  assert.ok(asm.orders > 0);
  assert.match(asm.fence, /屏障/);

  await reset(`<vk-stack gap="md">
    <vk-bits id="bits" w="1600" value="10111111110000000000000000000000"
             bit-width="32" bytes sign>
      <i from="31" label="符号"></i>
      <i from="30" to="23" label="指数"></i>
      <i from="22" to="0" label="尾数"></i>
    </vk-bits>
  </vk-stack>`);
  const r = await page.evaluate(() => ({
    bits: document.querySelectorAll('#bits .vk-bit').length,
    fields: document.querySelectorAll('#bits .vk-bit-field').length,
  }));
  assert.equal(r.bits, 32);
  assert.equal(r.fields, 3);
});

after(async () => {
  await browser.close();
  await close();
});

test('锚点真的能解析到运行时元素（cell / line），不是只过构建', async () => {
  await reset(
    '<vk-page><vk-stack gap="sm"><vk-cells id="x"><i value="1"></i><i value="2"></i><i value="3"></i></vk-cells><vk-code id="c" lang="c">int a;' +
      '\nint b;</vk-code></vk-stack></vk-page>'
  );
  const found = await page.evaluate(() => ({
    cell: !!document.querySelector('#x [data-cell="2"]'),
    line: !!document.querySelector('#c [data-line="2"]'),
  }));
  assert.deepEqual(found, { cell: true, line: true });
});