/**
 * 统一测试编排。
 *
 *   node tools/test-all.mjs          # 全量：build → 静态 → 契约/复制 → 门禁/自检 → 浏览器回归 → 纯函数单测
 *   node tools/test-all.mjs --fast   # 快检：verify + links + pack + 纯函数单测（不 build）
 *
 * 三条硬规则：
 * 1. 全量先 build；CI 已经 build 过时可设 VK_SKIP_BUILD=1（或 --no-build）跳过重复构建。
 * 2. 任何一组失败立即停（fail-fast），不把后面的浏览器任务跑完。
 * 3. 浏览器任务最多 2 个并发、默认 2 路分片；unit 只跑纯函数测试。
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const fast = args.includes('--fast');
const skipBuild = fast || args.includes('--no-build') || process.env.VK_SKIP_BUILD === '1';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const shards = Math.max(1, Math.min(8, (os.availableParallelism?.() ?? os.cpus().length) - 1));

/** 产物指纹与源码一致就不重建：npm run build 之后的 npm test 不该再 build 一次。 */
async function freshEnough() {
  const stamp = '_site/.fingerprint';
  if (!fs.existsSync(stamp) || !fs.existsSync('_site/index.html')) return false;
  const { fingerprint } = await import('./lib/fingerprint.mjs');
  return fs.readFileSync(stamp, 'utf8').trim() === fingerprint();
}

const results = [];
let aborted = false;

function killTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      child.kill('SIGKILL');
    } catch {
      /* 已经退出 */
    }
  }
}

function run(label, args, { timeoutMs = 180000, env = process.env } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(args[0], args.slice(1), {
      stdio: 'inherit',
      env,
      shell: process.platform === 'win32' && args[0].endsWith('.cmd'),
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      console.error(`\n✗ ${label} 超时（${timeoutMs}ms），终止进程树`);
      killTree(child);
    }, timeoutMs);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      const r = {
        label,
        code: timedOut ? 124 : (code ?? (signal ? 1 : 0)),
        ms: Date.now() - started,
        timedOut,
      };
      results.push(r);
      resolve(r);
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      console.error(`\n✗ ${label} 启动失败：${e.message}`);
      const r = { label, code: 1, ms: Date.now() - started, timedOut: false };
      results.push(r);
      resolve(r);
    });
  });
}

/** 一组任务最多 limit 个并发；任何一个失败就不再启动新任务。 */
async function pool(tasks, limit = 2) {
  let next = 0;
  let failed = null;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (!failed) {
      const i = next++;
      if (i >= tasks.length) return;
      const r = await tasks[i]();
      if (r.code !== 0) failed = r;
    }
  });
  await Promise.all(workers);
  return failed;
}

const npx = process.platform === 'win32' ? 'node' : 'node';
const nodeTest = [
  npx,
  '--test',
  '--test-concurrency=1',
  'tests/anchor.test.mjs',
  'tests/contract.test.mjs',
  'tests/geometry.test.mjs',
  'tests/package.test.mjs',
  'tests/registry.test.mjs',
  'tests/shared.test.mjs',
  'tests/transform.test.mjs',
];
const browserTest = [npx, '--test', '--test-concurrency=1', 'tests/canvas.test.mjs', 'tests/dom.test.mjs'];
const browserEnv = {
  ...process.env,
  CONTRACT_SHARDS: process.env.CONTRACT_SHARDS || String(Math.min(4, shards)),
  GATE_SHARDS: process.env.GATE_SHARDS || String(Math.min(2, shards)),
  GATE_TIMEOUT_MS: process.env.GATE_TIMEOUT_MS || '600000',
  CONTRACT_TIMEOUT_MS: process.env.CONTRACT_TIMEOUT_MS || '300000',
};

if (fast) {
  // 快检不启动浏览器：生成物、链接、包体、纯函数。
  const staticFailed = await pool(
    [
      () => run('verify', [process.execPath, 'tools/verify.mjs'], { timeoutMs: 120000 }),
      () => run('links', [process.execPath, 'tools/links.mjs'], { timeoutMs: 120000 }),
      () => run('pack', [process.execPath, 'tools/pack-check.mjs'], { timeoutMs: 120000 }),
    ],
    2
  );
  if (staticFailed) aborted = true;
  else {
    const unit = await run('unit', nodeTest, { timeoutMs: 120000 });
    if (unit.code !== 0) aborted = true;
  }
} else {
  if (!skipBuild && (await freshEnough())) {
    console.log('· build 已跳过（产物比 src 新）');
  } else if (!skipBuild) {
    const build = await run('build', [npmCmd, 'run', 'build'], { timeoutMs: 300000, env: process.env });
    if (build.code !== 0) aborted = true;
  } else {
    console.log('· build 已跳过（VK_SKIP_BUILD=1 / --no-build）');
  }

  if (!aborted) {
    const staticFailed = await pool(
      [
        () => run('verify', [process.execPath, 'tools/verify.mjs'], { timeoutMs: 180000 }),
        () => run('links', [process.execPath, 'tools/links.mjs'], { timeoutMs: 180000 }),
        () => run('pack', [process.execPath, 'tools/pack-check.mjs'], { timeoutMs: 180000 }),
      ],
      2
    );
    if (staticFailed) aborted = true;
  }

  if (!aborted) {
    // 浏览器是稀缺资源：十几 个 Chromium 同时抢核只会互相拖慢（实测 34s vs 39s）。
    // 两波：契约（4 片）+ 纯函数单测，然后门禁（2 片）+ 浏览器回归。
    const waveA = await pool(
      [
        () => run('contract', [process.execPath, 'tools/contract-all.mjs'], { timeoutMs: 600000, env: browserEnv }),
        () => run('unit', nodeTest, { timeoutMs: 120000 }),
      ],
      2
    );
    if (waveA) aborted = true;
    if (!aborted) {
      const waveB = await pool(
        [
          () => run('gate', [process.execPath, 'tools/gate-all.mjs', '--presets'], { timeoutMs: 600000, env: browserEnv }),
          () => run('browser', browserTest, { timeoutMs: 600000, env: browserEnv }),
        ],
        2
      );
      if (waveB) aborted = true;
    }
  }
}

console.log('');
for (const r of results) {
  const status = r.code === 0 ? '✓' : r.timedOut ? '⏱' : '✗';
  console.log(`${status} ${r.label.padEnd(10)} ${(r.ms / 1000).toFixed(1)}s${r.timedOut ? '  超时' : ''}`);
}
if (aborted || results.some((r) => r.code !== 0)) {
  const failed = results.filter((r) => r.code !== 0).map((r) => r.label);
  console.error(`\n测试失败：${failed.length ? failed.join(', ') : '未知'}`);
  process.exitCode = 1;
} else {
  console.log(`\n${fast ? '快检' : '全量'}通过（${results.length} 组）。`);
}
