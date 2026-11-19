/**
 * vk render —— 构建页 → 开浏览器 → 自检 → 出图 → 联系表。
 *
 *   import { renderFiles, collect } from '../tools/render.mjs';
 *
 * 这里是 CLI 的“手”，不是命令层：不解析参数、不打印报表，只把文件变成产物。
 * 页面先进 .vk-tmp/pages/，再逐帧截图；693 预览由 1920 原图盒式缩放得到。
 *
 * v27 的三条硬约束：
 *   · 只用 Playwright 自带的 Chromium；版本不支持 light-dark() / text-wrap:balance 就报错，
 *     绝不回退系统 Chrome/Edge 出一批「颜色全错但 ok:true」的图。
 *   · 一个文件失败只影响它自己的帧，--json 永远有报告。
 *   · 产物名用相对 ROOT 的路径做 hash，换目录跑不改名。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { VERSION } from '../src/contract.mjs';
import * as codesTables from '../src/contract/codes.mjs';
import { CANVAS, PHONE_W } from '../src/vocab.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PAGES = path.join(ROOT, '.vk-tmp', 'pages');
/** 手机横屏满屏：390×844 的屏幕放 16:9 视频，有效宽度 693（不是 780）。 */
export const PREVIEW_W = PHONE_W;
const VIEWPORT = { width: CANVAS.w, height: CANVAS.h };
const OUT_MANIFEST = '.manifest.json';

/* ---------------------------------------------------------------- 严重度
   hint 只进每帧的 hints（终端打成「事实」行），不参与 ok、不影响 exit。
   判定只在这一处：src/contract/codes.mjs 导出 isHint 就用它，其次 severityOf，
   都没有时退回这张兜底表。 */
const HINT_FALLBACK = new Set(['MARK_PARTIAL', 'LANG_MISSING', 'ATTR_IGNORED', 'VALUE_CLAMP']);
export const isHintCode =
  typeof codesTables.isHint === 'function'
    ? codesTables.isHint
    : typeof codesTables.severityOf === 'function'
      ? (code) => codesTables.severityOf(code) === 'hint'
      : (code) => HINT_FALLBACK.has(code);
const isHint = isHintCode;

export function splitBySeverity(list) {
  const errors = [];
  const hints = [];
  for (const d of list) (isHint(d.code) ? hints : errors).push(d);
  return { errors, hints };
}

/** 给页面里的 await 一个上限：某页卡死不要在 evaluate 上无限等（unref，不拖住进程退出）。 */
const timeoutValue = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms).unref());

/** 相对 ROOT 的路径：产物名与报告里的 file 都用它，和 cwd 无关。 */
const rootRel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
/** 给人看的路径：尽量相对 cwd；出去 REPO 就回落到绝对路径。 */
const show = (p) => {
  const r = path.relative(process.cwd(), p).split(path.sep).join('/');
  return r.startsWith('..') ? path.resolve(p).split(path.sep).join('/') : r;
};
const safeId = (s) =>
  String(s || '')
    .replace(/[^A-Za-z0-9_\-\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

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
      else if (abs.toLowerCase().endsWith('.html')) out.push(abs);
    }
  };
  walk(p);
  return out;
}

async function buildPage(file) {
  const { transformHtml } = await import('../src/build/index.mjs');
  const abs = path.resolve(file);
  const fileRel = rootRel(abs);
  try {
    const html = fs.readFileSync(abs, 'utf8');
    /* 仓外文件不能只按 basename 落暂存页：ep1/index.html 和 ep2/index.html 会互相覆盖。 */
    const outsideName = `${crypto.createHash('sha1').update(abs).digest('hex').slice(0, 10)}-${path.basename(abs)}`;
    const out = path.join(PAGES, fileRel.startsWith('..') ? path.join('_outside', outsideName) : fileRel);
    const res = await transformHtml(html, { file: abs });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, res.html);
    return { file: abs, ok: true, out, diagnostics: res.diagnostics };
  } catch (e) {
    return { file: abs, ok: false, diagnostics: e.diagnostics || [{ file: fileRel, line: 1, code: 'BUILD', message: e.message, fix: '看这一条的上下文' }] };
  }
}

/* ---------------------------------------------------------------- 引擎
   只认 Playwright 自带 Chromium。缺了就说装，不支持两个新特性就报错——
   系统 Chrome/Edge 太老时 light-dark() 会整体失效，出的是「色全错」的图。 */
export async function launch() {
  const { chromium } = await import('playwright');
  const args = [
    '--allow-file-access-from-files',
    '--font-render-hinting=none',
    '--disable-gpu',
    '--disable-lcd-text',
    '--disable-partial-raster',
    '--force-color-profile=srgb',
    '--run-all-compositor-stages-before-draw',
  ];
  let browser;
  try {
    browser = await chromium.launch({ args });
  } catch (e) {
    const why = String(e.message || e).split('\n')[0];
    throw new Error(`找不到 Playwright 自带的 Chromium：${why}\n  → 跑 npx playwright install chromium（不自动改用系统 Chrome/Edge：老版本不支持 light-dark() / text-wrap:balance）`);
  }

  const version = browser.version();
  try {
    const probe = await browser.newPage();
    const caps = await probe.evaluate(() => ({
      lightDark: CSS.supports('color', 'light-dark(#ffffff, #0b0f14)'),
      balance: CSS.supports('text-wrap', 'balance'),
    }));
    await probe.close();
    if (!caps.lightDark || !caps.balance) {
      const lack = [!caps.lightDark && 'light-dark()', !caps.balance && 'text-wrap:balance'].filter(Boolean).join(' / ');
      throw new Error(`Chromium ${version} 不支持 ${lack}：这样出的图会静默错色/错版\n  → 跑 npx playwright install chromium 换自带的新版本，别用系统浏览器`);
    }
  } catch (e) {
    await browser.close().catch(() => {});
    throw e;
  }
  return { browser, channel: 'chromium', version };
}

/* 盒式缩放：每个目标像素取源像素的平均值。693 预览就靠它，不用 canvas。
   CANVAS.w → PHONE_W，比例写进目标高度，和 deviceScaleFactor 无关。 */
export async function downscale(buf, targetW = PHONE_W) {
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

/* ---------------------------------------------------------------- 一页
   只处理一个构建好的页面；页级失败（goto 超时等）抛出去，调用方只记这一页。 */
async function renderOne(browser, built, opts, report) {
  const f = built.file;
  const { shots, output, preview, onlyFrame } = opts;
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  try {
    page.setDefaultTimeout(30_000);
    const errors = [];
    const warns = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
      else if (m.type() === 'warning') warns.push(m.text().replace(/\s*JSHandle@node\s*$/, ''));
    });

    await page.goto(pathToFileURL(built.out).href, { waitUntil: 'load', timeout: 30_000 });
    const ready = await Promise.race([
      page
        .evaluate(async () => {
          if (!window.vk?.ready) return 'no-runtime';
          try {
            await window.vk.ready();
          } catch (e) {
            return `error: ${e?.message || e}`;
          }
          return document.documentElement.hasAttribute('data-vk-ready') ? 'ok' : 'not-ready';
        })
        .catch((e) => `error: ${e?.message || e}`),
      timeoutValue(15_000, 'timeout'),
    ]);
    const runtimeIssue =
      ready === 'ok'
        ? null
        : {
            code: 'RUNTIME',
            message: ready === 'timeout' ? '运行期 15s 没就绪：这一帧照出图，但可能没量过' : `运行期没有就绪（${ready}）：画面可能没量过`,
            fix: '检查 dist/vk.js 是否在页面里；图片/字体是不是卡住了；重新 vk build',
          };

    /* 自检脚本坏掉不该拖垮出图：拿不到就报一条 AUDIT，照常截图。 */
    let auditBroken = null;
    try {
      await page.addScriptTag({ path: path.join(DIST, 'audit.js') });
    } catch (e) {
      auditBroken = `自检脚本没注入：${e.message}`;
    }

    const frames = await page.evaluate(() =>
      [...document.querySelectorAll('vk-page')].map((p, i) => {
        const r = p.getBoundingClientRect();
        return { id: p.id || '', index: i, x: r.left, y: r.top, w: r.width, h: r.height };
      })
    );
    const picked = onlyFrame ? frames.filter((x) => x.id === onlyFrame) : frames;
    if (!frames.length) report.diagnostics.push({ file: rootRel(f), line: 1, code: 'FRAME', message: '这一页没有 <vk-page>：什么都没画出来', fix: '把内容包进 <vk-page>…</vk-page>' });
    else if (onlyFrame && !picked.length)
      report.diagnostics.push({ file: rootRel(f), line: 1, code: 'FRAME', message: `这一页没有 id="${onlyFrame}" 的帧`, fix: `这一页的 id：${frames.map((x) => x.id || '(无 id)').join(' / ')}` });
    for (const err of errors) report.diagnostics.push({ file: rootRel(f), code: 'RUNTIME', message: `运行期错误：${err}`, fix: '这是页面脚本/组件抛的，不是版式问题' });

    const base = path.parse(f).name;
    for (const fr of picked) {
      const tag = safeId(fr.id) || String(fr.index + 1).padStart(2, '0');
      let name = frames.length > 1 ? `${base}-${tag}` : base;
      for (let n = 2; report.frames.some((x) => x.name === name); n++) name = `${base}-${tag}-${n}`;
      /* 同一个 out/ 里再放另一个同名文件：加源路径短 hash，别静默覆盖。
         hash 用相对 ROOT 的路径，换个 cwd 跑产物名不变。 */
      const priorJson = path.join(output, `${name}.json`);
      if (fs.existsSync(priorJson)) {
        try {
          const prior = JSON.parse(fs.readFileSync(priorJson, 'utf8'));
          if (prior.file && prior.file !== rootRel(f)) name = `${base}-${tag}-${crypto.createHash('sha1').update(rootRel(f)).digest('hex').slice(0, 6)}`;
        } catch {
          /* 旧的坏 JSON 不挡新产物 */
        }
      }

      const rec = { file: rootRel(f), name, id: fr.id, png: null, preview: null, json: null, ok: false, fits: false, issues: [], hints: [], health: null, warns: [...new Set(warns)], engine: opts.engine };
      try {
        let audit;
        const auditRun = await Promise.race([
          page
            .evaluate((idx) => {
              const stage = document.querySelectorAll('.vk-stage')[idx];
              if (!window.vkAudit) return { issues: [{ code: 'AUDIT', message: '页面里没有自检运行时', fix: '重新 vk build' }], health: null, fits: false };
              return window.vkAudit.page(stage);
            }, fr.index)
            .then((x) => ({ ok: true, audit: x }))
            .catch((e) => ({ ok: false, message: e.message })),
          timeoutValue(20_000, { timeout: true }),
        ]);
        if (auditRun.timeout) audit = { issues: [{ code: 'AUDIT', message: '自检 20s 没跑完（页面可能卡住了）', fix: '这一帧照常出图；看页面里有没有死循环/等不到的资源' }], health: null, fits: false };
        else if (!auditRun.ok) audit = { issues: [{ code: 'AUDIT', message: `自检没跑完：${auditRun.message}`, fix: '重新 vk build；这一帧照常出图' }], health: null, fits: false };
        else audit = auditRun.audit;
        if (auditBroken) audit.issues = [{ code: 'AUDIT', message: auditBroken, fix: '重新 vk build' }, ...(audit.issues || [])];

        /* 构建期诊断按帧归位：坏帧不再是一张「ok: true」的绿纸。
           severity=hint 的只进 hints：合法但不是本意，不拦出图。 */
        const buildRaw = built.diagnostics
          .filter((d) => d.frame === fr.index)
          .map((d) => ({ code: d.code, message: d.message, fix: d.fix, line: d.line, origin: 'build' }));
        const buildBits = splitBySeverity(buildRaw);
        const buildCodes = new Set(buildRaw.map((i) => i.code));
        const auditRaw = (audit.issues || []).filter((i) => !(i.code === 'ANCHOR' && buildCodes.has('ANCHOR_MISSING')));
        const auditBits = splitBySeverity(auditRaw);
        const issues = [...(runtimeIssue ? [runtimeIssue] : []), ...buildBits.errors, ...auditBits.errors];
        /* 自检自己产出的 hints 是独立数组（不混进 issues），这里合并。
           code 必须登记在 src/contract/codes.mjs 且 severity=hint，否则不会走到这里。 */
        const auditHints = (audit.hints || []).map((h) => ({ code: h.code, message: h.message, fix: h.fix, origin: 'audit' }));
        const hints = [...buildBits.hints, ...auditBits.hints, ...auditHints].map((h) => ({ code: h.code, message: h.message, fix: h.fix, ...(h.line != null ? { line: h.line } : {}) }));

        let png = null;
        let previewFile = null;
        if (shots) {
          fs.mkdirSync(output, { recursive: true });
          png = path.join(output, `${name}.png`);
          const buf = await page.locator('vk-page').nth(fr.index).screenshot({ timeout: 30_000 });
          fs.writeFileSync(png, buf);
          rec.png = show(png);
          if (preview) {
            previewFile = path.join(output, `${name}.phone.png`);
            const small = await downscale(buf, PREVIEW_W);
            if (small) fs.writeFileSync(previewFile, small);
            rec.preview = show(previewFile);
          }
        }

        const data = { ok: issues.length === 0, fits: audit.fits, issues, hints, health: audit.health };
        rec.ok = data.ok;
        rec.fits = data.fits;
        rec.issues = issues;
        rec.hints = hints;
        rec.health = audit.health;
        const jsonPath = path.join(output, `${name}.json`);
        fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
        fs.writeFileSync(jsonPath, JSON.stringify({ file: rec.file, id: rec.id, engine: rec.engine, ...data, warns: rec.warns }, null, 1) + '\n');
        rec.json = show(jsonPath);
      } catch (e) {
        rec.issues = [
          ...(runtimeIssue ? [runtimeIssue] : []),
          { code: 'RUNTIME', message: `这一帧没出图：${e.message}`, fix: '这一帧失败不影响其它帧；看它是不是太大/卡死' },
        ];
      }
      report.frames.push(rec);
    }
  } finally {
    await page.close().catch(() => {});
  }
}

/* ---------------------------------------------------------------- 孤儿清理
   每次出图都把本次产物文件名写进 out/.manifest.json；下次启动先删旧清单里没再产出的文件。
   --frame 只出一部分，清单取并集，不删其它帧。 */
function recordOutputs(output, names, { keepPrior }) {
  const mf = path.join(output, OUT_MANIFEST);
  let prior = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(mf, 'utf8'));
    if (Array.isArray(parsed.files)) prior = parsed.files.filter((n) => typeof n === 'string');
  } catch {
    /* 没有旧清单：第一次 */
  }
  const safe = (n) => n && !n.includes('/') && !n.includes('\\') && n !== OUT_MANIFEST && /\.(png|json)$/.test(n);
  const now = new Set(names.filter(safe));
  let removed = 0;
  if (!keepPrior) {
    for (const n of prior) {
      if (!safe(n) || now.has(n)) continue;
      const abs = path.join(output, n);
      if (fs.existsSync(abs)) {
        fs.rmSync(abs, { force: true });
        removed++;
      }
    }
  }
  const files = keepPrior ? [...new Set([...prior.filter(safe), ...now])].sort() : [...now].sort();
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(mf, JSON.stringify({ version: VERSION, files }, null, 1) + '\n');
  if (removed) console.error(`清掉 ${removed} 个上次留下、这次没有的产物`);
}

/**
 * files → 产物。返回体检单对象（CLI 打印它，测试读它）。
 *   shots    false = 只构建 + 自检（vk render --check）
 *   output   产物目录（绝对路径）
 *   onlyFrame 只出这一帧（按 vk-page 的 id）
 *   preview  false = 不出 693 预览
 *   sheet    true = 再拼一张联系表
 */
export async function renderFiles(files, { shots = true, output = path.join(ROOT, 'out'), onlyFrame = null, keepPrior = false, preview = true, sheet = false } = {}) {
  const report = { version: VERSION, ok: false, clean: false, engine: null, diagnostics: [], hints: [], frames: [], produced: 0, inputs: files.length };
  const builtList = [];
  for (const f of files) {
    const built = await buildPage(f);
    if (!built.ok) {
      const bits = splitBySeverity(built.diagnostics);
      report.diagnostics.push(...bits.errors);
      report.hints.push(...bits.hints);
    } else {
      for (const d of built.diagnostics) if (d.frame == null) (isHint(d.code) ? report.hints : report.diagnostics).push(d);
      builtList.push(built);
    }
  }
  if (!builtList.length) return report;

  let engine;
  try {
    engine = await launch();
  } catch (e) {
    report.diagnostics.push({ file: 'dist', line: 1, code: 'ENGINE', message: e.message, fix: 'npx playwright install chromium' });
    return report;
  }
  report.engine = { channel: engine.channel, version: engine.version };
  const opts = { shots, output, preview, onlyFrame, engine: report.engine };

  try {
    for (const built of builtList) {
      try {
        await renderOne(engine.browser, built, opts, report);
      } catch (e) {
        report.diagnostics.push({
          file: rootRel(built.file),
          line: 1,
          code: 'RUNTIME',
          message: `这一页没出图：${e.message}`,
          fix: '只影响这一页；继续下一页。看它是不是超大或卡死',
        });
      }
    }
    if (shots && sheet && report.frames.some((f) => f.preview)) {
      try {
        await makeSheet(engine.browser, report.frames, output);
      } catch (e) {
        report.diagnostics.push({ file: rootRel(path.join(output, 'sheet.png')), line: 1, code: 'RUNTIME', message: `联系表没拼出来：${e.message}`, fix: '不影响单帧产物' });
      }
    }
  } finally {
    await engine.browser.close().catch(() => {});
  }

  report.produced = report.frames.length;
  report.ok = report.frames.length > 0 && report.diagnostics.length === 0 && report.frames.every((f) => f.ok);
  report.clean = report.ok && report.frames.every((f) => f.fits);
  /* 孤儿清单在最后写：只有真的出图了才动上一轮的产物。 */
  if (shots && report.frames.length) {
    const names = report.frames.flatMap((f) => [f.png, f.preview, f.json].filter(Boolean).map((p) => path.basename(p)));
    if (sheet && fs.existsSync(path.join(output, 'sheet.png'))) names.push('sheet.png');
    try {
      recordOutputs(output, names, { keepPrior: !!onlyFrame || keepPrior });
    } catch (e) {
      report.diagnostics.push({ file: rootRel(path.join(output, OUT_MANIFEST)), line: 1, code: 'ASSET', message: `产物清单没写成：${e.message}`, fix: '检查 out/ 是否可写' });
    }
  }
  return report;
}

/* 联系表：把所有手机预览拼成一张，给人一眼扫完整集（验收工具，不是模板）。 */
async function makeSheet(browser, frames, dir) {
  const withShot = frames.filter((f) => f.preview);
  if (!withShot.length) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cells = withShot
    .map((f) => {
      const url = pathToFileURL(path.join(dir, `${f.name}.phone.png`)).href;
      const h = f.health;
      const fact = h ? `${h.content}/${h.band}${h.overflow ? ` 超出 ${h.overflow}` : ''} · 焦点 ${h.focus} · 最小字 ${h.minFont}` : '';
      return `<figure><img src="${url}" alt=""><figcaption><b>${esc(f.name)}</b> ${esc(fact)}</figcaption></figure>`;
    })
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:20px;background:#eef1f5;font:15px/1.5 "Inter","Segoe UI",system-ui,sans-serif;color:#20242a}
    main{display:grid;grid-template-columns:repeat(2,${PREVIEW_W}px);gap:20px;width:${PREVIEW_W * 2 + 20}px}
    figure{margin:0;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 0 0 1px #cfd6df}
    img{display:block;width:${PREVIEW_W}px;height:auto}
    figcaption{padding:8px 12px;color:#5b6472;border-top:1px solid #e3e8ee}
    figcaption b{color:#20242a;font-weight:600}
  </style><main>${cells}</main>`;
  const page = await browser.newPage({ viewport: { width: PREVIEW_W * 2 + 60, height: 900 } });
  const tmp = path.join(dir, '.sheet.html');
  fs.writeFileSync(tmp, html);
  try {
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))));
    const out = path.join(dir, 'sheet.png');
    await page.screenshot({ path: out, fullPage: true });
    console.error(`联系表：${show(out)}`);
  } finally {
    await page.close().catch(() => {});
    fs.rmSync(tmp, { force: true });
  }
}
