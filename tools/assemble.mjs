/**
 * 组装站点根目录 _site/。
 *
 * 站点页面由各自的生成器直接写进 _site/；这里负责把包产物与作者资产
 * 镜像到同一个静态根里，让本地 dev server 和 GitHub Pages 使用完全相同的
 * 相对路径。作者目录（frames/、code/、assets/）本身保持只读。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { writeIfChanged, checkMode } from './lib/io.mjs';
import { SITE } from './lib/paths.mjs';

const check = checkMode();

function filesUnder(dir, out = [], base = dir) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) filesUnder(abs, out, base);
    else if (ent.isFile()) out.push(path.relative(base, abs).replace(/\\/g, '/'));
  }
  return out;
}

function mirrorDir(src, dest, { filter = () => true } = {}) {
  const wanted = new Set();
  for (const rel of filesUnder(src)) {
    if (!filter(rel)) continue;
    wanted.add(rel);
    writeIfChanged(path.join(dest, rel), fs.readFileSync(path.join(src, rel)), check);
  }
  // 删掉源目录里已经不存在的旧文件，避免 _site 越来越脏。
  for (const rel of filesUnder(dest)) {
    if (wanted.has(rel)) continue;
    if (check) {
      console.error(`✗ ${path.join(dest, rel)}  应删除（源文件已不存在）`);
      process.exitCode = 1;
    } else {
      fs.rmSync(path.join(dest, rel), { force: true });
    }
  }
}

function mirrorFile(src, dest) {
  writeIfChanged(dest, fs.readFileSync(src), check);
}

if (check && !fs.existsSync(SITE)) {
  console.error(`✗ ${SITE}/  目录缺失：先运行 npm run build`);
  process.exit(1);
}

mirrorDir('vk', path.join(SITE, 'vk'));
mirrorDir('dist', path.join(SITE, 'dist'));
mirrorDir('assets', path.join(SITE, 'assets'));
mirrorDir('code', path.join(SITE, 'code'));
mirrorFile('site/site.css', path.join(SITE, 'site.css'));
mirrorFile('site/site.js', path.join(SITE, 'site.js'));
mirrorFile('LICENSE', path.join(SITE, 'LICENSE'));

// 作者帧：源文件变化时才覆盖 _site 里的原始副本；否则保留 precompile 已注入的版本，
// 避免每次 build 都把 5 个帧退回原始 HTML、再重新注入、再重拍截图。
if (check) {
  if (!fs.existsSync(path.join(SITE, 'frames'))) {
    console.error(`✗ ${SITE}/frames/  目录缺失：先运行 npm run build`);
    process.exitCode = 1;
  }
} else {
  const stampFile = path.join(SITE, 'frames.source.json');
  const prev = fs.existsSync(stampFile) ? JSON.parse(fs.readFileSync(stampFile, 'utf8')) : {};
  const next = {};
  const wanted = filesUnder('frames').filter((rel) => rel.endsWith('.html'));
  for (const rel of wanted) {
    const raw = fs.readFileSync(path.join('frames', rel));
    const hash = crypto.createHash('sha1').update(raw).digest('hex');
    next[rel] = hash;
    const dest = path.join(SITE, 'frames', rel);
    if (prev[rel] === hash && fs.existsSync(dest)) continue;
    writeIfChanged(dest, raw, false);
  }
  for (const rel of filesUnder(path.join(SITE, 'frames'))) {
    if (!wanted.includes(rel)) fs.rmSync(path.join(SITE, 'frames', rel), { force: true });
  }
  writeIfChanged(stampFile, JSON.stringify(next, null, 2) + '\n', false);
}

console.log(`assemble: ${SITE}/ ready`);
