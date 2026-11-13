#!/usr/bin/env node
/**
 * vk —— 单帧画面库 CLI（v24）
 *
 *   vk build                        重建 dist/（tokens / fonts / vk.css / vk.js / audit.js）
 *   vk render <file|dir> [--frame id] [--out DIR] [--json] [--no-preview]
 *   vk check  <file|dir> [--frame id] [--out DIR] [--json]
 *   vk doc    <tag> [--json]        一个件的属性表
 *   vk brief  [--json|--md]         全部契约
 *   vk icons  <query>               搜 Lucide 图标名
 *   vk clean  [--all]               删 .vk-tmp；--all 连 out/ 一起删
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { contract, markdown, docText, VERSION } from '../src/contract.mjs';
import { TAGS, TAG_NAMES } from '../src/schema.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'out');
const TMP = path.join(ROOT, '.vk-tmp');
const DIST = path.join(ROOT, 'dist');
const PAGES = path.join(TMP, 'pages');

const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);
const has = (n) => rest.includes(n);
const val = (n) => {
  const i = rest.indexOf(n);
  return i >= 0 ? rest[i + 1] : null;
};
const VALUE_FLAGS = new Set(['--out', '--frame']);

const FLAGS = {
  render: new Set(['--frame', '--out', '--json', '--no-preview', '--help', '-h']),
  check: new Set(['--frame', '--out', '--json', '--help', '-h']),
  doc: new Set(['--json', '--help', '-h']),
  brief: new Set(['--json', '--md', '--help', '-h']),
  icons: new Set(['--help', '-h']),
  clean: new Set(['--all', '--help', '-h']),
  build: new Set(['--help', '-h']),
};

const usage = `vk ${VERSION} —— 单帧画面库（一帧一张 1920×1080，手机上约 780 宽）

  vk build                         重建 dist/
  vk render <file|dir> [--frame id] [--out DIR] [--json] [--no-preview]
      构建 + 自检 + 出三件：<name>.png / <name>.780.png / <name>.json
  vk check  <file|dir> [--frame id] [--out DIR] [--json]
      只构建 + 自检 + 写 json（不出图）
  vk doc    <tag> [--json]         一个件的属性表
  vk brief  [--json|--md]          全部契约
  vk icons  <query>                搜 Lucide 图标名
  vk clean  [--all]                删 .vk-tmp；--all 连 out/ 一起删
  vk --version | --help

默认只管出图：内容/版式有问题也出图，exit 0；只有一张图都没出来才 exit 1。`;

const die = (msg, code = 2) => {
  console.error(msg);
  process.exit(code);
};

/* 参数校验：每个命令只认自己的 flag；--out/--frame 必须有值。 */
if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log(usage);
  process.exit(0);
}
if (cmd === '--version' || cmd === '-v') {
  console.log(VERSION);
  process.exit(0);
}
if (!FLAGS[cmd]) {
  console.error(`[vk] 不认识的命令 ${cmd}\n`);
  console.log(usage);
  process.exit(2);
}
const allowed = FLAGS[cmd];
const bad = rest.find((a) => a.startsWith('-') && !allowed.has(a));
if (bad) die(`[vk] ${cmd} 不认识的参数 ${bad}；可用：${[...allowed].join(' ')}`);
for (const f of VALUE_FLAGS) {
  if (!rest.includes(f)) continue;
  const v = val(f);
  if (v == null || v.startsWith('-')) die(`[vk] ${f} 需要值`);
}
const inputs = rest.filter((a, i) => !a.startsWith('-') && !(i > 0 && VALUE_FLAGS.has(rest[i - 1])));
const onlyFrame = val('--frame');

if (has('--help') || has('-h')) {
  console.log(usage);
  process.exit(0);
}

/* ---------------------------------------------------------------- 构建产物 */
const runTool = (file, args = []) =>
  execFileSync(process.execPath, [path.join(ROOT, 'tools', file), ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });

function buildLibrary() {
  runTool('gen.mjs');
  runTool('vendor.mjs');
  runTool('bundle.mjs');
}

function ensureLibrary() {
  let ok = true;
  try {
    runTool('gen.mjs', ['--check']);
    runTool('vendor.mjs');
    runTool('bundle.mjs', ['--check']);
  } catch {
    ok = false;
  }
  if (!ok) {
    try {
      buildLibrary();
    } catch (e) {
      throw new Error(`构建 dist/ 失败：${String(e.stderr || e.message || e).trim().split('\n').slice(-4).join(' / ')}`);
    }
  }
}

/* ---------------------------------------------------------------- 构建页 */
async function buildPage(file) {
  const { transformHtml } = await import('../src/build/index.mjs');
  const html = fs.readFileSync(file, 'utf8');
  const abs = path.resolve(file);
  const rel = path.relative(ROOT, abs);
  const out = path.join(PAGES, rel.startsWith('..') ? path.join('_outside', path.basename(abs)) : rel);
  try {
    const res = await transformHtml(html, { file: abs });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, res.html);
    return { file, ok: true, out, diagnostics: res.diagnostics, assets: res.assets };
  } catch (e) {
    return { file, ok: false, diagnostics: e.diagnostics || [{ file: rel, line: 1, code: 'BUILD', message: e.message, fix: '看这一条的上下文' }] };
  }
}

function collect(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return [p];
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else if (abs.endsWith('.html')) out.push(abs);
    }
  };
  walk(p);
  return out;
}

/* ---------------------------------------------------------------- 浏览器 */
async function launch() {
  const { chromium } = await import('playwright');
  const opts = {
    args: [
      '--allow-file-access-from-files',
      '--font-render-hinting=none',
      '--disable-gpu',
      '--disable-lcd-text',
      '--disable-partial-raster',
      '--force-color-profile=srgb',
      '--run-all-compositor-stages-before-draw',
    ],
  };
  let last = null;
  for (const channel of [undefined, 'chrome', 'msedge']) {
    try {
      const browser = await chromium.launch(channel ? { ...opts, channel } : opts);
      return { browser, channel: channel || 'bundled', version: browser.version() };
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`找不到可用浏览器：跑 npx playwright install chromium，或装 Chrome/Edge（${last?.message || ''}）`);
}

/* ---------------------------------------------------------------- 780 */
async function downscale(buf, targetW) {
  const { PNG } = await import('pngjs');
  const src = PNG.sync.read(buf);
  if (src.width <= targetW) return null;
  const targetH = Math.round((src.height * targetW) / src.width);
  const out = new PNG({ width: targetW, height: targetH });
  const sx = src.width / targetW;
  const sy = src.height / targetH;
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      const x0 = Math.floor(x * sx);
      const x1 = Math.min(src.width, Math.ceil((x + 1) * sx));
      const y0 = Math.floor(y * sy);
      const y1 = Math.min(src.height, Math.ceil((y + 1) * sy));
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) << 2;
          r += src.data[i];
          g += src.data[i + 1];
          b += src.data[i + 2];
          a += src.data[i + 3];
          n++;
        }
      }
      const o = (y * targetW + x) << 2;
      out.data[o] = r / n;
      out.data[o + 1] = g / n;
      out.data[o + 2] = b / n;
      out.data[o + 3] = a / n;
    }
  }
  return PNG.sync.write(out);
}

const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join('/');
const outDir = () => path.resolve(process.cwd(), val('--out') || OUT);

/* ---------------------------------------------------------------- 渲染 */
async function renderFiles(files, { shots }) {
  const report = { version: VERSION, ok: false, clean: false, engine: null, diagnostics: [], frames: [] };
  const builtList = [];
  for (const f of files) {
    const built = await buildPage(f);
    if (!built.ok) report.diagnostics.push(...built.diagnostics);
    else {
      report.diagnostics.push(...built.diagnostics);
      builtList.push(built);
    }
  }
  if (!builtList.length) return report;

  const { browser, channel, version } = await launch();
  report.engine = { channel, version };
  try {
    for (const built of builtList) {
      const f = built.file;
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      const errors = [];
      const warns = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
        else if (m.type() === 'warning') warns.push(m.text().replace(/\s*JSHandle@node\s*$/, ''));
      });
      await page.goto(pathToFileURL(built.out).href, { waitUntil: 'load' });
      await page.evaluate(() => window.vk?.ready?.());
      await page.addScriptTag({ path: path.join(DIST, 'audit.js') });

      const frames = await page.evaluate(() =>
        [...document.querySelectorAll('vk-page')].map((p, i) => {
          const r = p.getBoundingClientRect();
          return { id: p.id || '', index: i, x: r.left, y: r.top, w: r.width, h: r.height };
        })
      );
      const picked = onlyFrame ? frames.filter((f2) => f2.id === onlyFrame) : frames;
      if (!frames.length) report.diagnostics.push({ file: rel(f), line: 1, code: 'FRAME', message: '这一页没有 <vk-page>：什么都没画出来', fix: '把内容包进 <vk-page>…</vk-page>' });
      else if (onlyFrame && !picked.length) report.diagnostics.push({ file: rel(f), line: 1, code: 'FRAME', message: `这一页没有 id="${onlyFrame}" 的帧`, fix: `这一页的 id：${frames.map((x) => x.id || '(无 id)').join(' / ')}` });
      for (const err of errors) report.diagnostics.push({ file: rel(f), line: 1, code: 'RUNTIME', message: `运行期错误：${err}`, fix: '这是页面脚本/组件抛的，不是版式问题' });

      const base = path.basename(f, '.html');
      const dir = outDir();
      for (const fr of picked) {
        const name = frames.length > 1 ? `${base}-${fr.id || String(fr.index + 1).padStart(2, '0')}` : base;
        const audit = await page.evaluate((idx) => {
          const stage = document.querySelectorAll('.vk-stage')[idx];
          if (!window.vkAudit) return { issues: [{ code: 'FRAME', message: '页面里没有自检运行时', fix: '重新 vk build' }] };
          return window.vkAudit.page(stage);
        }, fr.index);

        let png = null;
        let png780 = null;
        if (shots) {
          fs.mkdirSync(dir, { recursive: true });
          png = path.join(dir, `${name}.png`);
          const buf = await page.locator('vk-page').nth(fr.index).screenshot();
          fs.writeFileSync(png, buf);
          if (!has('--no-preview')) {
            png780 = path.join(dir, `${name}.780.png`);
            const small = await downscale(buf, 780);
            if (small) fs.writeFileSync(png780, small);
          }
        }

        const data = {
          id: fr.id,
          ok: audit.issues.length === 0,
          issues: audit.issues,
          warns: [...new Set(warns)],
        };
        const jsonPath = path.join(dir, `${name}.json`);
        fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
        fs.writeFileSync(jsonPath, JSON.stringify({ file: rel(f), ...data }, null, 1) + '\n');
        report.frames.push({ file: rel(f), name, png: png ? rel(png) : null, png780: png780 ? rel(png780) : null, json: rel(jsonPath), ...data });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  report.ok = report.frames.length > 0;
  report.clean = report.diagnostics.length === 0 && report.frames.every((f) => f.ok);
  return report;
}

function printReport(report) {
  for (const d of report.diagnostics) console.log(`✗ ${d.file}:${d.line} [${d.code || 'ERROR'}] ${d.message}${d.fix ? ` → ${d.fix}` : ''}`);
  for (const f of report.frames) {
    const tag = f.id ? ` #${f.id}` : '';
    if (f.issues.length) {
      console.log(`✗ ${f.file}${tag}`);
      for (const x of f.issues) console.log(`   · [${x.code}] ${x.message}${x.fix ? ` → ${x.fix}` : ''}`);
    } else {
      console.log(`✓ ${f.file}${tag}${f.png ? `  → ${f.png}${f.png780 ? ` + ${f.png780}` : ''}` : ''}`);
    }
    for (const w of f.warns) console.log(`   提示：${w}`);
  }
  const n = report.diagnostics.length + report.frames.reduce((k, f) => k + f.issues.length, 0);
  console.log(n ? `\n已出图：${report.frames.length} 帧，${n} 条问题（不拦出图）` : `\n干净：${report.frames.length} 帧`);
}

/* ---------------------------------------------------------------- 命令 */
if (cmd === 'build') {
  try {
    buildLibrary();
    console.log('✓ dist/ 已重建');
  } catch (e) {
    die(`[vk] 构建失败：${String(e.stderr || e.message).trim()}`, 3);
  }
  process.exit(0);
}

if (cmd === 'render' || cmd === 'check') {
  if (!inputs.length) die(`用法：vk ${cmd} <file|dir> [--frame id] [--out DIR]`);
  const files = inputs.flatMap((i) => {
    const abs = path.resolve(process.cwd(), i);
    return fs.existsSync(abs) ? collect(abs) : [];
  });
  if (!files.length) die(`[vk] 找不到 ${inputs.join(' ')}`);
  try {
    ensureLibrary();
  } catch (e) {
    die(`[vk] ${e.message}`, 3);
  }
  const report = await renderFiles(files, { shots: cmd === 'render' });
  if (has('--json')) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
  process.exitCode = report.frames.length === 0 ? 1 : 0;
} else if (cmd === 'doc') {
  const tag = inputs[0];
  if (!tag) die('用法：vk doc <tag> [--json]');
  if (!TAGS[tag]) die(`未知标签 ${tag}。可用：${TAG_NAMES.join(', ')}`);
  if (has('--json')) console.log(JSON.stringify(contract().tags[tag], null, 2));
  else console.log(docText(tag));
} else if (cmd === 'brief') {
  if (has('--json')) console.log(JSON.stringify(contract(), null, 2));
  else console.log(markdown());
} else if (cmd === 'icons') {
  const q = (inputs[0] || '').toLowerCase();
  if (!q) die('用法：vk icons <query>');
  const lucide = await import('lucide');
  const names = Object.keys(lucide.icons || {}).map((n) => n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase());
  const hit = names.filter((k) => k.includes(q)).slice(0, 60);
  console.log(hit.length ? hit.join('\n') : `没有匹配 "${q}" 的图标`);
} else if (cmd === 'clean') {
  for (const d of [TMP, ...(has('--all') ? [OUT] : [])]) {
    if (!fs.existsSync(d)) continue;
    fs.rmSync(d, { recursive: true, force: true });
    console.log('删掉 ' + rel(d));
  }
}
