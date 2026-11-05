/**
 * 从 vocab.mjs 生成 CSS 变量。
 *
 * 为什么用生成而不是手写：字号、行高、行宽、间距、颜色都只有一个真相。
 * 手写第二份 = 迟早对不上（v16 就是这个病：token 里 38 个变量从没人用，
 * 正名被引用 4 次、旧名被引用 39 次）。
 *
 *   node tools/css.mjs           生成 src/tokens.generated.css
 *   node tools/css.mjs --check   只校验（CI / 测试用），不一致就退出 1
 */
import fs from 'node:fs';
import {
  CANVAS,
  FONT,
  LINE,
  MEASURE,
  TRACKING,
  WEIGHT,
  GAP,
  RADIUS,
  LINE_W,
  PAPER,
  DARK,
  SYNTAX,
  DOTS,
  FONT_FAMILY,
} from '../src/vocab.mjs';

const rows = [];
const push = (name, value) => rows.push(`  --vk-${name}: ${value};`);

push('canvas-w', `${CANVAS.w}px`);
push('canvas-h', `${CANVAS.h}px`);
push('margin-x', `${CANVAS.safeX}px`);
push('margin-y', `${CANVAS.safeY}px`);
push('safe-w', `${CANVAS.w - CANVAS.safeX * 2}px`);
push('safe-h', `${CANVAS.h - CANVAS.safeY * 2}px`);

rows.push('');
for (const [tier, px] of Object.entries(FONT)) {
  push(`fs-${tier}`, `${px}px`);
  push(`lh-${tier}`, `${LINE[tier]}px`);
  push(`measure-${tier}`, `${MEASURE[tier]}em`);
  push(`track-${tier}`, `${TRACKING[tier]}em`);
}

rows.push('');
for (const [name, px] of Object.entries(GAP)) push(`gap-${name}`, `${px}px`);
for (const [name, px] of Object.entries(RADIUS)) push(`radius-${name}`, px >= 999 ? '999px' : `${px}px`);
for (const [name, px] of Object.entries(LINE_W)) push(`line-w-${name}`, `${px}px`);

rows.push('');
push('w-regular', WEIGHT.regular);
push('w-medium', WEIGHT.medium);
push('w-bold', WEIGHT.bold);
push('font-sans', FONT_FAMILY.sans);
push('font-mono', FONT_FAMILY.mono);

rows.push('');
push('paper', PAPER.paper);
push('soft', PAPER.soft);
push('ink-1', PAPER.ink1);
push('ink-2', PAPER.ink2);
push('ink-3', PAPER.ink3);
push('line-color', PAPER.line);
push('line-strong', PAPER.lineStrong);
push('focus', PAPER.focus);
for (const t of ['info', 'ok', 'warn', 'err']) push(t, PAPER[t]);
for (const t of ['Info', 'Focus', 'Ok', 'Warn', 'Err']) push(`tint-${t.toLowerCase()}`, PAPER[`tint${t}`]);

rows.push('');
for (const [k, v] of Object.entries(DARK)) push(`dark-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`, v);
for (const [k, v] of Object.entries(SYNTAX)) push(`syn-${k}`, v);
for (const [k, v] of Object.entries(DOTS)) push(`dot-${k}`, v);

const css = `/* vk · 由 tools/css.mjs 从 src/vocab.mjs 生成 —— 不要手改。
   改数值请改 vocab.mjs，然后 node tools/css.mjs。 */

:root {
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
