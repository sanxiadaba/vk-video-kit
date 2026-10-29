/**
 * vk 构建
 * ----------------------------------------------------------------------------
 * 1) CSS —— 按架构层拼接，层序在这里唯一决定：
 *      tokens → elements → layout → components → compositions
 *    源文件不写 @layer；层由本文件统一包。
 *
 * 2) JS —— esbuild 打包 src/runtime/index.mjs → dist/vk.js（IIFE）
 *    与 dist/vk.esm.js（给 bundler）。没有 GSAP、没有时间轴。
 *
 * 产物全部是生成物，不要手改。`--check` 只比对，不写盘。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { build } from 'esbuild';
import { writeIfChanged, checkMode, removeIfExists } from './lib/io.mjs';
import { computeBuildId, computeServerId } from '../cli/lib/build-id.mjs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const check = checkMode();
const FORCE = process.argv.includes('--force');
const STAMP = '.vk-cache/package-build.stamp';

const hashFile = (h, file) => {
  h.update(file);
  h.update('\0');
  if (fs.existsSync(file)) h.update(fs.readFileSync(file));
};
const hashDir = (h, dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) hashDir(h, abs);
    else if (ent.isFile()) hashFile(h, abs);
  }
};
const sourceKey = () => {
  const h = crypto.createHash('sha1');
  for (const dir of ['src/tokens', 'src/elements', 'src/layout', 'src/components', 'src/compositions', 'src/runtime', 'src/shared']) hashDir(h, dir);
  for (const file of ['src/registry.mjs', 'src/entry.mjs', 'src/icons.generated.mjs', 'src/icons.core.generated.mjs', 'vk/katex.css', 'package.json', 'tools/build.mjs']) hashFile(h, file);
  return h.digest('hex');
};
const key = sourceKey();
const cached =
  !check &&
  !FORCE &&
  fs.existsSync(STAMP) &&
  fs.readFileSync(STAMP, 'utf8').trim() === key &&
  fs.existsSync('dist/vk.js') &&
  fs.existsSync('dist/vk.esm.js') &&
  fs.existsSync('vk/vk.css');
if (cached) {
  // CSS/JS 可以跳过，但 build.json 的 server 指纹会因为构建期代码（highlight.mjs 等）变化；
  // 不刷新它，verify 会把“已是最新”当成漂移。
  const info = { id: computeBuildId(), server: computeServerId(), version: pkg.version };
  writeIfChanged('dist/build.json', JSON.stringify(info, null, 2) + '\n', false);
  console.log('build: 已是最新（跳过 CSS 拼接与 esbuild）');
  process.exit(0);
}

const LAYERS = [
  ['vendor', 'KaTeX 结构'],
  ['tokens', 'L0 值'],
  ['elements', 'L1 元素'],
  ['layout', 'L2 布局'],
  ['components', 'L3 组件'],
  ['compositions', 'L4 装置'],
];

/* ------------------------------------------------------------------ CSS */

const cssFiles = (dir) => {
  const p = path.join('src', dir);
  if (!fs.existsSync(p)) return [];
  return fs
    .readdirSync(p)
    .filter((f) => f.endsWith('.css'))
    .sort()
    .map((f) => path.join(p, f));
};

const banner = `/*! vk v${pkg.version} — generated from src/, do not edit */\n`;
const order = `@layer ${LAYERS.map(([n]) => `vk.${n}`).join(', ')};\n`;

let css = banner + order;
const inventory = [];

for (const [name, label] of LAYERS) {
  if (name === 'vendor') continue;
  const files = cssFiles(name);
  if (!files.length) {
    inventory.push(`  ${label.padEnd(8)} ${name.padEnd(12)} (空)`);
    continue;
  }
  const body = files
    .map((f) => {
      const text = fs.readFileSync(f, 'utf8').replace(/\s+$/, '');
      return `/* ---- ${f.replace(/\\/g, '/')} ---- */\n${text}`;
    })
    .join('\n\n');
  css += `\n/* ============================================================\n   ${label} · ${name}\n   ============================================================ */\n@layer vk.${name} {\n${body}\n}\n`;
  const kb = (files.reduce((n, f) => n + fs.statSync(f).size, 0) / 1024).toFixed(1);
  inventory.push(`  ${label.padEnd(8)} ${name.padEnd(12)} ${String(files.length).padStart(2)} 个文件  ${kb}kb`);
}

/* KaTeX 的结构样式跟 vk.css 一起到。必须进 @layer vk.vendor。 */
const katexCss = 'vk/katex.css';
if (!fs.existsSync(katexCss)) {
  throw new Error('缺少 vk/katex.css：公式会退化为源码。先跑 node tools/katex.mjs');
}
css += `\n/* ============================================================\n   KaTeX · 公式排版（vendor 层，优先级最低）\n   ============================================================ */\n@layer vk.vendor {\n${fs.readFileSync(katexCss, 'utf8').trim()}\n}\n`;
inventory.push('  KaTeX    katex.css    ' + (fs.statSync(katexCss).size / 1024).toFixed(1) + 'kb');

writeIfChanged('vk/vk.css', css, check);
console.log('CSS');
for (const line of inventory) console.log(line);

/* ------------------------------------------------------------------- JS */

const define = { __VK_VERSION__: JSON.stringify(pkg.version) };
const runtimeBanner = `/*! vk runtime v${pkg.version} — generated from src/runtime/, do not edit */\n`;

async function bundle(entry, format) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format,
    target: ['chrome110'],
    write: false,
    banner: { js: format === 'iife' ? runtimeBanner : `/*! vk v${pkg.version} — generated, do not edit */\n` },
    legalComments: 'none',
    minify: true,
    define,
    logLevel: 'warning',
  });
  return result.outputFiles[0].contents;
}

const iife = await bundle('src/runtime/index.mjs', 'iife');
const esm = await bundle('src/entry.mjs', 'esm');
writeIfChanged('dist/vk.js', iife, check);
writeIfChanged('dist/vk.esm.js', esm, check);
// 7.0 曾把同一份 IIFE 再复制到 vk/vk.js：三份 480KB，全部进包。现在只保留 dist。
removeIfExists('vk/vk.js', check);
removeIfExists('dist/vk-icons.js', check);

const buildInfo = {
  id: computeBuildId(),
  server: computeServerId(),
  version: pkg.version,
};
writeIfChanged('dist/build.json', JSON.stringify(buildInfo, null, 2) + '\n', check);

const kb = (buf) => (buf.length / 1024).toFixed(1) + 'kb';
console.log('\nJS');
console.log(`  dist/vk.js       ${kb(iife)}`);
console.log(`  dist/vk.esm.js   ${kb(esm)}`);
console.log(`  dist/build.json  ${buildInfo.id}`);
fs.mkdirSync(path.dirname(STAMP), { recursive: true });
fs.writeFileSync(STAMP, key + '\n');
