/**
 * vk render —— 构建页 → 开浏览器 → 自检 → 出图 → 联系表。
 *
 *   import { renderFiles, collect } from '../tools/render.mjs';
 *
 * 这里是 CLI 的“手”，不是命令层：不解析参数、不打印报表，只把文件变成产物。
 * 页面先进 .vk-tmp/pages/，再逐帧截图；780 预览由 1920 原图缩放得到（同一台机器、同一套像素）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { VERSION } from '../src/contract.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PAGES = path.join(ROOT, '.vk-tmp', 'pages');

const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join('/');

/** 一个路径 → 里面所有 .html（目录递归；跳过点文件与 node_modules）。 */
export function collect(p) {
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

async function buildPage(file) {
  const { transformHtml } = await import('../src/build/index.mjs');
  const html = fs.readFileSync(file, 'utf8');
  const abs = path.resolve(file);
  const fileRel = path.relative(ROOT, abs);
  const out = path.join(PAGES, fileRel.startsWith('..') ? path.join('_outside', path.basename(abs)) : fileRel);
  try {
    const res = await transformHtml(html, { file: abs });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, res.html);
    return { file, ok: true, out, diagnostics: res.diagnostics };
  } catch (e) {
    return { file, ok: false, diagnostics: e.diagnostics || [{ file: fileRel, line: 1, code: 'BUILD', message: e.message, fix: '看这一条的上下文' }] };
  }
}

/* 优先自带 Chromium；找不到就退系统 Chrome / Edge。 */
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

/* 盒式缩放：每个目标像素取源像素的平均值。780 预览就靠它，不用 canvas。 */
export async function downscale(buf, targetW) {
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

/**
 * files → 产物。返回体检单对象（CLI 打印它，测试读它）。
 *   shots    false = 只构建 + 自检（vk check）
 *   output   产物目录（绝对路径）
 *   onlyFrame 只出这一帧（按 vk-page 的 id）
 *   preview  false = 不出 780 预览
 *   sheet    true = 再拼一张联系表
 */
export async function renderFiles(files, { shots = true, output = path.join(ROOT, 'out'), onlyFrame = null, preview = true, sheet = false } = {}) {
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
      const picked = onlyFrame ? frames.filter((x) => x.id === onlyFrame) : frames;
      if (!frames.length) report.diagnostics.push({ file: rel(f), line: 1, code: 'FRAME', message: '这一页没有 <vk-page>：什么都没画出来', fix: '把内容包进 <vk-page>…</vk-page>' });
      else if (onlyFrame && !picked.length)
        report.diagnostics.push({ file: rel(f), line: 1, code: 'FRAME', message: `这一页没有 id="${onlyFrame}" 的帧`, fix: `这一页的 id：${frames.map((x) => x.id || '(无 id)').join(' / ')}` });
      for (const err of errors) report.diagnostics.push({ file: rel(f), line: 1, code: 'RUNTIME', message: `运行期错误：${err}`, fix: '这是页面脚本/组件抛的，不是版式问题' });

      const base = path.basename(f, '.html');
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
          fs.mkdirSync(output, { recursive: true });
          png = path.join(output, `${name}.png`);
          const buf = await page.locator('vk-page').nth(fr.index).screenshot();
          fs.writeFileSync(png, buf);
          if (preview) {
            png780 = path.join(output, `${name}.780.png`);
            const small = await downscale(buf, 780);
            if (small) fs.writeFileSync(png780, small);
          }
        }

        const data = { id: fr.id, ok: audit.ok, fits: audit.fits, issues: audit.issues, health: audit.health, warns: [...new Set(warns)] };
        const jsonPath = path.join(output, `${name}.json`);
        fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
        fs.writeFileSync(jsonPath, JSON.stringify({ file: rel(f), ...data }, null, 1) + '\n');
        report.frames.push({ file: rel(f), name, png: png ? rel(png) : null, png780: png780 ? rel(png780) : null, json: rel(jsonPath), ...data });
      }
      await page.close();
    }
    if (shots && sheet) await makeSheet(browser, report.frames, output);
  } finally {
    await browser.close();
  }
  report.ok = report.frames.length > 0;
  report.clean = report.diagnostics.length === 0 && report.frames.every((x) => x.ok && x.fits);
  return report;
}

/* 联系表：把所有 780 预览拼成一张，给人一眼扫完整集（验收工具，不是模板）。 */
async function makeSheet(browser, frames, dir) {
  const withShot = frames.filter((f) => f.png780);
  if (!withShot.length) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cells = withShot
    .map((f) => {
      const url = pathToFileURL(path.resolve(process.cwd(), f.png780)).href;
      const h = f.health;
      const fact = h ? `${h.content}/${h.band}${h.overflow ? ` 超出 ${h.overflow}` : ''} · 焦点 ${h.focus}` : '';
      return `<figure><img src="${url}" alt=""><figcaption><b>${esc(f.name)}</b> ${esc(fact)}</figcaption></figure>`;
    })
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:20px;background:#eef1f5;font:15px/1.5 "Inter","Segoe UI",system-ui,sans-serif;color:#20242a}
    main{display:grid;grid-template-columns:repeat(2,780px);gap:20px;width:1580px}
    figure{margin:0;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 0 0 1px #cfd6df}
    img{display:block;width:780px;height:auto}
    figcaption{padding:8px 12px;color:#5b6472;border-top:1px solid #e3e8ee}
    figcaption b{color:#20242a;font-weight:600}
  </style><main>${cells}</main>`;
  const page = await browser.newPage({ viewport: { width: 1620, height: 900 } });
  const tmp = path.join(dir, '.sheet.html');
  fs.writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))));
  const out = path.join(dir, 'sheet.png');
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
  fs.rmSync(tmp, { force: true });
  console.log(`联系表：${rel(out)}`);
}
