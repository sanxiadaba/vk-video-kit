/**
 * v18 · 测试
 * ----------------------------------------------------------------------------
 * 只测「会静默坏掉」的东西。四组：
 *
 *   一、契约   tokens / 契约文档与源码一致；schema 里没有死属性；每个件都被真帧用过
 *   二、渲染   所有验收帧构建 + 出图 + 自检 0 问题；像素里真有墨迹；与粗签名相比没变形
 *   三、行为   缩字号 / 数字右对齐 / markers / 缩进树截断 / 锚点基数
 *   四、确定   同一页渲两次，PNG 逐字节相同
 *
 * 没写进去的：CSS 选择器长什么样、函数有几个、文件多少行 —— 那些改实现就会红，
 * 和画面质量无关。
 *
 *   npm test              跑全部
 *   npm test -- --update  重写 tests/golden.json（改了默认值之后用）
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const UPDATE = process.argv.includes('--update');
const SHOTS = path.join(ROOT, '.vk-cache', 'shots');
const GOLDEN = path.join(ROOT, 'tests', 'golden.json');

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
  node(['tools/css.mjs', '--check']);
  ok(true, 'tokens 与 vocab 一致');
} catch (e) {
  ok(false, 'tokens 与 vocab 一致', String(e.stdout || e.message).trim());
}
try {
  node(['tools/contract.mjs', '--check']);
  ok(true, '契约文档与 schema 一致');
} catch (e) {
  ok(false, '契约文档与 schema 一致', String(e.stdout || e.message).trim());
}

const { TAG_NAMES, attrsOf } = await import('../src/schema.mjs');

// 死属性：schema 声明了，但运行期/CSS/构建期没有一处读它。
// 白名单只放「结构性」属性：它们由位置规则或 CSS 属性选择器直接消费。
const STRUCTURAL = new Set(['span', 'row-span', 'x', 'y', 'w', 'h', 'z', 'current', 'state', 'tone', 'size', 'gap', 'pad', 'bleed', 'grow', 'id']);
const sources = [
  ...fs.readdirSync(path.join(ROOT, 'src/runtime')).map((f) => path.join(ROOT, 'src/runtime', f)),
  path.join(ROOT, 'src/build.mjs'),
  path.join(ROOT, 'src/contract.mjs'),
  ...fs
    .readdirSync(path.join(ROOT, 'src'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => path.join(ROOT, 'src', f)),
];
const hay = sources.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const dead = [];
for (const tag of TAG_NAMES) {
  for (const name of Object.keys(attrsOf(tag))) {
    if (STRUCTURAL.has(name)) continue;
    if (!hay.includes(`'${name}'`) && !hay.includes(`"${name}"`) && !hay.includes(`[${name}`) && !hay.includes(`${name}=`)) dead.push(`${tag}.${name}`);
  }
}
ok(dead.length === 0, `schema 里没有死属性（${dead.length} 个可疑）`, dead.slice(0, 12).join(', '));

// 每个件都被真帧用过：没人用的件就是没人需要。
const framesHtml = fs
  .readdirSync(path.join(ROOT, 'tests'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8'))
  .join('\n');
const unused = TAG_NAMES.filter((t) => !framesHtml.includes(`<${t}`));
ok(unused.length === 0, '每个件都被验收帧用过', unused.join(', '));

/* ------------------------------------------------------------------ 二、渲染 */
group('渲染');
fs.rmSync(SHOTS, { recursive: true, force: true });
let report = [];
try {
  const out = node(['bin/vk.mjs', 'render', 'tests', '--json', '--out', SHOTS]);
  report = JSON.parse(out.slice(out.indexOf('[')));
} catch (e) {
  const txt = String(e.stdout || '');
  const i = txt.indexOf('[');
  if (i >= 0) report = JSON.parse(txt.slice(i));
  else ok(false, '渲染测试页', String(e.stderr || e.message).slice(0, 800));
}

const frames = report.flatMap((r) => r.frames.map((f) => ({ ...f, file: r.file })));
const errors = report.flatMap((r) => r.errors);
ok(errors.length === 0, '构建 + 运行期没有错误', errors.map((e) => `${e.file}:${e.line} ${e.message}`).slice(0, 6).join('\n      '));
ok(frames.length >= 12, `验收帧数量够（${frames.length}）`);
const dirty = frames.filter((f) => f.issues.length);
ok(dirty.length === 0, '每一帧自检干净', dirty.slice(0, 5).map((f) => `${f.file}#${f.id}: ${f.issues.map((x) => x.message).join('；')}`).join('\n      '));

const focusHeavy = frames.filter((f) => f.metrics && f.metrics.focus > 1);
ok(focusHeavy.length === 0, '每帧最多一个焦点', focusHeavy.map((f) => `${f.file}#${f.id} 焦点 ${f.metrics.focus}`).join(', '));

/* 像素里真有墨迹，而且和 DOM 量出来的位置对得上（抓字体没加载 / 白屏 / 截图早于 layout）。 */
const { PNG } = await import('pngjs');
const inkBox = (file) => {
  const png = PNG.sync.read(fs.readFileSync(file));
  const bg = [png.data[0], png.data[1], png.data[2]];
  let left = 1e9, top = 1e9, right = -1, bottom = -1;
  for (let y = 0; y < png.height; y += 2) {
    for (let x = 0; x < png.width; x += 2) {
      const i = (y * png.width + x) << 2;
      if (Math.abs(png.data[i] - bg[0]) + Math.abs(png.data[i + 1] - bg[1]) + Math.abs(png.data[i + 2] - bg[2]) < 24) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { left, top, right, bottom, w: png.width, h: png.height };
};
const pixelBad = [];
for (const f of frames) {
  if (!f.png) continue;
  const box = inkBox(path.join(ROOT, f.png));
  if (!box) {
    pixelBad.push(`${f.file}#${f.id} 整张是空的`);
    continue;
  }
  const scale = box.w / 1920;
  const dyTop = Math.abs(box.top / scale - f.metrics.contentTop);
  const dyBottom = Math.abs(box.bottom / scale - f.metrics.contentBottom);
  if (dyTop > 60 || dyBottom > 60) {
    pixelBad.push(`${f.file}#${f.id} 墨迹 ${Math.round(box.top / scale)}–${Math.round(box.bottom / scale)}，DOM 量的是 ${f.metrics.contentTop}–${f.metrics.contentBottom}`);
  }
}
ok(pixelBad.length === 0, '像素与 DOM 对得上（没有白屏 / 字体没加载）', pixelBad.slice(0, 5).join('\n      '));

/* 粗签名：只抓「整块消失 / 版面塌了」，不抓字距微调。 */
const sigOf = (f) => `${Math.round(f.metrics.fill / 5) * 5}|${f.metrics.focus}|${f.issues.map((x) => x.code).join(',')}`;
const sigs = Object.fromEntries(frames.map((f) => [`${f.file}#${f.id}`, sigOf(f)]));
const prev = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : null;
if (UPDATE || !prev) {
  fs.writeFileSync(GOLDEN, JSON.stringify(sigs, null, 1) + '\n');
  ok(true, `写入粗签名 tests/golden.json（${Object.keys(sigs).length} 帧）`);
} else {
  const changed = Object.keys(sigs).filter((k) => prev[k] && prev[k] !== sigs[k]);
  const added = Object.keys(sigs).filter((k) => !prev[k]);
  ok(changed.length === 0, '版面与上次一致（粗签名）', changed.map((k) => `${k}: ${prev[k]} → ${sigs[k]}`).slice(0, 8).join('\n      '));
  ok(added.length === 0, '没有新帧未登记', added.slice(0, 8).join(', '));
}

/* ------------------------------------------------------------------ 三、行为 */
group('行为');
const { chromium } = await import('playwright');
const browser = await chromium
  .launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files'] })
  .catch(() => chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files'], channel: 'msedge' }));
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const built = (name) => 'file:///' + path.join(ROOT, '.vk-cache', 'pages', 'tests', name).split(path.sep).join('/');
await page.goto(built('behaviour.html'), { waitUntil: 'load' });
await page.evaluate(() => window.vk.ready());

const behave = await page.evaluate(() => {
  const q = (sel) => document.querySelector(sel);
  const out = {};
  // 1. 长行会缩字号，但不是无限缩
  const c = q('#shrink');
  const row = c?.querySelector('.vk-line');
  out.shrink = row ? parseFloat(getComputedStyle(row).fontSize) : 0;
  // 2. 数字列右对齐，文字列不动
  const t = q('#numtable');
  out.numAlign = t ? getComputedStyle(t.querySelector('td.num') || t).textAlign : '';
  out.textAlign = t ? getComputedStyle([...t.querySelectorAll('td')].find((td) => !td.classList.contains('num')) || t).textAlign : '';
  // 3. markers 画出来了
  out.markers = q('#marks') ? q('#marks').querySelectorAll('.vk-cell-m').length : -1;
  // 4. 锚点 1 起：#buf@byte:1 是第一个字节
  out.byte1 = !!q('#buf')?.querySelector('i[data-vk-byte="1"]');
  // 5. 文件树超行数会留一行说明
  out.treeMore = !!q('#bigtree')?.querySelector('.is-more');
  // 6. 深色页里的纸面窗保持深色字
  const win = q('#darkpaper .vk-win');
  out.darkPaper = win ? getComputedStyle(win).color : '';
  return out;
});
ok(behave.shrink > 43 && behave.shrink < 56, `长代码行会缩字号（${behave.shrink}px）`);
ok(behave.numAlign === 'right', `数字列右对齐（${behave.numAlign}）`);
ok(behave.textAlign !== 'right', `文字列不右对齐（${behave.textAlign}）`);
ok(behave.markers === 2, `markers 画出来了（${behave.markers} 个）`);
ok(behave.byte1, '@byte 是 1 起');
ok(behave.treeMore, '文件树超行数留了说明行');
ok(/rgb\(11, 15, 20\)|rgb\(17, 21, 28\)/.test(behave.darkPaper), `深色页里的浅底窗仍是深字（${behave.darkPaper}）`);

/* ------------------------------------------------------------------ 四、确定 */
group('确定');
const hashOf = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const one = frames[0];
const before = hashOf(path.join(ROOT, one.png));
try { node(['bin/vk.mjs', 'render', 'tests/behaviour.html', '--json', '--out', SHOTS]); } catch {}
const after = hashOf(path.join(ROOT, one.png));
ok(before === after, '同一页渲两次，PNG 逐字节相同');

await browser.close();

console.log(failed ? `\n${failed} 条没通过` : '\n全部通过');
process.exitCode = failed ? 1 : 0;



