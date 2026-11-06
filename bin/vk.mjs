#!/usr/bin/env node
/**
 * vk —— 一条命令。
 *
 *   vk render <file|dir> [--frame id] [--phone] [--out DIR] [--json]
 *   vk check  <file|dir> [--frame id] [--json]     只自检，不出图
 *   vk doc <tag>                                   一个件的属性表
 *   vk brief [--json|--md]                          全部契约
 *   vk icons <query>                               搜 Lucide 图标名
 *   vk clean [--all]                               删 out/ 与缓存（--all 连 vk/ dist/）
 *
 * 库的构建（CSS / JS / 字体）在这里按需自动完成：没有第二个入口。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TAGS, TAG_NAMES, attrsOf } from '../src/schema.mjs';
import { contract, markdown } from '../src/contract.mjs';

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
const VALUE_FLAGS = new Set(['--out', '--width', '--shot', '--frame']);
const KNOWN_FLAGS = new Set([...VALUE_FLAGS, '--phone', '--json', '--md', '--all', '--version']);
const badFlag = args.slice(1).find((a) => a.startsWith('-') && !KNOWN_FLAGS.has(a));
if (badFlag) {
  console.error(`[vk] 不认识的参数 ${badFlag}；可用：${[...KNOWN_FLAGS].join(' ')}`);
  process.exit(2);
}
const inputs = args.slice(1).filter((a, i) => !a.startsWith('-') && !VALUE_FLAGS.has(args.slice(1)[i - 1]));

const json = flag('--json');
const phone = flag('--phone');
const width = Number(val('--width') || 0) || (phone ? 780 : 1920);
const onlyFrame = val('--frame');
const pngDir = () => path.resolve(ROOT, val('--out') || OUT);

/* ---------------------------------------------------------------- 库构建 */
const crypto = await import('node:crypto');

/** 目录内容指纹：改了内容才算变，恢复成旧时间戳也不骗人。 */
const digestOf = (dir, exts) => {
  const h = crypto.createHash('sha1');
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(p, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        walk(abs);
      } else if (!exts.length || exts.some((x) => abs.endsWith(x))) {
        h.update(path.relative(ROOT, abs));
        h.update(fs.readFileSync(abs));
      }
    }
  };
  if (!fs.existsSync(dir)) return '';
  walk(dir);
  return h.digest('hex');
};

const run = (bin, argv) => execFileSync(bin, argv, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });

function ensureLibrary() {
  const cacheFile = path.join(ROOT, '.vk-cache', 'lib.json');
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch {
    cache = {};
  }
  const save = () => {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(cache));
  };
  const stamp = [digestOf(path.join(ROOT, 'src'), ['.mjs', '.css']), digestOf(path.join(ROOT, 'tools'), ['.mjs']), fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')].join(':');
  const digest = crypto.createHash('sha1').update(stamp).digest('hex');

  if (!fs.existsSync(path.join(ROOT, 'vk/fonts.css'))) run('node', ['tools/fonts.mjs']);
  if (!fs.existsSync(path.join(ROOT, 'vk/katex.css'))) run('node', ['tools/katex.mjs']);
  const tokens = digestOf(path.join(ROOT, 'src'), ['.mjs']);
  if (!fs.existsSync(path.join(ROOT, 'src/tokens.generated.css')) || cache.tokens !== tokens) {
    run('node', ['tools/css.mjs']);
    cache.tokens = tokens;
    save();
  }
  if (!fs.existsSync(path.join(ROOT, 'vk/vk.css')) || !fs.existsSync(path.join(ROOT, 'dist/vk.js')) || cache.lib !== digest) {
    run('node', ['tools/build.mjs']);
    cache.lib = digest;
    save();
  }
}

/* ---------------------------------------------------------------- 构建页 */
async function buildPage(file) {
  const { transformHtml } = await import('../src/build.mjs');
  const html = fs.readFileSync(file, 'utf8');
  const abs = path.resolve(file);
  const rel = path.relative(ROOT, abs);
  // 仓库外的页也能渲：放到 _outside/ 下，不往 .vk-cache 外面写。
  const out = path.join(PAGES, rel.startsWith('..') ? path.join('_outside', path.basename(abs)) : rel);
  let res;
  try {
    res = await transformHtml(html, { file: abs });
  } catch (e) {
    return { file, ok: false, errors: e.errors || [{ file: rel, line: 1, message: e.message }] };
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, res.html);
  return { file, ok: true, out, count: res.count };
}

function collect(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return [p];
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
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
  const opts = { args: ['--font-render-hinting=none', '--allow-file-access-from-files'] };
  try {
    return await chromium.launch(opts);
  } catch {
    return await chromium.launch({ ...opts, channel: 'msedge' });
  }
}

async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  const warns = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    else if (m.type() === 'warning') warns.push(m.text().replace(/\s*JSHandle@node\s*$/, ''));
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`资源加载失败：${r.url().split('/').pop()}（${r.failure()?.errorText || ''}）`));
  await page.goto(url, { waitUntil: 'load' });
  const ready = await page.evaluate(() => window.vk?.ready?.());
  const frames = await page.evaluate(() =>
    [...document.querySelectorAll('vk-page')].map((p, i) => {
      const r = p.getBoundingClientRect();
      return { id: p.id || '', index: i, x: r.left, y: r.top, w: r.width, h: r.height };
    })
  );
  return { page, errors, ready, frames, warns };
}

/** 把一张 PNG 等比缩到 targetW（盒式滤波）：按手机尺度看整帧。 */
async function downscale(file, targetW) {
  const { PNG } = await import('pngjs');
  const src = PNG.sync.read(fs.readFileSync(file));
  const targetH = Math.round((src.height * targetW) / src.width);
  const out = new PNG({ width: targetW, height: targetH });
  const sx = src.width / targetW;
  const sy = src.height / targetH;
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const x0 = Math.floor(x * sx), x1 = Math.min(src.width, Math.ceil((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.min(src.height, Math.ceil((y + 1) * sy));
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) << 2;
          r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; a += src.data[i + 3]; n++;
        }
      }
      const o = (y * targetW + x) << 2;
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = a / n;
    }
  }
  fs.writeFileSync(file, PNG.sync.write(out));
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/* ---------------------------------------------------------------- 命令 */

if (cmd === 'render' || cmd === 'check') {
  if (!inputs.length) {
    console.error(`用法：vk ${cmd} <file|dir> [--frame id] [--phone] [--width N] [--json]`);
    process.exit(2);
  }
  ensureLibrary();

  // 相对路径按「你站的地方」算，不按库根：在 tests/ 里跑 `vk check frames.html` 也得成立。
  const files = inputs.flatMap((i) => {
    const abs = path.resolve(process.cwd(), i);
    return fs.existsSync(abs) ? collect(abs) : [];
  });
  if (!files.length) {
    console.error(`[vk] 找不到 ${inputs.join(' ')}`);
    process.exit(2);
  }

  const built = [];
  for (const f of files) built.push(await buildPage(f));

  const browser = await launch();
  const report = [];
  try {
    for (const b of built) {
      if (!b.ok) {
        report.push({ file: rel(b.file), ok: false, errors: b.errors, frames: [] });
        continue;
      }
      const url = 'file:///' + b.out.split(path.sep).join('/');
      const session = await openPage(browser, url);
      const frames = onlyFrame ? session.frames.filter((f) => f.id === onlyFrame) : session.frames;
      const perFrame = [];
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        const audit = await session.page.evaluate((idx) => {
          if (!window.vk?.auditPage) {
            return { issues: [{ code: 'frame', message: '页面里没有 vk 运行时（window.vk 不存在）', fix: '片段页不用管；整页 HTML 要引 dist/vk.js' }], metrics: null };
          }
          const stage = document.querySelectorAll('.vk-stage')[idx];
          return { issues: window.vk.auditPage(stage).issues, metrics: window.vk.metrics(stage) };
        }, f.index);
        let png = null;
        if (cmd === 'render') {
          const base = path.basename(b.file, '.html');
          const suffix = (session.frames.length > 1 ? `-${f.id || String(f.index + 1).padStart(2, '0')}` : '') + (width !== 1920 ? `.${width}` : '');
          png = path.join(pngDir(), `${base}${suffix}.png`);
          fs.mkdirSync(path.dirname(png), { recursive: true });
          await session.page.screenshot({ path: png, fullPage: true, clip: { x: f.x, y: f.y, width: f.w, height: f.h } });
          if (width !== 1920) await downscale(png, width);
        }
        perFrame.push({ id: f.id, index: f.index, issues: audit.issues, metrics: audit.metrics, png: png ? rel(png) : null });
      }
      const errors = [];
      if (!session.frames.length) errors.push({ file: rel(b.file), line: 1, message: '这一页没有 <vk-page>：什么都没画出来', fix: '把内容包进 <vk-page>…</vk-page>' });
      if (onlyFrame && !frames.length) errors.push({ file: rel(b.file), line: 1, message: `没有 id="${onlyFrame}" 的帧`, fix: 'vk check 会列出这一页所有帧的 id' });
      if (session.ready === false) errors.push({ file: rel(b.file), line: 1, message: '页面在超时前没有就绪（字体/图片没加载完？）', fix: '看下面的运行期错误' });
      for (const e of session.errors) errors.push({ file: rel(b.file), line: 1, message: `运行期错误：${e}`, fix: '这是页面脚本/组件抛的，不是版式问题' });
      report.push({ file: rel(b.file), ok: true, out: rel(b.out), errors, frames: perFrame, warns: [...new Set(session.warns)] });
      await session.page.close();
    }
  } finally {
    await browser.close();
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const r of report) {
      if (!r.frames.length) {
        console.log(`✗ ${r.file}`);
        for (const e of r.errors) console.log(`   ${e.file}:${e.line} ${e.message}${e.fix ? ` → ${e.fix}` : ''}`);
        continue;
      }
      for (const f of r.frames) {
        const tag = r.frames.length > 1 || f.id ? ` #${f.id || f.index + 1}` : '';
        if (f.issues.length) {
          console.log(`✗ ${r.file}${tag}`);
          for (const x of f.issues) console.log(`   · ${x.message}${x.fix ? ` → ${x.fix}` : ''}`);
        } else {
          console.log(`✓ ${r.file}${tag}${f.png ? `  → ${f.png}` : ''}`);
        }
        if (f.metrics) console.log(`   墨迹 y ${f.metrics.contentTop}–${f.metrics.contentBottom}（占版心 ${f.metrics.fill}%）· 焦点 ${f.metrics.focus}`);
      }
      for (const e of r.errors) console.log(`   ✗ ${e.message}${e.fix ? ` → ${e.fix}` : ''}`);
      for (const w of r.warns || []) console.log(`   提示：${w}`);
    }
    const nIssues = report.reduce((n, r) => n + r.errors.length + r.frames.reduce((k, f) => k + f.issues.length, 0), 0);
    const nFrames = report.reduce((n, r) => n + r.frames.length, 0);
    console.log(nIssues ? `\n${nIssues} 条问题` : `\n干净：${nFrames} 帧`);
  }

  const bad = report.some((r) => !r.frames.length || r.errors.length || r.frames.some((f) => f.issues.length));
  process.exitCode = bad ? 1 : 0;
} else if (cmd === 'clean') {
  const all = flag('--all');
  const targets = [OUT, path.join(ROOT, '.vk-cache'), ...(all ? [path.join(ROOT, 'vk'), path.join(ROOT, 'dist'), path.join(ROOT, 'src/tokens.generated.css')] : [])];
  for (const d of targets) {
    if (!fs.existsSync(d)) continue;
    fs.rmSync(d, { recursive: true, force: true });
    console.log('删掉 ' + rel(d));
  }
  console.log(all ? '干净（下次会重建库）。' : '干净（库还在）。');
} else if (cmd === 'doc') {
  const tag = inputs[0];
  if (!TAGS[tag]) {
    console.error(`未知标签 ${tag || ''}。可用：${TAG_NAMES.join(', ')}`);
    process.exit(2);
  }
  const t = TAGS[tag];
  if (json) {
    console.log(JSON.stringify(contract().tags[tag], null, 2));
    process.exit(0);
  }
  console.log(`${tag} · ${t.name}  (${t.layer})`);
  console.log(t.summary);
  if (t.capacity) console.log(`一帧容量：${t.capacity.max} ${t.capacity.unit}`);
  const LABEL = { type: '字', appearance: '外观', layout: '布局', state: '状态', content: '内容', target: '目标', other: '其它' };
  const groups = {};
  for (const [name, spec] of Object.entries(attrsOf(tag))) (groups[spec.group || 'other'] ||= []).push([name, spec]);
  for (const [g, list] of Object.entries(groups)) {
    console.log(`\n${LABEL[g] || g}`);
    for (const [name, spec] of list) {
      const vals = spec.values ? spec.values.join(' | ') : spec.type;
      const def = spec.default !== undefined ? `  默认 ${spec.default}` : '';
      const when = spec.when ? `  （只对 ${spec.when.attr}=${spec.when.values.join('/')}）` : '';
      console.log(`  ${name.padEnd(12)} ${vals}${def}  ${spec.label || ''}${when}`);
    }
  }
  if (t.children?.hint) console.log(`\n子节点：${t.children.hint}`);
} else if (cmd === 'brief') {
  if (flag('--md')) {
    console.log(markdown());
    process.exit(0);
  }
  if (json) {
    console.log(JSON.stringify(contract(), null, 2));
    process.exit(0);
  }
  const c = contract();
  console.log(`画布 1920×1080，版心 1680×888；最小字号 ${c.fontFloor}px；索引 1 起。`);
  for (const tag of TAG_NAMES) {
    const t = c.tags[tag];
    console.log(`\n${tag} · ${t.name} —— ${t.summary}`);
    const parts = Object.entries(t.attrs).map(([n, s]) => `${n}=${s.values ? s.values.join('|') : s.type}${s.default !== undefined ? `(${s.default})` : ''}`);
    console.log('  ' + parts.join('  '));
    if (t.children?.hint) console.log(`  内容：${t.children.hint}`);
  }
} else if (cmd === 'icons') {
  const q = (inputs[0] || '').toLowerCase();
  const lucide = await import('lucide');
  const names = Object.keys(lucide.icons || {}).map((n) =>
    n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()
  );
  const hit = names.filter((k) => k.includes(q)).slice(0, 60);
  console.log(hit.length ? hit.join('\n') : `没有匹配 "${q}" 的图标`);
} else if (flag('--version') || cmd === '--version') {
  console.log(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version);
} else {
  console.log(`vk —— 单帧画面库（一帧一张 1920×1080，手机上约 780 宽）

  vk render <file|dir> [--frame id] [--phone] [--out DIR] [--json]
  vk check  <file|dir> [--frame id] [--json]
  vk doc    <tag> [--json]
  vk brief  [--json|--md]
  vk icons  <query>
  vk clean  [--all]
`);
}

