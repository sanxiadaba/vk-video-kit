/**
 * vk bundle：把样式与运行期打包成两个产物。
 *
 *   vk/vk.css   tokens → base → components → callout（KaTeX 在 vendor 层，优先级最低）
 *   dist/vk.js  运行期（只含需要测量的四个件）
 */
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const ROOT = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const LAYERS = [
  ['vendor', ['vk/katex.css']],
  ['tokens', ['src/tokens.generated.css']],
  ['base', ['src/base.css']],
  ['components', ['src/components.css']],
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
fs.mkdirSync(path.join(ROOT, 'vk'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'vk/vk.css'), css);

const result = await build({
  entryPoints: [path.join(ROOT, 'src/runtime/index.mjs')],
  bundle: true,
  format: 'iife',
  target: ['chrome120'],
  write: false,
  banner: { js: `/*! vk runtime v${pkg.version} — generated, do not edit */\n` },
  legalComments: 'none',
  minify: true,
  define: { __VK_VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'warning',
});
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/vk.js'), result.outputFiles[0].contents);

const kb = (n) => (n / 1024).toFixed(1) + 'kb';
console.log(`bundle: vk/vk.css ${kb(fs.statSync(path.join(ROOT, 'vk/vk.css')).size)} · dist/vk.js ${kb(fs.statSync(path.join(ROOT, 'dist/vk.js')).size)}`);
