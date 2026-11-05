#!/usr/bin/env node
/**
 * vk shot —— 把一帧（或一组帧）截成图。
 *
 *   vk shot pages/a.html                     → out/a.png（1920×1080）
 *   vk shot pages/a.html --phone             → out/a.phone.png（780 宽）
 *   vk shot pages/*.html --out-dir out/x --width 640
 *   vk shot pages/a.html --json              机器可读报告
 *
 * 一组帧共用一个浏览器与一个字体缓存；有 error 默认不出图（--keep 保留）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, openSession } from './lib/browser.mjs';
import { resolvePage, assertBuilt } from './lib/pages.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valueOf = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const VALUE_FLAGS = new Set(['--out', '--out-dir', '--width']);
const inputs = args.filter((a, i) => !a.startsWith('-') && !VALUE_FLAGS.has(args[i - 1]));
if (!inputs.length) {
  console.error('用法：vk shot <page.html…> [--phone] [--width 640] [--out f.png | --out-dir dir/] [--json] [--keep]');
  process.exit(1);
}

const phone = flag('--phone');
const json = flag('--json');
const keep = flag('--keep');
const widthArg = Number(valueOf('--width') || 0);
const W = widthArg > 0 ? Math.round(widthArg) : phone ? 780 : 1920;
const H = Math.round(1080 * (W / 1920));
const scale = W / 1920;
const outDir = valueOf('--out-dir');
const singleOut = valueOf('--out');

try {
  assertBuilt();
} catch (e) {
  console.error(`[vk] ${e.message}`);
  process.exit(1);
}
const built = [];
for (const input of inputs) {
  try {
    built.push(await resolvePage(input, { build: !flag('--no-build') }));
  } catch (e) {
    console.error(`✗ ${input}\n${e.message}`);
    process.exitCode = 1;
  }
}
if (!built.length) process.exit(1);

const browser = await launch();
const session = await openSession(browser, { width: W, height: H });
const report = [];
try {
  for (const page of built) {
    const name = path.basename(page, '.html') + (phone ? '.phone' : '') + '.png';
    const out = singleOut && built.length === 1 ? path.resolve(singleOut) : path.resolve(outDir || 'out', name);
    const item = { page, png: null, issues: [], special: [], errors: [], metrics: null };
    try {
      item.errors = await session.open(page);
      if (scale !== 1) {
        await session.tab.evaluate((s) => {
          document.body.style.transformOrigin = '0 0';
          document.body.style.transform = `scale(${s})`;
        }, scale);
        await session.tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      }
      const audit = await session.tab.evaluate(() => window.vk?.auditPage?.() || { issues: [], special: ['缺少 vk.auditPage'] });
      item.issues = audit.issues;
      item.special = audit.special;
      item.metrics = await session.tab.evaluate(() => window.vk?.metrics?.()?.[0] || null);
      const bad = item.errors.length || item.issues.length || item.special.length;
      if (!bad || keep) {
        fs.mkdirSync(path.dirname(out), { recursive: true });
        await session.tab.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
        item.png = out;
      }
    } catch (e) {
      item.errors.push(e.message);
    }
    report.push(item);
  }
} finally {
  await session.close();
  await browser.close();
}

const lines = (item) => [
  ...item.errors.map((e) => ({ type: 'runtime', what: e })),
  ...item.issues,
  ...item.special.map((s) => ({ type: 'special', what: s })),
];

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const item of report) {
    const rel = path.relative(process.cwd(), item.png || item.page);
    const list = lines(item);
    if (item.png) {
      const st = fs.statSync(item.png);
      console.log(`✓ ${rel}  ${W}×${H}  ${Math.round(st.size / 1024)} KB`);
    } else {
      console.log(`✗ ${rel}`);
    }
    if (item.metrics) {
      const m = item.metrics;
      const top = Math.round(m.contentTop / scale);
      const bottom = Math.round(m.contentBottom / scale);
      console.log(`  度量：y ${top}–${bottom}（底距 ${1080 - bottom}）· x ${Math.round(m.contentLeft / scale)}–${Math.round(m.contentRight / scale)} · 焦点 ${m.focus}`);
    }
    if (list.length) {
      console.log(`  自检（${list.length} 条）：`);
      for (const x of list) console.log(`    · ${x.what || x.type}${x.fix ? `（${x.fix}）` : ''}`);
    } else console.log('  自检：干净');
  }
  if (built.length > 1) console.log(`\n${built.length} 页`);
}
const bad = report.some((i) => lines(i).length);
process.exitCode = bad ? 1 : 0;

