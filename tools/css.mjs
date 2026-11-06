/**
 * 从 vocab.mjs 生成 CSS 变量。
 *
 * 为什么用生成而不是手写：字号、行高、行宽、间距、颜色都只有一个真相。
 * 颜色在这里生成为 light-dark(纸面, 暗面) 对：一个面只写 color-scheme，
 * 整棵子树的墨、线、语义色、淡底自动切 —— 不再有第二套主题，也不再有
 * 「深色页上把浅底件钉回纸面」的补丁。
 *
 *   node tools/css.mjs           生成 src/tokens.generated.css
 *   node tools/css.mjs --check   只校验（测试用），不一致就退出 1
 */
import fs from 'node:fs';
import {
  CANVAS,
  FONT,
  FONT_MICRO,
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
} from '../src/vocab.mjs';

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

rows.push('');
for (const [tier, px] of Object.entries(FONT)) {
  push(`fs-${tier}`, `${px}px`);
  push(`lh-${tier}`, String(LINE[tier]));
  push(`measure-${tier}`, `${MEASURE[tier]}em`);
  push(`track-${tier}`, `${TRACKING[tier]}em`);
}
push('fs-micro', `${FONT_MICRO}px`);
push('lh-micro', '1.3');

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

rows.push('');
for (const [k, v] of Object.entries(SYNTAX)) push(`syn-${k}`, `light-dark(${v[0]}, ${v[1]})`);
for (const [k, v] of Object.entries(DOTS)) push(`dot-${k}`, v);

const css = `/* vk · 由 tools/css.mjs 从 src/vocab.mjs 生成 —— 不要手改。
   颜色是 light-dark(纸面, 暗面)：谁声明表面，谁写一行 color-scheme。 */

:root {
  color-scheme: light;
${rows.join('\n')}
}
`;

const OUT = 'src/tokens.generated.css';

if (process.argv.includes('--check')) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (now !== css) {
    console.error('✗ src/tokens.generated.css 与 vocab.mjs 不一致：跑 node tools/css.mjs');
    process.exit(1);
  }
  console.log('✓ tokens 与 vocab 一致');
} else {
  fs.writeFileSync(OUT, css);
  console.log(`✓ ${OUT}（${rows.length} 个变量）`);
}
