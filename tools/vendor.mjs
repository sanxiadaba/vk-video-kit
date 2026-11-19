/**
 * vk vendor：把字体与 KaTeX 装进 dist/，让产物不依赖网络、不依赖系统字体。
 *
 *   node tools/vendor.mjs           单独跑（build 里同进程调用 run()）
 *   import { run } from './vendor.mjs'
 *
 * 中文用 @fontsource 的 unicode-range 切片：覆盖率完整，浏览器只下载用到的片。
 * 没有 stamp：是否重建只由 build 的「源哈希 + 产物 + 字体数量」判断；
 * run() 被调用时总是全量重拷，目标目录由 build 给（.vk-tmp/dist.next）。
 */
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'node_modules', '@fontsource');

const katexVersion = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'katex', 'package.json'), 'utf8')).version;
  } catch {
    return 'missing';
  }
};

/**
 * 把字体与 KaTeX 拷进目标 dist。
 *   dist  产物目录（build 传 .vk-tmp/dist.next）
 * 返回 { fonts, katex }：fonts = dist/fonts 下 woff2 总数，katex = KaTeX 自带 woff2 数。
 */
export function run({ dist = path.join(ROOT, 'dist') } = {}) {
  const FONT_DIR = path.join(dist, 'fonts');
  const NOTO_DIR = path.join(FONT_DIR, 'noto');

  const copy = (src, dest) => {
    if (!fs.existsSync(src)) throw new Error(`缺文件：${path.relative(ROOT, src)}（装依赖：npm ci）`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  };

  fs.mkdirSync(NOTO_DIR, { recursive: true });

  /* -------------------------------------------------------------- 拉丁字体 */
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

  /* -------------------------------------------------------------- 中文 */
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
  for (const f of fs.readdirSync(FONT_DIR, { withFileTypes: true })) {
    if (f.isFile() && f.name.endsWith('.woff2') && !expected.has(f.name)) fs.rmSync(path.join(FONT_DIR, f.name));
  }
  for (const f of fs.readdirSync(NOTO_DIR)) {
    if (!expectedNoto.has(f)) fs.rmSync(path.join(NOTO_DIR, f), { force: true });
  }

  fs.writeFileSync(
    path.join(dist, 'fonts.css'),
    `/* vk · 字体 —— 自动生成，不要手改；重新生成：node tools/vendor.mjs\n   font-display: block 是有意的：截帧要的是不闪，不是先给系统字体。 */\n\n${blocks.join('\n\n')}\n`
  );

  /* -------------------------------------------------------------- KaTeX */
  const katexDist = path.join(ROOT, 'node_modules', 'katex', 'dist');
  const raw = fs.readFileSync(path.join(katexDist, 'katex.min.css'), 'utf8');
  let katex = 0;
  for (const f of fs.readdirSync(path.join(katexDist, 'fonts'))) {
    if (!f.endsWith('.woff2')) continue;
    copy(path.join(katexDist, 'fonts', f), path.join(FONT_DIR, 'katex', f));
    katex++;
  }
  fs.writeFileSync(path.join(dist, 'katex.css'), `/* katex@${katexVersion()} —— 自动生成，不要手改 */\n` + raw.replace(/url\(fonts\//g, 'url(fonts/katex/'));

  const fonts = countFonts(dist);
  console.error(`vendor: 字体 ${expected.size + expectedNoto.size} 个，katex ${katex} 个 woff2（共 ${fonts}）`);
  return { fonts, katex };
}

/** dist/fonts 下所有 woff2 的数量（含 noto / katex）。 */
export function countFonts(dist = path.join(ROOT, 'dist')) {
  let n = 0;
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (e.name.endsWith('.woff2')) n++;
    }
  };
  walk(path.join(dist, 'fonts'));
  return n;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    run();
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
