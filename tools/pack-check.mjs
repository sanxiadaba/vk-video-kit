/**
 * 包体门禁：只发布运行时、字体、CLI 与元数据；unpacked < 9MB。
 *
 *   node tools/pack-check.mjs
 *
 * 用 --ignore-scripts 防止 prepack 递归调用 npm pack。
 */
import { spawnSync } from 'node:child_process';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const MAX_BYTES = 9.5 * 1000 * 1000;

const r = spawnSync(npmCmd, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
  timeout: 120000,
  maxBuffer: 32 * 1024 * 1024,
});
if (r.status !== 0) {
  console.error('✗ npm pack --dry-run 失败');
  console.error(r.stderr || r.stdout);
  process.exit(1);
}

let data;
try {
  const text = r.stdout.slice(r.stdout.indexOf('['));
  data = JSON.parse(text);
} catch (e) {
  console.error('✗ 无法解析 npm pack --json 输出');
  console.error(e.message);
  console.error(r.stdout.slice(0, 2000));
  process.exit(1);
}

const info = data[0];
const files = info.files.map((f) => f.path.replace(/\\/g, '/'));
const failures = [];

const required = [
  'dist/vk.js',
  'dist/vk.esm.js',
  'vk/vk.css',
  'vk/fonts.css',
  'assets/fonts/',
  'types/index.d.ts',
  'bin/vk.mjs',
  'cli/build.mjs',
  'cli/serve.mjs',
  'src/highlight.mjs',
  'src/registry.mjs',
  'icons.json',
  'custom-elements.json',
  'vscode-html-data.json',
  'web-types.json',
  'README.md',
  'USAGE.md',
  'LICENSE',
  'CHANGELOG.md',
  'THIRD-PARTY-NOTICES.md',
];
for (const p of required) {
  const hit = p.endsWith('/') ? files.some((f) => f.startsWith(p)) : files.includes(p);
  if (!hit) failures.push(`缺少 ${p}`);
}

const forbidden = [
  'tools/',
  'site/',
  '_site/',
  'shots/',
  'specimens/',
  'frames/',
  'docs/',
  'code/',
  'assets/img/',
  'src/scenes/',
  'src/effects.mjs',
  'src/entry.mjs',
  'test/',
  'tests/',
  'dist/build.json',
  'dist/vk-icons.js',
  'vk/katex.css',
  'index.html',
  'docs.html',
  'examples.html',
];
for (const p of forbidden) {
  const hit = p.endsWith('/') ? files.some((f) => f.startsWith(p)) : files.includes(p);
  if (hit) failures.push(`不该随包发布：${p}`);
}

// 唯一允许出现在包里的 src/runtime 文件：CLI 预编译共用的行模型。
for (const f of files) {
  if (f.startsWith('src/runtime/') && f !== 'src/runtime/code-utils.mjs') {
    failures.push(`不该随包发布：${f}`);
  }
}

if (files.some((f) => f.includes('node_modules/'))) failures.push('包里出现 node_modules/');
if (info.unpackedSize >= MAX_BYTES) {
  failures.push(`unpacked ${(info.unpackedSize / 1000 / 1000).toFixed(2)}MB ≥ 9.5MB`);
}

console.log(`包体：${files.length} 个文件，unpacked ${(info.unpackedSize / 1000 / 1000).toFixed(2)}MB（上限 9.5MB）`);
if (failures.length) {
  console.log(`\n包体门禁失败 ${failures.length} 条：`);
  for (const f of failures) console.log('  ✗ ' + f);
  process.exitCode = 1;
} else {
  console.log('包体门禁通过：只有运行时、字体、CLI 与元数据。');
}
