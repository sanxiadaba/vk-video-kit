/**
 * 字体：从 @fontsource 生成 vk/fonts.css 与 assets/fonts/
 *
 * 为什么不用「扫文案做子集」：子集是按当前文案切的，新一期多一个字就会静默
 * 回退到系统字体，字形和字重都会跳，而且不报错。现在中文走 fontsource 的
 * unicode-range 切片（几十到上百片），浏览器只下载用到的那些，覆盖率是完整
 * 字符集，不会因为漏了一个字而穿帮。
 *
 * 用法：node tools/fonts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'node_modules/@fontsource';
const FONT_DIR = 'assets/fonts';
const NOTO_DIR = path.join(FONT_DIR, 'noto');

fs.mkdirSync(NOTO_DIR, { recursive: true });

const blocks = [];
let copied = 0;

function copy(src, dest) {
  fs.copyFileSync(src, dest);
  copied++;
}

/* ---------------------------------------------------------------- 拉丁字体 */

const LATIN = [
  { family: 'Inter', pkg: 'inter', weight: [400, 500, 700], file: 'inter-latin-%w-normal.woff2', out: 'inter-%w.woff2' },
  { family: 'JetBrains Mono', pkg: 'jetbrains-mono', weight: [400, 500, 700], file: 'jetbrains-mono-latin-%w-normal.woff2', out: 'jetbrains-mono-%w.woff2' },
];

const expected = new Set();
const expectedNoto = new Set();

for (const f of LATIN) {
  for (const w of f.weight) {
    const src = path.join(SRC, f.pkg, 'files', f.file.replace('%w', w));
    const dest = path.join(FONT_DIR, f.out.replace('%w', w));
    copy(src, dest);
    expected.add(path.basename(dest));
    blocks.push(`@font-face {
  font-family: '${f.family}';
  font-style: normal;
  font-weight: ${w};
  font-display: block;
  src: url('../${dest.replace(/\\/g, '/')}') format('woff2');
}`);
  }
}

/* ---------------------------------------------------------------- 中文字体 */

/**
 * fontsource 的 400/500/700.css 是按 unicode-range 切好的上百个 @font-face。
 * 只做三件事：换成自托管路径、去掉用不到的 woff 回退、font-display 改成 block
 * （block 保证截帧时不会先闪一下系统字体）。
 *
 * 500 必须真的发：中文标签用 --vk-w-med，缺 500 会静默落到 400，
 * 层级看不出差别，而且不报错。
 */
for (const w of [400, 500, 700]) {
  const dir = path.join(SRC, 'noto-sans-sc');
  const css = fs.readFileSync(path.join(dir, `${w}.css`), 'utf8');

  // 复制 CSS 真正引用到的每一个文件（切片 + latin/cyrillic/vietnamese 那几片）。
  // 只收 CSS 真正引用的 woff2；woff 回退行被删掉，不复制不会被请求的文件。
  const referenced = new Set();
  for (const m of css.matchAll(/url\(\.\/files\/([^)]+)\)/g)) if (m[1].endsWith('.woff2')) referenced.add(m[1]);
  for (const file of referenced) {
    const src = path.join(dir, 'files', file);
    if (!fs.existsSync(src)) {
      console.warn(`  ! 缺字体文件 ${file}`);
      continue;
    }
    copy(src, path.join(NOTO_DIR, file));
    expectedNoto.add(file);
  }

  const rewritten = css
    .replace(/, url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g, '')
    .replace(/url\(\.\/files\/([^)]+)\)/g, "url('../assets/fonts/noto/$1')")
    .replace(/font-display: swap;/g, 'font-display: block;');

  blocks.push(rewritten.trim());
}

/* ------------------------------------------------------------------ 写文件 */

// 清理不再被 CSS 引用的字重，避免死文件进包。
for (const f of fs.readdirSync(FONT_DIR, { withFileTypes: true })) {
  if (!f.isFile() || !f.name.endsWith('.woff2')) continue;
  if (!expected.has(f.name)) fs.rmSync(path.join(FONT_DIR, f.name), { force: true });
}
// Noto 的 unicode-range 切片会随上游版本增删，同样只保留本次引用到的。
for (const f of fs.readdirSync(NOTO_DIR, { withFileTypes: true })) {
  if (!f.isFile() || !f.name.endsWith('.woff2')) continue;
  if (!expectedNoto.has(f.name)) fs.rmSync(path.join(NOTO_DIR, f.name), { force: true });
}

const header = `/* vk · 字体 —— 自动生成，不要手改
   重新生成：node tools/fonts.mjs
   中文用 unicode-range 切片：覆盖率完整，浏览器只下载用到的片。 */

`;

fs.mkdirSync(path.dirname('vk/fonts.css'), { recursive: true });
fs.writeFileSync('vk/fonts.css', header + blocks.join('\n\n') + '\n');

const kb = (n) => (n / 1024).toFixed(0) + 'kb';
const cssKb = kb(fs.statSync('vk/fonts.css').size);
let fontBytes = 0;
for (const f of fs.readdirSync(FONT_DIR, { withFileTypes: true })) {
  if (f.isFile() && f.name.endsWith('.woff2')) fontBytes += fs.statSync(path.join(FONT_DIR, f.name)).size;
}
for (const f of fs.readdirSync(NOTO_DIR)) fontBytes += fs.statSync(path.join(NOTO_DIR, f)).size;

console.log(`vk/fonts.css  ${cssKb}`);
console.log(`字体文件 ${copied} 个，共 ${kb(fontBytes)}`);
