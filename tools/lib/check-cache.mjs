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

export const CACHE_VERSION = 'vk-check-2';
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

/** 所有页面共享的产物 + 检查工具。任何一项变，全站缓存失效。 */
export function sharedHash(site) {
  return hashFiles([
    ...walk(path.join(site, 'vk')),
    ...walk(path.join(site, 'dist')),
    ...walk(path.join(site, 'assets')),
    ...walk(path.join(ROOT, 'tools/lib')),
    path.join(ROOT, 'tools/gate.mjs'),
    path.join(ROOT, 'tools/contract.mjs'),
    path.join(ROOT, 'src/registry.mjs'),
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

export function isCached(key) {
  try {
    return fs.existsSync(path.join(CACHE_DIR, `${key}.ok`));
  } catch {
    return false;
  }
}

export function markCached(key) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${key}.ok`), new Date().toISOString());
  } catch {
    /* 缓存写失败不影响检查 */
  }
}

export function cacheEnabled(args = process.argv.slice(2)) {
  return process.env.VK_CHECK_CACHE !== '0' && !args.includes('--force');
}
