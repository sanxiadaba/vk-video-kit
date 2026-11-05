#!/usr/bin/env node
/**
 * vk check —— 一页或多页的结构自检。
 *
 *   vk check pages/a.html
 *   vk check pages/ --json
 *
 * 先构建（源 → out/），再用同一个浏览器逐页跑 VK.auditPage()。
 * 只判客观错误：字号地板 / 对比度 / 安全区 / 溢出 / 裁切 / 非覆盖层重叠 / 空锚点 /
 * 组件渲染失败 / 素材过期。
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, openSession } from './lib/browser.mjs';
import { resolvePage, collect, assertBuilt } from './lib/pages.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const inputs = args.filter((a) => !a.startsWith('-'));

if (!inputs.length) {
  console.error('用法：vk check <page.html|dir> [--json]');
  process.exit(1);
}

const files = [];
for (const input of inputs) {
  if (!fs.existsSync(input)) {
    console.error(`[vk] 找不到 ${input}`);
    process.exit(2);
  }
  if (fs.statSync(input).isDirectory()) files.push(...collect(input));
  else files.push(input);
}

try {
  assertBuilt();
} catch (e) {
  console.error(`[vk] ${e.message}`);
  process.exit(1);
}
const built = [];
for (const f of files) {
  try {
    built.push(await resolvePage(f));
  } catch (e) {
    console.error(`✗ ${f}\n${e.message}`);
    process.exitCode = 1;
  }
}

const browser = await launch();
const session = await openSession(browser);
const all = [];
try {
  for (const page of built) {
    const errors = await session.open(page);
    const audit = await session.tab.evaluate(() => window.vk?.auditPage?.() || { issues: [], special: ['缺少 vk.auditPage'] });
    const issues = [
      ...errors.map((e) => ({ type: 'runtime', what: e })),
      ...audit.issues,
      ...audit.special.map((s) => ({ type: 'special', what: s })),
    ];
    all.push({ page, issues });
  }
} finally {
  await session.close();
  await browser.close();
}

if (json) {
  console.log(JSON.stringify(all, null, 2));
} else {
  let bad = 0;
  for (const { page, issues } of all) {
    const rel = path.relative(process.cwd(), page);
    if (!issues.length) console.log(`✓ ${rel} 干净`);
    else {
      bad += issues.length;
      console.log(`✗ ${rel}`);
      for (const x of issues) console.log(`  · ${x.what || x.type}${x.fix ? `（${x.fix}）` : ''}`);
    }
  }
  if (bad) console.log(`\n${bad} 条 error`);
  else console.log(`\n${all.length} 页全部干净`);
}
process.exitCode = all.some((x) => x.issues.length) ? 1 : 0;

