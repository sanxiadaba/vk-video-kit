/**
 * vk 构建
 * ----------------------------------------------------------------------------
 * 1) CSS：按层拼接（层序只在这里决定）
 * 2) JS：esbuild → dist/vk.js（IIFE）与 dist/vk.esm.js
 *
 * 产物都是生成物，不要手改。
 */
import fs from 'node:fs';
import { build } from 'esbuild';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const LAYERS = [
  ['tokens', 'L0 值（生成）', ['src/tokens.generated.css']],
  ['base', 'L1 底座', ['src/base.css']],
  ['layout', 'L2 排布', ['src/layout.css']],
  ['content', 'L3 件', ['src/components.css']],
  ['relation', 'L4 关系', ['src/callout.css']],
];

const banner = `/*! vk v${pkg.version} — generated from src/, do not edit */\n`;
let css = banner + `@layer ${LAYERS.map(([n]) => `vk.${n}`).join(', ')}, vk.vendor;\n`;
const inventory = [];

for (const [layer, label, files] of LAYERS) {
  const body = files.map((f) => `/* ---- ${f} ---- */\n${fs.readFileSync(f, 'utf8').trim()}`).join('\n\n');
  css += `\n/* ===== ${label} ===== */\n@layer vk.${layer} {\n${body}\n}\n`;
  const kb = (files.reduce((n, f) => n + fs.statSync(f).size, 0) / 1024).toFixed(1);
  inventory.push(`  ${label.padEnd(12)} ${String(files.length).padStart(2)} 个文件  ${kb}kb`);
}

if (fs.existsSync('vk/katex.css')) {
  css += `\n/* ===== KaTeX ===== */\n@layer vk.vendor {\n${fs.readFileSync('vk/katex.css', 'utf8').trim()}\n}\n`;
}

fs.mkdirSync('vk', { recursive: true });
fs.writeFileSync('vk/vk.css', css);
console.log('CSS');
for (const line of inventory) console.log(line);
console.log(`  vk/vk.css      ${(fs.statSync('vk/vk.css').size / 1024).toFixed(0)}kb`);

const define = { __VK_VERSION__: JSON.stringify(pkg.version) };
const runtimeBanner = `/*! vk runtime v${pkg.version} — generated, do not edit */\n`;

const bundle = async (entry, format) => {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format,
    target: ['chrome110'],
    write: false,
    banner: { js: runtimeBanner },
    legalComments: 'none',
    minify: true,
    define,
    logLevel: 'warning',
  });
  return result.outputFiles[0].contents;
};

const iife = await bundle('src/runtime/index.mjs', 'iife');
const esm = await bundle('src/entry.mjs', 'esm');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/vk.js', iife);
fs.writeFileSync('dist/vk.esm.js', esm);

const kb = (b) => (b.length / 1024).toFixed(1) + 'kb';
console.log('\nJS');
console.log(`  dist/vk.js      ${kb(iife)}`);
console.log(`  dist/vk.esm.js  ${kb(esm)}`);
