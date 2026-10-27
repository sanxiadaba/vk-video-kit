/**
 * 并行门禁：把 specimen + frame + page 按 N 路分片，各自跑 tools/gate.mjs。
 *
 *   node tools/gate-all.mjs            # 默认 4 路
 *   $env:GATE_SHARDS=6; node tools/gate-all.mjs
 *   $env:VK_GATE_PRESETS=0; node tools/gate-all.mjs   # 跳过预设像素差
 *
 * 每路自己起 server + browser；互不共享页面，避免串行等待。
 * 失败就是失败：不静默重试；只有子进程超时才记录并终止。
 */
import { spawn } from 'node:child_process';

// 带对象名时只跑那一件（不分片）：npm run gate -- vk-edge frame-0
const names = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const flags = process.argv.slice(2).filter((a) => a.startsWith('-'));
if (names.length) {
  const child = spawn(process.execPath, ['tools/gate.mjs', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
} else {
  const raw = process.env.GATE_SHARDS || '2';
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 16) {
    console.error(`GATE_SHARDS 必须是 1..16 的整数，收到 ${JSON.stringify(raw)}`);
    process.exitCode = 1;
  } else {
    const TIMEOUT_MS = Number(process.env.GATE_TIMEOUT_MS || 600000);
    const runs = [];
    for (let i = 1; i <= n; i++) {
      runs.push(
        new Promise((resolve) => {
          const child = spawn(process.execPath, ['tools/gate.mjs', `--shard=${i}/${n}`, ...flags], {
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
        `\n并行门禁失败：${failed.map((r) => `shard ${r.i}${r.timedOut ? '(超时)' : `(exit ${r.code})`}`).join(', ')}`
      );
      process.exitCode = 1;
    } else {
      console.log(`\n并行门禁全绿（${n} 路）。`);
    }
  }
}
