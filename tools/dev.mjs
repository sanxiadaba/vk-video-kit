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

/* ------------------------------------------------------------------ 重建 */

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let building = false;
let queued = null;
let buildTimer = 0;

function rebuild(reason) {
  if (building) {
    queued = reason;
    return;
  }
  building = true;
  const t = Date.now();
  console.log(`[dev] build ← ${reason}`);
  const b = spawn(npmCmd, ['run', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  b.on('exit', (code) => {
    building = false;
    console.log(`[dev] build ${code ? '✗' : '✓'} ${((Date.now() - t) / 1000).toFixed(1)}s`);
    if (queued) {
      const next = queued;
      queued = null;
      rebuild(next);
    }
  });
}

function scheduleBuild(reason) {
  if (buildTimer) clearTimeout(buildTimer);
  buildTimer = setTimeout(() => {
    buildTimer = 0;
    rebuild(reason);
  }, 180);
}

function watchTree(rel, filter) {
  try {
    fs.watch(path.join(ROOT, rel), { recursive: true }, (_e, file) => {
      if (!file || file.includes('.tmp') || file.startsWith('.')) return;
      if (filter && !filter(file)) return;
      scheduleBuild(`${rel}/${file}`);
    });
  } catch {
    /* 平台不支持 recursive：保留固定文件 watch */
  }
}

watchTree('src', (f) => !/(icons|icons\\.core)\\.generated/.test(f));
watchTree('site');
watchTree('tools', (f) => /(specimens|scenes|gen|build|assemble|icons|fonts|katex)\.mjs$/.test(f));
watchTree('cli', (f) => /(build|transform|highlight)/.test(f));

function stop() {
  if (child) child.kill();
  child = null;
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', () => child?.kill());

start();
