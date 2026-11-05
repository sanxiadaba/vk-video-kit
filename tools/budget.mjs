/**
 * 预算门禁：防止库再长回去。
 *
 * 这个文件存在的理由：v15 是 45k 行、688 个属性、六份真值。
 * 现在每次提交都要过这几条，超了直接红。
 */
import fs from 'node:fs';
import path from 'node:path';
import { TAGS, TAG_NAMES } from '../src/schema.mjs';

const BUDGET = {
  tags: 30,
  attrs: 420, // 每个标签的属性声明总和（含 7 个共享布局/状态属性）
  srcLines: 14500, // v15 是 22.4k（不含 vendored 图标/高亮）；v16 约 14.2k
  toolLines: 2200, // cli + tools（不含生成物与测试）
};

const countLines = (dir, exts) => {
  let n = 0;
  const walk = (p) => {
    for (const ent of fs.readdirSync(p, { withFileTypes: true })) {
      const abs = path.join(p, ent.name);
      if (ent.isDirectory()) walk(abs);
      else if (exts.some((e) => abs.endsWith(e))) n += fs.readFileSync(abs, 'utf8').split('\n').length;
    }
  };
  walk(dir);
  return n;
};

let attrs = 0;
for (const t of TAG_NAMES) attrs += Object.keys(TAGS[t].attrs || {}).length;
const srcLines = countLines('src', ['.mjs', '.css']);
// 生成物不计入预算：图标与高亮是 vendored 数据。
const generated = ['src/icons.generated.mjs', 'src/highlight.mjs'];
const generatedLines = generated.reduce((n, f) => n + fs.readFileSync(f, 'utf8').split('\n').length, 0);
const ownSrcLines = srcLines - generatedLines;
const toolLines = countLines('cli', ['.mjs']) + countLines('tools', ['.mjs']);

const rows = [
  ['tags', TAG_NAMES.length, BUDGET.tags],
  ['attrs', attrs, BUDGET.attrs],
  ['src lines', ownSrcLines, BUDGET.srcLines],
  ['cli+tools lines', toolLines, BUDGET.toolLines],
];

let bad = 0;
for (const [name, got, max] of rows) {
  const ok = got <= max;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(16)} ${String(got).padStart(6)} / ${max}`);
}
if (bad) {
  console.error(`\n${bad} 项超预算。要么删，要么改 BUDGET 并说明理由。`);
  process.exitCode = 1;
}
