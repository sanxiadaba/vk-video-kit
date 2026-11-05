#!/usr/bin/env node
/**
 * vk shot —— 把一帧截成图，给作者看。
 *
 *   vk shot pages/x.html                 → out/x.png（1920×1080）
 *   vk shot pages/x.html --phone         → out/x.phone.png（780 宽，近似手机横屏）
 *   vk shot pages/x.html --out f.png
 *   vk shot pages/x.html --json          → 额外打印机器可读报告
 *
 * 先构建（源 → out/）；有 error 时默认不出图（--keep 保留坏图用于排查）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, openPage, wait } from './lib/browser.mjs';
import { resolvePage, buildOne } from './lib/pages.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valueOf = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const src = args.find((a) => !a.startsWith('-') && !/^[\d,]+$/.test(a));
if (!src) {
  console.error('用法：vk shot <page.html> [--phone] [--out f.png] [--json] [--keep] [--no-build]');
  process.exit(1);
}

const outBuilt = await resolvePage(src, { build: !flag('--no-build') });
const phone = flag('--phone');
const json = flag('--json');
const keep = flag('--keep');

const widthArg = Number(valueOf('--width') || 0);
const W = widthArg > 0 ? Math.round(widthArg) : phone ? 780 : 1920;
const scale = W / 1920;
const H = Math.round(1080 * scale);
const out = valueOf('--out')
  ? path.resolve(valueOf('--out'))
  : path.join('out', path.basename(outBuilt, '.html') + (phone ? '.phone' : '') + '.png');

const browser = await launch();
const report = { page: outBuilt, errors: [], issues: [], special: [], metrics: null, png: null };
try {
  const { tab, errors } = await openPage(browser, outBuilt, { width: W, height: H });
  if (scale !== 1) {
    await tab.evaluate((s) => {
      document.body.style.transformOrigin = '0 0';
      document.body.style.transform = `scale(${s})`;
    }, scale);
    await wait(tab);
  }
  report.errors = errors;
  const audit = await tab.evaluate(() => window.vk?.auditPage?.() || { issues: [], special: ['缺少 vk.auditPage'] });
  report.issues = audit.issues;
  report.special = audit.special;
  report.metrics = await tab.evaluate(() => window.vk?.metrics?.()?.[0] || null);

  const bad = errors.length || report.issues.length || report.special.length;
  if (!bad || keep) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await tab.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
    report.png = out;
  }
} finally {
  await browser.close();
}

if (json) console.log(JSON.stringify(report, null, 2));
else {
  if (report.png) {
    const st = fs.statSync(report.png);
    console.log(`✓ ${path.relative(process.cwd(), report.png)}  ${W}×${H}  ${Math.round(st.size / 1024)} KB`);
  }
  if (report.metrics) {
    const m = report.metrics;
    const top = Math.round(m.contentTop / scale);
    const bottom = Math.round(m.contentBottom / scale);
    console.log(`  度量：内容 y ${top}–${bottom}（底距 ${1080 - bottom}）· x ${Math.round(m.contentLeft / scale)}–${Math.round(m.contentRight / scale)} · 焦点 ${m.focus}`);
  }
  const list = [
    ...report.errors.map((e) => ({ type: 'runtime', what: e })),
    ...report.issues,
    ...report.special.map((s) => ({ type: 'special', what: s })),
  ];
  if (!list.length) console.log('  自检：干净');
  else {
    console.log('  自检（有 error）：');
    for (const x of list) console.log(`    · ${x.what || x.type}${x.fix ? `（${x.fix}）` : ''}`);
    if (!keep) console.log('  [vk] 有 error，未出图；加 --keep 保留坏图排查');
  }
}
process.exitCode = report.errors.length || report.issues.length || report.special.length ? 1 : 0;
