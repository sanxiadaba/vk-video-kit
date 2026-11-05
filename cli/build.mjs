#!/usr/bin/env node
/**
 * vk build —— 把 pages/ 里的作者页预编译到 out/。
 *
 *   vk build                 → 递归 pages/
 *   vk build pages/a.html    → 单页
 *   vk build pages/          → 整个目录
 *
 * 源文件不改：高亮、公式、hexdump、文件树、图标都内联进 out/ 的副本。
 */
import fs from 'node:fs';
import { buildOne, collect, outPathOf } from './lib/pages.mjs';

const args = process.argv.slice(2);
let inputs = args.filter((a) => !a.startsWith('--'));

if (!inputs.length) {
  if (!fs.existsSync('pages')) {
    console.error('[vk] 没有 pages/ 目录。写一帧：mkdir pages && echo ... > pages/a.html');
    process.exit(2);
  }
  inputs = ['pages'];
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

if (!files.length) {
  console.error('[vk] 没有 .html 文件');
  process.exit(2);
}

let blocks = 0;
let failed = 0;
for (const file of files) {
  try {
    const r = await buildOne(file);
    blocks += r.count;
    console.log(`  ${file} → ${r.out}  ${r.count ? `${r.count} block(s)` : ''}`.trimEnd());
  } catch (e) {
    failed++;
    console.error(`✗ ${file}\n${e.message}`);
  }
}

if (failed) {
  console.error(`\n${failed} 个文件失败`);
  process.exitCode = 1;
} else {
  console.log(`\ndone · ${blocks} block(s), ${files.length} file(s)`);
}
