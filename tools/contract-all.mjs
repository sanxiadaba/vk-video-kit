/**
 * 契约门禁并行版：30 个标签切成 N 路，各自起浏览器。
 *
 *   node tools/contract-all.mjs
 *   $env:CONTRACT_SHARDS=8; node tools/contract-all.mjs
 *
 * 分片数必须在 1..16；任一路失败（包括超时、0 个对象）整体失败。
 */
import { spawn } from 'node:child_process';

const raw = process.env.CONTRACT_SHARDS ?? '4';
const n = Number(raw);
if (!Number.isInteger(n) || n < 1 || n > 16) {
  console.error(`CONTRACT_SHARDS 必须是 1..16 的整数，收到 ${JSON.stringify(raw)}`);
  process.exit(1);
}

const TIMEOUT_MS = Number(process.env.CONTRACT_TIMEOUT_MS || 300000);
const runs = [];
for (let i = 1; i <= n; i++) {
  runs.push(
    new Promise((resolve) => {
      const child = spawn(process.execPath, ['tools/contract.mjs', `--shard=${i}/${n}`], {
        stdio: 'inherit',
        env: process.env,
      });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, TIMEOUT_MS);
      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        if (timedOut) console.error(`\n✗ shard ${i}/${n} 超时（${TIMEOUT_MS}ms），已终止`);
        resolve({ i, code: timedOut ? 124 : (code ?? (signal ? 1 : 0)), timedOut });
      });
      child.on('error', (e) => {
        clearTimeout(timer);
        console.error(`\n✗ shard ${i}/${n} 启动失败：${e.message}`);
        resolve({ i, code: 1, timedOut: false });
      });
    })
  );
}
const results = await Promise.all(runs);
const failed = results.filter((r) => r.code !== 0);
if (failed.length) {
  console.error(
    `\n契约失败：${failed.map((r) => `shard ${r.i}${r.timedOut ? '(超时)' : `(exit ${r.code})`}`).join(', ')}`
  );
  process.exitCode = 1;
} else {
  console.log(`\n契约并行通过（${n} 路，每路至少 1 个标签）。`);
}
