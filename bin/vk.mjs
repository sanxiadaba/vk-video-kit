#!/usr/bin/env node
/**
 * vk —— 单帧画面库的 CLI。
 *
 *   vk render <file|dir> [--frame id] [--out DIR] [--json]
 *       构建 + 自检 + 出图：每帧三件（1920 PNG、780 PNG、frame.json）
 *   vk check <file|dir> [--frame id] [--out DIR] [--json]
 *       只构建 + 自检 + frame.json，不出 PNG
 *   vk doc <tag> [--json]      一个件的属性表
 *   vk brief [--json|--md]     全部契约
 *   vk icons <query>           搜 Lucide 图标名
 *   vk clean                   删 out/ 与 .vk-cache/
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { TAGS, TAG_NAMES, attrsOf } from '../src/schema.mjs';
import { contract, markdown, VERSION } from '../src/contract.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'out');
const PAGES = path.join(ROOT, '.vk-cache', 'pages');

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => args.includes(n);
const val = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const VALUE_FLAGS = new Set(['--out', '--frame']);
const KNOWN = new Set([...VALUE_FLAGS, '--json', '--md', '--advise', '--help', '-h', '--version', '-v']);
const bad = args.slice(1).find((a) => a.startsWith('-') && !KNOWN.has(a));
if (bad) {
  console.error(`[vk] 不认识的参数 ${bad}；可用：${[...KNOWN].join(' ')}`);
  process.exit(2);
}
const inputs = args.slice(1).filter((a, i, arr) => !a.startsWith('-') && !VALUE_FLAGS.has(arr[i - 1]));
const json = flag('--json');
const onlyFrame = val('--frame');
const outDir = () => path.resolve(process.cwd(), val('--out') || OUT);

/* ---------------------------------------------------------------- 库 */
const run = (file) => execFileSync(process.execPath, [path.join(ROOT, 'tools', file)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });

function ensureLibrary() {
  run('gen.mjs');
  run('vendor.mjs');
  run('bundle.mjs');
}

/* ---------------------------------------------------------------- 构建页 */
async function buildPage(file) {
  const { transformHtml } = await import('../src/build.mjs');
  const html = fs.readFileSync(file, 'utf8');
  const abs = path.resolve(file);
  const rel = path.relative(ROOT, abs);
  const out = path.join(PAGES, rel.startsWith('..') ? path.join('_outside', path.basename(abs)) : rel);
  try {
    const res = await transformHtml(html, { file: abs });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, res.html);
    return { file, ok: true, out, assets: res.assets };
  } catch (e) {
    return { file, ok: false, diagnostics: e.diagnostics || [{ file: rel, line: 1, message: e.message }] };
  }
}

function collect(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return [p];
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith('.')) continue;
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
  // 固定的栅格化参数：关 GPU、关 LCD 次像素、固定色彩配置。
  // 这不是性能优化，是让同一帧两次出图像素一致（视频也会压掉次像素彩边）。
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
  for (const channel of [undefined, 'chrome', 'msedge']) {
    try {
      const browser = await chromium.launch(channel ? { ...opts, channel } : opts);
      return { browser, channel: channel || 'bundled' };
    } catch {
      /* 下一个 */
    }
  }
  throw new Error('找不到可用浏览器：跑 npx playwright install chromium，或装 Chrome/Edge');
}

/** 把一张 PNG 等比缩到 targetW（盒式滤波）：按手机尺度看整帧。 */
async function downscale(file, targetW) {
  const { PNG } = await import('pngjs');
  const src = PNG.sync.read(fs.readFileSync(file));
  if (src.width <= targetW) return;
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
  fs.writeFileSync(file, PNG.sync.write(out));
}

const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join('/');

/* ---------------------------------------------------------------- 渲染 */
async function renderFiles(files, { shots }) {
  const report = { version: VERSION, ok: true, engine: null, diagnostics: [], frames: [] };
  const builtList = [];
  for (const f of files) {
    const built = await buildPage(f);
    if (!built.ok) report.diagnostics.push(...built.diagnostics);
    else builtList.push(built);
  }
  if (!builtList.length) {
    report.ok = false;
    return report;
  }
  const browserInfo = await launch();
  report.engine = browserInfo.channel;
  const browser = browserInfo.browser;
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

      const frames = await page.evaluate(() =>
        [...document.querySelectorAll('vk-page')].map((p, i) => {
          const r = p.getBoundingClientRect();
          return { id: p.id || '', index: i, x: r.left, y: r.top, w: r.width, h: r.height };
        })
      );
      const picked = onlyFrame ? frames.filter((f) => f.id === onlyFrame) : frames;
      if (!frames.length) report.diagnostics.push({ file: rel(f), line: 1, code: 'FRAME', message: '这一页没有 <vk-page>：什么都没画出来', fix: '把内容包进 <vk-page>…</vk-page>' });
      else if (onlyFrame && !picked.length) report.diagnostics.push({ file: rel(f), line: 1, code: 'FRAME', message: `这一页没有 id="${onlyFrame}" 的帧`, fix: `这一页的 id：${frames.map((x) => x.id || '(无 id)').join(' / ')}` });
      for (const err of errors) report.diagnostics.push({ file: rel(f), line: 1, code: 'RUNTIME', message: `运行期错误：${err}`, fix: '这是页面脚本/组件抛的，不是版式问题' });

      const base = path.basename(f, '.html');
      const dir = outDir();
      for (const fr of picked) {
        const name = frames.length > 1 ? `${base}-${fr.id || String(fr.index + 1).padStart(2, '0')}` : base;
        const audit = await page.evaluate((idx) => {
          const stage = document.querySelectorAll('.vk-stage')[idx];
          if (!window.vk?.auditPage) return { issues: [{ code: 'frame', message: '页面里没有 vk 运行时', fix: '整页 HTML 要引 dist/vk.js' }], metrics: null, elements: [], overlaps: [], contrast: [] };
          return window.vk.auditPage(stage);
        }, fr.index);
        let png = null;
        let png780 = null;
        if (shots) {
          fs.mkdirSync(dir, { recursive: true });
          png = path.join(dir, `${name}.png`);
          png780 = path.join(dir, `${name}.780.png`);
          await page.screenshot({ path: png, fullPage: true, clip: { x: fr.x, y: fr.y, width: fr.w, height: fr.h } });
          fs.copyFileSync(png, png780);
          await downscale(png780, 780);
        }
        const data = {
          id: fr.id,
          ok: audit.issues.length === 0,
          metrics: audit.metrics,
          issues: audit.issues,
          elements: audit.elements,
          overlaps: audit.overlaps,
          contrast: audit.contrast,
          small: audit.small || [],
          counts: audit.counts || {},
          advice: audit.advice || [],
          warns: [...new Set(warns)],
        };
        fs.mkdirSync(shots ? dir : path.join(dir), { recursive: true });
        const jsonPath = path.join(dir, `${name}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify({ file: rel(f), ...data }, null, 1) + '\n');
        report.frames.push({ file: rel(f), name, png: png ? rel(png) : null, png780: png780 ? rel(png780) : null, json: rel(jsonPath), ...data });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  report.ok = report.diagnostics.length === 0 && report.frames.every((f) => f.ok);
  return report;
}

function printReport(report, advise = false) {
  for (const d of report.diagnostics) console.log(`✗ ${d.file}:${d.line} [${d.code || 'ERROR'}] ${d.message}${d.fix ? ` → ${d.fix}` : ''}`);
  for (const f of report.frames) {
    const tag = f.id ? ` #${f.id}` : '';
    if (f.issues.length) {
      console.log(`✗ ${f.file}${tag}`);
      for (const x of f.issues) console.log(`   · [${x.code}] ${x.message}${x.fix ? ` → ${x.fix}` : ''}`);
    } else {
      console.log(`✓ ${f.file}${tag}${f.png ? `  → ${f.png}${f.png780 ? ` + ${f.png780}` : ''}` : ''}`);
    }
    if (f.metrics) {
      console.log(`   正文 y ${f.metrics.bodyTop}–${f.metrics.bodyBottom}（占正文区 ${f.metrics.fill}%）· 焦点 ${f.metrics.focus}${f.overlaps.length ? ` · 重叠 ${f.overlaps.length}` : ''}`);
    }
    if (advise && f.advice?.length) for (const a of f.advice) console.log(`   · ${a}`);
    for (const w of f.warns) console.log(`   提示：${w}`);
  }
  const n = report.diagnostics.length + report.frames.reduce((k, f) => k + f.issues.length, 0);
  console.log(n ? `\n${n} 条问题` : `\n干净：${report.frames.length} 帧`);
}

/* ---------------------------------------------------------------- 命令 */
const USAGE = `vk ${VERSION} —— 单帧画面库（一帧一张 1920×1080，手机上约 780 宽）

  vk render <file|dir> [--frame id] [--out DIR] [--json]
      构建 + 自检 + 出三件：<name>.png / <name>.780.png / <name>.json
  vk check  <file|dir> [--frame id] [--out DIR] [--json]
      只构建 + 自检 + 写 json（不出图）
  vk doc    <tag> [--json]     一个件的属性表
  vk brief  [--json|--md]      全部契约
  vk icons  <query>            搜 Lucide 图标名
  vk clean                     删 out/ 与 .vk-cache/
  vk --version | --help
`;

if (cmd === '--help' || cmd === '-h' || cmd === undefined) {
  console.log(USAGE);
} else if (cmd === '--version' || cmd === '-v') {
  console.log(VERSION);
} else if (cmd === 'render' || cmd === 'check') {
  if (!inputs.length) {
    console.error(`用法：vk ${cmd} <file|dir> [--frame id] [--out DIR] [--json]`);
    process.exit(2);
  }
  const files = inputs.flatMap((i) => {
    const abs = path.resolve(process.cwd(), i);
    return fs.existsSync(abs) ? collect(abs) : [];
  });
  if (!files.length) {
    console.error(`[vk] 找不到 ${inputs.join(' ')}`);
    process.exit(2);
  }
  ensureLibrary();
  const report = await renderFiles(files, { shots: cmd === 'render' });
  if (json) console.log(JSON.stringify(report, null, 2));
  else printReport(report, flag('--advise'));
  process.exitCode = report.ok ? 0 : 1;
} else if (cmd === 'doc') {
  const tag = inputs[0];
  if (!TAGS[tag]) {
    console.error(`未知标签 ${tag || ''}。可用：${TAG_NAMES.join(', ')}`);
    process.exit(2);
  }
  const t = TAGS[tag];
  if (json) {
    console.log(JSON.stringify(contract().tags[tag], null, 2));
  } else {
    console.log(`${tag} · ${t.name}  (${t.layer})`);
    console.log(t.summary);
    if (t.capacity) {
      const by = t.capacity.by ? `（${Object.entries(t.capacity.by).map(([k, v]) => `${k} ${v}`).join(' / ')}）` : '';
      console.log(`一帧容量：${t.capacity.max} ${t.capacity.unit}${by}`);
    }
    if (t.children?.hint) console.log(`内容：${t.children.hint}`);
    const LABEL = { type: '字', appearance: '外观', layout: '布局', state: '状态', content: '内容', target: '目标', other: '其它' };
    const groups = {};
    for (const [name, spec] of Object.entries(attrsOf(tag))) (groups[spec.group || 'other'] ||= []).push([name, spec]);
    for (const [g, list] of Object.entries(groups)) {
      console.log(`\n${LABEL[g] || g}`);
      for (const [name, spec] of list) {
        const values = spec.values ? spec.values.join(' | ') : spec.type;
        const def = spec.default !== undefined ? `  默认 ${spec.default}` : '';
        const when = spec.when ? `  （只对 ${spec.when.attr}=${spec.when.values.join('/')}）` : '';
        console.log(`  ${name.padEnd(12)} ${values}${def}  ${spec.label || ''}${when}`);
      }
    }
    if (t.children?.attrs && Object.keys(t.children.attrs).length) {
      console.log('\n子项 (<li>)');
      for (const [name, spec] of Object.entries(t.children.attrs)) {
        const values = spec.values ? spec.values.join(' | ') : spec.type;
        const def = spec.default !== undefined ? `  默认 ${spec.default}` : '';
        console.log(`  ${name.padEnd(12)} ${values}${def}  ${spec.label || ''}`);
      }
    }
    if (t.example) console.log(`\n示例：\n${t.example}`);
  }
} else if (cmd === 'brief') {
  if (flag('--md')) console.log(markdown());
  else if (json) console.log(JSON.stringify(contract(), null, 2));
  else {
    const c = contract();
    console.log(`vk ${c.version} · 画布 ${c.canvas.w}×${c.canvas.h} · 版心 ${c.canvas.w - c.canvas.safeX * 2}×${c.canvas.h - c.canvas.safeY * 2} · 地板 ${c.floor}px · 索引 ${c.indexRule}`);
    console.log('\n骨架：\n' + c.skeleton);
    for (const tag of TAG_NAMES) {
      const t = c.tags[tag];
      console.log(`\n${tag} · ${t.name} —— ${t.summary}`);
      console.log('  ' + Object.entries(t.attrs).map(([n, s]) => `${n}=${s.values ? s.values.join('|') : s.type}${s.default !== undefined ? `(${s.default})` : ''}`).join('  '));
      if (t.children?.hint) console.log(`  内容：${t.children.hint}`);
    }
  }
} else if (cmd === 'icons') {
  const q = (inputs[0] || '').toLowerCase();
  const lucide = await import('lucide');
  const names = Object.keys(lucide.icons || {}).map((n) => n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase());
  const hit = names.filter((k) => k.includes(q)).slice(0, 60);
  console.log(hit.length ? hit.join('\n') : `没有匹配 "${q}" 的图标`);
} else if (cmd === 'clean') {
  for (const d of [OUT, path.join(ROOT, '.vk-cache')]) {
    if (!fs.existsSync(d)) continue;
    fs.rmSync(d, { recursive: true, force: true });
    console.log('删掉 ' + rel(d));
  }
} else {
  console.error(`[vk] 不认识的命令 ${cmd}\n`);
  console.log(USAGE);
  process.exit(2);
}
