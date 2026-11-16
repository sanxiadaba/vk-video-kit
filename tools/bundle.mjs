/**
 * vk bundle：把样式与运行期打包成 dist/ 产物。
 *
 *   dist/vk.css     katex → tokens → base → components → callout
 *   dist/vk.js      运行期（只含需要测量的件）
 *   dist/audit.js   自检，单独注入，不进 vk.js
 *
 *   node tools/bundle.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const LAYERS = [
  ['vendor', ['dist/katex.css']],
  ['tokens', ['dist/tokens.css']],
  ['base', ['src/base.css']],
  ['components', ['src/components.css', 'src/state.css']],
  ['callout', ['src/callout.css']],
];

let css = `/*! vk v${pkg.version} — generated from src/, do not edit */\n@layer ${LAYERS.map(([n]) => `vk.${n}`).join(', ')};\n`;
for (const [layer, files] of LAYERS) {
  for (const f of files) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) {
      console.error(`✗ 缺 ${f}：先跑 node tools/gen.mjs && node tools/vendor.mjs`);
      process.exit(1);
    }
    css += `\n/* ===== ${f} ===== */\n@layer vk.${layer} {\n${fs.readFileSync(abs, 'utf8').trim()}\n}\n`;
  }
}
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'vk.css'), css);

const banner = { js: `/*! vk runtime v${pkg.version} — generated, do not edit */\n` };
const js = await build({
  entryPoints: [path.join(ROOT, 'src/runtime/index.mjs')],
  bundle: true,
  format: 'iife',
  target: ['chrome120'],
  write: false,
  banner,
  legalComments: 'none',
  minify: true,
  define: { __VK_VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'warning',
});
fs.writeFileSync(path.join(DIST, 'vk.js'), js.outputFiles[0].contents);

const audit = await build({
  entryPoints: [path.join(ROOT, 'src/audit/index.mjs')],
  bundle: true,
  format: 'iife',
  target: ['chrome120'],
  write: false,
  banner,
  legalComments: 'none',
  minify: true,
  define: { __VK_VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'warning',
});
fs.writeFileSync(path.join(DIST, 'audit.js'), audit.outputFiles[0].contents);

fs.mkdirSync(DIST, { recursive: true });
const kb = (n) => (n / 1024).toFixed(1) + 'kb';
console.log(`bundle: vk.css ${kb(fs.statSync(path.join(DIST, 'vk.css')).size)} · vk.js ${kb(fs.statSync(path.join(DIST, 'vk.js')).size)} · audit.js ${kb(fs.statSync(path.join(DIST, 'audit.js')).size)}`);
