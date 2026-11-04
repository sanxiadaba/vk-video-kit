#!/usr/bin/env node
/**
 * vk check —— 一页或多页作者页的结构自检。
 *
 *   node cli/check.mjs page.html
 *   node cli/check.mjs a.html b.html --json
 *   node cli/check.mjs page.html --style     # 额外跑项目层审美 preset
 *
 * 和 `vk shot` 的区别：不出图，只跑 VK.auditPage() 并给退出码。
 * 多页共用一个浏览器；仍然要求先 `vk build`。
 *
 * 默认只判客观错误（溢出 / 遮挡 / 非法值 / 锚点 / 渲染失败 / 素材过期）。
 * `--style` 才跑那六条版面上的主张（强调色 ≤1、深色块 ≤1、图标白名单提醒、
 * 页眉只讲工序、120 边距、字幕短句）—— 它们属于项目，不属于库。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const json = args.includes('--json');
/** 审美 preset：默认关。打开了也只是加一组"项目层"判定，不改变库的默认。 */
const styleOn = args.includes('--style');
// 提醒类：放行但记账。layer = 声明了 elevation 的叠层；void = 安全区里的大块留白。
const WARN_ALL = new Set(['layer', 'void']);
/** 单条 issue 也可以自带 level="warn"（审美 preset 里的工具提醒），同样不算致命。 */
const isWarn = (x) => WARN_ALL.has(x.type) || x.level === 'warn';
const pages = args.filter((a) => !a.startsWith('-'));
if (!pages.length) {
  console.error('用法：node cli/check.mjs <page.html> [more.html...] [--json] [--style]');
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
    const report = await tab.evaluate((style) => {
      if (!window.vk) return { issues: [], special: ['缺少 vk.auditPage'] };
      if (window.vk.auditPages) {
        const r = window.vk.auditPages(document, { style });
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
      return window.vk.auditPage?.(document, { style }) || { issues: [], special: ['缺少 vk.auditPage'] };
    }, styleOn);
    item.issues = report.issues || [];
    item.special = report.special || [];
    results.push(item);
  }

  const linesFor = (it) => {
    const lines = [];
    for (const x of it.issues) {
      if (x.type === 'font') lines.push(`字号 ${x.fs} 低于地板：${x.what}`);
      else if (x.type === 'empty') lines.push(`空帧：${x.what}`);
      else if (x.type === 'font-content') lines.push(`正文落在 ${x.fs}（低于 body 档）：${x.what}`);
      else if (x.type === 'contrast') lines.push(`对比度 ${x.cr} < ${x.need}：${x.what}`);
      else if (x.type === 'safe') lines.push(`超出安全区：${x.what} ${x.box?.join(',') || ''}`);
      else if (x.type === 'overflow') lines.push(`超出画布：${x.what} ${x.box?.join(',') || ''}`);
      else if (x.type === 'clip') lines.push(`横向被裁：${x.what}（${x.sw} > ${x.cw}）`);
      else if (x.type === 'clip-y') lines.push(`纵向被裁：${x.what}（${x.sh} > ${x.ch}）`);
      else if (x.type === 'content-clip') lines.push(`内容被裁：${x.what}（内容 ${x.sh} > 盒子 ${x.ch}）`);
      else if (x.type === 'narrow') lines.push(`格太窄：${x.what}（${x.sw} > ${x.cw}）：建议换行 / 改 ratio`);
      else if (x.type === 'overlap') lines.push(`重叠 ${x.size?.join('×') || ''}：${x.what}`);
      else if (x.type === 'zero') lines.push(`空锚点：${x.what}`);
      else if (x.type === 'ln-overlap') lines.push(`行号压住代码：${x.what}（+${x.gap}px）`);
      else if (x.type === 'missing') lines.push(`找不到文件：${x.what}`);
      else if (x.type === 'layer') lines.push(`${x.what}`);
      else if (x.type === 'void') lines.push(`留白：${x.what}`);
      // ---- 项目层审美 preset（只有 --style 才会出现） ----
      else if (x.type === 'accent') lines.push(`风格·强调色：${x.what}`);
      else if (x.type === 'dark') lines.push(`风格·深色块：${x.what}`);
      else if (x.type === 'icon') lines.push(`提醒·图标白名单：${x.what}`);
      else if (x.type === 'header') lines.push(`风格·页眉：${x.what}`);
      else if (x.type === 'margin') lines.push(`风格·120 边距：${x.what} ${x.box?.join(',') || ''}`);
      else lines.push(`${x.type}：${x.what || ''}`);
      if (x.fix) lines.push(`  ↳ ${x.fix}`);
    }
    for (const s of it.special) lines.push(s);
    for (const s of it.console) lines.push(`控制台：${s}`);
    return lines;
  };

  if (json) {
    console.log(
      JSON.stringify(
        { style: styleOn, pages: results.map((it) => ({ ...it, lines: linesFor(it) })) },
        null,
        2
      )
    );
  } else {
    const fatal = (it) => it.issues.filter((x) => !isWarn(x)).length > 0 || it.special.length > 0;
    if (styleOn) {
      // 默认不跑；跑的时候把"这是什么"写在最前面，不让人误以为库的要求变多了。
      console.log('· --style：已开项目层审美 preset（6 条）。默认不跑；这是项目自己的版面主张。');
    }
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
  process.exitCode = results.some((it) => it.issues.filter((x) => !isWarn(x)).length > 0 || it.special.length > 0) ? 1 : 0;
} finally {
  await browser.close();
}

