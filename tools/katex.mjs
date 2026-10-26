/**
 * 把 KaTeX 的样式和字体装进 vk/，让公式不需要 CDN、不依赖网络。
 *
 * 只拷贝 woff2：KaTeX 的 @font-face 里 woff2 排第一，现代浏览器不会去取
 * 后面那些 woff/ttf（留着也没坏处，只是多拷 1MB）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT_CSS = 'vk/katex.css';
const OUT_FONT = 'vk/fonts/katex';

export function installKatex() {
  const dist = path.join('node_modules', 'katex', 'dist');
  const css = fs.readFileSync(path.join(dist, 'katex.min.css'), 'utf8');

  fs.mkdirSync(OUT_FONT, { recursive: true });
  let copied = 0;
  for (const f of fs.readdirSync(path.join(dist, 'fonts'))) {
    if (!f.endsWith('.woff2')) continue;
    fs.copyFileSync(path.join(dist, 'fonts', f), path.join(OUT_FONT, f));
    copied++;
  }

  const banner =
    '/*! vk/katex.css — generated from katex@' +
    JSON.parse(fs.readFileSync('node_modules/katex/package.json', 'utf8')).version +
    ', do not edit */\n';
  // 字体目录换到 vk/fonts/katex，组件库自己带字体
  const rewritten = css.replace(/url\(fonts\//g, 'url(fonts/katex/');
  fs.writeFileSync(OUT_CSS, banner + rewritten);
  return { fonts: copied, bytes: fs.statSync(OUT_CSS).size };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { fonts, bytes } = installKatex();
  console.log(`katex: ${fonts} woff2, css ${(bytes / 1024).toFixed(1)}kb`);
}
