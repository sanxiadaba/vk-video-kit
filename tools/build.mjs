/**
 * vk 构建
 * ----------------------------------------------------------------------------
 * 1) CSS：按层拼接，层序只在这里决定。
 * 2) JS：esbuild 打包 src/runtime/index.mjs → dist/vk.js（IIFE）与 dist/vk.esm.js。
 *
 * 产物都是生成物，不要手改。
 */
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const LAYERS = [
  ['tokens', 'L0 值', ['src/tokens/themes.css', 'src/tokens/tokens.css']],
  ['elements', 'L1 原子', ['src/elements/elements.css', 'src/elements/window.css']],
  ['layout', 'L2 排布', ['src/layout/layout.css']],
  ['components', 'L3 器械', ['src/components/components.css', 'src/components/diagrams.css']],
  ['page', 'L5 页面', ['src/compositions/compositions.css']],
  ['relations', 'L4 关系', ['src/compositions/overlays.css']],
];

const banner = `/*! vk v${pkg.version} — generated from src/, do not edit */\n`;
let css = banner + `@layer ${LAYERS.map(([n]) => `vk.${n}`).join(', ')}, vk.vendor;\n`;
const inventory = [];

for (const [name, label, files] of LAYERS) {
  const body = files
    .map((f) => `/* ---- ${f} ---- */\n${fs.readFileSync(f, 'utf8').trim()}`)
    .join('\n\n');
  css += `\n/* ===== ${label} · ${name} ===== */\n@layer vk.${name} {\n${body}\n}\n`;
  const kb = (files.reduce((n, f) => n + fs.statSync(f).size, 0) / 1024).toFixed(1);
  inventory.push(`  ${label.padEnd(8)} ${name.padEnd(10)} ${String(files.length).padStart(2)} 个文件  ${kb}kb`);
}

if (fs.existsSync('vk/katex.css')) {
  css += `\n/* ===== KaTeX · 排版（vendor 层，优先级最低） ===== */\n@layer vk.vendor {\n${fs
    .readFileSync('vk/katex.css', 'utf8')
    .trim()}\n}\n`;
}

fs.mkdirSync('vk', { recursive: true });
fs.writeFileSync('vk/vk.css', css);
console.log('CSS');
for (const line of inventory) console.log(line);

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
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/vk.js', iife);
fs.writeFileSync('dist/vk.esm.js', esm);

const kb = (buf) => (buf.length / 1024).toFixed(1) + 'kb';
console.log('\nJS');
console.log(`  dist/vk.js       ${kb(iife)}`);
console.log(`  dist/vk.esm.js   ${kb(esm)}`);
