#!/usr/bin/env node
/**
 * demo 冒烟检查 —— demo 在库仓库外面，所以它不进 npm test。
 *
 * 这个脚本替代"我手动敲 12 条命令"：一次跑完
 *   0) 产物镜像（demo 的 vk/ 与 dist/ 是否就是本库刚构建的那一份）
 *   1) 12 个单帧 + 连排页的 `vk check`（字号/对比度/安全区/空帧/裁切）
 *   2) 12 个单帧的结构断言（主角/字号档/焦点/墨量/底部空带）
 *
 * 第 0 项防的是"静默失效"：镜像落后时页面不报错、`vk check` 也干净
 * ——它检查的就是 demo 里那份旧运行时。所以先确认"检查的对象是新的"。
 *
 *   node tools/demo-check.mjs "D:\test\新建文件夹 (1182)"
 *   node tools/demo-check.mjs <demo 目录> --no-mirror-check   # 特殊场景才关
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { checkMirror, formatMirror } from './mirror.mjs';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const mirrorOn = !args.includes('--no-mirror-check');
if (!dir) {
  console.error(
    '用法：node tools/demo-check.mjs <demo 目录> [--no-mirror-check]',
  );
  process.exit(2);
}

const vk = path.resolve('bin/vk.mjs');
const frames = fs
  .readdirSync(path.join(dir, 'frames'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => path.join(dir, 'frames', f));

const story = path.join(dir, 'index.html');
const appendix = path.join(dir, 'appendix.html');
const extra = [story, appendix].filter((p) => fs.existsSync(p));
const pages = [...frames, ...extra];

let bad = 0;
const run = (args, label) => {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    bad++;
    console.log(`✗ ${label}`);
    console.log(
      (r.stdout || '')
        .split('\n')
        .filter(Boolean)
        .slice(-8)
        .map((l) => '   ' + l)
        .join('\n'),
    );
  } else {
    console.log(`✓ ${label}`);
  }
};

// 先查"检查对象"本身。不一致就不往下走也没意义，但其余项照跑：一次看全。
if (mirrorOn) {
  const r = checkMirror({ demo: path.resolve(dir) });
  const lines = formatMirror(r);
  if (r.ok) {
    console.log(lines[0]);
  } else {
    bad++;
    console.log(lines[0]);
    for (const line of lines.slice(1)) console.log(`   ${line}`);
  }
} else {
  console.log('· 产物镜像检查已跳过（--no-mirror-check）');
}

run([vk, 'check', ...pages], `vk check（${pages.length} 页）`);
run(
  [path.resolve('tools/structure.mjs'), ...frames],
  `结构断言（${frames.length} 帧）`,
);
run(
  [path.resolve('tools/legibility.mjs'), ...frames],
  `交付尺度 0.38（${frames.length} 帧）`,
);
run(
  [
    path.resolve('tools/fingerprint.mjs'),
    '--compare',
    path.join(dir, 'qa/baseline/fingerprint.json'),
    ...frames,
  ],
  '布局指纹',
);

console.log(bad ? `\n冒烟失败：${bad} 项` : '\n冒烟通过');
process.exitCode = bad ? 1 : 0;
