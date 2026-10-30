#!/usr/bin/env node
/**
 * vk check —— 一页或多页作者页的结构自检。
 *
 *   node cli/check.mjs page.html
 *   node cli/check.mjs a.html b.html --json
 *
 * 和 `vk shot` 的区别：不出图，只跑 VK.auditPage() 并给退出码。
 * 多页共用一个浏览器；仍然要求先 `vk build`。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const json = args.includes('--json');
// 提醒类：放行但记账。layer = 声明了 elevation 的叠层；void = 安全区里的大块留白。
const WARN_ALL = new Set(['layer', 'void']);
const pages = args.filter((a) => !a.startsWith('-'));
if (!pages.length) {
  console.error('用法：node cli/check.mjs <page.html> [more.html...] [--json]');
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('\n[vk] 缺少 playwright（自检需要它）。在仓库里 npm i -D playwright。\n');
    process.exit(1);
  }
}

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const results = [];
try {
  const tab = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  for (const page of pages) {
    const abs = path.resolve(page);
    const item = { page: abs, rel: path.relative(process.cwd(), abs), issues: [], special: [], console: [] };
    if (!fs.existsSync(abs)) {
      item.issues.push({ type: 'missing', what: page });
      results.push(item);
      continue;
    }
    tab.removeAllListeners?.('console');
    tab.removeAllListeners?.('pageerror');
    tab.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') item.console.push(`${m.type()}: ${m.text()}`);
    });
    tab.on('pageerror', (e) => item.console.push(`pageerror: ${e.message}`));
    await tab.goto(pathToFileURL(abs).href, { waitUntil: 'load' });
    await tab.evaluate(async () => {
      if (window.vk?.ready) await window.vk.ready();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    const report = await tab.evaluate(() => {
      if (!window.vk) return { issues: [], special: ['缺少 vk.auditPage'] };
      if (window.vk.auditPages) {
        const r = window.vk.auditPages();
        if (r.pages.length > 1) {
          return {
            issues: r.issues.map((x) => ({
              ...x,
              what: `第 ${x.page + 1} 页${x.pageId ? ' #' + x.pageId : ''}：${x.what}`,
            })),
            special: r.special,
          };
        }
      }
      return window.vk.auditPage?.() || { issues: [], special: ['缺少 vk.auditPage'] };
    });
    item.issues = report.issues || [];
    item.special = report.special || [];
    results.push(item);
  }

  const linesFor = (it) => {
    const lines = [];
    for (const x of it.issues) {
      if (x.type === 'font') lines.push(`字号 ${x.fs} < 36：${x.what}`);
      else if (x.type === 'font-content') lines.push(`正文落在 ${x.fs}（应 ≥48）：${x.what}`);
      else if (x.type === 'contrast') lines.push(`对比度 ${x.cr} < ${x.need}：${x.what}`);
      else if (x.type === 'safe') lines.push(`超出安全区：${x.what} ${x.box?.join(',') || ''}`);
      else if (x.type === 'overflow') lines.push(`超出画布：${x.what} ${x.box?.join(',') || ''}`);
      else if (x.type === 'clip') lines.push(`横向被裁：${x.what}（${x.sw} > ${x.cw}）`);
      else if (x.type === 'clip-y') lines.push(`纵向被裁：${x.what}（${x.sh} > ${x.ch}）`);
      else if (x.type === 'content-clip') lines.push(`内容被裁：${x.what}（内容 ${x.sh} > 盒子 ${x.ch}）`);
      else if (x.type === 'overlap') lines.push(`重叠 ${x.size?.join('×') || ''}：${x.what}`);
      else if (x.type === 'zero') lines.push(`空锚点：${x.what}`);
      else if (x.type === 'ln-overlap') lines.push(`行号压住代码：${x.what}（+${x.gap}px）`);
      else if (x.type === 'missing') lines.push(`找不到文件：${x.what}`);
      else if (x.type === 'layer') lines.push(`${x.what}`);
      else if (x.type === 'void') lines.push(`留白：${x.what}`);
      else lines.push(`${x.type}：${x.what || ''}`);
      if (x.fix) lines.push(`  ↳ ${x.fix}`);
    }
    for (const s of it.special) lines.push(s);
    for (const s of it.console) lines.push(`控制台：${s}`);
    return lines;
  };

  if (json) {
    console.log(JSON.stringify(results.map((it) => ({ ...it, lines: linesFor(it) })), null, 2));
  } else {
    const WARN = WARN_ALL;
    const fatal = (it) => it.issues.filter((x) => !WARN.has(x.type)).length > 0 || it.special.length > 0;
    for (const it of results) {
      const lines = linesFor(it);
      if (!lines.length) console.log(`✓ ${it.rel} 干净`);
      else {
        console.log(`${fatal(it) ? '✗' : '△'} ${it.rel}  ${lines.length} 条`);
        for (const l of lines.slice(0, 20)) console.log(`  · ${l}`);
      }
    }
    const bad = results.filter((it) => fatal(it)).length;
    if (pages.length > 1) console.log(`\n${pages.length} 页 · ${bad} 页有问题`);
  }
  process.exitCode = results.some((it) => it.issues.filter((x) => !WARN_ALL.has(x.type)).length > 0 || it.special.length > 0) ? 1 : 0;
} finally {
  await browser.close();
}

