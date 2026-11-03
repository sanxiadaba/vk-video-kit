#!/usr/bin/env node
/**
 * 结构断言 —— 像素指纹之外的另一半。
 *
 * 指纹只能证明"和上次一样"，证明不了"这一帧是对的"：把整页内容往下挪 40px，
 * 指纹全红但结构没变；反过来，把三个元素堆在中间，指纹可能只差几行。
 *
 * 这里量的是**这一帧成不成立**：
 *   · 主角：最大的一块文字面积占安全区 ≥ 10%
 *   · 字号档：一帧最多 3 档（超过就是在比大小，不是在讲事）
 *   · 焦点：≤ 1 个 region
 *   · 墨量：内容占安全区高度 ≥ 55%（少了就是空帧）
 *   · 底部空带：≤ 25%
 *
 * 用法：
 *   node tools/structure.mjs frames/*.html
 *   node tools/structure.mjs --json frames/*.html
 */
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

/** 大字行盒的下限：body 40 起算，caption（28，单位/角标/页脚）不该算成主角。 */
const MIN_LINE_BOX_FONT = 40;

const BLOCK_SELECTOR =
  'vk-text, vk-code, vk-term, vk-diff, vk-table, vk-list, vk-cells, vk-bars, vk-timeline, vk-steps, p, h1, h2, h3, li';

/** 给一个已经打开的页面量一帧的结构指标。CLI 与测试共用。 */
export async function measurePage(page, file) {
  await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load' });
  await page.evaluate(() => window.vk?.ready?.());
  const r = await page.evaluate(({ blockSelector, minFont }) => {
    const stage = document.querySelector('.vk-page, .vk-stage');
    if (!stage) return { error: '没有 .vk-page' };
    const safe = stage.querySelector('.vk-page-bd, .vk-page-inner') || stage;
    const sr = safe.getBoundingClientRect();
    const safeArea = sr.width * sr.height;

    // 只看真正装字的块，跳过覆盖层与 svg
    const blocks = [...safe.querySelectorAll(blockSelector)]
      .filter((el) => !el.closest('svg') && !el.closest('[data-vk-overlay]'))
      .filter((el) => (el.textContent || '').trim().length > 0);

    // 文字行盒：有直接文本节点的元素（span / 自定义元素里的文字）也算候选。
    // 没有这一步时，"14 字节"这种只由 span 当家的帧会被判成没有主角。
    // 用字号门槛挡掉单位、角标这类装饰性小字。
    const lineBoxes = [...safe.querySelectorAll('*')]
      .filter((el) => !el.closest('svg') && !el.closest('[data-vk-overlay]'))
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .filter((el) => (el.textContent || '').trim().length > 0)
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) >= minFont);

    let biggest = 0;
    const sizes = new Set();
    // 字号档仍只从"块"里数：span 行盒补的是主角面积，不该把一帧的字号档变多。
    for (const el of blocks) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const fs = Math.round(parseFloat(getComputedStyle(el).fontSize));
      if (fs >= 36) sizes.add(fs);
      biggest = Math.max(biggest, (b.width * b.height) / safeArea);
    }
    for (const el of lineBoxes) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      biggest = Math.max(biggest, (b.width * b.height) / safeArea);
    }

    const rects = [...safe.querySelectorAll('*')]
      .filter((el) => !el.closest('svg') && !el.closest('[data-vk-overlay]'))
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.height > 0 && b.width > 0);
    const bottom = rects.length ? Math.max(...rects.map((b) => b.bottom)) : sr.bottom;
    const top = rects.length ? Math.min(...rects.map((b) => b.top)) : sr.top;

    return {
      hero: +biggest.toFixed(3),
      sizes: [...sizes].sort((a, b) => b - a),
      focus: window.vk?.focusRegions?.(stage)?.length ?? 0,
      ink: +((bottom - top) / sr.height).toFixed(3),
      voidBottom: +((sr.bottom - bottom) / sr.height).toFixed(3),
    };
  }, { blockSelector: BLOCK_SELECTOR, minFont: MIN_LINE_BOX_FONT });
  return { file: path.basename(file), ...r };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const asJson = process.argv.includes('--json');
  if (!files.length) {
    console.error('用法：node tools/structure.mjs <文件…>');
    process.exit(2);
  }

  const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const rows = [];
  for (const file of files) rows.push(await measurePage(page, file));

  await browser.close();

  const problems = [];
  for (const r of rows) {
    if (r.error) {
      problems.push(`${r.file}: ${r.error}`);
      continue;
    }
    if (r.hero < 0.1) problems.push(`${r.file}: 主角只占 ${(r.hero * 100).toFixed(1)}%（要 ≥10%）`);
    if (r.sizes.length > 3) problems.push(`${r.file}: ${r.sizes.length} 档字号（${r.sizes.join('/')}），一帧最多 3 档`);
    if (r.focus > 1) problems.push(`${r.file}: ${r.focus} 个焦点（要 ≤1）`);
    if (r.ink < 0.55) problems.push(`${r.file}: 内容只占 ${(r.ink * 100).toFixed(0)}% 高（要 ≥55%）`);
    if (r.voidBottom > 0.25) problems.push(`${r.file}: 底部空 ${(r.voidBottom * 100).toFixed(0)}%（要 ≤25%）`);
  }

  if (asJson) console.log(JSON.stringify({ rows, problems }, null, 2));
  else {
    for (const r of rows) {
      if (r.error) {
        console.log(`✗ ${r.file}  ${r.error}`);
        continue;
      }
      console.log(
        `${problems.some((p) => p.startsWith(r.file + ':')) ? '✗' : '✓'} ${r.file.padEnd(12)} 主角 ${(r.hero * 100).toFixed(0).padStart(3)}%  字号 ${r.sizes.join('/')}  焦点 ${r.focus}  墨量 ${(r.ink * 100).toFixed(0)}%  底空 ${(r.voidBottom * 100).toFixed(0)}%`
      );
    }
    for (const p of problems) console.log('  · ' + p);
  }

  process.exitCode = problems.length ? 1 : 0;
}
