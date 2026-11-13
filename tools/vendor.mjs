/**
 * vk vendor：把字体与 KaTeX 装进 dist/，让产物不依赖网络、不依赖系统字体。
 *
 *   node tools/vendor.mjs
 *
 * 中文用 @fontsource 的 unicode-range 切片：覆盖率完整，浏览器只下载用到的片。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'node_modules', '@fontsource');
const FONT_DIR = path.join(DIST, 'fonts');
const NOTO_DIR = path.join(FONT_DIR, 'noto');
const STAMP = path.join(DIST, '.vendor-stamp');

const versionOf = (pkg) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(SRC, pkg, 'package.json'), 'utf8')).version;
  } catch {
    return 'missing';
  }
};
const katexVersion = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'katex', 'package.json'), 'utf8')).version;
  } catch {
    return 'missing';
  }
};

const key = crypto
  .createHash('sha1')
  .update(fs.readFileSync(new URL(import.meta.url), 'utf8'))
  .update(['inter', 'jetbrains-mono', 'noto-sans-sc'].map(versionOf).join('|'))
  .update(katexVersion())
  .digest('hex');

if (fs.existsSync(STAMP) && fs.readFileSync(STAMP, 'utf8').trim() === key && fs.existsSync(path.join(DIST, 'fonts.css')) && fs.existsSync(path.join(DIST, 'katex.css'))) {
  console.log('vendor: 已是最新');
  process.exit(0);
}

const copy = (src, dest) => {
  if (!fs.existsSync(src)) {
    console.error(`✗ 缺文件：${path.relative(ROOT, src)}（装依赖：npm ci）`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
};

fs.mkdirSync(NOTO_DIR, { recursive: true });

/* ---------------------------------------------------------------- 拉丁字体 */
const blocks = [];
const LATIN = [
  { family: 'Inter', pkg: 'inter', weight: [400, 500, 600], file: 'inter-latin-%w-normal.woff2', out: 'inter-%w.woff2' },
  { family: 'JetBrains Mono', pkg: 'jetbrains-mono', weight: [400, 500, 600], file: 'jetbrains-mono-latin-%w-normal.woff2', out: 'jetbrains-mono-%w.woff2' },
];
const expected = new Set();
for (const f of LATIN) {
  for (const w of f.weight) {
    copy(path.join(SRC, f.pkg, 'files', f.file.replace('%w', w)), path.join(FONT_DIR, f.out.replace('%w', w)));
    expected.add(f.out.replace('%w', w));
    blocks.push(`@font-face {
  font-family: '${f.family}';
  font-style: normal;
  font-weight: ${w};
  font-display: block;
  src: url('./fonts/${f.out.replace('%w', w)}') format('woff2');
}`);
  }
}

/* ---------------------------------------------------------------- 中文 */
const expectedNoto = new Set();
for (const w of [400, 500, 600]) {
  const dir = path.join(SRC, 'noto-sans-sc');
  const css = fs.readFileSync(path.join(dir, `${w}.css`), 'utf8');
  const referenced = new Set();
  for (const m of css.matchAll(/url\(\.\/files\/([^)]+)\)/g)) if (m[1].endsWith('.woff2')) referenced.add(m[1]);
  for (const file of referenced) {
    copy(path.join(dir, 'files', file), path.join(NOTO_DIR, file));
    expectedNoto.add(file);
  }
  const rewritten = css
    .replace(/, url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g, '')
    .replace(/font-display:\s*swap/g, 'font-display: block')
    .replace(/url\(\.\/files\/([^)]+)\)/g, "url('./fonts/noto/$1')");
  blocks.push(rewritten.trim());
}

/* 只留本次引用到的字体文件，避免死文件进包。 */
for (const f of fs.existsSync(FONT_DIR) ? fs.readdirSync(FONT_DIR, { withFileTypes: true }) : []) {
  if (f.isFile() && f.name.endsWith('.woff2') && !expected.has(f.name)) fs.rmSync(path.join(FONT_DIR, f.name));
}
for (const f of fs.existsSync(NOTO_DIR) ? fs.readdirSync(NOTO_DIR) : []) {
  if (!expectedNoto.has(f)) fs.rmSync(path.join(NOTO_DIR, f), { force: true });
}

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(
  path.join(DIST, 'fonts.css'),
  `/* vk · 字体 —— 自动生成，不要手改；重新生成：node tools/vendor.mjs\n   font-display: block 是有意的：截帧要的是不闪，不是先给系统字体。 */\n\n${blocks.join('\n\n')}\n`
);

/* ---------------------------------------------------------------- KaTeX */
const katexDist = path.join(ROOT, 'node_modules', 'katex', 'dist');
copy(path.join(katexDist, 'katex.min.css'), path.join(DIST, 'katex.raw.css'));
const katexCss = fs.readFileSync(path.join(DIST, 'katex.raw.css'), 'utf8');
let fonts = 0;
for (const f of fs.readdirSync(path.join(katexDist, 'fonts'))) {
  if (!f.endsWith('.woff2')) continue;
  copy(path.join(katexDist, 'fonts', f), path.join(DIST, 'fonts', 'katex', f));
  fonts++;
}
fs.writeFileSync(path.join(DIST, 'katex.css'), `/* katex@${katexVersion()} —— 自动生成，不要手改 */\n` + katexCss.replace(/url\(fonts\//g, 'url(fonts/katex/'));
fs.rmSync(path.join(DIST, 'katex.raw.css'), { force: true });

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(STAMP, key + '\n');
console.log(`vendor: 字体 ${expected.size + expectedNoto.size} 个，katex ${fonts} 个 woff2`);
