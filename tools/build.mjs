/**
 * vk build —— 唯一的构建入口。
 * ----------------------------------------------------------------------------
 *   node tools/build.mjs            重建 dist/
 *   node tools/build.mjs --check    只校验：源没变、产物齐
 *
 * 三步：tokens（vocab → CSS 变量）→ vendor（字体 / KaTeX）→ bundle（vk.css / vk.js / audit.js）。
 * 产物清单与源哈希写在 dist/.manifest.json；bin、npm script、测试都只调这一个文件。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { markdown } from '../src/contract.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const MANIFEST = path.join(DIST, '.manifest.json');
const ARTIFACTS = ['tokens.css', 'fonts.css', 'katex.css', 'vk.css', 'vk.js', 'audit.js'];

const step = (file, args = []) =>
  execFileSync(process.execPath, [path.join(ROOT, 'tools', file), ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });

/* 源哈希：src/**、tools/**、package.json 全算。改任何一个字节，产物就不再被信任。 */
function sourceKey() {
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
  walk(path.join(ROOT, 'tools'));
  files.push(path.join(ROOT, 'package.json'));
  const hash = crypto.createHash('sha1');
  for (const f of files.sort()) hash.update(path.relative(ROOT, f)).update('\0').update(fs.readFileSync(f));
  return hash.digest('hex');
}

export function check() {
  if (!fs.existsSync(MANIFEST)) throw new Error('dist/ 还没构建过：跑 node tools/build.mjs');
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (m.key !== sourceKey()) throw new Error('dist/ 与源不一致：跑 node tools/build.mjs');
  for (const f of ARTIFACTS) if (!fs.existsSync(path.join(DIST, f))) throw new Error(`dist/${f} 丢了：跑 node tools/build.mjs`);
  return m;
}

export function build() {
  fs.mkdirSync(DIST, { recursive: true });
  for (const [file, args] of [['gen.mjs', []], ['vendor.mjs', []], ['bundle.mjs', []]]) {
    const out = step(file, args);
    for (const line of out.trim().split('\n').filter(Boolean)) console.log(line);
  }
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'docs/CONTRACT.md'), markdown() + '\n');
  fs.writeFileSync(MANIFEST, JSON.stringify({ key: sourceKey(), version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, artifacts: ARTIFACTS }, null, 1) + '\n');
  console.log('✓ dist/ 已重建');
}

/** 产物可信就直接用，否则重建一次；重建后再校验，仍然不行就把原因抛出去。 */
export function ensure() {
  try {
    check();
    return;
  } catch {
    /* 落到重建 */
  }
  build();
  check();
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
