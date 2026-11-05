#!/usr/bin/env node
/**
 * vk —— 一条命令。
 *
 *   vk render pages/a.html            构建 + 自检 + 出图（多帧文件一次出 N 张）
 *   vk render pages/ --phone          780 宽，按手机尺度看
 *   vk check  pages/                  只自检
 *   vk doc vk-code                    一个件的属性表
 *   vk brief [--json]                 全部件的机器可读契约
 *   vk sheet episodes/ --cols 4        每帧缩略图拼成一张联络图（看节奏）
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
/* 出图目录：默认 out/，--out 可以改（把帧当素材导出时用）。 */
const PNG_DIR = () => path.resolve(val('--out') || OUT);
const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => args.includes(n);
const val = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const VALUE_FLAGS = new Set(['--out', '--width', '--shot']);
const inputs = args.slice(1).filter((a, i) => !a.startsWith('-') && !VALUE_FLAGS.has(args.slice(1)[i - 1]));

const json = flag('--json');
const phone = flag('--phone');
const width = Number(val('--width') || 0) || (phone ? 780 : 1920);

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
        h.update(abs);
        h.update(fs.readFileSync(abs));
      }
    }
  };
  if (!fs.existsSync(dir)) return '';
  walk(dir);
  return h.digest('hex');
};

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
  const srcDigest = digestOf('src', ['.mjs', '.css']);
  const tokensDigest = digestOf('src', ['.mjs']);
  if (!fs.existsSync('vk/fonts.css')) run('node', ['tools/fonts.mjs']);
  if (!fs.existsSync('vk/katex.css')) run('node', ['tools/katex.mjs']);
  if (!fs.existsSync('src/icons.generated.mjs')) run('node', ['tools/icons.mjs']);
  if (!fs.existsSync('src/tokens.generated.css') || cache.tokens !== tokensDigest) {
    run('node', ['tools/css.mjs']);
    cache.tokens = tokensDigest;
    save();
  }
  if (!fs.existsSync('vk/vk.css') || !fs.existsSync('dist/vk.js') || cache.lib !== srcDigest) {
    run('node', ['tools/build.mjs']);
    cache.lib = srcDigest;
    save();
  }
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
    // 同样按内容指纹：只改了 mtime 不该触发整目录重拷，内容变了则一定要拷。
    const t = digestOf(dir, []);
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
  const warns = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    // 组件自己的 warn()（比如"cols 超出范围，按 8 处理"）：不拦，但要说出来。
    else if (m.type() === 'warning') warns.push(m.text().replace(/\s*JSHandle@node\s*$/, ''));
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
  return { page, errors, ready, frames, warns };
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
    if (!r.ok) failed++;
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
      if (session.warns?.length) {
        for (const w of [...new Set(session.warns)]) console.error(`   提示：${w}`);
      }
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
          png = path.join(PNG_DIR(), `${base}${suffix}.png`);
          fs.mkdirSync(path.dirname(png), { recursive: true });
          const shotSel = val('--shot');
          if (shotSel) {
            // 只截这一帧里的某个元素：导出素材时不要画布留白。
            const el = session.page.locator('.vk-stage').nth(i).locator(shotSel).first();
            if (await el.count()) await el.screenshot({ path: png });
            else await session.page.screenshot({ path: png, fullPage: true, clip: { x: f.x, y: f.y, width: f.w, height: f.h } });
          } else {
            await session.page.screenshot({ path: png, fullPage: true, clip: { x: f.x, y: f.y, width: f.w, height: f.h } });
          }
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

  /* 每次渲染留一份快照：改了默认值之后，能直接看出"哪几帧变了"，不用逐张看。 */
  const snapPath = path.join(OUT, '.vk-run.json');
  const prev = (() => {
    try {
      return JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    } catch {
      return {};
    }
  })();
  const next = { ...prev };
  const changed = [];
  const seen = new Set();
  for (const r of report) {
    const rel = path.relative(ROOT, r.file).split(path.sep).join('/');
    for (const f of r.frames || []) {
      if (!f.metrics) continue;
      const key = rel + '#' + (f.id || f.index + 1);
      seen.add(key);
      const sig = [f.metrics.contentTop, f.metrics.contentBottom, f.metrics.fill, f.metrics.focus, f.issues.map((x) => x.type || x.what).join('|')].join(',');
      if (prev[key] && prev[key] !== sig) changed.push(key);
      next[key] = sig;
    }
  }
  // 这次渲染过的文件里，已经不存在的帧名（改名/删帧）要从快照里清掉，
  // 否则以后重建同名帧会跟"幽灵"比对。
  for (const key of Object.keys(next)) {
    const [file] = key.split('#');
    if (report.some((r) => path.relative(ROOT, r.file).split(path.sep).join('/') === file) && !seen.has(key)) delete next[key];
  }
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(snapPath, JSON.stringify(next, null, 1));
  } catch {}

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const r of report) {
      const rel = path.relative(ROOT, r.file);
      if (r.errors?.length && !r.frames?.length) {
        console.log(`✗ ${rel}`);
        for (const e of r.errors) console.log(`   ${String(e).split('\n').join('\n   ')}`);
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
    if (changed.length) {
      const head = changed.slice(0, 6).join('  ');
      console.log(`比上次变了 ${changed.length} 帧：${head}${changed.length > 6 ? ` …` : ''}`);
    }
  }
  const bad = report.some((r) => r.errors?.length || r.frames.some((f) => f.issues.length) || r.ready === false);
  process.exitCode = failed || bad ? 1 : 0;
} else if (cmd === 'stats') {
  // 一集的"体检表"：帧数、有主张的帧、占版心、焦点数、用到的件。
  if (!inputs.length) {
    console.error('用法：vk stats <file|dir>');
    process.exit(2);
  }
  ensureLibrary();
  publish();
  const files = inputs.flatMap((i) => (fs.existsSync(i) ? collect(i) : []));
  const built = [];
  for (const f of files) {
    const r = await buildPage(f);
    if (r.ok) built.push(r);
    else console.error(`✗ ${path.relative(ROOT, r.file)}\n  ${r.errors.join('\n  ')}`);
  }
  const browser = await launch();
  try {
    for (const b of built) {
      const session = await openPage(browser, 'file:///' + b.out.split(path.sep).join('/'));
      const rows = await session.page.evaluate(() =>
        [...document.querySelectorAll('vk-page')].map((pg, i) => {
          const stage = pg.querySelector('.vk-stage');
          let maxFs = 0;
          for (const el of stage.querySelectorAll('vk-text, vk-label, vk-box, vk-table caption')) {
            maxFs = Math.max(maxFs, parseFloat(getComputedStyle(el).fontSize) || 0);
          }
          const m = window.vk.metrics(stage) || {};
          const tags = new Set([...stage.querySelectorAll('*')].map((e) => e.localName).filter((t) => t.startsWith('vk-')));
          const CONTENT = ['vk-code', 'vk-term', 'vk-diff', 'vk-asm', 'vk-table', 'vk-list', 'vk-tree', 'vk-cells', 'vk-bytes', 'vk-bits', 'vk-steps', 'vk-bars', 'vk-timeline', 'vk-compare', 'vk-pair', 'vk-canvas', 'vk-img', 'vk-math'];
          // 没有内容件但有成排的盒子：那是示意图，不是纯文字。
          const shape = CONTENT.find((t) => stage.querySelector(t)) || (stage.querySelectorAll('vk-box').length >= 3 ? 'vk-box' : 'text');
          return { id: pg.id || String(i + 1), maxFs, unchecked: m.unchecked || 0, fill: m.fill || 0, focus: m.focus || 0, dark: pg.hasAttribute('surface') && pg.getAttribute('surface') === 'dark', shape, tags: [...tags] };
        })
      );
      const low = rows.filter((r) => r.maxFs <= 56).map((r) => r.id);
      const dark = rows.filter((r) => r.dark).length;
      const avg = Math.round(rows.reduce((n, r) => n + r.fill, 0) / rows.length);
      const tags = new Set(rows.flatMap((r) => r.tags));
      console.log(`\n${path.relative(ROOT, b.file)}  ·  ${rows.length} 帧`);
      console.log(`  占版心 平均 ${avg}%（${Math.min(...rows.map((r) => r.fill))}–${Math.max(...rows.map((r) => r.fill))}）`);
      console.log(`  字号只到正文 ${low.length} 帧${low.length ? '（可能缺一句主张）：' + low.join(' ') : ''}`);
      const GLYPH = {
        'vk-code': '码', 'vk-term': '端', 'vk-diff': '差', 'vk-asm': '汇',
        'vk-table': '表', 'vk-list': '单', 'vk-tree': '树', 'vk-cells': '格',
        'vk-bytes': '节', 'vk-bits': '位', 'vk-steps': '步', 'vk-bars': '条',
        'vk-timeline': '线', 'vk-compare': '照', 'vk-pair': '并', 'vk-canvas': '图',
        'vk-img': '图', 'vk-math': '式', 'vk-box': '块', text: '字',
      };
      const rhythm = rows.map((r) => (r.dark ? '●' : '') + (GLYPH[r.shape] || '字')).join(' ');
      // 连续三帧同一形态 = 节奏发闷
      const runs = [];
      let run = 1;
      for (let i = 1; i <= rows.length; i++) {
        if (i < rows.length && rows[i].shape === rows[i - 1].shape) run++;
        else {
          if (run >= 3) runs.push(`${rows[i - run].id} 起 ${run} 帧都是「${GLYPH[rows[i - 1].shape] || '字'}」`);
          run = 1;
        }
      }
      console.log(`  节奏 ${rhythm}`);
      if (runs.length) console.log(`  连续同形：${runs.join('；')}`);
      const unchecked = rows.reduce((n, r) => n + r.unchecked, 0);
      console.log(`  深色 ${dark} 帧 · 用到 ${tags.size} 种件${unchecked ? ` · ${unchecked} 处文字压在图/渐变上（未查对比度）` : ''}`);
      await session.page.close();
    }
  } finally {
    await browser.close();
  }
} else if (cmd === 'sheet') {
  // 联络图：把一串帧缩成小图拼在一张纸上。它不替代单帧渲染，是用来"一眼看完一集"的。
  if (!inputs.length) {
    console.error('用法：vk sheet <file|dir> [--cols 4] [--width 420] [--out out/sheet.png]');
    process.exit(2);
  }
  const cols = Math.max(1, Number(val('--cols') || 0) || 4);
  const thumbW = Math.max(160, Number(val('--width') || 0) || 420);
  const outFile = path.resolve(val('--out') || path.join(OUT, 'sheet.png'));
  ensureLibrary();
  publish();

  const files = inputs.flatMap((i) => (fs.existsSync(i) ? collect(i) : []));
  if (!files.length) {
    console.error(`[vk] 找不到 ${inputs.join(' ')}`);
    process.exit(2);
  }

  const tmp = fs.mkdtempSync(path.join(OUT, '.sheet-'));
  const shots = [];
  const browser = await launch();
  try {
    for (const f of files) {
      const b = await buildPage(f);
      if (!b.ok) {
        console.error(`✗ ${path.relative(ROOT, f)}：${b.errors.join('；')}`);
        continue;
      }
      const session = await openPage(browser, 'file:///' + b.out.split(path.sep).join('/'));
      for (let i = 0; i < session.frames.length; i++) {
        const fr = session.frames[i];
        const png = path.join(tmp, `${shots.length}.png`);
        await session.page.screenshot({ path: png, fullPage: true, clip: { x: fr.x, y: fr.y, width: fr.w, height: fr.h } });
        await downscale(png, thumbW);
        shots.push({ png, label: `${path.basename(f, '.html')}${session.frames.length > 1 ? ' #' + (fr.id || i + 1) : ''}` });
      }
      await session.page.close();
    }

    const gap = 16;
    const capH = 26;
    const rows = Math.ceil(shots.length / cols);
    const pageW = cols * thumbW + (cols + 1) * gap;
    const pageH = rows * (Math.round((thumbW * 9) / 16) + capH + gap) + gap;
    const html = `<!doctype html><meta charset="utf-8"><style>
      body { margin:0; background:#141414; font:13px/1.4 ui-monospace,Consolas,monospace; color:#9a9a9a; }
      .g { display:grid; grid-template-columns:repeat(${cols},${thumbW}px); gap:${gap}px; padding:${gap}px; }
      figure { margin:0; }
      img { display:block; width:${thumbW}px; border-radius:6px; background:#fff; }
      figcaption { padding:5px 2px 0; }
    </style><div class="g">${shots
      .map((s) => `<figure><img src="file:///${s.png.split(path.sep).join('/')}"><figcaption>${s.label}</figcaption></figure>`)
      .join('')}</div>`;

    const sheetHtml = path.join(tmp, 'sheet.html');
    fs.writeFileSync(sheetHtml, html);
    const page = await browser.newPage({ viewport: { width: pageW, height: Math.min(pageH, 8000) }, deviceScaleFactor: 1 });
    await page.goto('file:///' + sheetHtml.split(path.sep).join('/'), { waitUntil: 'load' });
    // 字体和图没落地就截图，同一份内容会出两张不一样的图（预览图检查就是这么闪过的）。
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((img) => (img.complete ? 0 : new Promise((done) => (img.onload = img.onerror = done))))
      );
    });
    await page.screenshot({ path: outFile, fullPage: true });
    await page.close();
    console.log(`${shots.length} 帧 → ${path.relative(ROOT, outFile)}`);
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  process.exitCode = 0;
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
      const modes = spec.modes ? `  （只对 mode=${spec.modes.join(' / ')}）` : '';
      console.log(`  ${name.padEnd(12)} ${vals}${def}  ${spec.label || ''}${modes}`);
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
      console.log(`\n${tag} · ${t.name} —— ${t.summary}`);
      const parts = [];
      for (const [name, spec] of Object.entries(attrsOf(tag))) {
        const v = spec.values ? spec.values.join('|') : spec.type;
        parts.push(`${name}=${v}${spec.default !== undefined ? `(${spec.default})` : ''}`);
      }
      console.log('  ' + parts.join('  '));
      if (CHILD_ATTRS[tag]) console.log(`  子 <li>：${CHILD_ATTRS[tag].join(', ') || '无属性'}`);
      if (t.children?.hint) console.log(`  内容：${t.children.hint}`);
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

  vk render <file|dir> [--phone] [--width N] [--out DIR] [--shot SEL]
                                               构建 + 自检 + 出图（--shot 只截某个元素，导出素材用）
  vk check  <file|dir>                         只自检
  vk doc <tag>                                 一个件的属性表
  vk brief [--json]                            全部件的契约
  vk icons <query>                             搜图标
`);
}
