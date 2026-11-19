/**
 * vk bundle：把样式与运行期打包成 dist/ 产物。
 *
 *   dist/vk.css     katex → tokens → base → components → callout
 *   dist/vk.js      运行期（只含需要测量的件）
 *   dist/audit.js   自检，单独注入，不进 vk.js
 *
 *   node tools/bundle.mjs           单独跑（build 里同进程调用 run()）
 *   import { run } from './bundle.mjs'
 *
 * 用 esbuild 的同步接口：build 的 gen → vendor → bundle 全在一个 Node 进程里。
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildSync } from 'esbuild';

export const ROOT = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const LAYERS = [
  ['vendor', ['katex.css']],
  ['tokens', ['tokens.css']],
  ['base', ['src/base.css']],
  ['components', ['src/components.css', 'src/state.css']],
  ['callout', ['src/callout.css']],
];

/**
 * 写 dist/vk.css、vk.js、audit.js。
 *   dist  产物目录（build 传 .vk-tmp/dist.next；katex.css / tokens.css 必须已在那）
 * 返回 { bytes }。
 */
export function run({ dist = path.join(ROOT, 'dist') } = {}) {
  let css = `/*! vk v${pkg.version} — generated from src/, do not edit */\n@layer ${LAYERS.map(([n]) => `vk.${n}`).join(', ')};\n`;
  for (const [layer, files] of LAYERS) {
    for (const f of files) {
      const abs = f.startsWith('src/') ? path.join(ROOT, f) : path.join(dist, f);
      if (!fs.existsSync(abs)) throw new Error(`缺 ${f}：gen / vendor 没跑完（先跑 node tools/build.mjs）`);
      css += `\n/* ===== ${f} ===== */\n@layer vk.${layer} {\n${fs.readFileSync(abs, 'utf8').trim()}\n}\n`;
    }
  }
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, 'vk.css'), css);

  const banner = { js: `/*! vk runtime v${pkg.version} — generated, do not edit */\n` };
  const common = {
    bundle: true,
    format: 'iife',
    target: ['chrome120'],
    write: false,
    banner,
    legalComments: 'none',
    minify: true,
    define: { __VK_VERSION__: JSON.stringify(pkg.version) },
    logLevel: 'warning',
  };
  const js = buildSync({ ...common, entryPoints: [path.join(ROOT, 'src/runtime/index.mjs')] });
  fs.writeFileSync(path.join(dist, 'vk.js'), js.outputFiles[0].contents);

  const audit = buildSync({ ...common, entryPoints: [path.join(ROOT, 'src/audit/index.mjs')] });
  fs.writeFileSync(path.join(dist, 'audit.js'), audit.outputFiles[0].contents);

  const kb = (n) => (n / 1024).toFixed(1) + 'kb';
  const bytes = {
    'vk.css': fs.statSync(path.join(dist, 'vk.css')).size,
    'vk.js': fs.statSync(path.join(dist, 'vk.js')).size,
    'audit.js': fs.statSync(path.join(dist, 'audit.js')).size,
  };
  console.error(`bundle: vk.css ${kb(bytes['vk.css'])} · vk.js ${kb(bytes['vk.js'])} · audit.js ${kb(bytes['audit.js'])}`);
  return { bytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    run();
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
