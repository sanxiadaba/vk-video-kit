/**
 * vk showcase —— 把 tests/fixtures 渲成一个可以托管的静态看板。
 *
 *   node tools/showcase.mjs [--out .showcase]
 *
 * 输出：
 *   <out>/index.html          一页：7 组、37 帧、点开看 1920 原图
 *   <out>/frames/*.png        每帧 1920 + 693 两张，外加体检单 json 与联系表
 *   <out>/.nojekyll           GitHub Pages 不跑 Jekyll
 *
 * 规矩：
 *   - 这里没有前端框架、没有网络请求；HTML 是拼出来的字符串。
 *   - 少一帧、多一帧都会报错：新增 fixture 必须在这张表里补一句“它演示什么”。
 *   - 体检单 fits=false 只标红，不阻断部署（库的原则：放不下是事实，不是门禁）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const OUT = path.resolve(ROOT, outArg >= 0 ? args[outArg + 1] : '.showcase');
const SRC = path.join(ROOT, 'tests', 'fixtures');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/** 8 组 41 帧：顺序就是看板顺序；每帧一句“它演示什么”。 */
const GROUPS = [
  ['layout', '版式', [
    ['cover', '封面：一帧只讲一件事'],
    ['text', '四种行内强调，其余是附注'],
    ['list', '三步寻址，只有最后一步读内存'],
    ['compare', '错与对，两张卡对照'],
    ['flow', '左代码右说明的 7:5 分栏'],
    ['steps', '编译四步，当前步高亮'],
  ]],
  ['media', '主题与图', [
    ['dark', '深色页：焦点蓝与语法色都还在'],
    ['nest', '明暗面嵌套，颜色自动反转'],
    ['card-img', '图放进卡片，四周留白'],
    ['img-bleed', '整帧底图，字压在图上'],
    ['overlay', '图与图注同格'],
  ]],
  ['code', '代码', [
    ['code', 'C 代码：语法色 + 当前行'],
    ['code-fold', '折掉中间三行，只留首尾'],
    ['code-term', '终端：命令与输出'],
    ['code-diff', '同一段代码，改一个方向'],
    ['code-asm', '汇编：地址、机器码、指令'],
  ]],
  ['data', '数据', [
    ['bytes', '十二个字节的十六进制与 ASCII'],
    ['bits', 'float16 的三段位域'],
    ['cells', '内存格 + 指针 p'],
    ['table', '四层存储：越往下越慢越大'],
    ['bars', '谁最花时间'],
    ['timeline', '编码五十年'],
  ]],
  ['diagram', '图示', [
    ['graph-row', '链表插入：改两个指针'],
    ['graph-vertical', '竖着走的一条链'],
    ['graph-tree', '递归树，三层'],
    ['graph-mesh', '死锁：你等我，我等你'],
    ['graph-layered', 'git 的分叉与合并'],
    ['dir', '一个目录，三层文件'],
  ]],
  ['seq', '时序', [
    ['seq2', '三次握手'],
    ['seq3', '缓存未命中，回源站'],
    ['seq4', '握手之后再发一次请求'],
  ]],
  ['mark', '标注与公式', [
    ['callout', '行级注记：划一道，旁边说一句'],
    ['callout-arrow', '从一行代码，指到一句话'],
    ['callout-range', '两行用一只括号'],
    ['callout-word', '指着一个词说一句'],
    ['callout-measure', '量两个格子之间的距离'],
    ['math', '居中公式'],
  ]],
  ['mix', '组合', [
    ['mix-cells', '代码 + 内存：一行改一格，标注跨两件'],
    ['mix-asm', 'O0 / O2 汇编对照'],
    ['flow-callout', '标注写在 flow 里也不会飞出画布'],
    ['table-tone', '表格单元格语义色与当前格'],
  ]],
];

const fixtures = fs.readdirSync(SRC).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).sort();
const listed = GROUPS.flatMap(([, , items]) => items.map(([name]) => name));
const missing = listed.filter((n) => !fixtures.includes(n));
const extra = fixtures.filter((n) => !listed.includes(n));
if (missing.length || extra.length) {
  console.error(`✗ 看板表与 tests/fixtures 对不上`);
  if (missing.length) console.error(`  少了：${missing.join(', ')}`);
  if (extra.length) console.error(`  多了：${extra.join(', ')}（在 tools/showcase.mjs 的 GROUPS 里补一句说明）`);
  process.exit(2);
}

const framesDir = path.join(OUT, 'frames');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

console.log(`showcase: 渲染 ${fixtures.length} 帧 → ${path.relative(ROOT, framesDir)}`);
const run = spawnSync(process.execPath, ['bin/vk.mjs', 'render', 'tests/fixtures', '--out', framesDir, '--sheet'], { cwd: ROOT, stdio: 'inherit' });
if (run.status !== 0) {
  console.error('✗ 渲染失败：看上面的输出');
  process.exit(1);
}

const health = (name) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(framesDir, `${name}.json`), 'utf8'));
  } catch {
    return null;
  }
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const sections = GROUPS.map(([id, title, items]) => {
  const cards = items
    .map(([name, desc]) => {
      const h = health(name);
      const bad = h && (h.ok === false || h.fits === false);
      const over = h?.health?.overflow || 0;
      const issues = h?.issues?.length || 0;
      return `<a class="card${bad ? ' bad' : ''}" href="frames/${name}.png" target="_blank" rel="noopener">
  <img src="frames/${name}.phone.png" width="693" height="390" loading="lazy" decoding="async" alt="${esc(name)}：${esc(desc)}">
  <span class="cap"><b>${esc(name)}</b><em>${esc(desc)}</em><i>${issues ? `${issues} 个问题` : over ? `超出 ${over}px` : '1920'}</i></span>
</a>`;
    })
    .join('\n');
  return `<section id="${id}">
  <h2>${esc(title)} <small>${items.length} 帧</small></h2>
  <div class="grid">
${cards}
  </div>
</section>`;
}).join('\n');

const nav = GROUPS.map(([id, title, items]) => `<a href="#${id}">${esc(title)} ${items.length}</a>`).join('');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>vk · ${fixtures.length} 帧</title>
<meta name="description" content="13 个 HTML 标签，写 1920×1080 的编程科普视频帧；这里是全部 ${fixtures.length} 个示例。">
<style>
  :root { color-scheme: light; --ink1: #111418; --ink2: #3f4652; --ink3: #5b6472; --paper: #fff; --soft: #f6f7f8; --line: rgba(17,20,24,.16); --focus: #1d4ed8; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--soft); color: var(--ink1); font: 16px/1.5 "Inter", "Noto Sans SC", system-ui, sans-serif; }
  header { position: sticky; top: 0; z-index: 2; background: color-mix(in srgb, var(--paper) 92%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
  .bar { max-width: 1680px; margin: auto; padding: 14px 24px; display: flex; gap: 16px; align-items: baseline; flex-wrap: wrap; }
  .bar h1 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
  .bar p { margin: 0; color: var(--ink2); font-size: 14px; }
  .bar a.sheet { margin-left: auto; color: var(--focus); text-decoration: none; font-size: 14px; }
  nav { max-width: 1680px; margin: auto; padding: 0 24px 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  nav a { font-size: 13px; color: var(--ink2); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; background: var(--paper); }
  nav a:hover { border-color: var(--focus); color: var(--focus); }
  main { max-width: 1680px; margin: auto; padding: 24px; }
  section { margin: 0 0 40px; }
  h2 { font-size: 15px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink3); margin: 0 0 14px; font-weight: 600; }
  h2 small { font-weight: 400; letter-spacing: 0; text-transform: none; margin-left: 6px; }
  .grid { display: grid; gap: 20px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @media (max-width: 1199px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 719px) { .grid { grid-template-columns: 1fr; } main { padding: 16px; } }
  .card { display: block; background: var(--paper); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; color: inherit; text-decoration: none; }
  .card:hover { border-color: var(--focus); }
  .card img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: top; background: var(--paper); }
  .cap { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: baseline; padding: 10px 12px; border-top: 1px solid var(--line); font-size: 13px; }
  .cap b { font-family: "JetBrains Mono", monospace; font-weight: 600; }
  .cap em { color: var(--ink2); font-style: normal; }
  .cap i { color: var(--ink3); font-style: normal; font-size: 12px; }
  .card.bad { outline: 2px solid #b3261e; }
  .card.bad .cap i { color: #b3261e; }
  footer { max-width: 1680px; margin: auto; padding: 0 24px 48px; color: var(--ink3); font-size: 13px; }
  footer code { font-family: "JetBrains Mono", monospace; }
</style>
</head>
<body>
<header>
  <div class="bar">
    <h1>vk · ${fixtures.length} 帧</h1>
    <p>13 个标签 · 1920×1080 · 手机 693 · v${esc(PKG.version)}</p>
    <a class="sheet" href="frames/sheet.png" target="_blank" rel="noopener">整集联系表 →</a>
  </div>
  <nav>${nav}</nav>
</header>
<main>
${sections}
</main>
<footer>
  生成物：<code>node tools/showcase.mjs</code>（截图来自 <code>tests/fixtures</code>，点任意一帧看 1920 原图）。
</footer>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`✓ ${path.relative(ROOT, OUT)}/index.html（${fixtures.length} 帧，${GROUPS.length} 组）`);
