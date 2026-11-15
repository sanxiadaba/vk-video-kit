/**
 * v25 · 测试
 * ----------------------------------------------------------------------------
 * 只测「会静默坏掉」的东西：
 *   一、契约 / 文档     13 个标签、变体、生成物同步
 *   二、负例            每种写错都给出稳定错误码（不抛异常）
 *   三、渲染            全部 fixture 干净：无问题、无溢出、1920/780、非空白
 *   四、行为            不缩字 / 圈选 / 数字列 / 深色窗
 *   五、确定            同一帧渲两次 PNG 逐字节相同
 *   六、CLI             参数、退出码、默认不拦出图
 *   七、对比度          墨与语法色在纸面/暗面上都 ≥ 4.5
 *
 *   npm test
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { TAG_NAMES } from '../src/schema.mjs';
import { contract, docText, markdown } from '../src/contract.mjs';
import { transformHtml } from '../src/build/index.mjs';
import { PAINT, SYNTAX } from '../src/vocab.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const TMP = path.join(ROOT, '.tmp');
const OUT = path.join(TMP, 'test-fixtures');

let failed = 0;
const ok = (cond, msg, detail = '') => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failed++;
    console.log(`  ✗ ${msg}${detail ? `\n      ${detail}` : ''}`);
  }
};
const group = (name) => console.log(`\n${name}`);
const node = (args) => execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
const cli = (args) => spawnSync(process.execPath, ['bin/vk.mjs', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

/* ------------------------------------------------------------------ 一、契约 */
group('契约');
try {
  node(['tools/build.mjs']);
  ok(true, 'dist/ 能重建');
} catch (e) {
  ok(false, 'dist/ 能重建', String(e.stdout || e.stderr || e.message).slice(0, 600));
}

const brief = contract();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
ok(brief.version === pkg.version, `契约版本来自 package.json（${brief.version}）`);
ok(TAG_NAMES.length === 13, `13 个标签（${TAG_NAMES.length}）`);
for (const old of ['vk-cells', 'vk-steps', 'vk-bars', 'vk-timeline', 'vk-table', 'vk-list', 'vk-bytes', 'vk-bits', 'vk-term', 'vk-tree', 'vk-stack', 'vk-grid']) ok(!TAG_NAMES.includes(old), `旧名 ${old} 已并入变体`);
ok(Object.keys(brief.tags['vk-code'].variants).length === 6, 'code 有 6 个变体');
ok(Object.keys(brief.tags['vk-board'].variants).length === 6, 'board 有 6 个变体');
ok(Object.keys(brief.tags['vk-graph'].variants || {}).length === 0 && brief.tags['vk-graph'].attrs.as.values.length === 4, 'graph 的 4 种布局在 as 属性里');
ok(brief.flowChild.span && !('span' in brief.tags['vk-code'].attrs), 'span 是 flow 子项能力，不是逐件属性');
ok(brief.canvas.marginX === 120 && brief.canvas.marginY === 96, '对称版心 120 / 96');
ok(brief.tags['vk-code'].variants.code.attrs.lang.required === true, '源码窗必须写 lang');
ok(docText('vk-code').includes('as="bits"') && docText('vk-code').includes('默认 body'), 'doc 按变体列出范围与默认值');
ok(docText('vk-callout').includes('必填'), 'doc 标出必填');
const md = markdown();
const contractFile = path.join(ROOT, 'docs', 'CONTRACT.md');
ok(fs.existsSync(contractFile) && fs.readFileSync(contractFile, 'utf8').trim() === md.trim(), 'docs/CONTRACT.md 与 vk brief --md 逐字一致');
ok(!/<\/?(vk-stack|vk-grid|vk-compare|vk-cells|vk-steps|vk-bars|vk-timeline|vk-table|vk-list|vk-bytes|vk-bits|vk-term)>/.test(md), '生成物里没有旧标签');

/* CSS 里用到的 token 必须有定义（或由构建/运行期写入）。 */
const cssAll = ['dist/vk.css'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const tokensCss = fs.readFileSync(path.join(ROOT, 'dist', 'tokens.css'), 'utf8');
const defined = new Set([...tokensCss.matchAll(/(--vk-[\w-]+)\s*:/g)].map((m) => m[1]));
const runtimeVars = new Set(['--vk-gap', '--vk-cols', '--vk-cols-template', '--vk-span', '--vk-tone', '--vk-tint', '--vk-ln-digits', '--vk-aaddr-w', '--vk-depth', '--vk-bcol', '--vk-bhexw', '--vk-n', '--vk-at', '--vk-x', '--vk-seq-c', '--vk-x1', '--vk-x2', '--vk-mid']);
const usedVars = new Set([...cssAll.matchAll(/var\((--vk-[\w-]+)/g)].map((m) => m[1]));
const missingVars = [...usedVars].filter((v) => !defined.has(v) && !runtimeVars.has(v));
ok(missingVars.length === 0, 'CSS 用到的 token 都有定义', missingVars.join(', '));

/* 层的边界：组件层只写几何，状态层只消费 --vk-tone。 */
const componentsCss = fs.readFileSync(path.join(ROOT, 'src', 'components.css'), 'utf8');
const stateCss = fs.readFileSync(path.join(ROOT, 'src', 'state.css'), 'utf8');
ok(!/\[current\]|\.is-cur|\[data-tone|\[tone=/.test(componentsCss), '状态不写在 components.css');
ok(!/--vk-(ok|warn|err|info)\b/.test(stateCss), 'state.css 只消费 --vk-tone，不点名语义色');
ok(/var\(--vk-focus\)/.test(stateCss), 'current 只用焦点色');
ok(!markdown().includes('FLOOR') && !markdown().includes('0.72'), '生成物里没有已删的缩放下限');

/* ------------------------------------------------------------------ 二、负例 */
group('负例');
const CODE = (attrs, body = 'int a = 1;') => `<vk-page><vk-code lang="c" ${attrs}><script type="text/plain" data-vk-source>${body}</script></vk-code></vk-page>`;
const CASES = [
  ['UNKNOWN_TAG', '<vk-page><vk-nope>x</vk-nope></vk-page>'],
  ['UNKNOWN_ATTR', '<vk-page><vk-text typo="1">x</vk-text></vk-page>'],
  ['UNKNOWN_VARIANT', '<vk-page><vk-code as="nope"></vk-code></vk-page>'],
  ['VALUE_ENUM', '<vk-page theme="blue"></vk-page>'],
  ['VALUE_BOOL', '<vk-page><vk-flow overlay="yes"></vk-flow></vk-page>'],
  ['VALUE_NUMBER', '<vk-page><vk-board as="cells" stride="x"><li value="1"></li></vk-board></vk-page>'],
  ['VALUE_RANGE_ATTR', CODE('range="4-2"')],
  ['VALUE_SPACE', '<vk-page><vk-flow gap="huge"></vk-flow></vk-page>'],
  ['VALUE_LINES', CODE('current="x"')],
  ['VALUE_SELECTOR', '<vk-page><vk-text id="t">x</vk-text><vk-callout mode="ring" for="#t@foo:1"></vk-callout></vk-page>'],
  ['VALUE_RATIO', '<vk-page><vk-img src="x" ratio="16:9"></vk-img></vk-page>'],
  ['SRC_MISSING', '<vk-page><vk-img src="nope.png" alt="缺图"></vk-img></vk-page>'],
  ['ATTR_REQUIRED', '<vk-page><vk-callout mode="ring"></vk-callout></vk-page>'],
  ['ATTR_REQUIRED', '<vk-page><vk-code><script type="text/plain" data-vk-source>x</script></vk-code></vk-page>'],
  ['ATTR_IGNORED', '<vk-page><vk-text id="t">x</vk-text><vk-callout mode="ring" for="#t" label="nope"></vk-callout></vk-page>'],
  ['ATTR_PLACEMENT', '<vk-page><vk-text span="2">x</vk-text></vk-page>'],
  ['SPAN_TOO_WIDE', '<vk-page><vk-flow cols="2"><vk-text span="3">x</vk-text></vk-flow></vk-page>'],
  ['BLEED_ALL', '<vk-page><vk-text bleed="all">x</vk-text></vk-page>'],
  ['ID_DUPLICATE', '<vk-page><vk-text id="x">a</vk-text><vk-text id="x">b</vk-text></vk-page>'],
  ['CHILD_KIND', '<vk-page><vk-text><vk-flow><vk-text>x</vk-text></vk-flow></vk-text></vk-page>'],
  ['CHILD_MISSING', '<vk-page><vk-board as="list"></vk-board></vk-page>'],
  ['STRAY_TEXT', '<vk-page><vk-flow>裸文字</vk-flow></vk-page>'],
  ['GRAPH_REF', '<vk-page><vk-graph><li id="a">a</li><li after="nope">b</li></vk-graph></vk-page>'],
  ['ANCHOR_MISSING', '<vk-page><vk-text id="t">x</vk-text><vk-callout mode="ring" for="#nope"></vk-callout></vk-page>'],
  ['SRC_MISSING', '<vk-page><vk-code lang="c" src="nope.c"></vk-code></vk-page>'],
  ['SRC_CONFLICT', '<vk-page><vk-code lang="c" src="nope.c"><script type="text/plain" data-vk-source>x</script></vk-code></vk-page>'],
  ['RANGE_OUT_OF_RANGE', CODE('range="99"')],
  ['TREE_JSON', '<vk-page><vk-dir><script type="text/plain" data-vk-tree>{</script></vk-dir></vk-page>'],
  ['TREE_NODE', '<vk-page><vk-dir><script type="text/plain" data-vk-tree>{"children":[{}]}</script></vk-dir></vk-page>'],
  ['MATH', '<vk-page><vk-math>\\frac{</vk-math></vk-page>'],
  ['ICON', '<vk-page><vk-text icon="no-such-icon">x</vk-text></vk-page>'],
  ['MARK_MISSING', CODE('mark="zz"')],
  ['FIELD_LABELS', '<vk-page><vk-code as="bits" value="0|1|0" field-labels="a,b"></vk-code></vk-page>'],
  ['CURRENT_RANGE', CODE('current="99"')],
  ['BUILD', '<vk-page><vk-code lang="no-such-lang"><script type="text/plain" data-vk-source>x</script></vk-code></vk-page>'],
];
for (const [code, html] of CASES) {
  try {
    const res = await transformHtml(html, { file: path.join(ROOT, 'tests', 'negative', '_inline.html') });
    const codes = res.diagnostics.map((d) => d.code);
    ok(codes.includes(code), `${code}`, `实际：${codes.join(', ') || '无'}`);
  } catch (e) {
    ok(false, `${code}（不抛异常）`, e.message);
  }
}

/* ------------------------------------------------------------------ 三、渲染 */
group('渲染');
fs.rmSync(OUT, { recursive: true, force: true });
const renderRun = cli(['render', 'tests/fixtures', '--out', OUT, '--json']);
let report = null;
try {
  report = JSON.parse(renderRun.stdout.slice(renderRun.stdout.indexOf('{')));
} catch {
  /* 下面报 */
}
ok(renderRun.status === 0 && report, '全部 fixture 出图', String(renderRun.stderr || '').slice(0, 400));
if (report) {
  const fileCount = fs.readdirSync(path.join(ROOT, 'tests', 'fixtures')).filter((f) => f.endsWith('.html')).length;
  ok(report.frames.length === fileCount, `${fileCount} 帧（${report.frames.length}）`);
  ok(report.engine?.version, `记录引擎（${report.engine?.channel} ${report.engine?.version}）`);
  const bad = report.frames.filter((f) => !f.png || !f.png780 || !f.json);
  ok(bad.length === 0, '每帧三件产物都在', bad.map((f) => f.name).join(', '));
  const withIssues = report.frames.filter((f) => f.issues.length);
  ok(withIssues.length === 0, '每帧都没有硬错', withIssues.map((f) => `${f.name}: ${f.issues.map((i) => i.code).join(',')}`).join('；'));
  const over = report.frames.filter((f) => f.health?.overflow);
  ok(over.length === 0, '每帧都放得下（overflow = 0）', over.map((f) => `${f.name} 超出 ${f.health.overflow}`).join('；'));
  const tooMany = report.frames.filter((f) => (f.health?.focus ?? 0) > 1);
  ok(tooMany.length === 0, '每帧最多一处焦点', tooMany.map((f) => `${f.name} 焦点 ${f.health.focus}`).join('；'));

  let widthsOk = true;
  const blank = [];
  for (const f of report.frames) {
    const big = PNG.sync.read(fs.readFileSync(path.join(ROOT, f.png)));
    const small = PNG.sync.read(fs.readFileSync(path.join(ROOT, f.png780)));
    if (big.width !== 1920 || small.width !== 780) widthsOk = false;
    const colors = new Set();
    for (let i = 0; i < big.data.length; i += 4 * 97) colors.add(`${big.data[i]},${big.data[i + 1]},${big.data[i + 2]}`);
    if (colors.size < 4) blank.push(f.name);
  }
  ok(widthsOk, '1920 / 780 出图');
  ok(blank.length === 0, '没有空白帧', blank.join(', '));
}

/* 出图页的 DOM 里不许出现旧标签（构建层已经换过一遍，防止回潮）。 */
const builtPages = path.join(ROOT, '.vk-tmp', 'pages', 'tests', 'fixtures');
const builtHtml = fs.existsSync(builtPages) ? fs.readdirSync(builtPages).filter((f) => f.endsWith('.html')).map((f) => fs.readFileSync(path.join(builtPages, f), 'utf8')).join('\n') : '';
ok(builtHtml.length > 0, '出图页已生成');
ok(!/<vk-(cells|steps|bars|timeline|table|list|bytes|bits|term|tree|stack|grid|compare|surface|box|label)\b/.test(builtHtml), '出图页里没有旧标签');

/* ------------------------------------------------------------------ 四、行为 */
group('行为');
const { chromium } = await import('playwright');
const launchOpts = {
  args: ['--allow-file-access-from-files', '--font-render-hinting=none', '--disable-gpu', '--disable-lcd-text', '--disable-partial-raster', '--force-color-profile=srgb', '--run-all-compositor-stages-before-draw'],
};
let browser = null;
for (const channel of [undefined, 'chrome', 'msedge']) {
  try {
    browser = await chromium.launch(channel ? { ...launchOpts, channel } : launchOpts);
    break;
  } catch {
    /* 下一个 */
  }
}
if (!browser) {
  ok(false, '浏览器可用');
} else {
  const load = async (fixture) => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('file:///' + path.join(ROOT, '.vk-tmp', 'pages', 'tests', 'fixtures', fixture).split(path.sep).join('/'), { waitUntil: 'load' });
    await page.evaluate(() => window.vk.ready());
    return page;
  };
  const codePage = await load('code.html');
  const behave = await codePage.evaluate(() => ({
    font: parseFloat(getComputedStyle(document.querySelector('.vk-lc')).fontSize),
    cur: document.querySelectorAll('.vk-line.is-cur').length,
    ring: !!document.querySelector('.vk-co-ring'),
    frames: document.querySelectorAll('.vk-stage').length,
  }));
  ok(behave.font === 64, `不缩字：代码就是 64px（${behave.font}）`);
  ok(behave.cur === 1, `当前行只有一条（${behave.cur}）`);
  ok(behave.ring, '圈选画出来了');
  await codePage.close();

  const tablePage = await load('table.html');
  const t = await tablePage.evaluate(() => {
    const table = document.querySelector('table');
    const num = table.querySelector('td.num');
    const text = [...table.querySelectorAll('td')].find((td) => !td.classList.contains('num'));
    return { num: num ? getComputedStyle(num).textAlign : '', text: text ? getComputedStyle(text).textAlign : '', cur: table.querySelectorAll('tr[current]').length };
  });
  ok(t.num === 'right', `数字列右对齐（${t.num}）`);
  ok(t.text !== 'right', `文字列不右对齐（${t.text}）`);
  ok(t.cur === 1, '表格 current 落在行上');
  await tablePage.close();

  const darkPage = await load('dark.html');
  const dark = await darkPage.evaluate(() => getComputedStyle(document.querySelector('.vk-frame')).backgroundColor);
  ok(!/rgb\(255, 255, 255\)/.test(dark), `深色页的代码窗自动变深（${dark}）`);
  await darkPage.close();

  const wordPage = await load('callout-word.html');
  const word = await wordPage.evaluate(() => {
    const note = [...document.querySelectorAll('.vk-co-note')].find((n) => !n.hidden);
    const card = document.querySelector('vk-code');
    if (!note || !card) return null;
    const n = note.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const inside = n.left > c.left && n.right < c.right && n.top > c.top && n.bottom < c.bottom;
    return { inside, marks: document.querySelectorAll('.vk-mark[data-vk-item]').length };
  });
  ok(word && !word.inside, '注记在卡片外，不冒充代码');
  ok(word && word.marks >= 3, `mark 的词都带锚点（${word && word.marks}）`);

  /* 词：下括号必须扣在词上（横向覆盖词的左右），杆从括号引出。 */
  const aim = await wordPage.evaluate(() => {
    const bracket = document.querySelector('.vk-co-bracket');
    const mark = document.querySelectorAll('.vk-mark')[3];
    const note = [...document.querySelectorAll('.vk-co-note')].find((n) => !n.hidden);
    if (!bracket || !mark || !note) return null;
    const b = bracket.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    const n = note.getBoundingClientRect();
    return {
      covers: b.left <= m.left + 2 && b.right >= m.right - 2,
      below: Math.round(b.top - m.bottom),
      gap: Math.round(n.left - m.right),
    };
  });
  ok(aim && aim.covers, '下括号扣住整个词');
  ok(aim && aim.gap >= 80, `标签离词 ≥ 80（${aim && aim.gap}）`);
  await wordPage.close();

  /* 图：节点之间必须留够连接件的净空，箭头不许落进节点里。 */
  const gvPage = await load('graph-vertical.html');
  const geo = await gvPage.evaluate(() => {
    const nodes = [...document.querySelectorAll('.vk-gnode')].map((n) => n.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    const gaps = nodes.slice(1).map((r, i) => Math.round(r.top - nodes[i].bottom));
    const heads = [...document.querySelectorAll('.vk-edge-head')].map((h) => h.getBoundingClientRect());
    const inside = heads.some((h) => nodes.some((n) => h.top > n.top + 1 && h.bottom < n.bottom - 1));
    return { minGap: Math.min(...gaps), inside };
  });
  ok(geo.minGap >= 63, `竖链节点间距 ≥ 64（${geo.minGap}）`);
  ok(!geo.inside, '箭头不落进节点');
  await gvPage.close();

  const gtPage = await load('graph-tree.html');
  const tgeo = await gtPage.evaluate(() => {
    const tops = [...new Set([...document.querySelectorAll('.vk-gnode')].map((n) => Math.round(n.getBoundingClientRect().top)))].sort((a, b) => a - b);
    return { levels: tops.length, gaps: tops.slice(1).map((t, i) => t - tops[i]) };
  });
  ok(tgeo.levels === 3 && Math.min(...tgeo.gaps) >= 63, `树的三层各留出净空（${tgeo.gaps.join(' / ')}）`);
  await gtPage.close();

  /* 箭头：头部够大，否则在 780 下就是一根没头的线。 */
  const grPage = await load('graph-row.html');
  const head = await grPage.evaluate(() => {
    const h = document.querySelector('.vk-edge-head').getBoundingClientRect();
    return { w: Math.round(h.width), h: Math.round(h.height) };
  });
  ok(head.w === 52 && head.h === 38, `箭头 52×38（${head.w}×${head.h}）`);
  await grPage.close();

  /* 泳道箭头：尖端必须落在泳道线上，偏一点都不行。 */
  const sqPage = await load('seq4.html');
  const tips = await sqPage.evaluate(() => {
    const page = document.querySelector('vk-page').getBoundingClientRect();
    const lanes = [...document.querySelectorAll('.vk-seq-lane')].map((e) => {
      const q = e.getBoundingClientRect();
      return q.left + q.width / 2 - page.left;
    });
    return [...document.querySelectorAll('.vk-seq-row')].map((row) => {
      const dir = row.getAttribute('data-dir');
      const a = row.querySelector('.vk-seq-arrow');
      const ar = a.getBoundingClientRect();
      const cs = getComputedStyle(a, '::after');
      /* 尖端：右向在箭头盒的右端，左向在左端。 */
      const tip = dir === 'right' ? ar.right : ar.left;
      const lane = dir === 'right' ? Math.max(...lanes) : Math.min(...lanes);
      return Math.round(tip - page.left - lane);
    });
  });
  ok(tips.every((d) => Math.abs(d) <= 1), `泳道箭头尖端对齐竖线（偏差 ${tips.join(' / ')}）`);
  const gaps = await sqPage.evaluate(() =>
    [...document.querySelectorAll('.vk-seq-row')].map((row) => {
      const label = row.querySelector('.vk-seq-l').getBoundingClientRect();
      const arrow = row.querySelector('.vk-seq-arrow').getBoundingClientRect();
      return Math.round(arrow.top - label.bottom);
    })
  );
  ok(gaps.every((g) => g >= 8), `seq 标签不压杆（${gaps.join(' / ')}）`);
  await sqPage.close();

  /* P 指针：徽标够大，针脚止于格子上边，不进格。 */
  const cPage = await load('cells.html');
  const pin = await cPage.evaluate(() => {
    const badge = document.querySelector('.vk-cell-p').getBoundingClientRect();
    const cell = document.querySelector('.vk-cell[current]').getBoundingClientRect();
    return { badge: Math.round(badge.height), gap: Math.round(cell.top - badge.bottom), inside: badge.bottom > cell.top + 1 };
  });
  ok(pin.badge >= 96, `P 徽标高度 ≥ 96（${pin.badge}）`);
  ok(pin.gap >= 50, `针脚长度 ≥ 50（${pin.gap}）`);
  ok(!pin.inside, '针脚不进入格子');
  await cPage.close();

  const cmpPage = await load('compare.html');
  const cmp = await cmpPage.evaluate(() => {
    const cards = [...document.querySelectorAll('vk-card[tone]')];
    return cards.map((c) => ({ tone: c.getAttribute('tone'), border: getComputedStyle(c).borderColor, bg: getComputedStyle(c).backgroundColor }));
  });
  ok(cmp.length === 2 && cmp[0].border !== cmp[1].border, `语义卡两种色（${cmp.map((c) => c.tone + ' ' + c.border).join(' / ')}）`);
  ok(cmp.every((c) => c.bg !== 'rgba(0, 0, 0, 0)'), '语义卡有淡底');
  await cmpPage.close();
  await browser.close();
}

/* ------------------------------------------------------------------ 五、确定 */
group('确定');
const detA = path.join(TMP, 'det-a');
const detB = path.join(TMP, 'det-b');
for (const d of [detA, detB]) fs.rmSync(d, { recursive: true, force: true });
cli(['render', 'tests/fixtures/graph-tree.html', '--out', detA]);
cli(['render', 'tests/fixtures/graph-tree.html', '--out', detB]);
const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const fileA = fs.existsSync(detA) ? fs.readdirSync(detA).find((f) => f.endsWith('.png') && !f.includes('.780.')) : null;
const fileB = fs.existsSync(detB) ? fs.readdirSync(detB).find((f) => f.endsWith('.png') && !f.includes('.780.')) : null;
ok(fileA && fileB && hash(path.join(detA, fileA)) === hash(path.join(detB, fileB)), '同一帧渲两次，PNG 逐字节相同');

/* ------------------------------------------------------------------ 六、CLI */
group('CLI');
ok(cli(['bogus']).status === 2, '未知命令 exit 2');
ok(cli(['doc']).status === 2, 'doc 缺 tag exit 2');
ok(cli(['icons']).status === 2, 'icons 缺 query exit 2');
ok(cli(['render', 'tests/fixtures/code.html', '--frame']).status === 2, '--frame 缺值 exit 2');
ok(cli(['render', 'tests/fixtures/code.html', '--out']).status === 2, '--out 缺值 exit 2');
ok(cli(['--version']).stdout.trim() === pkg.version, '--version 输出 package 版本');
for (const tag of TAG_NAMES) ok(cli(['doc', tag]).status === 0, `vk doc ${tag}`);
const negDir = path.join(TMP, 'negative');
fs.rmSync(negDir, { recursive: true, force: true });
const neg = cli(['render', 'tests/negative/unknown.html', '--out', negDir]);
ok(neg.status === 0, '默认不是门禁：有错也出图、exit 0', `实际 ${neg.status}`);
ok(fs.existsSync(path.join(negDir, 'unknown.png')), '有错的帧仍然产生 PNG');

/* 核心承诺：放不下时库不缩字，但必须把事实写进 JSON（不拦出图）。 */
const overFile = path.join(TMP, 'overflow.html');
fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(
  overFile,
  `<vk-page id="over"><vk-head>放不下的时候。</vk-head><vk-code lang="c" title="big.c">${'<script type="text/plain" data-vk-source>'}${Array.from({ length: 12 }, (_, i) => `int v${i} = ${i};`).join('\n')}</script></vk-code></vk-page>`
);
const overDir = path.join(TMP, 'overflow');
fs.rmSync(overDir, { recursive: true, force: true });
const overRun = cli(['render', overFile, '--out', overDir, '--json']);
let overReport = null;
try {
  overReport = JSON.parse(overRun.stdout.slice(overRun.stdout.indexOf('{')));
} catch {
  /* 下面报 */
}
ok(overRun.status === 0, '超容量也 exit 0（不拦出图）');
ok(overReport?.frames?.[0]?.health?.overflow > 0, `体检单报出超出（${overReport?.frames?.[0]?.health?.overflow}px）`);
ok(fs.existsSync(path.join(overDir, 'overflow.png')), '超容量的帧仍然产生 PNG');
ok(overReport?.frames?.[0]?.issues?.length === 0 && overReport?.frames?.[0]?.ok === true, '超容量不算硬错（ok 仍为 true）');
ok(overReport?.frames?.[0]?.fits === false, 'fits 单独标记放不下');
fs.rmSync(overFile, { force: true });

/* ------------------------------------------------------------------ 七、对比度 */
group('对比度');
const lum = (hex) => {
  const h = hex.replace('#', '');
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]);
};
const ratio = (a, b) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
for (const mode of [0, 1]) {
  const bg = PAINT.paper[mode];
  for (const key of ['ink1', 'ink2', 'ink3']) ok(ratio(PAINT[key][mode], bg) >= 4.5, `${mode ? '暗' : '亮'}色 ${key} ≥ 4.5（${ratio(PAINT[key][mode], bg).toFixed(2)}）`);
  for (const key of ['comment', 'operator', 'string', 'number', 'keyword']) ok(ratio(SYNTAX[key][mode], bg) >= 4.5, `${mode ? '暗' : '亮'}色语法 ${key} ≥ 4.5（${ratio(SYNTAX[key][mode], bg).toFixed(2)}）`);
}

console.log(failed ? `\n${failed} 条没通过` : '\n全部通过');
process.exitCode = failed ? 1 : 0;
