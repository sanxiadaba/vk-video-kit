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
for (const p of ['index.html', 'docs.html', 'examples.html']) {
  const abs = `${SITE}/${p}`;
  if (fs.existsSync(abs)) PAGES.push(abs);
}
for (const dir of [`${SITE}/frames`, `${SITE}/components`]) walkHtml(dir, PAGES);
const pages = [...new Set(PAGES)].map((p) => p.slice(SITE.length + 1));

const { base, close } = await startServer({ port: 0, root: SITE, transform: true });
const failures = [];
const seen = new Set();
const idCache = new Map();

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
        failures.push(`${page} → ${raw}: 锚点 #${id} 不存在${samePath ? '' : `（目标 ${url.pathname}）`}`);
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

    // vk-filetree 的 src 指向真实目录（构建期扫描），不是浏览器资源。
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
    const ct = r.headers.get('content-type') || '';
    if (!contentTypeOk(ct)) failures.push(`${page} → ${raw}: content-type ${ct || '空'} 不可渲染`);
  }
  console.log(`✓ ${page}  ${links.length} 个链接`);
}

await close();
if (failures.length) {
  console.log(`\n链接失败 ${failures.length} 条：`);
  for (const f of failures) console.log('  ✗ ' + f);
  process.exitCode = 1;
} else {
  console.log(`\n链接通过：${pages.length} 个页面，${seen.size} 个资源，0 个死链。`);
}
