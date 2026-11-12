/**
 * v19 · 测试
 * ----------------------------------------------------------------------------
 * 只测「会静默坏掉」的东西。五组：
 *
 *   一、契约   tokens 与 vocab 一致；契约里的 tag / 容量 / where 都在
 *   二、负例   每种写错都给出稳定的错误码（不是只给一句中文）
 *   三、渲染   22 帧全部构建 + 自检干净；三件产物都在；780 真的是 780
 *   四、行为   缩字号 / 数字列 / 关系图连线 / 圈选 / 深色页纸面窗
 *   五、确定   同一帧渲两次，PNG 逐字节相同（不信缓存，因为已经不做渲染缓存）
 *
 *   npm test              跑全部
 *   npm test -- --update  重写 tests/geometry.json（改了默认值之后用）
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const UPDATE = process.argv.includes('--update');
const OUT = path.join(ROOT, '.vk-cache', 'test-out');
const GEO = path.join(ROOT, 'tests', 'geometry.json');

let failed = 0;
const ok = (cond, msg, detail = '') => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failed++;
    console.log(`  ✗ ${msg}${detail ? `\n      ${detail}` : ''}`);
  }
};
const group = (name) => console.log(`\n${name}`);
const node = (args) => execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/* ------------------------------------------------------------------ 一、契约 */
group('契约');
try {
  node(['tools/gen.mjs', '--check']);
  ok(true, 'tokens 与 vocab 一致');
} catch (e) {
  ok(false, 'tokens 与 vocab 一致', String(e.stdout || e.message).trim());
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const { TAG_NAMES } = await import('../src/schema.mjs');
const { contract } = await import('../src/contract.mjs');
const brief = contract();
ok(brief.version === pkg.version, `契约版本来自 package.json（${brief.version}）`);
ok(TAG_NAMES.length === 20, `20 个标签（${TAG_NAMES.length}）`);
ok(Object.keys(brief.tags).length === TAG_NAMES.length, '契约覆盖每个标签');
ok(brief.tags['vk-code'].capacity.max === 6 && brief.tags['vk-code'].capacity.by.term === 6, '容量只有一个来源（code 6 / term 6）');
ok(!('capacity' in brief) || !brief.capacity, '契约顶层不再有一份 total 容量');
ok(brief.anchorParts.join(',') === 'line,item,bit,side', '锚点四种部件');
ok(brief.tags['vk-code'].example && brief.tags['vk-graph'].example, '难写的件带可抄示例');
ok(brief.skeleton.includes('<vk-page'), '契约带一帧骨架');
for (const tag of TAG_NAMES) {
  if (!brief.tags[tag].summary) ok(false, `${tag} 有 summary`);
}
ok(true, '每个标签都有 summary');

/* ------------------------------------------------------------------ 二、负例 */
group('负例');
const { transformHtml } = await import('../src/build.mjs');
const CASES = {
  'unknown-tag.html': 'UNKNOWN_TAG',
  'unknown-attr.html': 'UNKNOWN_ATTR',
  'bad-enum.html': 'VALUE_ENUM',
  'bad-space.html': 'VALUE_SPACE',
  'span-outside.html': 'ATTR_PLACEMENT',
  'span-wide.html': 'SPAN_TOO_WIDE',
  'dup-id.html': 'ID_DUPLICATE',
  'missing-src.html': 'SRC_MISSING',
  'bad-anchor.html': 'ANCHOR_MISSING',
  'missing-for.html': 'ATTR_REQUIRED',
  'bad-anchor-part.html': 'VALUE_SELECTOR',
  'current-range.html': 'CURRENT_RANGE',
  'graph-edge.html': 'GRAPH_REF',
};
for (const [file, code] of Object.entries(CASES)) {
  const abs = path.join(ROOT, 'tests', 'bad', file);
  try {
    await transformHtml(fs.readFileSync(abs, 'utf8'), { file: abs });
    ok(false, `${file} 应该报 ${code}`, '构建通过了');
  } catch (e) {
    const codes = (e.diagnostics || []).map((d) => d.code);
    ok(codes.includes(code), `${file} → ${code}`, `实际：${codes.join(', ') || e.message}`);
  }
}
const badCli = spawnSync(process.execPath, ['bin/vk.mjs', 'bogus'], { cwd: ROOT, encoding: 'utf8' });
ok(badCli.status === 2, `未知命令 exit 2（实际 ${badCli.status}）`);

/* 内联字节：没有 src 也要能画（草稿阶段不该被文件系统卡住）。 */
const inlineBytes = await transformHtml(
  '<vk-page><vk-bytes><script type="text/plain" data-vk-source>68 65 6c 6c 6f</script></vk-bytes></vk-page>',
  { file: path.join(ROOT, 'tests', 'inline.html') }
);
ok(inlineBytes.html.includes('68') && inlineBytes.html.includes('65'), 'vk-bytes 可以内联十六进制');

/* 默认值必须落进 DOM：CSS 不再自带第二份默认值（band 曾经就死在这里）。 */
const defaults = await transformHtml('<vk-page><vk-head>标题</vk-head><vk-text>正文</vk-text></vk-page>', { file: path.join(ROOT, 'tests', 'defaults.html') });
ok(/align="band"/.test(defaults.html) && /size="headline"/.test(defaults.html), '默认值落地到 DOM');

/* ------------------------------------------------------------------ 三、渲染 */
group('渲染');
let report = null;
try {
  const out = node(['bin/vk.mjs', 'render', 'tests/frames.html', '--json', '--out', OUT]);
  report = JSON.parse(out.slice(out.indexOf('{')));
} catch (e) {
  const txt = String(e.stdout || '');
  const i = txt.indexOf('{');
  if (i >= 0) report = JSON.parse(txt.slice(i));
  ok(false, '渲染验收帧', String(e.stderr || e.message).slice(0, 600));
}
if (report) {
  ok(report.ok, '23 帧全部干净', report.diagnostics.map((d) => d.message).join('；'));
  ok(report.frames.length === 23, `23 帧（${report.frames.length}）`);
  const bad = report.frames.filter((f) => !f.png || !f.png780 || !f.json);
  ok(bad.length === 0, '每帧三件产物都在', bad.map((f) => f.name).join(', '));
  const sizes = report.frames.map((f) => {
    const a = PNG.sync.read(fs.readFileSync(path.join(ROOT, '.vk-cache', 'test-out', f.png.split('/').pop()))).width;
    const b = PNG.sync.read(fs.readFileSync(path.join(ROOT, '.vk-cache', 'test-out', f.png780.split('/').pop()))).width;
    return [a, b];
  });
  ok(sizes.every(([a]) => a === 1920), '1920 出图');
  ok(sizes.every(([, b]) => b === 780), '780 出图');

  /* 组件集合快照：抓「整块消失 / 换了件」，不锁像素位置。 */
  const geo = Object.fromEntries(
    report.frames.map((f) => [f.id || f.name, { tags: [...new Set(f.elements.map((e) => e.tag))].sort().join(',') }])
  );
  if (UPDATE || !fs.existsSync(GEO)) {
    fs.writeFileSync(GEO, JSON.stringify(geo, null, 1) + '\n');
    ok(true, `写入组件快照 tests/geometry.json（${Object.keys(geo).length} 帧）`);
  } else {
    const prev = JSON.parse(fs.readFileSync(GEO, 'utf8'));
    const keys = new Set([...Object.keys(prev), ...Object.keys(geo)]);
    const diffs = [];
    for (const k of keys) {
      const a = prev[k];
      const b = geo[k];
      if (!a || !b) diffs.push(`${k} ${a ? '消失' : '新增'}`);
      else if (a.tags !== b.tags) diffs.push(`${k} 组件集合变了`);
    }
    ok(diffs.length === 0, '每帧的组件集合与快照一致', diffs.slice(0, 8).join('\n      '));
  }
  const overflow = report.frames.filter((f) => f.metrics && f.metrics.bodyBottom > 1080);
  ok(overflow.length === 0, '正文没有超出画布', overflow.map((f) => f.name).join(', '));
}
const miss = spawnSync(process.execPath, ['bin/vk.mjs', 'check', 'tests/frames.html', '--frame', 'no-such-frame'], { cwd: ROOT, encoding: 'utf8' });
ok(miss.status === 1 && /FRAME/.test(miss.stdout + miss.stderr), '--frame 指到不存在的 id 必须失败', `exit ${miss.status}`);

/* ------------------------------------------------------------------ 四、行为 */
group('行为');
try {
  node(['bin/vk.mjs', 'check', 'tests/behaviour.html', '--json', '--out', OUT]);
} catch {
  /* 行为页里有意放了一行超长代码，自检可能不干净；只看运行期行为 */
}
const { chromium } = await import('playwright');
const launchOpts = {
  args: ['--allow-file-access-from-files', '--font-render-hinting=none', '--disable-gpu', '--disable-lcd-text', '--disable-partial-raster', '--force-color-profile=srgb', '--run-all-compositor-stages-before-draw'],
};
const browser = await chromium
  .launch(launchOpts)
  .catch(() => chromium.launch({ ...launchOpts, channel: 'chrome' }))
  .catch(() => chromium.launch({ ...launchOpts, channel: 'msedge' }));
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('file:///' + path.join(ROOT, '.vk-cache', 'pages', 'tests', 'behaviour.html').split(path.sep).join('/'), { waitUntil: 'load' });
await page.evaluate(() => window.vk.ready());
const behave = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const row = q('#shrink .vk-line');
  const t = q('#numtable table');
  const graph = q('vk-graph');
  const paper = q('#paperwin');
  return {
    shrink: row ? parseFloat(getComputedStyle(row).fontSize) : 0,
    numAlign: t ? getComputedStyle(t.querySelector('td.num') || t).textAlign : '',
    textAlign: t ? getComputedStyle([...t.querySelectorAll('td')].find((td) => !td.classList.contains('num')) || t).textAlign : '',
    edges: graph ? graph.querySelectorAll('.vk-edge').length : 0,
    ring: !!q('#ring .vk-co-ring'),
    paperColor: paper ? getComputedStyle(paper.querySelector('.vk-lines')).color : '',
    inlineMono: /Mono/i.test(getComputedStyle(q('#inline code')).fontFamily),
    icon: !!q('#icon .vk-ic svg'),
    currentRow: getComputedStyle(q('#numtable tr[state="current"] td')).backgroundColor,
  };
});
ok(behave.shrink >= 44 && behave.shrink < 56, `长行会缩字号（${behave.shrink}px）`);
ok(behave.numAlign === 'right', `数字列右对齐（${behave.numAlign}）`);
ok(behave.textAlign !== 'right', `文字列不右对齐（${behave.textAlign}）`);
ok(behave.edges === 2, `两个节点三条边 → 2 条连线（${behave.edges}）`);
ok(behave.ring, '圈选画出来了');
ok(/rgb\(11, 15, 20\)/.test(behave.paperColor), `深色页里的纸面窗仍是深字（${behave.paperColor}）`);
ok(behave.inlineMono, '行内代码是等宽字体');
ok(behave.icon, '文字的行首图标插进去了');
ok(/rgba?\(223, 228, 249|rgb\(223, 228, 249\)/.test(behave.currentRow), `当前行有淡底（${behave.currentRow}）`);
await browser.close();

/* ------------------------------------------------------------------ 五、确定 */
group('确定');
const a = path.join(ROOT, '.vk-cache', 'det-a');
const b = path.join(ROOT, '.vk-cache', 'det-b');
node(['bin/vk.mjs', 'render', 'tests/frames.html', '--frame', 'cover', '--out', a]);
node(['bin/vk.mjs', 'render', 'tests/frames.html', '--frame', 'cover', '--out', b]);
const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const nameA = fs.readdirSync(a).find((f) => f.endsWith('.png') && !f.includes('.780.'));
const nameB = fs.readdirSync(b).find((f) => f.endsWith('.png') && !f.includes('.780.'));
ok(nameA && nameB && hash(path.join(a, nameA)) === hash(path.join(b, nameB)), '同一帧渲两次，PNG 逐字节相同');

console.log(failed ? `\n${failed} 条没通过` : '\n全部通过');
process.exitCode = failed ? 1 : 0;

