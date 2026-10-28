/**
 * 从 lucide 生成图标表。
 *
 *   node tools/icons.mjs
 *
 * 全量生成：作者写什么名字都能用，不再维护一张 36 个的小名单。
 * lucide 是 ISC 许可（见 THIRD-PARTY-NOTICES）。
 * 输出 src/icons.generated.mjs（提交进仓库），构建时不再依赖 lucide。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const STAMP = '.vk-cache/icons.stamp';
const lucideVersion = () => {
  try {
    return JSON.parse(fs.readFileSync('node_modules/lucide/package.json', 'utf8')).version;
  } catch {
    return 'missing';
  }
};
const key = crypto
  .createHash('sha1')
  .update(fs.readFileSync(new URL(import.meta.url), 'utf8'))
  .update(lucideVersion())
  .digest('hex');
if (fs.existsSync(STAMP) && fs.readFileSync(STAMP, 'utf8').trim() === key && fs.existsSync('src/icons.generated.mjs') && fs.existsSync('icons.json')) {
  console.log('icons: 已是最新（跳过 lucide 扫描）');
  process.exit(0);
}

const lucide = await import('lucide');

/** PascalCase → lucide 的 kebab-case（ALargeSmall → a-large-small） */
function kebab(name) {
  let out = '';
  for (let i = 0; i < name.length; i++) {
    const c = name[i];
    const prev = name[i - 1];
    const next = name[i + 1];
    const upper = c >= 'A' && c <= 'Z';
    const prevLower = prev && ((prev >= 'a' && prev <= 'z') || (prev >= '0' && prev <= '9'));
    const prevUpper = prev && prev >= 'A' && prev <= 'Z';
    const nextLower = next && next >= 'a' && next <= 'z';
    if (i > 0 && upper && (prevLower || (prevUpper && nextLower))) out += '-';
    out += c.toLowerCase();
  }
  return out;
}

/**
 * 旧名字继续可用：作者写 close / alert / box 比写 x / triangle-alert / package 自然。
 * 别名只改查表，不复制 SVG。
 */
export const ALIASES = {
  close: 'x',
  alert: 'triangle-alert',
  'check-circle': 'circle-check',
  'x-circle': 'circle-x',
  settings: 'sliders-horizontal',
  external: 'external-link',
  book: 'book-open',
  git: 'git-branch',
  bulb: 'lightbulb',
  box: 'package',
  shield: 'shield-check',
  refresh: 'rotate-cw',
};

const svgOf = (node) =>
  node
    .map(([tag, attrs]) =>
      `<${tag}${Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${v}"`)
        .join('')}/>`
    )
    .join('');

export function generateIcons() {
  const icons = new Map();
  for (const [exportName, node] of Object.entries(lucide)) {
    if (!Array.isArray(node)) continue;
    const name = kebab(exportName);
    if (!icons.has(name)) icons.set(name, svgOf(node));
  }

  for (const [alias, target] of Object.entries(ALIASES)) {
    if (!icons.has(target)) throw new Error(`别名 ${alias} 指向不存在的图标 ${target}`);
    icons.set(alias, icons.get(target));
  }

  const rows = [...icons.entries()].sort(([a], [b]) => a.localeCompare(b)).map(
    ([name, html]) => `  ${JSON.stringify(name)}: ${JSON.stringify(html)},`
  );

  const version = JSON.parse(fs.readFileSync('node_modules/lucide/package.json', 'utf8')).version;
  const names = [...icons.keys()].sort();
  const manifest =
    JSON.stringify(
      {
        name: 'vk-video-kit',
        source: 'lucide',
        version,
        license: 'ISC',
        count: names.length,
        names,
        aliases: ALIASES,
      },
      null,
      1
    ) + '\n';
  const manifestFile = 'icons.json';
  const prevManifest = fs.existsSync(manifestFile) ? fs.readFileSync(manifestFile, 'utf8') : '';
  if (prevManifest !== manifest) fs.writeFileSync(manifestFile, manifest);

  const code =
    `// 自动生成：node tools/icons.mjs —— 不要手改\n` +
    `// 来源 lucide@${version}（ISC），全量 ${icons.size} 个名字（含 ${Object.keys(ALIASES).length} 个别名）\n` +
    `export const ICONS = {\n${rows.join('\n')}\n};\n`;

  const file = 'src/icons.generated.mjs';
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (prev !== code) fs.writeFileSync(file, code);

  // 运行时只带组件内部真正用到的图标；作者页面的 vk-icon 由 vk build 按页注入。
  const CORE = [
    'circle-help', 'info', 'circle-check', 'triangle-alert', 'circle-x',
    'folder', 'file', 'file-code', 'file-json', 'file-text', 'file-terminal', 'braces',
  ];
  const coreRows = CORE.map((name) => {
    if (!icons.has(name)) throw new Error(`核心图标不存在：${name}`);
    return `  ${JSON.stringify(name)}: ${JSON.stringify(icons.get(name))},`;
  });
  const coreCode =
    `// 自动生成：node tools/icons.mjs —— 不要手改\n` +
    `// 只含运行时组件内部使用的 ${CORE.length} 个图标；作者页面的图标由 vk build 注入。\n` +
    `export const CORE_ICONS = {\n${coreRows.join('\n')}\n};\n`;
  const coreFile = 'src/icons.core.generated.mjs';
  const prevCore = fs.existsSync(coreFile) ? fs.readFileSync(coreFile, 'utf8') : '';
  if (prevCore !== coreCode) fs.writeFileSync(coreFile, coreCode);

  console.log(`icons: ${icons.size} 个 -> ${file} (${(code.length / 1024).toFixed(0)}kb)`);
  console.log(`icons: ${icons.size} 个 -> ${manifestFile} (${(manifest.length / 1024).toFixed(0)}kb)`);
  console.log(`icons: ${CORE.length} 个 -> ${coreFile} (${(coreCode.length / 1024).toFixed(0)}kb)`);
  fs.mkdirSync('.vk-cache', { recursive: true });
  fs.writeFileSync(STAMP, key + '\n');
  return icons.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) generateIcons();
