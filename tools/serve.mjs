#!/usr/bin/env node
/**
 * 静态服务器：把仓库根目录挂到本地端口，方便在浏览器里翻 out/ 里的图。
 *
 *   npm run serve            # http://127.0.0.1:8788/out/
 *   npm run serve -- 9000    # 换端口
 *
 * 只读：不写文件、不构建。出图还是用 `vk render`。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8788);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/** 目录列表：给 out/ 这种一堆 PNG 的地方一个能点的入口。 */
const listing = (dir, urlPath) => {
  const rows = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
    .map((e) => {
      const href = urlPath.replace(/\/?$/, '/') + encodeURIComponent(e.name) + (e.isDirectory() ? '/' : '');
      const size = e.isDirectory() ? '' : Math.round(fs.statSync(path.join(dir, e.name)).size / 1024) + ' KB';
      return `<li><a href="${href}">${e.name}${e.isDirectory() ? '/' : ''}</a> <em>${size}</em></li>`;
    })
    .join('');
  return `<!doctype html><meta charset="utf-8"><title>${urlPath}</title>
<style>body{font:16px/1.6 ui-monospace,Consolas,monospace;margin:32px;color:#111}
h1{font-size:18px;color:#555}ul{list-style:none;padding:0}li{padding:3px 0}
a{color:#1b3fd6;text-decoration:none}a:hover{text-decoration:underline}em{color:#888;font-style:normal;font-size:13px}</style>
<h1>${urlPath}</h1><ul>${rows || '<li>（空）</li>'}</ul>`;
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const target = path.join(ROOT, urlPath);
  // 只服务仓库内部：挡住 .. 穿越。
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 ' + urlPath);
    return;
  }
  if (stat.isDirectory()) {
    if (!urlPath.endsWith('/')) {
      res.writeHead(301, { location: urlPath + '/' }).end();
      return;
    }
    const index = path.join(target, 'index.html');
    if (fs.existsSync(index)) {
      res.writeHead(200, { 'content-type': TYPES['.html'] }).end(fs.readFileSync(index));
      return;
    }
    res.writeHead(200, { 'content-type': TYPES['.html'] }).end(listing(target, urlPath));
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  fs.createReadStream(target).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`vk 静态服务器 → http://127.0.0.1:${PORT}/out/`);
  console.log(`仓库根目录：${ROOT}`);
  console.log('Ctrl+C 停止（或 job_kill）。');
});
