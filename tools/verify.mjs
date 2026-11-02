/**
 * 只读校验：所有生成物必须与源码一致。
 *
 *   node tools/verify.mjs
 *
 * 不写盘；任何漂移退出码 1。npm test 先跑它，避免“测试前先重建”把
 * 过期产物洗成最新。
 */
import { spawn } from 'node:child_process';

/** 跑一个检查；返回 [label, code]。 */
function check(label, args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => resolve([label, code, out]));
  });
}

/** 一次跑 n 个，减少进程串行的空转（这些检查都是只读的）。 */
async function pool(tasks, n = 3) {
  const out = [];
  let i = 0;
  const worker = async () => {
    while (i < tasks.length) {
      const [label, args] = tasks[i++];
      out.push(await check(label, args));
    }
  };
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

const steps = [
  ['generated types / reference', ['tools/gen.mjs', '--check']],
  ['ai authoring doc', ['tools/ai-doc.mjs', '--check']],
  ['css / js', ['tools/build.mjs', '--check']],
  ['specimen hosts', ['tools/scenes.mjs', '--check']],
  ['site assets', ['tools/assemble.mjs', '--check']],
  ['capability matrix', ['tools/capabilities.mjs', '--check']],
  ['specimen pages', ['tools/specimens.mjs', '--check']],
  ['precompiled hosts', ['cli/build.mjs', '--check', '_site/specimens']],
  ['precompiled site', ['cli/build.mjs', '--check', '_site/specimen', '_site/index.html']],
];

// 前七步只读且互不依赖，并行跑；最后两步是预编译校验，放在最后串行。
const readOnly = steps.slice(0, 7);
const precompiled = steps.slice(6);
let failed = 0;
for (const [label, code, out] of await pool(readOnly, 3)) {
  console.log(`\n▸ ${label}${code === 0 ? ' ✓' : ''}`);
  if (code !== 0) {
    failed++;
    if (out.trim()) console.log(out.trim().split('\n').slice(0, 12).join('\n'));
  }
}
for (const [label, args] of precompiled) {
  console.log(`\n▸ ${label}`);
  const [, code, out] = await check(label, args);
  if (code !== 0) {
    failed++;
    if (out.trim()) console.log(out.trim().split('\n').slice(0, 12).join('\n'));
  }
}

if (failed) {
  console.error(`\n✗ verify 失败：${failed} 个生成步骤有过期产物。运行 npm run build 重建。`);
  process.exitCode = 1;
} else {
  console.log('\n✓ verify：所有生成物都是最新的。');
}
