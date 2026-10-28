/**
 * 只读校验：所有生成物必须与源码一致。
 *
 *   node tools/verify.mjs
 *
 * 不写盘；任何漂移退出码 1。npm test 先跑它，避免“测试前先重建”把
 * 过期产物洗成最新。
 */
import { spawnSync } from 'node:child_process';

const steps = [
  ['generated types / reference', ['tools/gen.mjs', '--check']],
  ['ai authoring doc', ['tools/ai-doc.mjs', '--check']],
  ['css / js', ['tools/build.mjs', '--check']],
  ['specimen hosts', ['tools/scenes.mjs', '--check']],
  ['site assets', ['tools/assemble.mjs', '--check']],
  ['specimen pages', ['tools/specimens.mjs', '--check']],
  ['precompiled hosts', ['cli/build.mjs', '--check', '_site/specimens']],
  ['precompiled site', ['cli/build.mjs', '--check', '_site/specimen', '_site/index.html']],
];

let failed = 0;
for (const [label, args] of steps) {
  console.log(`\n▸ ${label}`);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (r.status !== 0) failed++;
}

if (failed) {
  console.error(`\n✗ verify 失败：${failed} 个生成步骤有过期产物。运行 npm run build 重建。`);
  process.exitCode = 1;
} else {
  console.log('\n✓ verify：所有生成物都是最新的。');
}
