/**
 * vk build —— 唯一的构建入口。
 * ----------------------------------------------------------------------------
 *   node tools/build.mjs            重建 dist/
 *   node tools/build.mjs --check    只校验：源没变、产物齐、字体够
 *   vk build                        同 build()
 *   import { build, ensure, check } from './build.mjs'
 *
 * 三步 gen → vendor → bundle 全在同一个 Node 进程里（同进程函数调用，不再起子进程）。
 * 产物先写 .vk-tmp/dist.next/，全部成功后才 rm + rename 到 dist/：
 * 并行 render 不会读到半写的 vk.js。dist/.vendor-stamp 已删除——
 * 是否重建只看「源内容哈希 + 产物存在 + 字体数量」（inspect）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { run as genRun } from './gen.mjs';
import { run as vendorRun, countFonts } from './vendor.mjs';
import { run as bundleRun } from './bundle.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const DIST = path.join(ROOT, 'dist');
export const TMP = path.join(ROOT, '.vk-tmp');
const NEXT = path.join(TMP, 'dist.next');
const LOCK = path.join(TMP, 'build.lock');
const MANIFEST = '.manifest.json';
/** dist 里必须有的产物；少任何一个都算没构建好。 */
export const ARTIFACTS = ['tokens.css', 'fonts.css', 'katex.css', 'vk.css', 'vk.js', 'audit.js'];
/** 字体文件下限：6 拉丁 + 303 中文切片 + 20 KaTeX，留出删减余量。 */
export const MIN_FONTS = 300;
const LOCK_STALE_MS = 60_000;
const LOCK_WAIT_MS = 60_000;

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** 源内容哈希：src/**、构建脚本、package.json、lockfile。改字节，产物就不再被信任。 */
export function sourceKey() {
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (/\.(mjs|css|json)$/.test(e.name)) files.push(abs);
    }
  };
  walk(path.join(ROOT, 'src'));
  for (const f of ['build.mjs', 'gen.mjs', 'vendor.mjs', 'bundle.mjs']) files.push(path.join(ROOT, 'tools', f));
  files.push(path.join(ROOT, 'package.json'));
  const lock = path.join(ROOT, 'package-lock.json');
  if (fs.existsSync(lock)) files.push(lock);
  const hash = crypto.createHash('sha1');
  for (const f of files.sort()) hash.update(path.relative(ROOT, f)).update('\0').update(fs.readFileSync(f));
  return hash.digest('hex');
}

/** fonts.css 里每个 url('./…') 都必须能落到 dist 里。 */
function missingFonts(dist) {
  const cssPath = path.join(dist, 'fonts.css');
  if (!fs.existsSync(cssPath)) return ['fonts.css 不存在'];
  const css = fs.readFileSync(cssPath, 'utf8');
  return [...css.matchAll(/url\('\.\/([^)]+)'\)/g)].map((m) => m[1]).filter((rel) => !fs.existsSync(path.join(dist, rel)));
}

/**
 * 只看事实，不抛异常：dist 能不能直接用。
 * 校验 vk.css / vk.js / audit.js / fonts.css / 字体数量 ≥ MIN_FONTS，外加 manifest 的源哈希与 sha1。
 */
export function inspect() {
  const problems = [];
  const fonts = countFonts(DIST);
  let manifest = null;
  if (!fs.existsSync(DIST)) problems.push('dist/ 不存在');
  else {
    const mf = path.join(DIST, MANIFEST);
    try {
      manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
    } catch {
      problems.push('dist/.manifest.json 缺失或损坏');
    }
  }
  if (manifest) {
    if (manifest.key !== sourceKey()) problems.push('源内容变了');
    if (manifest.version !== pkg.version) problems.push(`版本从 ${manifest.version} 变成 ${pkg.version}`);
    for (const f of ARTIFACTS) {
      const abs = path.join(DIST, f);
      if (!fs.existsSync(abs)) problems.push(`缺 ${f}`);
      else if (manifest.artifacts?.[f] && sha1(fs.readFileSync(abs)) !== manifest.artifacts[f]) problems.push(`${f} 内容对不上 sha1`);
    }
    if (manifest.fonts !== undefined && manifest.fonts !== fonts) problems.push(`字体数从 ${manifest.fonts} 变成 ${fonts}`);
  }
  /* manifest 说好也可能被删：这四项是渲染的硬依赖，单独再查一遍。 */
  for (const f of ['vk.css', 'vk.js', 'audit.js', 'fonts.css']) {
    if (!fs.existsSync(path.join(DIST, f)) && !problems.includes(`缺 ${f}`)) problems.push(`缺 ${f}`);
  }
  if (fonts < MIN_FONTS) problems.push(`字体只有 ${fonts} 个（要 ≥ ${MIN_FONTS}）`);
  else {
    const lost = missingFonts(DIST);
    if (lost.length) problems.push(`fonts.css 引用的 ${lost.length} 个字体不在（如 ${lost[0]}）`);
  }
  return { ok: problems.length === 0, problems, manifest, fonts };
}

/** 产物可信就返回 manifest，否则抛一条带修法的错误（只做断言，不重建）。 */
export function check() {
  const r = inspect();
  if (!r.ok) throw new Error(`dist/ 不可用：${r.problems.join('；')}\n  → 跑 vk build（或 node tools/build.mjs）`);
  return r.manifest;
}

/* ---------------------------------------------------------------- 构建锁
   两个并行 render 同时 ensure() 时，后到的等前一个换完 dist 再进场。
   锁超过 60s 视为死锁残留，直接清掉；等满 60s 也清掉再抢。 */
function acquireLock() {
  fs.mkdirSync(TMP, { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      const fd = fs.openSync(LOCK, 'wx');
      fs.writeSync(fd, `${process.pid} ${new Date().toISOString()}\n`);
      fs.closeSync(fd);
      return () => fs.rmSync(LOCK, { force: true });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let age = Infinity;
      try {
        age = Date.now() - fs.statSync(LOCK).mtimeMs;
      } catch {
        continue; /* 刚好被释放，立刻重抢 */
      }
      if (age >= LOCK_STALE_MS || Date.now() > deadline) {
        console.error(`build: 清掉残留构建锁（${Math.round(age / 1000)}s）`);
        fs.rmSync(LOCK, { force: true });
        continue;
      }
      sleep(100);
    }
  }
}

/* 每次构建都从空目录开始：vendor 全量重拷，不留上一次的死文件。 */
function buildIntoNext() {
  fs.rmSync(NEXT, { recursive: true, force: true });
  fs.mkdirSync(NEXT, { recursive: true });
  try {
    genRun({ dist: NEXT });
    vendorRun({ dist: NEXT });
    bundleRun({ dist: NEXT });

    const missing = ARTIFACTS.filter((f) => !fs.existsSync(path.join(NEXT, f)));
    if (missing.length) throw new Error(`产物不齐：缺 ${missing.join(', ')}`);
    const fonts = countFonts(NEXT);
    if (fonts < MIN_FONTS) throw new Error(`字体只有 ${fonts} 个（要 ≥ ${MIN_FONTS}）：检查 node_modules/@fontsource`);
    const lost = missingFonts(NEXT);
    if (lost.length) throw new Error(`fonts.css 引用了不存在的字体：${lost.slice(0, 3).join(', ')}`);

    /* manifest 最后写：有它才代表这一版 dist 是完整的。 */
    const manifest = {
      version: pkg.version,
      key: sourceKey(),
      fonts,
      artifacts: Object.fromEntries(ARTIFACTS.map((f) => [f, sha1(fs.readFileSync(path.join(NEXT, f)))])),
    };
    fs.writeFileSync(path.join(NEXT, MANIFEST), JSON.stringify(manifest, null, 1) + '\n');
    return manifest;
  } catch (e) {
    fs.rmSync(NEXT, { recursive: true, force: true });
    throw e;
  }
}

/** 目录原子替换：先删旧的，再 rename 新的。Windows 上偶尔被占用，重试几次。 */
function swapIn() {
  fs.rmSync(DIST, { recursive: true, force: true });
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(NEXT, DIST);
      return;
    } catch (e) {
      if (i >= 4) throw new Error(`dist/ 替换失败：${e.message}`);
      sleep(100);
    }
  }
}

/** 全量重建 dist（gen → vendor → bundle 同进程），返回 manifest。 */
export function build() {
  const release = acquireLock();
  try {
    const manifest = buildIntoNext();
    swapIn();
    console.error(`✓ dist/ 已重建 · v${manifest.version} · ${manifest.fonts} 个字体`);
    return manifest;
  } finally {
    release();
  }
}

/**
 * 能用就直接用；缺任何一项都重建一次（不再只报「去跑 build」）。
 * 构建期间源又被改过时：产物是刚做完整的，只是哈希对不上——照用并提示，
 * 不抛「再跑一次 build」，避免慢编辑器把 render 卡死。
 */
export function ensure() {
  const first = inspect();
  if (first.ok) return first.manifest;
  build();
  const after = inspect();
  if (after.ok) return after.manifest;
  const hard = after.problems.filter((p) => p !== '源内容变了');
  if (hard.length) throw new Error(`dist/ 重建后仍不可用：${hard.join('；')}\n  → 看构建日志（vk build）`);
  console.error('ensure: 构建后源又被改过（产物完整，先用这一版；下次 render 会再重建）');
  return after.manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    if (process.argv.includes('--check')) {
      check();
      console.log('✓ dist/ 与源一致');
    } else build();
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
