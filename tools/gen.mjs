/**
 * vk gen：从 vocab 生成 CSS 变量。
 *
 *   node tools/gen.mjs              单独生成（build 里同进程调用 run()）
 *   import { run } from './gen.mjs'
 *
 * 纯函数：只读 src/vocab.mjs，写一份 tokens.css 到目标 dist。
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONN, ANN } from '../src/shared/connector.mjs';
import {
  CANVAS,
  CONTENT,
  FONT,
  LINE,
  MEASURE,
  TRACKING,
  WEIGHT,
  GAP,
  SPACE,
  RADIUS,
  LINE_W,
  PAINT,
  SYNTAX,
  FONT_FAMILY,
} from '../src/vocab.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * 生成 dist/tokens.css。
 *   dist  产物目录（build 传 .vk-tmp/dist.next）
 * 返回 { variables }。
 */
export function run({ dist = path.join(ROOT, 'dist') } = {}) {
  const rows = [];
  const push = (name, value) => rows.push(`  --vk-${name}: ${value};`);
  const pair = (name, key) => {
    const [light, dark] = PAINT[key];
    push(name, `light-dark(${light}, ${dark})`);
  };

  push('canvas-w', `${CANVAS.w}px`);
  push('canvas-h', `${CANVAS.h}px`);
  push('margin-x', `${CANVAS.marginX}px`);
  push('margin-y', `${CANVAS.marginY}px`);
  push('content-w', `${CONTENT.w}px`);
  push('content-h', `${CONTENT.h}px`);

  rows.push('');
  for (const [tier, px] of Object.entries(FONT)) {
    push(`fs-${tier}`, `${px}px`);
    push(`lh-${tier}`, String(LINE[tier]));
    push(`measure-${tier}`, `${MEASURE[tier]}em`);
    push(`track-${tier}`, `${TRACKING[tier]}em`);
  }

  rows.push('');
  for (const [name, px] of Object.entries(SPACE)) push(`space-${name}`, `${px}px`);
  for (const [name, px] of Object.entries(GAP)) push(`gap-${name}`, `${px}px`);
  for (const [name, px] of Object.entries(RADIUS)) push(`radius-${name}`, px >= 999 ? '999px' : `${px}px`);
  for (const [name, px] of Object.entries(LINE_W)) push(`line-w-${name}`, `${px}px`);
  /* 连接件与标注几何：CSS 与运行期读同一组数（src/shared/connector.mjs）。 */
  for (const [k, v] of Object.entries({ head: CONN.head, 'head-w': CONN.headW, tip: CONN.tip, clear: CONN.clear, corner: CONN.corner, shaft: CONN.shaft, 'min-gap': CONN.minGap, 'arrow-gap': CONN.arrowGap })) push(`conn-${k}`, `${v}px`);
  for (const [k, v] of Object.entries(ANN)) push(`ann-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, `${v}px`);

  rows.push('');
  push('w-regular', WEIGHT.regular);
  push('w-medium', WEIGHT.medium);
  push('w-bold', WEIGHT.bold);
  push('font-sans', FONT_FAMILY.sans);
  push('font-mono', FONT_FAMILY.mono);

  rows.push('');
  pair('paper', 'paper');
  pair('raised', 'raised');
  pair('soft', 'soft');
  /* auto 材质：浅页用纸、暗页用抬起面。 */
  push('surface-auto', `light-dark(${PAINT.paper[0]}, ${PAINT.raised[1]})`);
  pair('ink-1', 'ink1');
  pair('ink-2', 'ink2');
  pair('ink-3', 'ink3');
  pair('line-color', 'line');
  pair('line-strong', 'lineStrong');
  pair('focus', 'focus');
  for (const t of ['info', 'ok', 'warn', 'err']) pair(t, t);
  pair('on-focus', 'onFocus');
  pair('mark', 'mark');

  rows.push('');
  for (const [k, v] of Object.entries(SYNTAX)) push(`syn-${k}`, `light-dark(${v[0]}, ${v[1]})`);

  const css = `/* vk · 由 tools/gen.mjs 从 src/vocab.mjs 生成 —— 不要手改。
   颜色是 light-dark(纸面, 暗面)：谁声明表面，谁写一行 color-scheme。 */

:root {
  color-scheme: light;
${rows.join('\n')}
}
`;

  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, 'tokens.css'), css);
  console.error(`gen: tokens.css（${rows.filter((r) => r.trim()).length} 个变量）`);
  return { variables: rows.filter((r) => r.trim()).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    run();
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
