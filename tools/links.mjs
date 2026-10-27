/**
 * 链接门禁：页面上每个 href / src 必须 200，且浏览器能「看」。
 *
 *   node tools/links.mjs
 *
 * 范围：根页面 + frames/ + docs/components/（存在时递归）。锚点既查本页，也查跨页。
 * markdown / octet-stream 不算可渲染——属性参考曾经就是这样变成下载的。
 */
import fs from 'node:fs';
import { startServer } from '../cli/serve.mjs';
import { contentTypeOk } from './lib/contract-core.mjs';

const SITE = '_site';

function walkHtml(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${ent.name}`.replace(/\\/g, '/');
    if (ent.isDirectory()) walkHtml(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  }
}

const PAGES = [];
for (const p of ['index.html']) {
  const abs = `${SITE}/${p}`;
  if (fs.existsSync(abs)) PAGES.push(abs);
}
walkHtml(`${SITE}/specimen`, PAGES);
const pages = [...new Set(PAGES)].map((p) => p.slice(SITE.length + 1));

const { base, close } = await startServer({ port: 0, root: SITE, transform: true });
const failures = [];
const seen = new Set();
const idCache = new Map();

/** 可达性图：从 index.html 出发，站内 href 走一遍。孤儿页 = 永远没人链到它。 */
const pageSet = new Set(pages);
const graph = new Map(pages.map((p) => [p, new Set()]));

const skip = (href) =>
  !href ||
  href.startsWith('data:') ||
  href.startsWith('mailto:') ||
  href.startsWith('tel:') ||
  href.startsWith('javascript:') ||
  /^https?:/i.test(href);

async function idsOf(url) {
  const key = url.origin + url.pathname;
  if (idCache.has(key)) return idCache.get(key);
  try {
    const resp = await fetch(key);
    if (!resp.ok) {
      idCache.set(key, null);
      return null;
    }
    const html = await resp.text();
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    idCache.set(key, ids);
    return ids;
  } catch {
    idCache.set(key, null);
    return null;
  }
}

for (const page of pages) {
  const pageUrl = new URL(page, base);
  const resp = await fetch(pageUrl);
  if (!resp.ok) {
    failures.push(`${page}: HTTP ${resp.status}`);
    continue;
  }
  const html = await resp.text();
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  idCache.set(pageUrl.origin + pageUrl.pathname, ids);
  const links = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]);

  // 只记 href（src 不是导航），落到站内页面才算一条边。
  for (const raw of [...html.matchAll(/\bhref="([^"]+)"/g)].map((m) => m[1])) {
    if (skip(raw)) continue;
    const u = new URL(raw, pageUrl);
    if (u.origin !== new URL(base).origin) continue;
    const p = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if (pageSet.has(p)) graph.get(page).add(p);
  }

  for (const raw of links) {
    if (skip(raw)) continue;
    const url = new URL(raw, pageUrl);
    if (url.origin !== new URL(base).origin) continue;

    if (url.hash) {
      const id = decodeURIComponent(url.hash.slice(1));
      const samePath = url.pathname === pageUrl.pathname;
      const targetIds = samePath ? ids : await idsOf(url);
      if (targetIds === null) {
        failures.push(`${page} → ${raw}: 目标页打不开 HTTP ${url.pathname}`);
      } else if (id && !targetIds.has(id)) {
        // 镜头/索引页是 JS 路由，不靠 DOM id 落点；有 data-lens / data-docpage 即为合法。
        const lensRoute = samePath && /^(plate|variants|anatomy|usage|api)$/.test(id) && /data-lens=/.test(html);
        const docRoute = samePath && /^p\d+$/.test(id) && /data-docpage=/.test(html);
        if (!lensRoute && !docRoute) {
          failures.push(`${page} → ${raw}: 锚点 #${id} 不存在${samePath ? '' : `（目标 ${url.pathname}）`}`);
        }
      }
      if (samePath) continue;
      // 跨页 hash：目标页已通过 idsOf 取到 200，不再重复检查 content-type。
      const key = url.origin + url.pathname;
      if (seen.has(key)) continue;
      seen.add(key);
      continue;
    }

    const key = url.href;
    if (seen.has(key)) continue;
    seen.add(key);

    // vk-tree 的 src 指向真实目录（构建期扫描），不是浏览器资源。
    const local = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    try {
      const localPath = `${SITE}/${local}`;
      if (local && fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) continue;
    } catch {
      /* 路径异常就按普通链接处理 */
    }

    let r;
    try {
      r = await fetch(url);
    } catch (e) {
      failures.push(`${page} → ${raw}: ${e.message}`);
      continue;
    }
    if (!r.ok) {
      failures.push(`${page} → ${raw}: HTTP ${r.status}`);
      continue;
    }
    // .bin 是 vk-bytes 的构建期数据，浏览器不直接渲染它；存在即可。
    if (/\.bin$/i.test(local)) continue;
    const ct = r.headers.get('content-type') || '';
    if (!contentTypeOk(ct)) failures.push(`${page} → ${raw}: content-type ${ct || '空'} 不可渲染`);
  }
  console.log(`✓ ${page}  ${links.length} 个链接`);
}

await close();

// 可达性：index.html 走不到的页面就是孤儿（画廊曾经就是这样上线的）。
if (pageSet.has('index.html')) {
  const reach = new Set(['index.html']);
  const queue = ['index.html'];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of graph.get(cur) || []) {
      if (reach.has(n)) continue;
      reach.add(n);
      queue.push(n);
    }
  }
  const orphans = pages.filter((p) => !reach.has(p));
  if (orphans.length) {
    failures.push(`不可达：${orphans.slice(0, 8).join(', ')}${orphans.length > 8 ? ` 等 ${orphans.length} 页` : ''}（没有任何页面链到它）`);
  }
}

if (failures.length) {
  console.log(`\n链接失败 ${failures.length} 条：`);
  for (const f of failures) console.log('  ✗ ' + f);
  process.exitCode = 1;
} else {
  console.log(`\n链接通过：${pages.length} 个页面，${seen.size} 个资源，0 个死链。`);
}
