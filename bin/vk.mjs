#!/usr/bin/env node
/**
 * vk —— 一条命令。
 *
 *   vk render pages/a.html            构建 + 自检 + 出图（多帧文件一次出 N 张）
 *   vk render pages/ --phone          780 宽，按手机尺度看
 *   vk check  pages/                  只自检
 *   vk doc vk-code                    一个件的属性表
 *   vk brief [--json]                 全部件的机器可读契约
 *   vk icons arrow                    搜 Lucide 图标名
 *
 * 没有第二个入口：库的构建（CSS / JS / 字体）在这里按需自动完成。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TAGS, TAG_NAMES, attrsOf, CHILD_ATTRS } from '../src/schema.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'out');
const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => args.includes(n);
const val = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const VALUE_FLAGS = new Set(['--out', '--width']);
const inputs = args.slice(1).filter((a, i) => !a.startsWith('-') && !VALUE_FLAGS.has(args.slice(1)[i - 1]));

const json = flag('--json');
const phone = flag('--phone');
const width = Number(val('--width') || 0) || (phone ? 780 : 1920);

/* ---------------------------------------------------------------- 库构建 */

const newest = (dir, exts) => {
  let t = 0;
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const abs = path.join(p, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        walk(abs);
      } else if (!exts.length || exts.some((x) => abs.endsWith(x))) t = Math.max(t, fs.statSync(abs).mtimeMs);
    }
  };
  walk(dir);
  return t;
};

function run(bin, argv) {
  execFileSync(bin, argv, { stdio: ['ignore', 'pipe', 'inherit'] });
}

function ensureLibrary() {
  const stale = (file, deps) => !fs.existsSync(file) || fs.statSync(file).mtimeMs < deps;
  const srcT = Math.max(newest('src', ['.mjs', '.css']), fs.statSync('tools/build.mjs').mtimeMs);
  if (!fs.existsSync('vk/fonts.css')) run('node', ['tools/fonts.mjs']);
  if (!fs.existsSync('vk/katex.css')) run('node', ['tools/katex.mjs']);
  if (!fs.existsSync('src/icons.generated.mjs')) run('node', ['tools/icons.mjs']);
  if (stale('src/tokens.generated.css', fs.statSync('src/vocab.mjs').mtimeMs)) run('node', ['tools/css.mjs']);
  if (stale('vk/vk.css', srcT) || stale('dist/vk.js', srcT)) run('node', ['tools/build.mjs']);
}

/* ---------------------------------------------------------------- 发布 */

/** out/ 里放一份镜像的 vk / dist / assets：作者写的 ../vk 在 out/ 里仍然指得到。 */
function publish() {
  const stampFile = path.join(ROOT, '.vk-cache', 'publish.json');
  let stamp = {};
  try {
    stamp = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
  } catch {
    stamp = {};
  }
  for (const dir of ['vk', 'dist', 'assets']) {
    if (!fs.existsSync(dir)) continue;
    const t = newest(dir, []);
    if (stamp[dir] === t && fs.existsSync(path.join(OUT, dir))) continue;
    fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
    fs.cpSync(dir, path.join(OUT, dir), { recursive: true });
    stamp[dir] = t;
  }
  fs.mkdirSync(path.dirname(stampFile), { recursive: true });
  fs.writeFileSync(stampFile, JSON.stringify(stamp));
}

const outPathOf = (src) => path.join(OUT, path.relative(ROOT, path.resolve(src)));

/* ---------------------------------------------------------------- 构建页 */

async function buildPage(file) {
  const { transformHtml } = await import('../src/build.mjs');
  const html = fs.readFileSync(file, 'utf8');
  const out = outPathOf(file);
  const outRel = path.relative(OUT, out).split(path.sep).join('/');
  let res;
  try {
    res = await transformHtml(html, { file: path.relative(ROOT, path.resolve(file)), outRel });
  } catch (e) {
    if (e.errors) return { file, ok: false, errors: e.errors };
    return { file, ok: false, errors: [`${file}: ${e.message}`] };
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
    // 没装 Playwright 自带的 Chromium 时，用系统里已有的 Edge（同一内核）。
    return await chromium.launch({ ...opts, channel: 'msedge' });
  }
}

async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  const ready = await page.evaluate(() => window.vk?.ready?.());
  const frames = await page.evaluate(() =>
    [...document.querySelectorAll('vk-page')].map((p, i) => {
      const r = p.getBoundingClientRect();
      return { id: p.id || '', index: i, x: r.left, y: r.top, w: r.width, h: r.height };
    })
  );
  return { page, errors, ready, frames };
}


/** 把一张 PNG 等比缩到 targetW（盒式滤波），用于手机尺度预览。 */
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

/* ---------------------------------------------------------------- 命令 */

if (cmd === 'render' || cmd === 'check') {
  if (!inputs.length) {
    console.error(`用法：vk ${cmd} <file|dir> [--phone] [--width N] [--json]`);
    process.exit(2);
  }
  ensureLibrary();
  publish();

  const files = inputs.flatMap((i) => (fs.existsSync(i) ? collect(i) : []));
  if (!files.length) {
    console.error(`[vk] 找不到 ${inputs.join(' ')}`);
    process.exit(2);
  }

  const built = [];
  let failed = 0;
  for (const f of files) {
    const r = await buildPage(f);
    if (!r.ok) {
      failed++;
      for (const e of r.errors) console.error(`✗ ${e}`);
    }
    built.push(r);
  }

  const browser = await launch();
  const report = [];
  try {
    for (const b of built) {
      if (!b.ok) {
        report.push({ file: b.file, errors: b.errors, frames: [] });
        continue;
      }
      const url = 'file:///' + b.out.split(path.sep).join('/');
      const session = await openPage(browser, url);
      const perFrame = [];
      for (let i = 0; i < session.frames.length; i++) {
        const f = session.frames[i];
        const audit = await session.page.evaluate((idx) => {
          const stage = document.querySelectorAll('.vk-stage')[idx];
          return { issues: window.vk.auditPage(stage).issues, metrics: window.vk.metrics(stage) };
        }, i);
        let png = null;
        if (cmd === 'render') {
          const base = path.basename(b.file, '.html');
          const suffix = (session.frames.length > 1 ? `-${f.id || String(i + 1).padStart(2, '0')}` : '') + (width !== 1920 ? `.${width}` : '');
          png = path.join(OUT, `${base}${suffix}.png`);
          await session.page.screenshot({ path: png, fullPage: true, clip: { x: f.x, y: f.y, width: f.w, height: f.h } });
          if (width !== 1920) await downscale(png, width);
        }
        perFrame.push({ id: f.id, index: i, issues: audit.issues, metrics: audit.metrics, png });
      }
      report.push({ file: b.file, out: b.out, errors: session.errors, frames: perFrame, ready: session.ready });
      await session.page.close();
    }
  } finally {
    await browser.close();
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const r of report) {
      const rel = path.relative(ROOT, r.file);
      if (r.errors?.length && !r.frames?.length) {
        console.log(`✗ ${rel}`);
        for (const e of r.errors) console.log(`   ${e}`);
        continue;
      }
      for (const f of r.frames) {
        const tag = r.frames.length > 1 ? ` #${f.id || f.index + 1}` : '';
        const m = f.metrics;
        if (f.issues.length) {
          console.log(`✗ ${rel}${tag}`);
          for (const x of f.issues) console.log(`   · ${x.what}${x.fix ? `（${x.fix}）` : ''}`);
        } else {
          console.log(`✓ ${rel}${tag}${f.png ? `  → ${path.relative(ROOT, f.png)}` : ''}`);
        }
        if (m) console.log(`   墨迹 y ${m.contentTop}–${m.contentBottom}（占版心 ${m.fill}%）· 焦点 ${m.focus}`);
      }
    }
    const bad = report.reduce((n, r) => n + (r.errors?.length || 0) + r.frames.reduce((k, f) => k + f.issues.length, 0), 0);
    console.log(bad ? `\n${bad} 条问题` : `\n干净：${report.reduce((n, r) => n + r.frames.length, 0)} 帧`);
  }
  const bad = report.some((r) => r.errors?.length || r.frames.some((f) => f.issues.length) || r.ready === false);
  process.exitCode = failed || bad ? 1 : 0;
} else if (cmd === 'doc') {
  const tag = inputs[0];
  if (!TAGS[tag]) {
    console.error(`未知标签 ${tag || ''}。可用：${TAG_NAMES.join(', ')}`);
    process.exit(2);
  }
  const t = TAGS[tag];
  console.log(`${tag} · ${t.name}  (${t.layer})`);
  console.log(t.summary);
  const groups = {};
  for (const [name, spec] of Object.entries(attrsOf(tag))) (groups[spec.group || 'other'] ||= []).push([name, spec]);
  const LABEL = { type: '字', appearance: '外观', layout: '布局', state: '状态', content: '内容', target: '目标' };
  for (const [g, list] of Object.entries(groups)) {
    console.log(`\n${LABEL[g] || g}`);
    for (const [name, spec] of list) {
      const vals = spec.values ? spec.values.join(' | ') : spec.type;
      const def = spec.default !== undefined ? `  默认 ${spec.default}` : '';
      console.log(`  ${name.padEnd(12)} ${vals}${def}  ${spec.label || ''}`);
    }
  }
  if (t.children) console.log(`\n子节点：${t.children.hint || t.children.kind}`);
  if (t.content === 'text') console.log('\n内容：写在标签里');
} else if (cmd === 'brief') {
  const out = {};
  for (const tag of TAG_NAMES) {
    const t = TAGS[tag];
    out[tag] = { name: t.name, layer: t.layer, summary: t.summary, attrs: attrsOf(tag), children: t.children || null };
  }
  if (json) console.log(JSON.stringify(out, null, 2));
  else
    for (const tag of TAG_NAMES) {
      const t = TAGS[tag];
      console.log(`${tag.padEnd(12)} ${t.name}`);
      if (CHILD_ATTRS[tag]) console.log(`             子 <li>：${CHILD_ATTRS[tag].join(', ') || '无属性'}`);
    }
} else if (cmd === 'icons') {
  const q = (inputs[0] || '').toLowerCase();
  const { ICONS } = await import('../src/icons.generated.mjs');
  const hit = Object.keys(ICONS)
    .filter((k) => k.includes(q))
    .slice(0, 60);
  console.log(hit.length ? hit.join('\n') : `没有匹配 "${q}" 的图标`);
} else {
  console.log(`vk —— 单帧画面库

  vk render <file|dir> [--phone] [--width N]   构建 + 自检 + 出图
  vk check  <file|dir>                         只自检
  vk doc <tag>                                 一个件的属性表
  vk brief [--json]                            全部件的契约
  vk icons <query>                             搜图标
`);
}
