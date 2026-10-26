/**
 * 开发服务器：静态文件 + 按请求预编译 <vk-code> / <vk-diff>。
 *
 * 这样 `<vk-code src="code/hello.c">` 在 dev 下是「改 .c、刷新页面、立刻看到」，
 * 不需要手动跑 CLI；产物仍然是普通 HTML。
 *
 * 也给 tools/shots.mjs 复用：startServer({ port: 0 })。
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';
import { computeServerId } from './lib/build-id.mjs';

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
  // 进程启动时的服务端代码指纹：页面拿它和 dist/build.json.server 对比，
  // 不一致 = 这个进程比磁盘上的 serve.mjs 旧，必须重启。
  const serverId = computeServerId();
  let highlighterPromise = null;
  const highlighter = () => (highlighterPromise ||= createVkHighlighter());
  // dev 下每改一次 .c 才重算；同一页面的重复请求只转换一次。
  const htmlCache = new Map();

  async function renderHtml(file) {
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
          server: serverId,
          expectedServer: build?.server || null,
          ok: !!build && serverId === build.server,
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
          console.error(`✗ ${path.relative(root, file)}: ${e.message}`);
          res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
          res.end(
            `<!doctype html><meta charset="utf-8"><body style="font:16px/1.6 ui-monospace,monospace;padding:40px">` +
              `<h1 style="color:#CC3A2F">vk 预编译失败</h1><p>${escHtml(path.relative(root, file))}</p>` +
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

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const actual = server.address().port;
  const base = `http://127.0.0.1:${actual}`;
  return {
    server,
    base,
    port: actual,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** CLI 入口：bin/vk.mjs 调这个，不要把端口丢掉 */
export async function main(port = 8099, root = process.cwd()) {
  const { base } = await startServer({ port, root });
  console.log(`serving ${root} on ${base}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(Number(process.argv[2] || 8099), process.argv[3] || process.cwd());
}
