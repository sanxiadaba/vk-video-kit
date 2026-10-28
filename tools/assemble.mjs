/**
 * 组装站点根目录 _site/。
 *
 * 站点页面由 tools/specimens.mjs 直接写进 _site/；这里把包产物与作者资产
 * 镜像到同一个静态根里，并清掉上一版展示站的遗留目录。
 * 作者目录（code/、assets/）本身保持只读。
 */
import fs from 'node:fs';
import path from 'node:path';
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
    const s = path.join(src, rel);
    const d = path.join(dest, rel);
    if (!check && fs.existsSync(d)) {
      const ss = fs.statSync(s);
      const ds = fs.statSync(d);
      if (ss.size === ds.size && ds.mtimeMs >= ss.mtimeMs) continue;
    }
    writeIfChanged(d, fs.readFileSync(s), check);
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
  if (!check && fs.existsSync(dest)) {
    const ss = fs.statSync(src);
    const ds = fs.statSync(dest);
    if (ss.size === ds.size && ds.mtimeMs >= ss.mtimeMs) return;
  }
  writeIfChanged(dest, fs.readFileSync(src), check);
}

if (check && !fs.existsSync(SITE)) {
  console.error(`✗ ${SITE}/  目录缺失：先运行 npm run build`);
  process.exit(1);
}

// 旧展示站：components/、frames/、docs.html、site.css/js 等全部退役。
if (!check) {
  for (const rel of ['components', 'frames', 'shots', 'docs.html', 'examples.html', 'search-index.js', 'site.css', 'site.js', 'frames.source.json']) {
    fs.rmSync(path.join(SITE, rel), { recursive: true, force: true });
  }
}

mirrorDir('vk', path.join(SITE, 'vk'));
mirrorDir('dist', path.join(SITE, 'dist'));
mirrorDir('assets', path.join(SITE, 'assets'));
mirrorDir('code', path.join(SITE, 'code'));
mirrorFile('site/showcase.css', path.join(SITE, 'showcase.css'));
mirrorFile('site/showcase.js', path.join(SITE, 'showcase.js'));
mirrorFile('LICENSE', path.join(SITE, 'LICENSE'));

console.log(`assemble: ${SITE}/ ready`);
