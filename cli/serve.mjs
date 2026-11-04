/**
 * 开发服务器：静态文件 + 按请求预编译 <vk-code> / <vk-diff>。
 *
 * 这样 `<vk-code src="code/hello.c">` 在 dev 下是「改 .c、刷新页面、立刻看到」，
 * 不需要手动跑 CLI；产物仍然是普通 HTML。
 *
 * 也给 tools/shots.mjs 复用：startServer({ port: 0 })。
 */
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';
import { computeStamp, isStale } from './lib/build-id.mjs';

/**
 * 过时判定（纯函数，测试直接调，不用起真进程）。
 *
 * 判据 = 服务端代码指纹 + 构建产物指纹（build.json 的 id / dist/vk.js 的哈希）。
 * 只看 serve.mjs 自己是上一版的 bug：库新增 vk-label、vk-steps.connector 之后
 * serve.mjs 一个字没动，判定永远"没过时"，页面却拿旧 registry 报「未知标签」。
 *
 * @param {string} startupStamp startServer 启动时记下的指纹
 * @param {string} [root] 库根（默认 = 本库）
 * @returns {boolean} true = 磁盘上的库比这个进程新，必须重启
 */
export function serverIsStale(startupStamp, root = undefined) {
  return isStale(startupStamp, computeStamp(root));
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.c': 'text/plain; charset=utf-8',
  '.h': 'text/plain; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.term': 'text/plain; charset=utf-8',
  // 真实采集的 transcript 常是 .txt（assets/hello/build/steps.txt 这类）：
  // 浏览器要按文本看，不能当下载。vk-term/vk-code 的 src 也靠它。
  '.txt': 'text/plain; charset=utf-8',
  '.diff': 'text/plain; charset=utf-8',
  '.tex': 'text/plain; charset=utf-8',
};

const escHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * 起一个 vk 开发服务器。port=0 时由系统分配，返回实际地址。
 * transform=false 时原样发送已提交的 HTML（门禁用它验证磁盘产物）。
 * @returns {Promise<{ server: import('node:http').Server, base: string, port: number, close: () => Promise<void> }>}
 */
export async function startServer({ port = 8099, root = process.cwd(), transform = true } = {}) {
  // 进程启动时的库指纹：服务端代码 + 构建产物（dist/build.json 的 id）。
  // 页面 / 请求拿它和现在的指纹比，不一致 = 这个进程比磁盘上的库旧，必须重启。
  const serverStamp = computeStamp();
  // 过时了就自己重启：库改十几轮，人不会记得重启服务器，
  // 而每次"过时"看起来都像页面坏了。--no-restart 可以关掉（测试与 CI 用）。
  // 端口 0 是测试用的临时端口，不能自己重启（会抢不到端口、把测试进程搞乱）。
  const noRestart = port === 0 || process.argv.includes('--no-restart');
  let restarting = false;
  const selfRestart = () => {
    if (noRestart || restarting) return;
    restarting = true;
    // 不自己 spawn：以 42 退出，由监护进程在端口释放后拉起新 worker。
    setTimeout(() => process.exit(42), 400);
  };
  let highlighterPromise = null;
  const highlighter = () => (highlighterPromise ||= createVkHighlighter());
  // dev 下每改一次 .c 才重算；同一页面的重复请求只转换一次。
  const htmlCache = new Map();

  async function renderHtml(file) {
    // 先判旧、再看缓存：页面自己的 mtime 没变，但库重建过，缓存里的那份也不能信
    // （它由旧 registry 的校验产出）。放在缓存前面，过时才不会被命中缓存掩盖。
    if (serverIsStale(serverStamp)) {
      const e = new Error(
        '库已更新（构建产物或服务端代码变了），这个 vk serve 进程还是启动时那一份。\n' +
          '启动指纹 ' + serverStamp + ' → 现在 ' + computeStamp() + '。\n' +
          '已经自动重启；刷新后这条提示会消失。如果仍然存在，才是页面真的写错了。'
      );
      e.staleServer = true;
      throw e;
    }
    const st = await fs.stat(file);
    const hit = htmlCache.get(file);
    if (hit && hit.mtimeMs === st.mtimeMs) {
      let fresh = true;
      for (const dep of hit.deps) {
        const ds = await fs.stat(dep.path);
        if (ds.mtimeMs !== dep.mtimeMs) {
          fresh = false;
          break;
        }
      }
      if (fresh) return hit.html;
    }
    const html = (await fs.readFile(file)).toString('utf8');
    const out = await transformHtml(html, { file, highlighter: await highlighter() });
    const deps = [];
    for (const d of out.deps || []) {
      const ds = await fs.stat(d);
      deps.push({ path: d, mtimeMs: ds.mtimeMs });
    }
    htmlCache.set(file, { mtimeMs: st.mtimeMs, deps, html: out.html });
    return out.html;
  }

  const server = http.createServer(async (req, res) => {
    let url;
    try {
      url = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch {
      res.writeHead(400).end('bad request');
      return;
    }
    const file = path.join(root, url === '/' ? '/index.html' : url);
    if (url === '/__vk_build') {
      let build = null;
      try {
        build = JSON.parse(await fs.readFile(path.join(root, 'dist/build.json'), 'utf8'));
      } catch {
        /* 还没构建过 */
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(
        JSON.stringify({
          build: build?.id || null,
          server: serverStamp,
          buildServer: build?.server || null,
          stale: serverIsStale(serverStamp),
          ok: !serverIsStale(serverStamp),
        })
      );
      return;
    }
    // 前缀必须带分隔符：/root-evil 不能通过 /root 的检查。
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    try {
      let data;
      if (path.extname(file) === '.html' && transform) {
        try {
          data = Buffer.from(await renderHtml(file), 'utf8');
        } catch (e) {
          // 进程过时：页面里明说，同时自己重启——这次刷新之后就是新代码。
          if (e.staleServer) selfRestart();
          console.error(`✗ ${path.relative(root, file)}: ${e.message}`);
          res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
          res.end(
            `<!doctype html><meta charset="utf-8"><body style="font:16px/1.6 ui-monospace,monospace;padding:40px">` +
              (e.staleServer
        ? '<h1 style="color:#8A6D00">库已更新，正在重启</h1>' +
          '<p>这个 vk serve 进程用的是启动时那一份 registry / dist。已经自动重启，' +
          '等一两秒刷新本页即可。这不是页面的错。</p>'
        : '<h1 style="color:#CC3A2F">vk 预编译失败</h1>') +
      `<p>${escHtml(path.relative(root, file))}</p>` +
              `<pre style="white-space:pre-wrap;background:#FEE;padding:20px;border-left:4px solid #CC3A2F">${escHtml(e.message)}</pre></body>`
          );
          return;
        }
      } else {
        data = await fs.readFile(file);
      }
      const type =
        path.basename(file) === 'LICENSE'
          ? 'text/plain; charset=utf-8'
          : TYPES[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(data);
    } catch (e) {
      res.writeHead(404).end('not found: ' + url);
    }
  });

  // 自动重启时旧进程刚 close，端口在 Windows 上要过几十毫秒才真的释放；
  // 新进程若此刻直接 listen 就会 EADDRINUSE 然后退出——服务就"停住"了。
  // 所以绑定失败要退避重试，而不是一次就放弃。
  const listen = async (tries = 40) => {
    for (let i = 0; ; i++) {
      try {
        await new Promise((resolve, reject) => {
          const onErr = (e) => {
            server.off('listening', onOk);
            reject(e);
          };
          const onOk = () => {
            server.off('error', onErr);
            resolve();
          };
          server.once('error', onErr);
          server.once('listening', onOk);
          server.listen(port, '127.0.0.1');
        });
        return;
      } catch (e) {
        if (e.code !== 'EADDRINUSE' || i >= tries) throw e;
        await new Promise((r) => setTimeout(r, 150 * Math.min(i + 1, 8)));
      }
    }
  };
  await listen();
  // Chromium 拒绝连接一批"不安全端口"（6000、6665-6669、10080 …）。
  // port=0 时系统可能正好分到它们，页面直接 ERR_UNSAFE_PORT ——
  // 看起来像组件挂了，其实是端口不能用。只对自动分配端口重试，显式端口不动。
  if (port === 0) {
    const UNSAFE = new Set([2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);
    while (UNSAFE.has(server.address().port)) {
      await new Promise((r) => server.close(r));
      await listen();
    }
  }
  const actual = server.address().port;
  const base = `http://127.0.0.1:${actual}`;
  return {
    server,
    base,
    port: actual,
    // 关服务器时先把 keep-alive 连接掐掉：http.Server.close() 会一直等它们自己断，
    // 浏览器还活着的时候就是干等（实测每个测试文件多花 9 秒收尾）。
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(resolve);
      }),
  };
}

/** CLI 入口：bin/vk.mjs 调这个，不要把端口丢掉 */
function portBusy(port) {
  return new Promise((resolve) => {
    const probe = net.connect({ port, host: '127.0.0.1' });
    probe.once('connect', () => { probe.destroy(); resolve(true); });
    probe.once('error', () => resolve(false));
  });
}

export async function main(port = 8099, root = process.cwd()) {
  // 监护进程：自己不持端口，只负责"拉 worker、等它死、再拉一个"。
  // 库变了时 worker 以 42 退出；监护进程先等端口真正释放，再拉起新 worker。
  // 这样不会再出现"旧进程关了、新进程抢不到端口、服务就没了"。
  if (!process.argv.includes('--worker')) {
    for (;;) {
      const child = spawn(process.execPath, [process.argv[1], ...process.argv.slice(2), '--worker'], {
        stdio: 'inherit',
        env: process.env,
      });
      const code = await new Promise((resolve) => child.on('exit', (c) => resolve(c)));
      if (code !== 42) process.exit(code ?? 0);
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 150 * Math.min(i + 1, 6)));
        if (!(await portBusy(port))) break;
      }
    }
  }
  const { base } = await startServer({ port, root });
  console.log(`serving ${root} on ${base} · lib ${computeStamp()}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(Number(process.argv[2] || 8099), process.argv[3] || process.cwd());
}
