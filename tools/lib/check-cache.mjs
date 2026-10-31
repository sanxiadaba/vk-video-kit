/**
 * 检查缓存：只对「产物真的没变」的页面跳过浏览器门禁。
 *
 * 缓存键 = 工具版本 + 共享产物指纹 + 页面指纹 + 对象名。
 * 共享产物包括 vk/、dist/、assets/、showcase.css/js、检查工具本身；
 * 页面是具体标本页。任何一项变了，对应页面自动失效。
 *
 * 只缓存绿色结果；失败不写缓存。CI 可设 VK_CHECK_CACHE=0 强制全跑。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const CACHE_VERSION = 'vk-check-4';
const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, '.vk-cache');

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const exists = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

export function hashFiles(files) {
  const h = createHash('sha256');
  for (const f of [...new Set(files)].filter(exists).sort()) {
    h.update(f);
    h.update('\0');
    h.update(fs.readFileSync(f));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 32);
}

/**
 * 所有页面共享的产物 + 检查工具。任何一项变，全站缓存失效。
 *
 * 13.0 漏了 src/effects.mjs —— 把一条 kind:'style' 改成 kind:'any'，
 * 契约会"缓存命中"直接变绿。检查的**语义**也是输入，不能只哈希产物。
 * 所以：整个 tools/ 目录 + 所有参与判断的 src 文件都进来。
 */
export function sharedHash(site) {
  return hashFiles([
    ...walk(path.join(site, 'vk')),
    ...walk(path.join(site, 'dist')),
    ...walk(path.join(site, 'assets')),
    ...walk(path.join(ROOT, 'tools')),
    // 页面自己的 CSS 也是输入：配方页借 docs/recipes/recipes.css，
    // 改了 CSS 而页面指纹不变时，旧绿结论会被原样搬过来（14.0 踩过）。
    ...walk(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.css')),
    path.join(ROOT, 'src/registry.mjs'),
    path.join(ROOT, 'src/effects.mjs'),
    path.join(ROOT, 'src/shared/limits.mjs'),
    path.join(ROOT, 'src/scenes/presets.mjs'),
    path.join(ROOT, 'package.json'),
    path.join(ROOT, 'package-lock.json'),
  ]);
}

export function pageHash(site, rel) {
  return hashFiles([path.join(site, rel)]);
}

export function cacheKey(scope, shared, page, name, extra = '') {
  return createHash('sha1').update([CACHE_VERSION, scope, shared, page, name, extra].join('|')).digest('hex');
}

/**
 * 命中判定：不只看".ok 文件在不在"，还要看它记的键与版本是不是当前这一次。
 * 备份/复制/CI 缓存都会把旧 .ok 带过来；只查存在性等于拿旧结论给新代码盖章。
 */
export function isCached(key) {
  try {
    const raw = fs.readFileSync(path.join(CACHE_DIR, `${key}.ok`), 'utf8');
    const rec = JSON.parse(raw);
    return rec.v === CACHE_VERSION && rec.key === key;
  } catch {
    return false;
  }
}

export function markCached(key) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${key}.ok`), JSON.stringify({ v: CACHE_VERSION, key, at: new Date().toISOString() }));
  } catch {
    /* 缓存写失败不影响检查 */
  }
}

export function cacheEnabled(args = process.argv.slice(2)) {
  return process.env.VK_CHECK_CACHE !== '0' && !args.includes('--force');
}
