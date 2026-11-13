/**
 * v24 · 测试
 * ----------------------------------------------------------------------------
 * 只测「会静默坏掉」的东西：
 *   一、契约 / 文档        tokens、tag、示例、词表
 *   二、构建负例           每种写错都给出稳定错误码（不抛异常）
 *   三、渲染               全部 fixture 干净、1920/780、非空白
 *   四、行为               缩字号 / 数字列 / 关系图 / 圈选 / 深色 / 多泳道 / 量度
 *   五、确定               同一帧渲两次 PNG 逐字节相同
 *   六、CLI                参数、退出码、默认不出门禁
 *
 *   npm test              跑全部
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
const OUT = path.join(ROOT, '.tmp', 'test-fixtures');

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
  node(['bin/vk.mjs', 'build']);
  node(['tools/gen.mjs', '--check']);
  node(['tools/bundle.mjs', '--check']);
  ok(true, 'tokens / dist 与源一致');
} catch (e) {
  ok(false, 'tokens / dist 与源一致', String(e.stdout || e.stderr || e.message).slice(0, 600));
}

const brief = contract();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
ok(brief.version === pkg.version, `契约版本来自 package.json（${brief.version}）`);
ok(TAG_NAMES.length === 20, `20 个标签（${TAG_NAMES.length}）`);
ok(TAG_NAMES.includes('vk-card') && TAG_NAMES.includes('vk-dir'), 'card / dir 已改名');
ok(!TAG_NAMES.includes('vk-surface') && !TAG_NAMES.includes('vk-tree'), '旧名不再存在');
ok(brief.flowChild.span && !('span' in brief.tags['vk-code'].attrs), 'span 是 flow 子项能力，不是逐件属性');
ok(brief.tags['vk-card'].attrs.surface.default === 'paper', 'card 默认 paper');
ok(brief.canvas.marginX === 120 && brief.canvas.marginY === 96, '对称版心 120 / 96');
ok(docText('vk-code').includes('range') && docText('vk-code').includes('默认 body'), 'doc 带范围与默认值');
ok(docText('vk-callout').includes('必填'), 'doc 标出必填');
ok(markdown().length < 16000, `brief ≤ 16KB（${markdown().length}）`);
ok(!markdown().includes('badge'), 'badge 幽灵已删');
ok(brief.rules.length >= 5, '契约带写作规则');

/* ------------------------------------------------------------------ 二、负例 */
group('负例');
const CASES = [
  ['UNKNOWN_TAG', '<vk-page><vk-nope>x</vk-nope></vk-page>'],
  ['UNKNOWN_ATTR', '<vk-page><vk-text typo="1">x</vk-text></vk-page>'],
  ['VALUE_ENUM', '<vk-page theme="blue"></vk-page>'],
  ['VALUE_BOOL', '<vk-page><vk-flow overlay="yes"></vk-flow></vk-page>'],
  ['VALUE_NUMBER', '<vk-page><vk-cells stride="x"><li value="1"></li></vk-cells></vk-page>'],
  ['VALUE_RANGE_ATTR', '<vk-page><vk-code range="4-2"><script type="text/plain" data-vk-source>x</script></vk-code></vk-page>'],
  ['VALUE_SPACE', '<vk-page><vk-flow gap="huge"></vk-flow></vk-page>'],
  ['VALUE_LINES', '<vk-page><vk-code current="x"><script type="text/plain" data-vk-source>x</script></vk-code></vk-page>'],
  ['VALUE_SELECTOR', '<vk-page><vk-text id="t">x</vk-text><vk-callout mode="ring" for="#t@foo:1"></vk-callout></vk-page>'],
  ['VALUE_RATIO', '<vk-page><vk-img src="x" ratio="16:9"></vk-img></vk-page>'],
  ['ATTR_REQUIRED', '<vk-page><vk-callout mode="ring"></vk-callout></vk-page>'],
  ['ATTR_IGNORED', '<vk-page><vk-code as="code" prompt="$"><script type="text/plain" data-vk-source>x</script></vk-code></vk-page>'],
  ['ATTR_PLACEMENT', '<vk-page><vk-text span="2">x</vk-text></vk-page>'],
  ['SPAN_TOO_WIDE', '<vk-page><vk-flow cols="2"><vk-text span="3">x</vk-text></vk-flow></vk-page>'],
  ['BLEED_ALL', '<vk-page><vk-text bleed="all">x</vk-text></vk-page>'],
  ['ID_DUPLICATE', '<vk-page><vk-text id="x">a</vk-text><vk-text id="x">b</vk-text></vk-page>'],
  ['CHILD_KIND', '<vk-page><vk-text><vk-flow><vk-text>x</vk-text></vk-flow></vk-text></vk-page>'],
  ['CHILD_MISSING', '<vk-page><vk-list></vk-list></vk-page>'],
  ['STRAY_TEXT', '<vk-page><vk-flow>裸文字</vk-flow></vk-page>'],
  ['GRAPH_REF', '<vk-page><vk-graph><li id="a">a</li><li after="nope">b</li></vk-graph></vk-page>'],
  ['ANCHOR_MISSING', '<vk-page><vk-text id="t">x</vk-text><vk-callout mode="ring" for="#nope"></vk-callout></vk-page>'],
  ['SRC_MISSING', '<vk-page><vk-code src="nope.c"></vk-code></vk-page>'],
  ['SRC_CONFLICT', '<vk-page><vk-code src="nope.c"><script type="text/plain" data-vk-source>x</script></vk-code></vk-page>'],
  ['RANGE_OUT_OF_RANGE', '<vk-page><vk-code range="99"><script type="text/plain" data-vk-source>x</script></vk-code></vk-page>'],
  ['TREE_JSON', '<vk-page><vk-dir><script type="text/plain" data-vk-tree>{</script></vk-dir></vk-page>'],
  ['TREE_NODE', '<vk-page><vk-dir><script type="text/plain" data-vk-tree>{"children":[{}]}</script></vk-dir></vk-page>'],
  ['MATH', '<vk-page><vk-math>\\frac{</vk-math></vk-page>'],
  ['ICON', '<vk-page><vk-text icon="no-such-icon">x</vk-text></vk-page>'],
  ['MARK_MISSING', '<vk-page><vk-code mark="zz"><script type="text/plain" data-vk-source>int a = 1;</script></vk-code></vk-page>'],
  ['FIELD_LABELS', '<vk-page><vk-bits value="0|1|0" field-labels="a,b"></vk-bits></vk-page>'],
  ['CURRENT_RANGE', '<vk-page><vk-code current="99"><script type="text/plain" data-vk-source>int a = 1;</script></vk-code></vk-page>'],
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
  ok(report.clean, '全部 fixture 干净', report.diagnostics.map((d) => d.message).join('；'));
  ok(report.frames.length === 34, `34 帧（${report.frames.length}）`);
  ok(report.engine?.version, `记录引擎（${report.engine?.channel} ${report.engine?.version}）`);
  const bad = report.frames.filter((f) => !f.png || !f.png780 || !f.json);
  ok(bad.length === 0, '每帧三件产物都在', bad.map((f) => f.name).join(', '));

  let widthsOk = true;
  let blank = [];
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



/* ------------------------------------------------------------------ 四、行为 */
group('行为');
try {
  cli(['check', 'tests/behaviour.html', '--out', path.join(ROOT, '.tmp', 'behaviour')]);
} catch {
  /* 行为页可能有意留问题，只看运行期 */
}
const { chromium } = await import('playwright');
let browser = null;
const launchOpts = {
  args: ['--allow-file-access-from-files', '--font-render-hinting=none', '--disable-gpu', '--disable-lcd-text', '--disable-partial-raster', '--force-color-profile=srgb', '--run-all-compositor-stages-before-draw'],
};
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
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file:///' + path.join(ROOT, '.vk-tmp', 'pages', 'tests', 'behaviour.html').split(path.sep).join('/'), { waitUntil: 'load' });
  await page.evaluate(() => window.vk.ready());
  const behave = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const row = q('#shrink .vk-line');
    const t = q('#numtable table');
    const graph = q('#behave-graph vk-graph');
    const dark = q('#darkwin .vk-frame');
    const seq = q('#behave-seq vk-seq');
    const cells = q('#behave-cells vk-cells');
    return {
      shrink: row ? parseFloat(getComputedStyle(row).fontSize) : 0,
      numAlign: t ? getComputedStyle(t.querySelector('td.num') || t).textAlign : '',
      textAlign: t ? getComputedStyle([...t.querySelectorAll('td')].find((td) => !td.classList.contains('num')) || t).textAlign : '',
      edges: graph ? graph.querySelectorAll('.vk-edge').length : 0,
      ring: !!q('#behave-graph .vk-co-ring'),
      tableRing: !!q('#behave-table .vk-co-ring'),
      darkBg: dark ? getComputedStyle(dark).backgroundColor : '',
      seqLanes: seq ? seq.querySelectorAll('.vk-seq-head span').length : 0,
      seqCurrent: seq ? seq.querySelectorAll('.vk-seq-row[current]').length : 0,
      cellsCurrent: cells ? cells.querySelectorAll('.vk-cell[current]').length : 0,
      measure: !!q('#behave-cells .vk-co-line'),
      inlineMono: /Mono/i.test(getComputedStyle(q('#inline code')).fontFamily),
      currentRow: getComputedStyle(q('#numtable tr[current] td')).backgroundColor,
    };
  });
  ok(behave.shrink >= 40 && behave.shrink < 56, `长行会缩字号（${behave.shrink}px）`);
  ok(behave.numAlign === 'right', `数字列右对齐（${behave.numAlign}）`);
  ok(behave.textAlign !== 'right', `文字列不右对齐（${behave.textAlign}）`);
  ok(behave.edges === 2, `两个节点三条边 → 2 条连线（${behave.edges}）`);
  ok(behave.ring, '圈选画出来了');
  ok(behave.tableRing, '表格行锚点 @item 能圈');
  ok(!/rgb\(255, 255, 255\)/.test(behave.darkBg), `深色页的代码窗自动变深（${behave.darkBg}）`);
  ok(behave.seqLanes === 3, `时序 3 条泳道（${behave.seqLanes}）`);
  ok(behave.seqCurrent === 1, '时序 current 落在消息上');
  ok(behave.cellsCurrent === 1, '内存格 current 落在格子上');
  ok(behave.measure, '量度线画出来了');
  ok(behave.inlineMono, '行内代码是等宽字体');
  ok(/rgb\(226, 233, 255\)/.test(behave.currentRow), `当前行有淡底（${behave.currentRow}）`);
  await browser.close();
}

/* ------------------------------------------------------------------ 五、确定 */
group('确定');
const detA = path.join(ROOT, '.tmp', 'det-a');
const detB = path.join(ROOT, '.tmp', 'det-b');
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
const negDir = path.join(ROOT, '.tmp', 'negative');
fs.rmSync(negDir, { recursive: true, force: true });
const neg = cli(['render', 'tests/negative/unknown.html', '--out', negDir]);
ok(neg.status === 0, '默认不是门禁：有错也出图、exit 0', `实际 ${neg.status}`);
ok(fs.existsSync(path.join(negDir, 'unknown.png')), '有错的帧仍然产生 PNG');

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
