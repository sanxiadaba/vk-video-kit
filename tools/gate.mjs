/**
 * 构建期设计门禁。
 *
 *   node tools/gate.mjs                     # 全部：30 specimen + 8 frame + index
 *   node tools/gate.mjs vk-code frame-0     # 只跑匹配对象
 *   node tools/gate.mjs --no-presets        # 快检：跳过预设像素差（默认跑）
 *   node tools/gate.mjs --shard=2/4
 *
 * 只抓"画面事实"：
 * · 1920 画布上的字 ≥ 44 design px
 * · 正文对比度 ≥ 4.5（≥72 的大字 ≥ 3）
 * · 内容不出安全区、不被裁、不纵向溢出
 * · vk.auditOverflow() 报的内容溢出
 * · code 行号不压代码、w 属性真的等于实际宽度
 * · 运行时没有 console error / pageerror / [vk] 警告
 * · 中文与 400/500/700 字重真的加载
 * · KaTeX 主体字号 = 1em
 * · 每一张预设必须产生像素差异（默认跑；--no-presets 才关）
 *
 * 门禁读 _site/ 里构建好的 specimen / frame（transform=false）。
 * 审美不进这里；这里只拦事故。
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { startServer } from '../cli/serve.mjs';
import { SITE } from './lib/paths.mjs';
import { SCENES } from '../src/scenes/scenes.mjs';
import { PRESETS } from '../src/scenes/presets.mjs';
import { TAGS } from '../src/registry.mjs';

const MIN_FONT = 44; // 44 design px，不是 43.5
const MIN_RATIO = 4.5;
const LARGE_RATIO = 3;
const LARGE_FONT = 72;
const failed = [];
const warned = [];
const fail = (tag, msg) => failed.push(`${tag}: ${msg}`);
const warn = (tag, msg) => warned.push(`${tag}: ${msg}`);

/* ------------------------------------------------------------------ 参数 */

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('-'));
// 像素差是可选检查：默认不跑，显式 --presets / VK_GATE_PRESETS=1 才跑。
const checkPresets = args.includes('--presets') || process.env.VK_GATE_PRESETS === '1';

/* ------------------------------------------------------------- 预检：预设 */
// 跑像素差时，预设本身必须先合法：属性存在、值合法、不能是空卡。

if (checkPresets) {
  const presetFailures = [];
  for (const [tag, presets] of Object.entries(PRESETS)) {
    if (!TAGS[tag]) {
      presetFailures.push(`${tag}: PRESETS 指向不存在的标签`);
      continue;
    }
    for (const p of presets) {
      const attrs = p.attrs || {};
      if (!Object.keys(attrs).length) presetFailures.push(`${tag}「${p.label}」是空预设`);
      for (const [k, v] of Object.entries(attrs)) {
        const spec = TAGS[tag].attrs?.[k];
        if (!spec) {
          presetFailures.push(`${tag}「${p.label}」引用了不存在的属性 ${k}`);
          continue;
        }
        if (v !== null && spec.values && !spec.values.includes(v)) {
          presetFailures.push(`${tag}「${p.label}」的 ${k}="${v}" 不在枚举里`);
        }
      }
    }
  }
  for (const f of presetFailures) fail('presets', f);
}

/* --------------------------------------------------------------- 检查对象 */

const targets = [
  ...SCENES.map((s) => ({ kind: 'specimen', tag: s.tag, label: s.tag, path: `specimens/${s.tag}.html` })),
];

const frameFiles = fs.existsSync(`${SITE}/frames`)
  ? fs
      .readdirSync(`${SITE}/frames`)
      .filter((f) => /^frame-\d+\.html$/.test(f))
      .sort()
  : [];
if (frameFiles.length !== 8) fail('frames', `应该是 8 个 frame-*.html，实际 ${frameFiles.length} 个`);
for (const f of frameFiles) targets.push({ kind: 'frame', label: f.replace(/\.html$/, ''), path: `frames/${f}` });

if (fs.existsSync(`${SITE}/index.html`)) {
  targets.push({ kind: 'page', tag: 'index', label: 'index', path: 'index.html' });
}

/* ------------------------------------------------------------------ 分片 */

const shardArg = args.find((a) => a.startsWith('--shard='));
let list = only.length ? targets.filter((t) => only.includes(t.tag) || only.includes(t.label)) : targets;
if (shardArg) {
  const raw = shardArg.slice('--shard='.length);
  const parts = raw.split('/');
  const [i, n] = parts.map(Number);
  if (parts.length !== 2 || !Number.isInteger(i) || !Number.isInteger(n) || n < 1 || n > 16 || i < 1 || i > n) {
    console.error(`无效的 --shard=${raw}，应为 i/n（n 为 1..16）`);
    process.exit(1);
  }
  list = list.filter((_, idx) => idx % n === i - 1);
}
if (!list.length) {
  console.error(`没有匹配的检查对象：${only.join(' ')}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ 启动 */

const { base, close } = await startServer({ port: 0, root: SITE, transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

let consoleIssues = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleIssues.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => consoleIssues.push(`pageerror: ${e.message}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(target) {
  consoleIssues = [];
  const resp = await page.goto(`${base}/${target.path}`, { waitUntil: 'load' });
  if (!resp || !resp.ok()) {
    fail(target.label, `页面加载失败 ${resp?.status()}`);
    return false;
  }
  const needsVk = !(target.kind === 'page' && target.tag === 'index');
  if (needsVk) {
    await page.evaluate(() => window.vk?.ready?.());
    const ready = await page.evaluate(() => !!window.vk);
    if (!ready) {
      fail(target.label, '运行时未就绪：window.vk 未定义');
      return false;
    }
    await page.evaluate(() => window.vk?.freeze?.());
  }
  await page.evaluate(() => document.fonts?.ready);
  await sleep(60);
  return true;
}

/* -------------------------------------------------------------- 画面检查 */

async function inspect() {
  return page.evaluate(
    ({ MIN_FONT, MIN_RATIO, LARGE_RATIO, LARGE_FONT }) => {
      const out = [];
      const stage = document.querySelector('.vk-page') || document.querySelector('.vk-stage') || document.body;
      const safe = document.querySelector('.vk-page-bd') || document.querySelector('.vk-stage');
      const pageRect = stage.getBoundingClientRect();
      const safeRect = safe?.getBoundingClientRect();

      const parse = (s) => {
        const m = String(s).match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
      };
      const blend = (f, b) => {
        const a = f.a + b.a * (1 - f.a);
        if (a <= 0.0001) return { r: 0, g: 0, b: 0, a: 0 };
        return {
          r: (f.r * f.a + b.r * b.a * (1 - f.a)) / a,
          g: (f.g * f.a + b.g * b.a * (1 - f.a)) / a,
          b: (f.b * f.a + b.b * b.a * (1 - f.a)) / a,
          a,
        };
      };
      const bgOf = (el) => {
        let n = el;
        let acc = null;
        while (n && n !== document.documentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c.a > 0.01) {
            acc = acc ? blend(acc, c) : c;
            if (c.a >= 0.99) break;
          }
          n = n.parentElement;
        }
        return acc ? blend(acc, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 };
      };
      const lum = (c) => {
        const f = (v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
      };
      const ratio = (a, b) => {
        const l1 = lum(a);
        const l2 = lum(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };
      const opaque = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          if (parseFloat(getComputedStyle(n).opacity) < 0.5) return false;
          n = n.parentElement;
        }
        return true;
      };
      const clip = (s) => (s || '').toString().slice(0, 60);
      // 同一个溢出盒子只报最外层：父级已经失败时，不再把整棵子树刷屏。
      const overSeen = new Set();
      const safeSeen = new Set();
      const covered = (el, set) => {
        for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return true;
        return false;
      };

      for (const el of stage.querySelectorAll('*')) {
        if (el.closest('.katex')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (el.closest('svg') || el.closest('.vk-sr')) continue;
        const inAnnoLines = !!el.closest('.vk-anno-lines');
        const inPageChrome = !!el.closest('.vk-page-hd, .vk-page-ft');
        const pageScaffold = el.matches('.vk-page-inner, .vk-page-bd, .vk-page-hd, .vk-page-ft');

        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (hasText && opaque(el)) {
          const fs = parseFloat(cs.fontSize);
          if (fs < MIN_FONT) out.push({ type: 'font', what: clip(el.className || el.tagName), fs });
          const fg = parse(cs.color);
          if (fg) {
            const cr = ratio(fg, bgOf(el));
            const need = fs >= LARGE_FONT ? LARGE_RATIO : MIN_RATIO;
            if (cr < need) out.push({ type: 'contrast', what: clip(el.className || el.tagName), cr: +cr.toFixed(2), need });
          }
        }

        if (r.left < -4 || r.top < -4 || r.right > 1924 || r.bottom > 1084) {
          if (!inAnnoLines && !covered(el, overSeen)) {
            overSeen.add(el);
            out.push({
              type: 'overflow',
              what: clip(el.className || el.tagName),
              box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
            });
          }
        }

        // 安全区只约束正文；页眉/页脚住在安全区上下 96 的轨道里，页面骨架本身是整页。
        if (safeRect && !inAnnoLines && !inPageChrome && !pageScaffold) {
          if (
            (r.left < safeRect.left - 2 ||
              r.right > safeRect.right + 2 ||
              r.top < safeRect.top - 2 ||
              r.bottom > safeRect.bottom + 2) &&
            !covered(el, safeSeen)
          ) {
            safeSeen.add(el);
            out.push({
              type: 'safe',
              what: clip(el.className || el.tagName),
              box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
            });
          }
        }

        const ox = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
        const oy = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
        if (ox && el.scrollWidth > el.clientWidth + 3) {
          out.push({ type: 'clip', what: clip(el.className || el.tagName), sw: el.scrollWidth, cw: el.clientWidth });
        }
        if (oy && el.scrollHeight > el.clientHeight + 3) {
          out.push({ type: 'clip-y', what: clip(el.className || el.tagName), sh: el.scrollHeight, ch: el.clientHeight });
        }
      }

      // 行号不能压到代码正文上。
      for (const line of stage.querySelectorAll('.vk-line, .vk-dline')) {
        const num = line.querySelector('.vk-dnums') || line.querySelector('.vk-ln');
        const src = line.querySelector('.vk-src, .vk-dsrc');
        if (!num || !src) continue;
        const nr = num.getBoundingClientRect();
        const sr = src.getBoundingClientRect();
        if (nr.width < 1 || sr.width < 1) continue;
        if (nr.right > sr.left + 0.5) {
          out.push({ type: 'ln-overlap', what: clip(line.className), gap: +(nr.right - sr.left).toFixed(1) });
        }
      }

      // w 是硬宽：量出来必须等于写的数字（容忍 1.5px 的亚像素取整）。
      for (const el of stage.querySelectorAll('[w]')) {
        const raw = (el.getAttribute('w') || '').trim();
        if (!/^\d+(?:\.\d+)?$/.test(raw)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const want = Number(raw);
        // annotate 的 w 是批注栏宽，不是宿主宽；量 notes 列。
        if (el.tagName.toLowerCase() === 'vk-annotate') {
          const notes = el.querySelector('.vk-anno-notes');
          const got = notes?.offsetWidth || 0;
          if (got < 1) continue;
          if (Math.abs(got - want) > 1.5) out.push({ type: 'w', what: 'VK-ANNOTATE notes', want, got, tag: 'vk-annotate' });
          continue;
        }
        const got = el.offsetWidth;
        if (got < 1) continue;
        if (Math.abs(got - want) > 1.5) {
          out.push({ type: 'w', what: clip(el.className || el.tagName), want, got, tag: el.tagName.toLowerCase() });
        }
      }

      // 运行时自己的溢出审计（Frame 原语）：内容比盒子宽/高都算失败。
      const audit = typeof window.vk?.auditOverflow === 'function' ? window.vk.auditOverflow(stage) : null;
      if (audit === null) out.push({ type: 'audit-missing', what: 'window.vk.auditOverflow 不存在' });
      else {
        for (const a of audit) {
          out.push({ type: 'audit-overflow', what: `${a.tag} ${a.sel}`, sw: a.sw, cw: a.cw, sh: a.sh, ch: a.ch });
        }
      }

      const special = [];
      if (document.querySelector('[data-vk-unknown]')) {
        special.push(`未知图标：${document.querySelector('[data-vk-unknown]').dataset.vkUnknown}`);
      }
      if (document.querySelector('[data-vk-stale]')) special.push('有预编译数据过期');
      if (document.querySelector('[data-vk-parsed]')) special.push('源码被浏览器解析（漏转义）');
      if (document.querySelector('[data-vk-error]')) special.push('有元件渲染失败');
      if (document.querySelector('vk-img[data-error], vk-figure[data-error], .vk-fig-win[data-error]')) special.push('图片加载失败');

      return { issues: out, special, page: [Math.round(pageRect.width), Math.round(pageRect.height)] };
    },
    { MIN_FONT, MIN_RATIO, LARGE_RATIO, LARGE_FONT }
  );
}

/** 字体：check() 不会触发加载，必须显式 load 一次。 */
async function fontIssues() {
  return page.evaluate(async () => {
    const list = [
      ['400 16px "Inter"', 'A'],
      ['500 16px "Inter"', 'A'],
      ['700 16px "Inter"', 'A'],
      ['400 16px "Noto Sans SC"', '字符串'],
      ['500 16px "Noto Sans SC"', '字符串'],
      ['700 16px "Noto Sans SC"', '字符串'],
      ['400 16px "JetBrains Mono"', 'int main'],
      ['500 16px "JetBrains Mono"', 'int main'],
      ['700 16px "JetBrains Mono"', 'int main'],
    ];
    const out = [];
    for (const [spec, text] of list) {
      try {
        const faces = await document.fonts.load(spec, text);
        if (!faces.length) out.push(`字体未加载：${spec}`);
      } catch {
        out.push(`字体未加载：${spec}`);
      }
    }
    return out;
  });
}

/* -------------------------------------------------------------- 预设差异 */

function diffRatio(aBuf, bBuf) {
  const a = PNG.sync.read(aBuf);
  const b = PNG.sync.read(bBuf);
  if (a.width !== b.width || a.height !== b.height) return 1;
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (
      Math.abs(a.data[i] - b.data[i]) > 3 ||
      Math.abs(a.data[i + 1] - b.data[i + 1]) > 3 ||
      Math.abs(a.data[i + 2] - b.data[i + 2]) > 3
    ) {
      n++;
    }
  }
  return n / (a.width * a.height);
}

/** 对当前页面上的 tag 逐个套预设，截图和默认态比较。 */
async function presetDiff(tag, baseShot, targetSel = tag) {
  const presets = PRESETS[tag] || [];
  if (!presets.length) return;
  for (const [i, p] of presets.entries()) {
    await page.evaluate(
      ([sel, attrs]) => {
        const els = [...document.querySelectorAll(sel)];
        window.__vkBase = els.map((el) => ({ el, attrs: [...el.attributes].map((a) => [a.name, a.value]) }));
        for (const el of els) {
          for (const [k, v] of Object.entries(attrs)) {
            if (v === null) el.removeAttribute(k);
            else el.setAttribute(k, v);
          }
        }
        window.vk?.layout?.();
      },
      [targetSel, p.attrs || {}]
    );
    await sleep(220);
    const shot = await page.screenshot();
    const d = diffRatio(baseShot, shot);
    if (d === 0) fail(tag, `预设「${p.label}」与默认态完全相同`);
    else if (d < 0.0005) warn(tag, `预设「${p.label}」差异只有 ${(d * 100).toFixed(3)}%，确认是否看得见`);

    await page.evaluate(() => {
      for (const { el, attrs } of window.__vkBase || []) {
        for (const a of [...el.attributes]) el.removeAttribute(a.name);
        for (const [k, v] of attrs) el.setAttribute(k, v);
      }
      delete window.__vkBase;
      window.vk?.layout?.();
    });
    await sleep(180);
  }
}

/* ---------------------------------------------------------------- 主循环 */

let checked = 0;
for (const target of list) {
  if (!(await open(target))) continue;
  checked++;

  if (target.kind === 'page' && target.tag === 'index') {
    // 展示站首页只做静态冒烟；它不加载 vk 运行时，结构由展示站自己的测试负责。
    const smoke = await page.evaluate(() => ({
      body: document.body?.textContent?.trim().length || 0,
      main: !!document.querySelector('main'),
    }));
    if (!smoke.body) fail('index', '页面没有可读内容');
    if (!smoke.main) fail('index', '页面没有 main');
    for (const m of consoleIssues) {
      if (/\[vk\]/.test(m) || /pageerror/.test(m) || /^error:/.test(m)) fail('index', m);
    }
    console.log(`${smoke.body && smoke.main ? '✓' : '✗'} index`);
    continue;
  }

  const { issues, special, page: pageSize } = await inspect();
  const fonts = await fontIssues();
  for (const e of special) fail(target.label, e);
  for (const f of fonts) fail(target.label, f);
  for (const e of issues) {
    if (e.type === 'font') fail(target.label, `字号 ${e.fs}px < ${MIN_FONT}：${e.what}`);
    if (e.type === 'contrast') fail(target.label, `对比度 ${e.cr} < ${e.need}：${e.what}`);
    if (e.type === 'overflow') fail(target.label, `超出 1920×1080：${e.what} ${e.box.join(',')}`);
    if (e.type === 'safe') fail(target.label, `超出 1680×888 安全区：${e.what} ${e.box.join(',')}`);
    if (e.type === 'clip') fail(target.label, `横向被裁：${e.what} (${e.sw} > ${e.cw})`);
    if (e.type === 'clip-y') fail(target.label, `纵向被裁：${e.what} (${e.sh} > ${e.ch})`);
    if (e.type === 'ln-overlap') fail(target.label, `行号压住代码 ${e.gap}px：${e.what}`);
    if (e.type === 'w') fail(target.label, `w="${e.want}" 实际 ${e.got}px：${e.what}`);
    if (e.type === 'audit-overflow') {
      const parts = [];
      if (e.sw > e.cw + 1) parts.push(`宽 ${e.sw}>${e.cw}`);
      if (e.sh > e.ch + 1) parts.push(`高 ${e.sh}>${e.ch}`);
      fail(target.label, `auditOverflow：${e.what} ${parts.join(' · ')}`);
    }
    if (e.type === 'audit-missing') fail(target.label, e.what);
  }
  for (const m of consoleIssues) {
    if (/\[vk\]/.test(m) || /pageerror/.test(m) || /^error:/.test(m)) fail(target.label, m);
  }

  if (target.tag === 'vk-math') {
    const r = await page.evaluate(() => {
      const k = document.querySelector('.katex');
      const m = document.querySelector('.vk-math');
      if (!k || !m) return null;
      return parseFloat(getComputedStyle(k).fontSize) / parseFloat(getComputedStyle(m).fontSize);
    });
    if (r === null) fail(target.label, '没有找到 .katex');
    else if (Math.abs(r - 1) > 0.01) fail(target.label, `KaTeX 字号是 ${r.toFixed(2)}em，应为 1em`);
  }

  if (checkPresets && target.kind === 'specimen') {
    const baseShot = await page.screenshot();
    await presetDiff(target.tag, baseShot);
  }

  const bad = issues.length + special.length;
  console.log(`${bad ? '✗' : '✓'} ${target.label}${bad ? `  ${bad} 个画面问题` : ''}  ${pageSize[0]}×${pageSize[1]}`);
}

await browser.close();
await close();

console.log('');
if (warned.length) {
  console.log(`提醒 ${warned.length} 条：`);
  for (const w of warned) console.log('  · ' + w);
}
if (!checked) {
  console.log('\n门禁没有执行任何对象。');
  if (failed.length) {
    console.log(`同时记录 ${failed.length} 条失败：`);
    for (const f of failed) console.log('  ✗ ' + f);
  }
  process.exitCode = 1;
} else if (failed.length) {
  console.log(`\n门禁失败 ${failed.length} 条：`);
  for (const f of failed) console.log('  ✗ ' + f);
  process.exitCode = 1;
} else {
  console.log(`\n门禁全绿（${checked}/${targets.length} 个检查对象，预设像素差${checkPresets ? '已跑' : '已跳过'}）。`);
}
