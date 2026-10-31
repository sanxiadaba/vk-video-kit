#!/usr/bin/env node
/**
 * demo 冒烟检查 —— demo 在库仓库外面，所以它不进 npm test。
 *
 * 这个脚本替代"我手动敲 12 条命令"：一次跑完
 *   1) 12 个单帧 + 连排页的 `vk check`（字号/对比度/安全区/空帧/裁切）
 *   2) 12 个单帧的结构断言（主角/字号档/焦点/墨量/底部空带）
 *
 * demo 的职责是**探针**：它不会因为"画面好看"而存在，只因为能压出库的毛病。
 * 所以这里只守"这一帧成不成立"，不管它好不好看。
 *
 *   node tools/demo-check.mjs "D:\test\新建文件夹 (1182)"
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('用法：node tools/demo-check.mjs <demo 目录>');
  process.exit(2);
}

const vk = path.resolve('bin/vk.mjs');
const frames = fs
  .readdirSync(path.join(dir, 'frames'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => path.join(dir, 'frames', f));

const story = path.join(dir, 'index.html');
const pages = fs.existsSync(story) ? [...frames, story] : frames;

let bad = 0;
const run = (args, label) => {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    bad++;
    console.log(`✗ ${label}`);
    console.log((r.stdout || '').split('\n').filter(Boolean).slice(-8).map((l) => '   ' + l).join('\n'));
  } else {
    console.log(`✓ ${label}`);
  }
};

run([vk, 'check', ...pages], `vk check（${pages.length} 页）`);
run([path.resolve('tools/structure.mjs'), ...frames], `结构断言（${frames.length} 帧）`);
run([path.resolve('tools/legibility.mjs'), ...frames], `交付尺度 0.38（${frames.length} 帧）`);
run([path.resolve('tools/fingerprint.mjs'), '--compare', path.join(dir, 'qa/baseline/fingerprint.json'), ...frames], '布局指纹');

console.log(bad ? `\n冒烟失败：${bad} 项` : '\n冒烟通过');
process.exitCode = bad ? 1 : 0;
