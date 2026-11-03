/**
 * 构建期设计门禁。
 *
 *   node tools/gate.mjs                     # 全部：31 specimen + 8 frame + index
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
import { cacheEnabled, cacheKey, isCached, markCached, pageHash, sharedHash } from './lib/check-cache.mjs';
import { SITE } from './lib/paths.mjs';
import { PRESETS } from '../src/scenes/presets.mjs';
import { TAGS } from '../src/registry.mjs';

import { LIMITS } from '../src/shared/limits.mjs';

const MIN_FONT = LIMITS.fontFloor; // 36 design px = 手机 13.7px
const MIN_RATIO = LIMITS.contrastText;
const LARGE_RATIO = LIMITS.contrastLarge;
const LARGE_FONT = LIMITS.fontLarge;
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

const specimenDir = `${SITE}/specimen`;
const specimenFiles = fs.existsSync(specimenDir)
  ? fs.readdirSync(specimenDir).filter((f) => f.endsWith('.html')).sort()
  : [];
// 规格册是单镜头：每个组件一页，没有「成品 / 用法 / 解剖」多镜头。
// --full 保留为「连 index 一起查」的显式写法，不再制造不存在的 #anatomy 页面。
const targets = specimenFiles.map((f) => {
  const tag = f.replace(/\.html$/, '');
  return { kind: 'specimen', tag, path: `specimen/${f}`, label: tag };
});
if (fs.existsSync(`${SITE}/index.html`)) {
  targets.push({ kind: 'specimen', tag: 'index', label: 'index', path: 'index.html' });
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

/* ------------------------------------------------------------------ 缓存 */

const cacheOn = cacheEnabled(args);
const total = list.length;
let cacheHits = 0;
const cacheKeys = new Map();
if (cacheOn) {
  const shared = sharedHash(SITE);
  list = list.filter((t) => {
    const k = cacheKey('gate', shared, pageHash(SITE, t.path), t.label, checkPresets ? 'presets' : 'plain');
    cacheKeys.set(t.label, k);
    if (isCached(k)) {
      cacheHits++;
      return false;
    }
    return true;
  });
}
if (!list.length) {
  console.log(`门禁全绿（${total}/${total} 个检查对象，${cacheHits} 个缓存命中，未启动浏览器）。`);
  process.exit(0);
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
let loadedPath = null;

async function open(target) {
  consoleIssues = [];
  const hash = '';
  // 同一页的四个镜头只 load 一次：后面靠 hashchange 切镜头，省掉 3 次完整加载。
  if (loadedPath !== target.path) {
    const resp = await page.goto(`${base}/${target.path}${hash}`, { waitUntil: 'load' });
    if (!resp || !resp.ok()) {
      fail(target.label, `页面加载失败 ${resp?.status()}`);
      return false;
    }
    loadedPath = target.path;
  } else {
    const cur = await page.evaluate(() => location.hash);
    if (cur !== hash) await page.evaluate((h) => { location.hash = h; }, hash);
  }
  await page.evaluate(() => window.vk?.ready?.());
  const ready = await page.evaluate(() => !!window.vk);
  if (!ready) {
    fail(target.label, '运行时未就绪：window.vk 未定义');
    return false;
  }
  await page.evaluate(() => document.fonts?.ready);
  return true;
}

/* -------------------------------------------------------------- 画面检查 */

async function inspect() {
  // 画面审计只有一份：src/runtime/audit.mjs 的 auditPage。
  // 13.0 在这里还抄了一份 190 行的兜底，两边的阈值会打架（96/72/35.5），已删。
  return page.evaluate(() => {
    const stage = document.querySelector('.vk-page') || document.querySelector('.vk-stage') || document.body;
    const r = stage.getBoundingClientRect();
    const page = [Math.round(r.width), Math.round(r.height)];
    const audited = window.vk?.auditPage?.();
    if (!audited) return { issues: [{ type: 'audit-missing', what: '运行时没有 auditPage（构建过期？）' }], special: [], page };
    return { issues: audited.issues, special: audited.special, page };
  });
}

/** 字体：check() 不会触发加载，必须显式 load 一次；一页加载过全站共用。 */
let fontCache = null;
async function fontIssues() {
  if (fontCache) return fontCache;
  fontCache = await page.evaluate(async () => {
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
  return fontCache;
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
  const failedBefore = failed.length;

  const { issues, special, page: pageSize } = await inspect();
  const fonts = await fontIssues();
  for (const e of special) fail(target.label, e);
  for (const f of fonts) fail(target.label, f);
  for (const e of issues) {
    if (e.type === 'font') fail(target.label, `字号 ${e.fs}px < ${MIN_FONT}：${e.what}`);
    if (e.type === 'empty') fail(target.label, `空帧：${e.what}`);
    if (e.type === 'contrast') fail(target.label, `对比度 ${e.cr} < ${e.need}：${e.what}`);
    if (e.type === 'overflow') fail(target.label, `超出 1920×1080：${e.what} ${e.box.join(',')}`);
    if (e.type === 'safe') fail(target.label, `超出 1680×888 安全区：${e.what} ${e.box.join(',')}`);
    if (e.type === 'clip') fail(target.label, `横向被裁：${e.what} (${e.sw} > ${e.cw})`);
    if (e.type === 'clip-y') fail(target.label, `纵向被裁：${e.what} (${e.sh} > ${e.ch})`);
    if (e.type === 'ln-overlap') fail(target.label, `行号压住代码 ${e.gap}px：${e.what}`);
    if (e.type === 'zero') fail(target.label, `0 尺寸锚点：${e.what}`);
    if (e.type === 'overlap') fail(target.label, `顶层重叠 ${(e.size || []).join('×')}：${e.what}`);
    if (e.type === 'w') fail(target.label, `w="${e.want}" 实际 ${e.got}px：${e.what}`);
    if (e.type === 'bleed-text') fail(target.label, `出血层里不能放正文：${e.what}`);
    if (e.type === 'collision') fail(target.label, `文本超出单元格：${e.what} (${e.sw} > ${e.cw})`);
    // 批次 G/H：五条设计规则的硬审计（与 vk check 同一份判定）。
    // 覆盖层 / 图版页的例外写在 audit.mjs 里，这里不重复。
    if (e.type === 'accent') fail(target.label, `强调色超限：${e.what}`);
    if (e.type === 'dark') fail(target.label, `深色块超限：${e.what}`);
    if (e.type === 'icon') fail(target.label, `图标白名单：${e.what}`);
    if (e.type === 'header') fail(target.label, `页眉：${e.what}`);
    if (e.type === 'margin') fail(target.label, `120 边距：${e.what} ${(e.box || []).join(',')}`);
    // 格太窄不是"撞字"，但作者需要看见：只提醒，不当作画面错误。
    if (e.type === 'narrow') warn(target.label, e.fix || `格太窄：${e.what} (${e.sw} > ${e.cw})`);
    if (e.type === 'orphan') warn(target.label, `孤行 ${e.chars} 字：${e.what}`);
    if (e.type === 'blue') warn(target.label, `${e.count} 处焦点蓝：${e.what}`);
    if (e.type === 'pin-overlap') warn(target.label, e.what);
    if (e.type === 'void') warn(target.label, `留白：${e.what}`);
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

  // 预设只对"成品"镜头有意义：其余四个镜头里这块元件是隐藏的，改了也拍不到。
  if (checkPresets && target.kind === 'specimen') {
    const baseShot = await page.screenshot();
    await presetDiff(target.tag, baseShot);
  }

  // 只数"真的失败了的"：void 这类记账项不该把一行变成 ✗。
  const bad = failed.length - failedBefore;
  console.log(`${bad ? '✗' : '✓'} ${target.label}${bad ? `  ${bad} 个画面问题` : ''}  ${pageSize[0]}×${pageSize[1]}`);
  if (cacheOn && failed.length === failedBefore) markCached(cacheKeys.get(target.label));
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
  const seen = checked + cacheHits;
  console.log(
    `\n门禁全绿（${seen}/${total} 个检查对象${cacheHits ? `，${cacheHits} 个缓存命中` : ''}，预设像素差${checkPresets ? '已跑' : '已跳过'}）。`
  );
}

