/**
 * vk gen：从 vocab 生成 CSS 变量，从 schema 生成契约文档。
 *
 *   node tools/gen.mjs            生成 src/tokens.generated.css 与 out/CONTRACT.md
 *   node tools/gen.mjs --check    只校验（测试用），不一致就退出 1
 *
 * 契约文档是生成物，写到 out/，不入库：机器读 vk brief --json，人读 out/CONTRACT.md。
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  CANVAS,
  FONT,
  LINE,
  MEASURE,
  TRACKING,
  WEIGHT,
  GAP,
  INSET,
  RADIUS,
  LINE_W,
  PAINT,
  SYNTAX,
  DOTS,
  FONT_FAMILY,
  FLOOR,
} from '../src/vocab.mjs';
import { markdown } from '../src/contract.mjs';

const rows = [];
const push = (name, value) => rows.push(`  --vk-${name}: ${value};`);
const pair = (name, key) => {
  const [light, dark] = PAINT[key];
  push(name, `light-dark(${light}, ${dark})`);
};

push('canvas-w', `${CANVAS.w}px`);
push('canvas-h', `${CANVAS.h}px`);
push('margin-x', `${CANVAS.safeX}px`);
push('margin-y', `${CANVAS.safeY}px`);
push('safe-w', `${CANVAS.w - CANVAS.safeX * 2}px`);
push('safe-h', `${CANVAS.h - CANVAS.safeY * 2}px`);
push('floor', `${FLOOR}px`);

rows.push('');
for (const [tier, px] of Object.entries(FONT)) {
  push(`fs-${tier}`, `${px}px`);
  push(`lh-${tier}`, String(LINE[tier]));
  push(`measure-${tier}`, `${MEASURE[tier]}em`);
  push(`track-${tier}`, `${TRACKING[tier]}em`);
}

rows.push('');
for (const [name, px] of Object.entries(GAP)) push(`gap-${name}`, `${px}px`);
for (const [name, px] of Object.entries(INSET)) push(`inset-${name}`, `${px}px`);
for (const [name, px] of Object.entries(RADIUS)) push(`radius-${name}`, px >= 999 ? '999px' : `${px}px`);
for (const [name, px] of Object.entries(LINE_W)) push(`line-w-${name}`, `${px}px`);

rows.push('');
push('w-regular', WEIGHT.regular);
push('w-medium', WEIGHT.medium);
push('w-bold', WEIGHT.bold);
push('font-sans', FONT_FAMILY.sans);
push('font-mono', FONT_FAMILY.mono);

rows.push('');
pair('paper', 'paper');
pair('soft', 'soft');
pair('ink-1', 'ink1');
pair('ink-2', 'ink2');
pair('ink-3', 'ink3');
pair('line-color', 'line');
pair('line-strong', 'lineStrong');
pair('focus', 'focus');
for (const t of ['info', 'ok', 'warn', 'err']) pair(t, t);
for (const t of ['Info', 'Focus', 'Ok', 'Warn', 'Err']) pair(`tint-${t.toLowerCase()}`, `tint${t}`);
pair('on-focus', 'onFocus');

rows.push('');
for (const [k, v] of Object.entries(SYNTAX)) push(`syn-${k}`, `light-dark(${v[0]}, ${v[1]})`);
for (const [k, v] of Object.entries(DOTS)) push(`dot-${k}`, v);

const tokensCss = `/* vk · 由 tools/gen.mjs 从 src/vocab.mjs 生成 —— 不要手改。
   颜色是 light-dark(纸面, 暗面)：谁声明表面，谁写一行 color-scheme。 */

:root {
  color-scheme: light;
${rows.join('\n')}
}
`;

const TOKENS = path.join(import.meta.dirname, '..', 'src', 'tokens.generated.css');
const OUT = path.join(import.meta.dirname, '..', 'out', 'CONTRACT.md');

if (process.argv.includes('--check')) {
  const now = fs.existsSync(TOKENS) ? fs.readFileSync(TOKENS, 'utf8') : '';
  if (now !== tokensCss) {
    console.error('✗ src/tokens.generated.css 与 vocab.mjs 不一致：跑 node tools/gen.mjs');
    process.exit(1);
  }
  console.log('✓ tokens 与 vocab 一致');
} else {
  fs.writeFileSync(TOKENS, tokensCss);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, markdown() + '\n');
  console.log(`✓ ${path.relative(process.cwd(), TOKENS)}（${rows.length} 个变量）`);
  console.log(`✓ ${path.relative(process.cwd(), OUT)}`);
}
