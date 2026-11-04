#!/usr/bin/env node
/**
 * 项目层审美 preset —— 独立入口（等价于 `vk check --style`）。
 *
 *   node tools/style-preset.mjs <page.html> [more.html...] [--json]
 *   node tools/style-preset.mjs --list
 *
 * 库默认只判客观错误（溢出 / 遮挡 / 非法值 / 锚点 / 渲染失败 / 素材哈希）。
 * 下面这六条是**项目的版面主张**，换个项目就该换一套：
 *
 *   风格·强调色 ≤1      一页只有一个答案
 *   风格·深色块 ≤1      一页只砸一块"重"
 *   提醒·图标白名单     装饰图标可以留，知道就行（不是错误）
 *   风格·页眉只讲工序   文件名 / 页号属于内容块
 *   风格·120 边距       这一集的交付边距
 *   提醒·字幕短句       不带句号、每行 ≤18 字（字幕位）
 *
 * 它们默认不跑。跑法就是本文件或 `vk check --style`；也可以直接调
 * 运行期的 `vk.auditStyle()`（判定在 src/runtime/style-preset.mjs，
 * 规则清单是那一份 STYLE_RULES，CLI / 文档 / 测试共用）。
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STYLE_RULES } from '../src/runtime/style-preset.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const lib = path.resolve(here, '..');
const args = process.argv.slice(2);

if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.error(
    '用法：node tools/style-preset.mjs <page.html> [more.html...] [--json]\n' +
      '       node tools/style-preset.mjs --list     # 只看这六条规则'
  );
  process.exit(args.length ? 0 : 1);
}

if (args.includes('--list')) {
  console.log('项目层审美 preset（默认关；vk check --style / 本脚本才会跑）：\n');
  for (const r of STYLE_RULES) {
    console.log(`  ${r.level === 'warn' ? '提醒' : '风格'}  ${r.name}`);
    console.log(`        ${r.why}`);
  }
  console.log('\n它们不是库的要求：库只判客观错误。');
  process.exit(0);
}

const r = spawnSync(process.execPath, [path.join(lib, 'bin/vk.mjs'), 'check', '--style', ...args], {
  stdio: 'inherit',
  cwd: process.cwd(),
});
process.exit(r.status ?? 1);
