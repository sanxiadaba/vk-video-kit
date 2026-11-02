#!/usr/bin/env node
/**
 * 产物镜像检查 —— demo 的 `vk/` 与 `dist/` 是库构建产物的副本，不是它自己构建的。
 *
 * 为什么单列这一条：镜像落后时页面**不报错**，`vk check` 也是干净的
 * ——因为 check 检查的就是 demo 里那份旧运行时。于是新加的能力（value-size、
 * label-position、pin 的 solid……）全部静默失效，人只会觉得"我明明改对了，怎么没反应"。
 * 这和"dev server 过时"是同一类问题：代码和产物不同步时，系统必须自己喊出来。
 *
 * 判据只有字节：demo 的副本与库当前产物哈希不同 → 一份是旧的。
 * 只读四个文件（约 0.6 MB），毫秒级，不碰浏览器。
 *
 *   node tools/mirror.mjs "D:\test\新建文件夹 (1182)"
 *   node tools/mirror.mjs <demo 目录> --no-mirror-check   # 特殊场景放行
 *
 * 退出码：0 = 一致（或被 --no-mirror-check 关掉）；1 = 有文件不一致或缺失。
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 本库根目录（按脚本位置算，不依赖 cwd —— demo-check 会从库目录调用它）。 */
export const LIB = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

/**
 * demo/tools/sync.mjs 复制哪些文件，这里就比哪些文件。
 * 少列一个，那个文件就会重新变成"悄悄落后"；加文件时两边一起改。
 */
export const MIRRORED = [
  { rel: 'dist/vk.js', name: 'dist/vk.js' },
  { rel: 'vk/vk.css', name: 'vk/vk.css' },
  { rel: 'vk/fonts.css', name: 'vk/fonts.css' },
  { rel: 'vk/katex.css', name: 'vk/katex.css' },
];

const FIX =
  '在 demo 目录跑 `node tools/film.mjs`，它的第一步会 sync（把库的 vk/ 与 dist/ 重新镜像过去）；' +
  '只想补镜像也可以跑 `node tools/sync.mjs`。别手抄文件。';

const hash = (file) =>
  createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** 2026-11-02 09:34（本地时间，够读就行）。 */
function fmtTime(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const days = (ms) => Math.round((ms / 86400000) * 10) / 10;

/**
 * 比较 demo 的镜像与库产物。
 * @param {{demo: string, lib?: string}} opts demo 目录必填，lib 默认本库（测试可指向临时目录）。
 * @returns {{ok: boolean, files: object[], bad: object[], demo: string, lib: string}}
 */
export function checkMirror({ demo, lib = LIB } = {}) {
  if (!demo) throw new Error('checkMirror 需要 demo 目录');
  const started = Date.now();
  const files = MIRRORED.map(({ rel, name }) => {
    const libPath = path.join(lib, rel);
    const demoPath = path.join(demo, rel);
    const hasLib = fs.existsSync(libPath);
    const hasDemo = fs.existsSync(demoPath);
    const f = { rel, name, hasLib, hasDemo, ok: false, reason: '' };

    if (!hasLib) {
      f.reason = `库里没有 ${rel}——先在本库跑 node tools/build.mjs --force`;
      return f;
    }
    f.libSize = fs.statSync(libPath).size;
    f.libMtime = fs.statSync(libPath).mtimeMs;
    f.libHash = hash(libPath);

    if (!hasDemo) {
      f.reason = `demo 里没有 ${rel}（库 ${f.libSize} B）——镜像从没同步过或文件被删`;
      return f;
    }
    f.demoSize = fs.statSync(demoPath).size;
    f.demoMtime = fs.statSync(demoPath).mtimeMs;
    f.demoHash = hash(demoPath);

    if (f.demoHash === f.libHash) {
      f.ok = true;
      return f;
    }
    // 时间只解释"落后了多久"：镜像通常比库旧，但手改过的副本会更"新"，那不算落后。
    const age = days(f.libMtime - f.demoMtime);
    f.reason =
      `内容不同（demo ${f.demoSize} B · 库 ${f.libSize} B；` +
      `demo 那份是 ${fmtTime(f.demoMtime)}${age >= 0.1 ? `，比库旧 ${age} 天` : ''}）`;
    return f;
  });

  const bad = files.filter((f) => !f.ok);
  return {
    ok: bad.length === 0,
    files,
    bad,
    demo,
    lib,
    ms: Date.now() - started,
  };
}

/**
 * 把结果排成给人看的行：title + 明细（明细不缩进，调用方自己缩）。
 * 失败时最后一行是可执行的修复命令 —— 报错不附修法，等于让人去猜。
 */
export function formatMirror(r) {
  if (r.ok)
    return [`✓ 产物镜像（与库一致 · ${r.files.length} 个文件 · ${r.ms}ms）`];
  const lines = [
    `✗ 产物镜像（与库不一致：${r.bad.length}/${r.files.length} 个文件）`,
  ];
  for (const f of r.bad) lines.push(`${f.rel}：${f.reason}`);
  lines.push(`修复：${FIX}`);
  return lines;
}

/** CLI：node tools/mirror.mjs <demo 目录> [--no-mirror-check] [--lib <库目录>] */
function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--no-mirror-check')) {
    console.log('· 产物镜像检查已关闭（--no-mirror-check），这一项不设防。');
    return 0;
  }
  let lib = LIB;
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--lib') {
      lib = path.resolve(args[++i] || '');
      continue;
    }
    if (args[i].startsWith('--')) continue;
    rest.push(args[i]);
  }
  const demo = rest[0];
  if (!demo) {
    console.error(
      '用法：node tools/mirror.mjs <demo 目录> [--no-mirror-check] [--lib <库目录>]',
    );
    return 2;
  }
  if (!fs.existsSync(demo)) {
    console.error(`✗ demo 目录不存在：${demo}`);
    return 2;
  }

  const r = checkMirror({ demo: path.resolve(demo), lib });
  const lines = formatMirror(r);
  console.log(lines[0]);
  for (const line of lines.slice(1)) console.log(`  ${line}`);
  return r.ok ? 0 : 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = main(process.argv);
}
