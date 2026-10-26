/**
 * dev supervisor：改 serve.mjs / transform 相关源码，自动重启 dev server。
 *
 *   npm run dev
 *
 * 只重启「服务端会读到」的文件；改 CSS / 组件 / 场景不需要重启（浏览器刷新即可）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { computeServerId } from '../cli/lib/build-id.mjs';

const PORT = Number(process.env.PORT || 8099);
const ROOT = process.cwd();
let child = null;
let timer = 0;

function start() {
  const serverId = computeServerId();
  child = spawn(process.execPath, ['cli/serve.mjs', String(PORT), '_site'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, VK_SERVER_ID: serverId },
  });
  child.on('exit', (code, signal) => {
    if (signal) return;
    if (code && code !== 0) console.error(`[dev] server exited ${code}`);
  });
  console.log(`[dev] server ${serverId} on http://127.0.0.1:${PORT}`);
}

function restart(reason) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = 0;
    if (child) {
      console.log(`[dev] restart: ${reason}`);
      child.removeAllListeners('exit');
      child.kill();
      child = null;
    }
    start();
  }, 180);
}

const watchFiles = new Set([
  'cli/serve.mjs',
  'src/highlight.mjs',
  'src/shared/code.mjs',
  'src/registry.mjs',
  'src/icons.generated.mjs',
  'src/runtime/code-utils.mjs',
]);

for (const f of watchFiles) {
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs)) continue;
  fs.watchFile(abs, { interval: 400 }, () => restart(f));
}

// src 下新增/删除文件也要重启（transform 会 require 新模块时）
try {
  fs.watch(path.join(ROOT, 'src'), { recursive: true }, (_e, file) => {
    if (!file || file.includes('.tmpdir') || file.startsWith('.')) return;
    if (/^(highlight\.mjs|registry\.mjs|icons\.generated\.mjs|shared[\\/]code\.mjs|runtime[\\/]code-utils\.mjs)$/.test(file)) {
      restart(file);
    }
  });
} catch {
  /* 平台不支持 recursive 就算了，watchFile 已经覆盖固定文件 */
}

function stop() {
  if (child) child.kill();
  child = null;
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', () => child?.kill());

start();
