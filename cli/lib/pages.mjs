/**
 * 源 → 产物。作者只写 pages/ 下的 HTML；构建只写 out/，永不改源文件。
 * 页面里的相对路径（../vk / ../code）在 out/ 与源同深度，所以不用改写。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { transformHtml, createVkHighlighter } from '../../src/highlight.mjs';

const OUT = 'out';
const CACHE = '.vk-cache/build.json';
let highlighter = null;
const getHighlighter = async () => (highlighter ||= await createVkHighlighter());

/**
 * 产物路径保持与源同深度：
 *   pages/smoke.html → out/smoke.html；tests/pages/vk-code.html → out/pages/vk-code.html
 */
export const outPathOf = (src) => {
  const abs = path.resolve(src);
  const rel = path.relative(process.cwd(), abs);
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.length > 1) parts.shift();
  return path.join(OUT, ...parts);
};

let cache = null;
const loadCache = () => {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')).files || {};
  } catch {
    cache = {};
  }
  return cache;
};
const saveCache = () => {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ files: cache }, null, 0) + '\n');
};

/** 源文件 + 它引用的本地文件（size/mtime）决定缓存键。 */
function keyOf(abs, html) {
  const h = crypto.createHash('sha1');
  h.update(html);
  for (const m of html.matchAll(/\bsrc="([^"]+)"/g)) {
    const src = m[1];
    if (/^(?:[a-z]+:|\/|#)/i.test(src)) continue;
    const dep = path.resolve(path.dirname(abs), src.split(/[?#]/)[0]);
    h.update('\0' + dep);
    try {
      const st = fs.statSync(dep);
      h.update(`${st.size}:${st.mtimeMs}`);
    } catch {
      /* 缺文件交给 transform 报错 */
    }
  }
  return h.digest('hex');
}

export async function buildOne(src, { force = false } = {}) {
  const abs = path.resolve(src);
  const html = fs.readFileSync(abs, 'utf8');
  const out = outPathOf(abs);
  const key = keyOf(abs, html);
  const files = loadCache();
  if (!force && files[abs] === key && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(abs).mtimeMs) {
    return { src: abs, out, count: 0, cached: true };
  }
  const needsHl = /<vk-(?:code|diff|asm)\b/.test(html);
  const result = await transformHtml(html, { file: src, highlighter: needsHl ? await getHighlighter() : null });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, result.html);
  files[abs] = key;
  saveCache();
  return { src: abs, out, count: result.count, cached: false };
}

/** 输入可以是源页、out/ 文件或目录。 */
export async function resolvePage(input, { build = true, force = false } = {}) {
  const abs = path.resolve(input);
  const isBuilt = path.relative(OUT, abs).startsWith('..') === false;
  if (isBuilt && fs.existsSync(abs)) return abs;
  if (!fs.existsSync(abs)) throw new Error(`找不到 ${input}`);
  if (!build) throw new Error(`${input} 还没有构建产物（先跑 vk build ${input}）`);
  return (await buildOne(input, { force })).out;
}

export function collect(dir) {
  const out = [];
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isFile()) {
      if (p.endsWith('.html')) out.push(p);
      return;
    }
    for (const f of fs.readdirSync(p)) {
      if (f.startsWith('.')) continue;
      walk(path.join(p, f));
    }
  };
  walk(dir);
  return out;
}
