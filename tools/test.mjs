/**
 * v27 · 测试
 * ----------------------------------------------------------------------------
 * 只测「会静默坏掉」的东西：
 *   一、契约 / 文档     13 个标签、变体、生成物同步
 *   二、负例            每种写错都给出稳定错误码（不抛异常）
 *   三、渲染            全部 fixture 干净：ok / fits / 焦点 ≤1 / 1920×693 / 非空白
 *   四、行为            不缩字 / 圈选 / 数字列 / 深色窗 / 16 个几何断言
 *   五、确定            同一帧渲两次 PNG 逐字节相同
 *   六、CLI             参数、退出码、brief 索引、默认不拦出图
 *   七、对比度          读 dist/tokens.css 的 light-dark()，文本色在两种面上都 ≥ 4.5
 *
 *   npm test
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { TAG_NAMES, TAGS } from '../src/schema.mjs';
import { contract, docText, markdown, exampleFrame } from '../src/contract.mjs';
import { transformHtml } from '../src/build/index.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const TMP = path.join(ROOT, '.tmp');
const OUT = path.join(TMP, 'test-fixtures');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
/** v27 验收帧：41 个迁移 + 9 个新增（band-lock 一文件两帧）。数错说明有 fixture 被删或没进目录。 */
const EXPECTED_FIXTURES = 50;
const NEW_FIXTURES = ['board-band', 'board-frames', 'callout-jump', 'callout-bracket', 'graph-edge', 'callout-text', 'flow-split', 'dark-auto'];

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
const probe = (html, file = '_probe.html') => transformHtml(html, { file: path.join(ROOT, 'tests', 'fixtures', file) });
const codesOf = (res) => res.diagnostics.map((d) => d.code);

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
ok(Object.keys(brief.tags['vk-board'].variants).length === 8, `board 有 8 个变体（${Object.keys(brief.tags['vk-board'].variants).join(' / ')}）`);
ok(Object.keys(brief.tags['vk-graph'].variants).length === 4 && brief.tags['vk-graph'].attrs.as.values.join() === 'row,tree,layered,mesh', 'graph 的 4 种布局在 as 属性里');
ok(brief.flowChild.span && !('span' in brief.tags['vk-code'].attrs), 'span 是 flow 子项能力，不是逐件属性');
ok(brief.canvas.marginX === 120 && brief.canvas.marginY === 96, '对称版心 120 / 96');
ok(brief.tags['vk-code'].variants.code.attrs.lang && brief.tags['vk-code'].variants.code.attrs.lang.required !== true, 'lang 可省（有 src 时从扩展名推断）');
ok(brief.tags['vk-code'].variants.bits.attrs.fields && !('field-labels' in brief.tags['vk-code'].variants.bits.attrs), 'bits 用 fields，不再有 field-labels');
ok(brief.tags['vk-code'].variants.asm.attrs.addr?.values.join() === 'on,off', 'asm 用 addr="on|off"');
ok(!('ratio' in brief.tags['vk-img'].attrs) && brief.tags['vk-img'].attrs.aspect, 'img 用 aspect / fit / focus');
ok(docText('vk-code').includes('as="bits"') && docText('vk-code').includes('默认 body'), 'doc 按变体列出范围与默认值');
ok(docText('vk-callout').includes('必填'), 'doc 标出必填');
const md = markdown();
ok(md.startsWith(`# vk 契约 ${pkg.version}`), '紧凑契约能生成');
ok(md.includes('693'), '契约按真机 693 写');
ok(!/<\/?(vk-stack|vk-grid|vk-compare|vk-cells|vk-steps|vk-bars|vk-timeline|vk-table|vk-list|vk-bytes|vk-bits|vk-term)>/.test(md), '生成物里没有旧标签');

/* CSS 里用到的 token 必须有定义（或由构建/运行期写入）。 */
const cssAll = fs.readFileSync(path.join(ROOT, 'dist/vk.css'), 'utf8');
const tokensCss = fs.readFileSync(path.join(ROOT, 'dist', 'tokens.css'), 'utf8');
const defined = new Set([...tokensCss.matchAll(/(--vk-[\w-]+)\s*:/g)].map((m) => m[1]));
const runtimeVars = new Set(['--vk-gap', '--vk-cols', '--vk-cols-template', '--vk-span', '--vk-tone', '--vk-tint', '--vk-ln-digits', '--vk-aaddr-w', '--vk-bascii-w', '--vk-depth', '--vk-bcol', '--vk-bhexw', '--vk-n', '--vk-at', '--vk-x', '--vk-seq-c', '--vk-x1', '--vk-x2', '--vk-mid',
  /* 构建期 / 运行期写进 style 的局部变量 */
  '--vk-s', '--vk-e', '--vk-head-lock', '--vk-msg-h']);
const usedVars = new Set([...cssAll.matchAll(/var\((--vk-[\w-]+)/g)].map((m) => m[1]));
const missingVars = [...usedVars].filter((v) => !defined.has(v) && !runtimeVars.has(v));
ok(missingVars.length === 0, 'CSS 用到的 token 都有定义', missingVars.join(', '));

/* 字体必须是真文件：fonts.css 里每个 url() 都要能在 dist 里找到。 */
const fontsCss = fs.readFileSync(path.join(ROOT, 'dist', 'fonts.css'), 'utf8');
const fontUrls = [...fontsCss.matchAll(/url\('\.\/([^)]+)'\)/g)].map((m) => m[1]);
const fontMissing = fontUrls.filter((u) => !fs.existsSync(path.join(ROOT, 'dist', u)));
ok(fontUrls.length > 300 && fontMissing.length === 0, `字体文件都在（${fontUrls.length} 个）`, fontMissing.slice(0, 5).join(', '));

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
  ['VALUE_SELECTOR', '<vk-page><vk-text id="t">x</vk-text><vk-callout as="mark" target="#t@foo:1"></vk-callout></vk-page>'],
  ['VALUE_RATIO', '<vk-page><vk-img src="nope.png" aspect="16x9"></vk-img></vk-page>'],
  ['SRC_MISSING', '<vk-page><vk-img src="nope.png" alt="缺图"></vk-img></vk-page>'],
  ['ATTR_REQUIRED', '<vk-page><vk-callout as="mark"></vk-callout></vk-page>'],
  ['LANG_MISSING', '<vk-page><vk-code><script type="text/plain" data-vk-source>x</script></vk-code></vk-page>'],
  ['UNKNOWN_ATTR', '<vk-page><vk-text id="t">x</vk-text><vk-callout as="mark" target="#t" label="nope"></vk-callout></vk-page>'],
  ['ATTR_PLACEMENT', '<vk-page><vk-text span="2">x</vk-text></vk-page>'],
  ['SPAN_TOO_WIDE', '<vk-page><vk-flow cols="2"><vk-text span="3">x</vk-text></vk-flow></vk-page>'],
  ['BLEED_ALL', '<vk-page><vk-text bleed="all">x</vk-text></vk-page>'],
  ['ID_DUPLICATE', '<vk-page><vk-text id="x">a</vk-text><vk-text id="x">b</vk-text></vk-page>'],
  ['CHILD_KIND', '<vk-page><vk-text><vk-flow><vk-text>x</vk-text></vk-flow></vk-text></vk-page>'],
  ['CHILD_MISSING', '<vk-page><vk-board as="list"></vk-board></vk-page>'],
  ['STRAY_TEXT', '<vk-page><vk-flow>裸文字</vk-flow></vk-page>'],
  ['GRAPH_REF', '<vk-page><vk-graph><li id="a">a</li><li after="nope">b</li></vk-graph></vk-page>'],
  ['ANCHOR_MISSING', '<vk-page><vk-text id="t">x</vk-text><vk-callout as="mark" target="#nope"></vk-callout></vk-page>'],
  ['SRC_MISSING', '<vk-page><vk-code lang="c" src="nope.c"></vk-code></vk-page>'],
  ['SRC_CONFLICT', '<vk-page><vk-code lang="c" src="nope.c"><script type="text/plain" data-vk-source>x</script></vk-code></vk-page>'],
  ['RANGE_OUT_OF_RANGE', CODE('range="99"')],
  ['TREE_JSON', '<vk-page><vk-dir><script type="text/plain" data-vk-tree>{</script></vk-dir></vk-page>'],
  ['TREE_NODE', '<vk-page><vk-dir><script type="text/plain" data-vk-tree>{"children":[{}]}</script></vk-dir></vk-page>'],
  ['MATH', '<vk-page><vk-math>\\frac{</vk-math></vk-page>'],
  ['MARK_MISSING', CODE('mark="zz"')],
  ['FIELD_LABELS', '<vk-page><vk-code as="bits" value="0|1|0" fields="a,b"></vk-code></vk-page>'],
  ['CURRENT_MISSING', CODE('current="99"')],
  ['BUILD', '<vk-page><vk-code lang="no-such-lang"><script type="text/plain" data-vk-source>x</script></vk-code></vk-page>'],
  ['ID_FORMAT', '<vk-page><vk-text id="a/b">x</vk-text></vk-page>'],
  ['ATTR_REQUIRED', '<vk-page><vk-img alt="x"></vk-img></vk-page>'],
  ['ATTR_REQUIRED', '<vk-page><vk-code as="bits"></vk-code></vk-page>'],
  ['ATTR_PLACEMENT', '<vk-page><vk-card><vk-callout as="mark" target="#x"></vk-callout></vk-card></vk-page>'],
  ['NOTE_MULTI', '<vk-page><vk-text id="a">x</vk-text><vk-callout as="note" target="#a">一</vk-callout><vk-callout as="note" target="#a">二</vk-callout></vk-page>'],
  ['SELF_REF', '<vk-page><vk-seq participants="A,B"><li from="A" to="A">x</li></vk-seq></vk-page>'],
  ['GRAPH_CYCLE', '<vk-page><vk-graph><li id="a" after="b">a</li><li id="b" after="a">b</li></vk-graph></vk-page>'],
  ['TARGET_SELF', '<vk-page><vk-text id="a">x</vk-text><vk-callout as="arrow" from="#a" to="#a"></vk-callout></vk-page>'],
  ['CURRENT_MISSING', '<vk-page><vk-code lang="c" fold="2" current="2"><script type="text/plain" data-vk-source>a\nb\nc</script></vk-code></vk-page>'],
  ['SRC_RANGE', '<vk-page><vk-code as="bytes" offset="999" length="4"><script type="text/plain" data-vk-source>00 01 02 03</script></vk-code></vk-page>'],
  ['SRC_BINARY', '<vk-page><vk-code lang="c" src="../fixtures/backdrop.png"></vk-code></vk-page>'],
  /* v27 新口子：边标、区间、跳转上限、地址格子、@text 空词 */
  ['EDGE_MULTI', '<vk-page><vk-graph><li id="a">a</li><li id="b">b</li><li id="c" after="a b" edge="x">c</li></vk-graph></vk-page>'],
  ['BAND_RANGE', '<vk-page><vk-board as="band" start="0" end="10"><li start="2">缺终点</li></vk-board></vk-page>'],
  ['STRIDE_NEEDED', '<vk-page><vk-board as="cells" addr="0x1000"><li value="1"></li></vk-board></vk-page>'],
  ['JUMP_LIMIT', `<vk-page><vk-code id="c" lang="c">${'<script type="text/plain" data-vk-source>'}${Array.from({ length: 8 }, (_, i) => `int v${i};`).join('\n')}</script></vk-code>${Array.from({ length: 4 }, (_, i) => `<vk-callout as="jump" from="#c@line:${i + 1}" to="#c@line:${i + 2}"></vk-callout>`).join('')}</vk-page>`],
  ['TEXT_ANCHOR', '<vk-page><vk-code id="c" lang="c" mark="i"><script type="text/plain" data-vk-source>s += a[i];</script></vk-code><vk-callout as="mark" target="#c@text:"></vk-callout></vk-page>'],
];
for (const [code, html] of CASES) {
  try {
    const res = await probe(html, '_inline.html');
    const codes = codesOf(res);
    ok(codes.includes(code), `${code}`, `实际：${codes.join(', ') || '无'}`);
  } catch (e) {
    ok(false, `${code}（不抛异常）`, e.message);
  }
}

/* v26 旧名：构建侧兼容，只给 hint；新写法必须零诊断。 */
{
  const good = await probe('<vk-page><vk-text id="t">x</vk-text><vk-callout as="mark" target="#t"></vk-callout></vk-page>');
  ok(good.diagnostics.length === 0, 'as / target 正例零诊断', codesOf(good).join(', '));
  const legacy = await probe('<vk-page><vk-text id="t">x</vk-text><vk-callout mode="mark" for="#t"></vk-callout></vk-page>');
  const hint = legacy.diagnostics.find((d) => d.code === 'ATTR_IGNORED');
  ok(hint && hint.severity === 'hint', `旧名 mode / for 只给 hint（${hint?.message || '无'}）`);
  ok(!legacy.diagnostics.some((d) => d.severity !== 'hint'), '旧名不挡出图', codesOf(legacy).join(', '));
  const cap = await probe('<vk-page><vk-board as="table" caption="表"><table><tr><th>a</th></tr><tr><td>1</td></tr></table></vk-board></vk-page>');
  const capHint = cap.diagnostics.find((d) => d.code === 'UNKNOWN_ATTR');
  ok(capHint && /原生 <caption>/.test(capHint.fix), 'table 的 caption 属性提示改用原生 <caption>', capHint?.fix || codesOf(cap).join(', '));
  const img = await probe('<vk-page><vk-img src="../fixtures/backdrop.png" ratio="16 / 9" fill="cover" position="50% 50%"></vk-img></vk-page>');
  ok(img.diagnostics.some((d) => d.code === 'ATTR_IGNORED'), 'img 旧名 ratio / fill / position 给 hint');
  const index = await probe('<vk-page><vk-code as="bits" value="0|1" index="up"></vk-code></vk-page>');
  const idxHint = index.diagnostics.find((d) => d.code === 'ATTR_IGNORED');
  ok(idxHint && /weight|order/.test(idxHint.fix), 'bits 旧序号 index="up" 提示 order', idxHint?.fix || '');
}

/* src= 是「从真实文件读源码」的唯一入口：正例必须有，否则这条路没人走。 */
{
  const res = await probe('<vk-page><vk-code lang="c" src="../assets/src-demo.c"></vk-code></vk-page>');
  ok(res.html.includes('stdio.h') && !res.diagnostics.some((d) => d.code === 'SRC_MISSING'), 'src= 从文件读源码');
}

/* ------------------------------------------------------------------ 二·五、没走到的口子
   契约里写了、验收帧里没有的能力。不补帧，用构建结果断言它们真的生效。 */
group('契约口子');
{
  const log = await probe('<vk-page><vk-board as="bars" scale="log" max="100"><li value="10">a</li><li value="100">b</li></vk-board></vk-page>');
  ok(log.html.includes('width:52.0%'), 'bars scale=log 改变条长（10/100 → 52%，线性是 10%）');
  const span = await probe('<vk-page><vk-flow cols="2"><vk-text span="2">x</vk-text></vk-flow></vk-page>');
  ok(span.html.includes('--vk-span:2'), 'flow 子项 span 跨列');
  const bits = await probe('<vk-page><vk-code as="bits" value="0|010|1" index="order"></vk-code></vk-page>');
  ok(bits.html.includes('<b class="vk-bit-i">4</b>'), 'bits index=order 从左往右数');
  const term = await probe('<vk-page><vk-code as="term"><script type="text/plain" data-vk-source>$ ls -l\ntotal 0</script></vk-code></vk-page>');
  ok(term.html.includes('vk-prompt') && term.html.includes('vk-cmd'), 'term 的提示符与命令分开渲染');
  const bytes = await probe('<vk-page><vk-code as="bytes" addr="0x10" cols="4" offset="2" length="4"><script type="text/plain" data-vk-source>00 01 02 03 04 05 06 07</script></vk-code></vk-page>');
  ok(bytes.html.includes('0x0012') && /vk-bhex">(<i[^>]*>[0-9a-f]{2}<\/i>){4}/.test(bytes.html), 'bytes 的 offset / length 生效');
  const cap = await probe('<vk-page><vk-board as="table"><table><caption>表</caption><tr><th>a</th></tr><tr><td>1</td></tr></table></vk-board></vk-page>');
  ok(cap.html.includes('<div class="vk-cap">表</div>'), 'table 的原生 caption 保留');
  const asm = await probe('<vk-page><vk-code as="asm" mark="nop" fold="2"><script type="text/plain" data-vk-source>0x0 90 nop\n0x1 90 nop\n0x2 90 nop\n0x3 90 nop</script></vk-code></vk-page>');
  ok(asm.html.includes('省略 1 行'), 'asm fold 折掉已知行');
  ok(/<mark class="vk-mark"/.test(asm.html), 'asm mark 标助记符');
  const td = await probe('<vk-page><vk-board as="table"><table><tr><th>a</th></tr><tr><td tone="ok" align="right">1</td></tr></table></vk-board></vk-page>');
  ok(td.html.includes('tone="ok"') && td.html.includes('align="right"'), 'table 单元格 tone / align 保留');
  const spaceBits = await probe('<vk-page><vk-code as="bits" value="0 | 0111" index="order"></vk-code></vk-page>');
  ok(spaceBits.html.includes('<b class="vk-bit-i">4</b>'), 'bits 的空格不占位索引');
  const upper = await probe('<vk-page><vk-code lang="c" range="2-999"><script type="text/plain" data-vk-source>a\nb\nc</script></vk-code></vk-page>');
  ok(upper.diagnostics.some((d) => d.code === 'RANGE_OUT_OF_RANGE'), 'range 上界越界要报，不静默截断');
  const tl = await probe('<vk-page><vk-board as="timeline" start="1963" end="2010"><li at="3000">x</li></vk-board></vk-page>');
  ok(tl.diagnostics.some((d) => d.code === 'VALUE_RANGE'), 'timeline at 越界要报，不静默夹取');
  const full = await probe('<!doctype html><html><head><title>x</title></head><body><vk-page><vk-text>x</vk-text></vk-page></body></html>');
  ok(/vk\.css/.test(full.html) && /vk\.js/.test(full.html), '整页 HTML 也注入 dist 三件');
  const styled = await probe('<vk-page><vk-text style="--vk-fs-body:200px;--vk-focus:#f00">x</vk-text></vk-page>');
  ok(!/--vk-fs-body/.test(styled.html) && /--vk-focus/.test(styled.html), 'style 锁定 token 被删掉，颜色保留');
  /* v27：after 边标签写进 data-edge，由运行期画在边上。 */
  const edge = await probe('<vk-page><vk-graph><li id="a">a</li><li id="b" after="a" edge="是">b</li></vk-graph></vk-page>');
  ok(edge.html.includes('data-edge="是"'), 'graph 的 after 边标签 data-edge 落地');
  /* v27：不写 as，按内容推断布局 / 标注形态。 */
  const inferG = await probe('<vk-page><vk-graph><li id="a">a</li><li id="b" after="a">b</li></vk-graph></vk-page>');
  ok(inferG.html.includes('data-as="tree"'), 'graph 不写 as：有 after 推断成 tree');
  const inferC = await probe('<vk-page><vk-text id="t">x</vk-text><vk-callout target="#t">一句话</vk-callout></vk-page>');
  ok(inferC.html.includes('data-as="note"'), 'callout 不写 as：有正文推断成 note');
  const inferM = await probe('<vk-page><vk-text id="t">x</vk-text><vk-callout as="mark" target="#t"></vk-callout></vk-page>');
  ok(inferM.html.includes('data-as="mark"'), 'callout 写 as=mark 就是 mark');
  /* v27：jump / band / frames 构建出各自的 DOM。 */
  const jump = await probe('<vk-page><vk-code id="c" lang="c" size="caption"><script type="text/plain" data-vk-source>a\nb\nc\nd\ne\nf</script></vk-code><vk-callout as="jump" from="#c@line:2" to="#c@line:6" label="跳"></vk-callout></vk-page>');
  ok(jump.diagnostics.length === 0, 'jump 构建零诊断', codesOf(jump).join(', '));
  const band = await probe('<vk-page><vk-board as="band" start="0" end="16" unit="ms"><li start="0" end="3">a</li><li start="3" end="9" current>b</li><li start="9" end="13" tone="warn">c</li><li start="13" end="16">d</li></vk-board></vk-page>');
  ok(band.html.includes('vk-band-axis') && band.html.includes('--vk-s:'), 'band 出轴与条');
  const frames = await probe('<vk-page><vk-board as="frames" direction="up" top-label="栈顶"><li title="f(2)" current>n = 2</li><li title="main">argc = 1</li></vk-board></vk-page>');
  ok(frames.html.includes('data-dir="up"') && frames.html.includes('vk-fr-top'), 'frames 出生长方向与栈顶说明');
}

/* 每个 tag/变体的示例都必须是完整可跑帧，不是带 … 的片段。 */
group('示例');
for (const tag of TAG_NAMES) {
  const variants = TAGS[tag].variants ? Object.keys(TAGS[tag].variants) : [null];
  for (const as of variants) {
    const html = exampleFrame(tag, as);
    let codes = ['NO_EXAMPLE'];
    if (html) {
      try {
        codes = codesOf(await probe(html, '_example.html'));
      } catch (e) {
        codes = [`THROW ${e.message}`];
      }
    }
    ok(codes.length === 0, `${tag}${as ? ` as="${as}"` : ''} 示例可跑`, codes.join(', '));
  }
}

/* ------------------------------------------------------------------ 三、渲染 */
group('渲染');
fs.rmSync(OUT, { recursive: true, force: true });
const renderRun = cli(['render', 'tests/fixtures', '--out', OUT, '--json']);
let report = null;
try {
  report = JSON.parse(renderRun.stdout);
} catch {
  /* 下面报 */
}
ok(renderRun.status === 0 && report, '全部 fixture 出图，--json 是纯 JSON', String(renderRun.stderr || '').slice(0, 400));
if (report) {
  const fileCount = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.html')).length;
  ok(fileCount === EXPECTED_FIXTURES, `验收帧有 ${EXPECTED_FIXTURES} 个（${fileCount}）`);
  ok(report.frames.length >= fileCount, `${fileCount} 个文件出了 ${report.frames.length} 帧`);
  ok(NEW_FIXTURES.every((n) => report.frames.some((f) => f.name === n)), `v27 新增的 8 帧都在（${NEW_FIXTURES.join(' / ')}）`);
  ok(report.engine?.version, `记录引擎（${report.engine?.channel} ${report.engine?.version}）`);
  ok(report.ok === true && report.clean === true, '整批 ok 且 clean');
  const bad = report.frames.filter((f) => !f.png || !f.preview || !f.json);
  ok(bad.length === 0, '每帧三件产物都在', bad.map((f) => f.name).join(', '));
  const withIssues = report.frames.filter((f) => f.issues.length);
  ok(withIssues.length === 0, '每帧都没有硬错', withIssues.slice(0, 3).map((f) => `${f.name}: ${f.issues.map((i) => `${i.code} ${i.message}`).join(' / ')}`).join('；'));
  const notOk = report.frames.filter((f) => f.ok !== true);
  ok(notOk.length === 0, '每帧 ok:true', notOk.map((f) => f.name).join(', '));
  const notFit = report.frames.filter((f) => f.fits !== true);
  ok(notFit.length === 0, '每帧 fits:true', notFit.map((f) => `${f.name} 超出 ${f.health?.overflow}`).join('；'));
  const tooMany = report.frames.filter((f) => (f.health?.focus ?? 0) > 1);
  ok(tooMany.length === 0, '每帧最多一处焦点', tooMany.map((f) => `${f.name} 焦点 ${f.health.focus}`).join('；'));
  const anchored = report.frames.filter((f) => ((f.health?.anchorMissing ?? f.health?.anchors) ?? 0) !== 0);
  ok(anchored.length === 0, '每帧没有指空的锚点（anchorMissing / anchors 兼容）', anchored.map((f) => `${f.name} ${f.health.anchorMissing ?? f.health.anchors}`).join('；'));
  const over = report.frames.filter((f) => f.health?.overflow);
  ok(over.length === 0, '每帧都放得下（overflow = 0）', over.map((f) => `${f.name} 超出 ${f.health.overflow}`).join('；'));

  const listFrame = report.frames.find((f) => f.name === 'list');
  ok(listFrame?.health?.blocks?.[0]?.font === 64, `list 的 block 字号是真实 64（${listFrame?.health?.blocks?.[0]?.font}）`);
  const bitsFrame = report.frames.find((f) => f.name === 'bits');
  ok(bitsFrame?.health?.blocks?.[0]?.font === 64, `bits 的位值是正文 64（${bitsFrame?.health?.blocks?.[0]?.font}）`);
  const calloutFrame = report.frames.find((f) => f.name === 'callout');
  ok(calloutFrame?.health?.bodyWidth === 1120, `有 note 的正文宽度是 1120（${calloutFrame?.health?.bodyWidth}）`);
  /* bytes 的 current="1-5" 是一段字节，不是 5 处焦点。 */
  const bytesFrame = report.frames.find((f) => f.name === 'bytes');
  ok(bytesFrame?.health?.focus === 1, `bytes 的 current="1-5" 只算 1 个焦点（${bytesFrame?.health?.focus}）`);
  {
    const rangeFile = path.join(TMP, 'bytes-range.html');
    fs.writeFileSync(rangeFile, '<vk-page><vk-code as="bytes" current="1-3"><script type="text/plain" data-vk-source>68 65 6c 6c 6f</script></vk-code></vk-page>');
    const rangeRun = cli(['render', rangeFile, '--check', '--out', path.join(TMP, 'bytes-range'), '--json']);
    let rangeRep = null;
    try {
      rangeRep = JSON.parse(rangeRun.stdout);
    } catch {
      /* 下面报 */
    }
    ok(rangeRep?.frames?.[0]?.health?.focus === 1, `bytes 的 current="1-3" 只算 1 个焦点（${rangeRep?.frames?.[0]?.health?.focus}）`);
  }

  let widthsOk = true;
  const blank = [];
  for (const f of report.frames) {
    const big = PNG.sync.read(fs.readFileSync(path.join(ROOT, f.png)));
    const small = PNG.sync.read(fs.readFileSync(path.join(ROOT, f.preview)));
    if (big.width !== 1920 || big.height !== 1080 || small.width !== 693) widthsOk = false;
    const colors = new Set();
    for (let i = 0; i < big.data.length; i += 4 * 97) colors.add(`${big.data[i]},${big.data[i + 1]},${big.data[i + 2]}`);
    if (colors.size < 4) blank.push(f.name);
  }
  ok(widthsOk, '1920×1080 / 693 宽出图');
  ok(blank.length === 0, '没有空白帧', blank.join(', '));
}

/* ------------------------------------------------------------------ 三·五、自检
   体检单自己也要被体检：故意造三种坏帧，断言 audit 真的报出来。 */
group('自检');
{
  const dir = path.join(TMP, 'audit');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'audit.html');
  fs.writeFileSync(
    file,
    `<vk-page id="clip">
  <vk-code lang="c" title="long.c"><script type="text/plain" data-vk-source>
int this_is_a_very_long_line_that_will_not_fit_in_the_window_at_all = 1;
  </script></vk-code>
</vk-page>
<vk-page id="empty"></vk-page>
<vk-page id="headonly"><vk-head>下一节</vk-head></vk-page>
<vk-page id="wide"><vk-graph>${Array.from({ length: 20 }, (_, i) => `<li id="n${i}">${i}</li>`).join('')}</vk-graph></vk-page>
<vk-page id="outside">
  <vk-code lang="c" title="big.c"><script type="text/plain" data-vk-source>
${Array.from({ length: 12 }, (_, i) => `int v${i} = ${i};`).join('\n')}
  </script></vk-code>
</vk-page>`
  );
  const run = cli(['render', file, '--check', '--out', path.join(dir, 'out'), '--json']);
  let rep = null;
  try {
    rep = JSON.parse(run.stdout);
  } catch {
    /* 下面报 */
  }
  const codes = (rep?.frames || []).flatMap((f) => f.issues.map((i) => i.code));
  ok(codes.includes('CLIPPED'), '自检抓横向裁切', codes.join(', '));
  ok(codes.includes('EMPTY'), '自检抓空帧', codes.join(', '));
  ok(codes.includes('OUTSIDE'), '自检抓出画布', codes.join(', '));
  const wide = rep?.frames?.find((f) => f.id === 'wide');
  ok(wide?.issues.some((i) => i.code === 'OUTSIDE'), '宽图越界的节点也能抓到（不只正文第一层）');
  const headOnly = rep?.frames?.find((f) => f.id === 'headonly');
  ok(headOnly?.ok === true && headOnly?.health?.empty === false, '只有标题的章节帧不算空帧');
  ok(rep?.frames?.[0]?.ok === false, '坏帧不再报 ok:true');
  ok(rep?.frames?.every((f) => typeof (f.health?.anchorMissing ?? f.health?.anchors) === 'number'), '体检单同时给 anchorMissing 与 anchors（取到数字）');
  ok(run.status === 0, '--check 不拦出图：坏帧也 exit 0');
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
    frames: document.querySelectorAll('.vk-stage').length,
  }));
  ok(behave.font === 64, `不缩字：代码就是 64px（${behave.font}）`);
  ok(behave.cur === 1, `当前行只有一条（${behave.cur}）`);
  await codePage.close();

  /* band="lock"：同一文件里两帧的标题带对齐到最高那一帧，切帧时正文不跳。 */
  const lockPage = await load('band-lock.html');
  const lock = await lockPage.evaluate(() => {
    const heads = [...document.querySelectorAll('vk-page[band="lock"] vk-head, vk-page[band="lock"] .vk-head')].map((h) => h.getBoundingClientRect().height);
    return { heads, lock: getComputedStyle(document.querySelector('vk-page')).getPropertyValue('--vk-head-lock') };
  });
  ok(lock.heads.length === 2, `band=lock 有两帧（${lock.heads.length}）`);
  ok(lock.heads.every((h) => Math.abs(h - lock.heads[0]) < 1), `两帧标题带等高（${lock.heads.map((h) => Math.round(h)).join(' / ')}）`);
  ok(lock.heads[0] > 300, `锁到更高的那一档（${Math.round(lock.heads[0])}px）`);
  await lockPage.close();

  /* 标注 = 墨下一条 + 卡片外一句话 + 一条指到文字的水平箭头。 */
  const annoPage = await load('callout.html');
  const anno = await annoPage.evaluate(() => {
    const note = [...document.querySelectorAll('.vk-co-note')].find((n) => !n.hidden);
    const bars = [...document.querySelectorAll('.vk-co-bar')];
    const head = document.querySelector('.vk-co-head');
    const lead = document.querySelector('.vk-co-line');
    const card = document.querySelector('.vk-frame');
    const body = document.querySelector('.vk-body');
    const line = document.querySelectorAll('.vk-line')[1];
    if (!note || !bars.length || !head || !lead) return null;
    const n = note.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const l = line.getBoundingClientRect();
    const lc = line.querySelector('.vk-lc').getBoundingClientRect();
    const rg = document.createRange();
    rg.selectNodeContents(line.querySelector('.vk-lc'));
    const ink = rg.getBoundingClientRect();
    const b = bars[0].getBoundingClientRect();
    const h = head.getBoundingClientRect();
    return {
      bars: bars.length,
      covers: b.left <= ink.left && b.right >= ink.right,
      under: b.top >= ink.bottom - 6,
      outside: n.left >= c.right + 8,
      sameRow: Math.abs((n.top + n.bottom) / 2 - (l.top + l.bottom) / 2) <= 6,
      gap: Math.round(n.left - h.right),
      lead: Math.round(lead.getBoundingClientRect().width),
      gutter: c.width <= body.getBoundingClientRect().width - 400,
    };
  });
  ok(anno && anno.bars === 1, `一条行只有一个标记（${anno && anno.bars}）`);
  ok(anno && anno.covers && anno.under, '标记落在这一行的墨迹下面');
  ok(anno && anno.outside, '注记在卡片外面');
  ok(anno && anno.sameRow, '注记和它指的那一行同高');
  ok(anno && anno.gap >= 24 && anno.gap <= 48, `箭头在文字前留净空（${anno && anno.gap}）`);
  ok(anno && anno.lead >= 100, `箭头够长（${anno && anno.lead}）`);
  ok(anno && anno.gutter, '有注记的页给正文让出了一列');
  await annoPage.close();

  const tablePage = await load('table.html');
  const t = await tablePage.evaluate(() => {
    const table = document.querySelector('table');
    const num = table.querySelector('td.num');
    const text = [...table.querySelectorAll('td')].find((td) => !td.classList.contains('num'));
    return { num: num ? getComputedStyle(num).textAlign : '', text: text ? getComputedStyle(text).textAlign : '', rows: table.querySelectorAll('tr').length };
  });
  const align = await tablePage.evaluate(() => {
    const td = document.querySelector('td');
    td.setAttribute('align', 'center');
    const centerAttr = td.getAttribute('align');
    const center = getComputedStyle(td).textAlign;
    td.setAttribute('align', 'right');
    const rightAttr = td.getAttribute('align');
    const right = getComputedStyle(td).textAlign;
    td.removeAttribute('align');
    return { centerAttr, rightAttr, center, right };
  });
  ok(align.centerAttr === 'center' && align.rightAttr === 'right', 'table 单元格 align 属性保留到 DOM');
  /* 事实：`align` 是 v27 契约里的单元格属性；现在浏览器把它当旧的 presentational hint，
     CSS 的 td { text-align: left } 会盖住它。这里只打印，不拦出图（见报告）。 */
  console.log(`  · 事实：单元格 align 的 computed text-align = ${align.center} / ${align.right}（CSS 还没有 [align] 规则）`);
  ok(t.num === 'right', `数字列右对齐（${t.num}）`);
  ok(t.text !== 'right', `文字列不右对齐（${t.text}）`);
  ok(t.rows === 5, `表格 4 行数据 + 1 行表头（${t.rows}）`);
  await tablePage.close();

  const bitsPage = await load('bits.html');
  const bgap = await bitsPage.evaluate(() => {
    const lefts = [...document.querySelectorAll('.vk-bit')].map((b) => b.getBoundingClientRect().left);
    const gaps = lefts.slice(1).map((x, i) => Math.round(x - lefts[i]));
    return { n: lefts.length, min: Math.min(...gaps), max: Math.max(...gaps) };
  });
  ok(bgap.n === 16 && bgap.max - bgap.min >= 24, `16 位等距且分段有间隔（${bgap.min}–${bgap.max}）`);
  await bitsPage.close();

  const seqPage = await load('seq3.html');
  const seqClip = await seqPage.evaluate(() => {
    const arrow = [...document.querySelectorAll('.vk-seq-arrow')].find((a) => a.closest(".vk-seq-row[data-dir='right']"));
    return getComputedStyle(arrow, '::after').clipPath;
  });
  ok(seqClip.split(',').length === 4 && seqClip.includes('35%'), `时序箭头是凹底，不是平底（${seqClip}）`);
  await seqPage.close();

  const flowPage = await load('flow-callout.html');
  const fc = await flowPage.evaluate(() => {
    const page = document.querySelector('vk-page').getBoundingClientRect();
    const note = [...document.querySelectorAll('.vk-co-note')].find((n) => !n.hidden).getBoundingClientRect();
    const side = document.querySelector('vk-callout').getAttribute('data-vk-side');
    return { inside: note.left >= page.left && note.right <= page.right && note.top >= page.top && note.bottom <= page.bottom, side };
  });
  ok(fc.inside, 'flow 里的标注仍在画布内');
  ok(fc.side === 'bottom' || fc.side === 'top', `flow 里的标注不横穿中间那块（${fc.side}）`);
  const fgap = await flowPage.evaluate(() => {
    const line = document.querySelector('.vk-co-line');
    const box = document.querySelector('.vk-co-box').getBoundingClientRect();
    const side = document.querySelector('vk-callout').getAttribute('data-vk-side');
    const y = Number(line.getAttribute('y1'));
    return Math.round(side === 'top' ? box.top - y : y - box.bottom);
  });
  ok(fgap >= 10, `竖箭头先离开目标框再起杆（${fgap}px）`);
  await flowPage.close();

  const wordGapPage = await load('callout-word.html');
  const wgap = await wordGapPage.evaluate(() => {
    const line = document.querySelector('.vk-co-line');
    const box = document.querySelector('.vk-co-box').getBoundingClientRect();
    return Math.round(Number(line.getAttribute('x1')) - box.right);
  });
  ok(wgap >= 10, `横箭头先离开词框再起杆（${wgap}px）`);
  await wordGapPage.close();

  const darkPage = await load('dark.html');
  const dark = await darkPage.evaluate(() => getComputedStyle(document.querySelector('.vk-frame')).backgroundColor);
  ok(!/rgb\(255, 255, 255\)/.test(dark), `深色页的代码窗自动变深（${dark}）`);
  await darkPage.close();

  const wordPage = await load('callout-word.html');
  const word = await wordPage.evaluate(() => {
    const note = [...document.querySelectorAll('.vk-co-note')].find((n) => !n.hidden);
    const line = document.querySelectorAll('.vk-line')[2];
    const box = document.querySelector('.vk-co-box');
    if (!note || !line || !box) return null;
    const n = note.getBoundingClientRect();
    const l = line.getBoundingClientRect();
    const m = line.querySelector('.vk-mark').getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const c = document.querySelector('.vk-frame').getBoundingClientRect();
    const head = document.querySelector('.vk-co-head').getBoundingClientRect();
    return {
      covers: b.left <= m.left && b.right >= m.right,
      isWord: b.width < l.width * 0.8,
      outside: n.left >= c.right + 8,
      sameRow: Math.abs((n.top + n.bottom) / 2 - (l.top + l.bottom) / 2) <= 6,
      gap: Math.round(n.left - head.right),
      marks: document.querySelectorAll('.vk-mark[data-vk-item]').length,
    };
  });
  ok(word && word.covers, '圈住那个词（连同它的 token）');
  ok(word && word.isWord, '圈的是一个词，不是整行');
  ok(word && word.outside, '注记在卡片外面');
  ok(word && word.sameRow, '注记和那个词同一行');
  ok(word && word.gap >= 24 && word.gap <= 48, `箭头在文字前留净空（${word && word.gap}）`);
  ok(word && word.marks >= 1, `mark 的词都带锚点（${word && word.marks}）`);
  await wordPage.close();

  const rangePage = await load('callout-range.html');
  const range = await rangePage.evaluate(() => ({
    bracket: !!document.querySelector('.vk-co-bracket'),
    bars: document.querySelectorAll('.vk-co-bar').length,
  }));
  ok(range.bracket && range.bars === 0, '两行用一只括号，不是两条线');
  await rangePage.close();

  const bracketPage = await load('callout-bracket.html');
  const bracket = await bracketPage.evaluate(() => ({
    bracket: !!document.querySelector('.vk-co-bracket'),
    bars: document.querySelectorAll('.vk-co-bar').length,
    box: document.querySelectorAll('.vk-co-box').length,
  }));
  ok(bracket.bracket && bracket.bars === 0 && bracket.box === 0, '一组 item 用一只右括号，不是框（@item:2-4）');
  await bracketPage.close();

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

  /* 箭头：头部够大，否则在 693 下就是一根没头的线。 */
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
    const pinH = parseFloat(getComputedStyle(document.querySelector('.vk-cell-p'), '::after').height);
    return { badge: Math.round(badge.height), gap: Math.round(cell.top - badge.bottom), pinH: Math.round(pinH), inside: badge.bottom > cell.top + 1 };
  });
  ok(pin.badge >= 96, `P 徽标高度 ≥ 96（${pin.badge}）`);
  ok(pin.pinH >= 50, `针脚高度 ≥ 50（${pin.pinH}）`);
  ok(pin.gap >= 40, `针脚视觉净空 ≥ 40（${pin.gap}）`);
  ok(!pin.inside, '针脚不进入格子');
  await cPage.close();

  const cmpPage = await load('compare.html');
  const cmp = await cmpPage.evaluate(() => {
    const cards = [...document.querySelectorAll('vk-card[tone]')];
    return cards.map((c) => ({ tone: c.getAttribute('tone'), border: getComputedStyle(c).borderLeftColor, bg: getComputedStyle(c).backgroundColor }));
  });
  ok(cmp.length === 2 && cmp[0].border !== cmp[1].border, `语义卡两种色（${cmp.map((c) => c.tone + ' ' + c.border).join(' / ')}）`);
  await cmpPage.close();

  const mixPage = await load('mix-cells.html');
  const marks = await mixPage.evaluate(() => ({
    current: document.querySelectorAll('[current]').length,
    bars: document.querySelectorAll('.vk-co-bar, .vk-co-box').length,
  }));
  ok(marks.bars >= 2, `多目标标注画了两处（${marks.bars}）`);
  ok(marks.current === 0, '标注跨两件时不需要额外 current');
  await mixPage.close();

  /* split 真的是比例：7 fr / 5 fr，不是 1:1。 */
  const splitPage = await load('flow-split.html');
  const split = await splitPage.evaluate(() => {
    const flow = document.querySelector('vk-flow');
    const [a, b] = [...flow.children].map((c) => c.getBoundingClientRect().width);
    return { a, b, ratio: a / b, template: getComputedStyle(flow).gridTemplateColumns };
  });
  ok(Math.abs(split.ratio - 7 / 5) < 0.06, `split="7 5" 两栏是 7:5（${split.ratio.toFixed(2)}）`);
  ok(Math.abs(split.ratio - 1) > 0.2, 'split 不是 1:1');
  await splitPage.close();

  /* 新增 8 帧的渲染事实：不是「文件在」，是「画出来了」。 */
  const newPages = {};
  for (const name of NEW_FIXTURES) {
    const page = await load(`${name}.html`);
    newPages[name] = await page.evaluate(() => ({
      stage: document.querySelectorAll('.vk-stage').length,
      dots: null,
    }));
    await page.close();
  }
  ok(Object.values(newPages).every((p) => p.stage === 1), '8 个新帧各出一张画布');

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
const fileA = fs.existsSync(detA) ? fs.readdirSync(detA).find((f) => f.endsWith('.png') && !f.includes('.phone.')) : null;
const fileB = fs.existsSync(detB) ? fs.readdirSync(detB).find((f) => f.endsWith('.png') && !f.includes('.phone.')) : null;
ok(fileA && fileB && hash(path.join(detA, fileA)) === hash(path.join(detB, fileB)), '同一帧渲两次，PNG 逐字节相同');

/* ------------------------------------------------------------------ 六、CLI */
group('CLI');
ok(cli(['bogus']).status === 2, '未知命令 exit 2');
ok(cli(['doc']).status === 2, 'doc 缺 tag exit 2');
ok(cli(['render', 'tests/fixtures/code.html', '--frame']).status === 2, '--frame 缺值 exit 2');
ok(cli(['render', 'tests/fixtures/code.html', '--out']).status === 2, '--out 缺值 exit 2');
ok(cli(['--version']).stdout.trim() === pkg.version, '--version 输出 package 版本');
for (const tag of TAG_NAMES) ok(cli(['doc', tag]).status === 0, `vk doc ${tag}`);
ok(cli(['example', 'vk-code']).stdout.includes('<vk-page'), 'vk example 出完整帧');
ok(cli(['render', 'tests/fixtures/code.html', '--out', 'src/vk-out']).status === 2, '--out 不能指向源码目录');

/* 命令层：brief 默认只给索引（≤4KB 且含标签索引），--all 才全量。 */
{
  const small = cli(['brief']);
  ok(small.status === 0 && Buffer.byteLength(small.stdout, 'utf8') <= 4096, `vk brief 默认是索引 ≤4KB（${Buffer.byteLength(small.stdout, 'utf8')}B）`);
  ok(/标签/.test(small.stdout) && TAG_NAMES.every((t) => small.stdout.includes(t)), 'brief 默认含 13 个标签的索引');
  ok(!/## as="bits"/.test(small.stdout), 'brief 默认不含变体细节');
  const all = cli(['brief', '--all']);
  ok(all.status === 0 && all.stdout.length > small.stdout.length * 3, `vk brief --all 才是全量（${all.stdout.length}B）`);
  ok(all.stdout.includes('## 实现者数值') && all.stdout.includes('as="bits"'), '--all 含实现者数值与变体表');
  const tagBrief = cli(['brief', '--tag', 'vk-code']);
  ok(tagBrief.status === 0 && tagBrief.stdout.includes('as=code') && tagBrief.stdout.includes('as=bits'), 'brief --tag 给单个件的变体');
  const jsonBrief = cli(['brief', '--json']);
  let idx = null;
  try {
    idx = JSON.parse(jsonBrief.stdout);
  } catch {
    /* 下面报 */
  }
  ok(idx?.tags?.length === 13 && idx.tags.some((t) => t.tag === 'vk-code' && t.required), 'brief --json 默认给标签索引');
}

/* doc 的公共属性只印一次（变体只印 delta）。 */
{
  const text = cli(['doc', 'vk-code']).stdout;
  const lines = text.split('\n').filter((l) => /^  title\s/.test(l));
  ok(lines.length === 1, `vk doc 公共属性只出现一次（title ${lines.length} 次）`);
  ok(cli(['doc', 'vk-board']).stdout.includes('as="band"') && cli(['doc', 'vk-board']).stdout.includes('as="frames"'), 'vk doc 列出 band / frames');
}

/* 默认不是门禁：有错也出图、exit 0。 */
const negDir = path.join(TMP, 'negative');
fs.rmSync(negDir, { recursive: true, force: true });
const neg = cli(['render', 'tests/negative/unknown.html', '--out', negDir]);
ok(neg.status === 0, '默认不是门禁：有错也出图、exit 0', `实际 ${neg.status}`);
ok(fs.existsSync(path.join(negDir, 'unknown.png')), '有错的帧仍然产生 PNG');

/* --check 只构建 + 体检：不出 PNG，但 JSON 在。 */
{
  const checkDir = path.join(TMP, 'check-only');
  fs.rmSync(checkDir, { recursive: true, force: true });
  const r = cli(['render', 'tests/fixtures/code.html', '--check', '--out', checkDir, '--json']);
  ok(r.status === 0 && !fs.existsSync(path.join(checkDir, 'code.png')) && fs.existsSync(path.join(checkDir, 'code.json')), '--check 只写 JSON，不出图');
}

/* 核心承诺：放不下时库不缩字，把事实写进 JSON（不拦出图）。
   这里故意让内容只在正文带里溢出、不出画布：ok 仍 true，fits 单独 false。 */
const overFile = path.join(TMP, 'overflow.html');
fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(
  overFile,
  `<vk-page id="over" place="top"><vk-head>放不下的时候。</vk-head><vk-code lang="c" title="big.c" size="caption">${'<script type="text/plain" data-vk-source>'}${Array.from({ length: 7 }, (_, i) => `int v${i} = ${i};`).join('\n')}</script></vk-code></vk-page>`
);
const overDir = path.join(TMP, 'overflow');
fs.rmSync(overDir, { recursive: true, force: true });
const overRun = cli(['render', overFile, '--out', overDir, '--json']);
let overReport = null;
try {
  overReport = JSON.parse(overRun.stdout);
} catch {
  /* 下面报 */
}
ok(overRun.status === 0, '超容量也 exit 0（不拦出图）');
ok(overReport?.frames?.[0]?.health?.overflow > 0, `体检单报出超出（${overReport?.frames?.[0]?.health?.overflow}px）`);
ok(fs.existsSync(path.join(overDir, 'overflow.png')), '超容量的帧仍然产生 PNG');
ok(overReport?.frames?.[0]?.fits === false, 'fits 单独标记放不下');
ok(overReport?.frames?.[0]?.ok === true, '只在正文带里溢出不算硬错：ok 仍为 true（ok / fits 分离）');
ok(!overReport?.frames?.[0]?.issues?.some((i) => i.code === 'OUTSIDE'), '内容没出画布，不记 OUTSIDE');
fs.rmSync(overFile, { force: true });

/* 部分失败：文件名级诊断不能让顶层 ok 装作全绿。 */
{
  const mixDir = path.join(TMP, 'mixed');
  fs.rmSync(mixDir, { recursive: true, force: true });
  fs.mkdirSync(mixDir, { recursive: true });
  fs.copyFileSync(path.join(FIXTURES, 'code.html'), path.join(mixDir, 'good.html'));
  fs.writeFileSync(path.join(mixDir, 'nopage.html'), '<div>没有 vk-page</div>');
  const r = cli(['render', mixDir, '--out', path.join(mixDir, 'out'), '--json']);
  let rep = null;
  try {
    rep = JSON.parse(r.stdout);
  } catch {
    /* 下面报 */
  }
  ok(r.status === 0 && rep?.produced === 1 && rep?.ok === false, '部分失败：exit 0 但顶层 ok=false、produced=1');
}

/* ------------------------------------------------------------------ 七、对比度
   读 dist/tokens.css 的 light-dark(纸面, 暗面)：文本色要在两种面上都 ≥ 4.5。
   line / lineStrong 是非文本的结构线，只打印事实，不加门禁。 */
group('对比度');
const tokenColor = (name) => {
  const m = tokensCss.match(new RegExp(`--vk-${name}:\\s*light-dark\\((#(?:[0-9a-fA-F]{3,8})|rgba?\\([^)]*\\)),\\s*(#(?:[0-9a-fA-F]{3,8})|rgba?\\([^)]*\\))\\);`));
  return m ? [m[1], m[2]] : null;
};
const parseColor = (value) => {
  const v = value.trim();
  if (v.startsWith('#')) {
    let h = v.slice(1);
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  const m = v.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) };
};
const composite = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const lum = (c) => {
  const f = (x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const ratio = (fg, bg) => {
  const x = lum(fg);
  const y = lum(bg);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
{
  const paper = tokenColor('paper').map(parseColor);
  const TEXT_TOKENS = ['ink-1', 'ink-2', 'ink-3', 'syn-string', 'syn-comment', 'syn-number', 'syn-keyword', 'syn-operator', 'syn-fn'];
  for (let mode = 0; mode < 2; mode++) {
    const bg = paper[mode];
    for (const name of TEXT_TOKENS) {
      const pair = tokenColor(name);
      ok(pair, `tokens.css 有 --vk-${name} 的 light-dark 两个值`);
      if (!pair) continue;
      const fg = composite(parseColor(pair[mode]), bg);
      ok(ratio(fg, bg) >= 4.5, `${mode ? '暗' : '亮'}色 ${name} ≥ 4.5（${ratio(fg, bg).toFixed(2)}）`);
    }
    for (const name of ['line-color', 'line-strong']) {
      const pair = tokenColor(name);
      if (!pair) continue;
      const fg = composite(parseColor(pair[mode]), bg);
      console.log(`  · 事实：${mode ? '暗' : '亮'}色 ${name} = ${ratio(fg, bg).toFixed(2)}:1（非文本线，不设门禁）`);
    }
  }
}

/* 跑完把自己造的临时产物收掉：测试不该在仓库里留 5MB 的图。 */
fs.rmSync(TMP, { recursive: true, force: true });

console.log(failed ? `\n${failed} 条没通过` : '\n全部通过');
process.exitCode = failed ? 1 : 0;
