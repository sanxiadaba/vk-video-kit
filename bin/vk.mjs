#!/usr/bin/env node
/**
 * vk —— 单帧画面库 CLI（v26）
 *
 *   vk build                        重建 dist/（tokens / fonts / vk.css / vk.js / audit.js）
 *   vk render <file|dir> [--frame id] [--out DIR] [--json] [--no-preview] [--sheet]
 *   vk check  <file|dir> [--frame id] [--out DIR] [--json]
 *   vk doc    <tag> [--json]        一个件的属性表（含子项）
 *   vk brief  [--json] [--full]     全部契约；默认紧凑
 *   vk icons  <query>               搜 Lucide 图标名
 *   vk clean  [--all]               删 .vk-tmp；--all 连 out/ 一起删
 *
 * 这一层只做三件事：解析参数、调用、打印。出图在 tools/render.mjs，构建在 tools/build.mjs。
 */
import fs from 'node:fs';
import path from 'node:path';
import { contract, compact, markdown, markdownFull, docText, exampleFrame, VERSION } from '../src/contract.mjs';
import { TAGS, TAG_NAMES } from '../src/schema.mjs';
import { build as buildDist, ensure as ensureDist } from '../tools/build.mjs';
import { renderFiles, collect } from '../tools/render.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'out');
const TMP = path.join(ROOT, '.vk-tmp');

const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);
const has = (n) => rest.includes(n);
const val = (n) => {
  const i = rest.indexOf(n);
  return i >= 0 ? rest[i + 1] : null;
};
const VALUE_FLAGS = new Set(['--out', '--frame']);
const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join('/');

const FLAGS = {
  render: new Set(['--frame', '--out', '--json', '--no-preview', '--sheet', '--help', '-h']),
  check: new Set(['--frame', '--out', '--json', '--help', '-h']),
  doc: new Set(['--json', '--help', '-h']),
  example: new Set(['--help', '-h']),
  brief: new Set(['--json', '--full', '--codes', '--tag', '--help', '-h']),
  icons: new Set(['--help', '-h']),
  clean: new Set(['--all', '--help', '-h']),
  build: new Set(['--help', '-h']),
};

const usage = `vk ${VERSION} —— 单帧画面库（一帧一张 1920×1080，手机上约 693 宽）

  vk build                         重建 dist/
  vk render <file|dir> [--frame id] [--out DIR] [--json] [--no-preview] [--sheet]
      构建 + 自检 + 出三件：<name>.png / <name>.phone.png / <name>.json；--sheet 再拼一张联系表
  vk check  <file|dir> [--frame id] [--out DIR] [--json]
      只构建 + 自检 + 写 json（不出图）
  vk doc    <tag> [--json]         一个件的属性表（含子项）
  vk example <tag> [as]             一个件的完整可跑最小帧
  vk brief  [--json] [--full]      全部契约；默认紧凑，--full 含颜色/字号/线宽
  vk icons  <query>                搜 Lucide 图标名
  vk clean  [--all]                删 .vk-tmp；--all 连 out/ 一起删
  vk --version | --help

默认只管出图：内容/版式有问题也出图，exit 0；只有一张图都没出来才 exit 1。
--json 的 stdout 只有 JSON，日志走 stderr。`;

const die = (msg, code = 2) => {
  console.error(msg);
  process.exit(code);
};

/* 参数校验：每个命令只认自己的 flag；--out/--frame 必须有值。 */
if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log(usage);
  process.exit(0);
}
if (cmd === '--version' || cmd === '-v') {
  console.log(VERSION);
  process.exit(0);
}
if (!FLAGS[cmd]) {
  console.error(`[vk] 不认识的命令 ${cmd}\n`);
  console.log(usage);
  process.exit(2);
}
const allowed = FLAGS[cmd];
const bad = rest.find((a) => a.startsWith('-') && !allowed.has(a));
if (bad) die(`[vk] ${cmd} 不认识的参数 ${bad}；可用：${[...allowed].join(' ')}`);
for (const f of VALUE_FLAGS) {
  if (!rest.includes(f)) continue;
  const v = val(f);
  if (v == null || v.startsWith('-')) die(`[vk] ${f} 需要值`);
}
const inputs = rest.filter((a, i) => !a.startsWith('-') && !(i > 0 && VALUE_FLAGS.has(rest[i - 1])));

if (has('--help') || has('-h')) {
  console.log(usage);
  process.exit(0);
}

/* 报表：只打印事实，不评价。 */
function printReport(report) {
  for (const d of report.diagnostics) {
    const at = d.line ? `${d.file}:${d.line}` : d.file;
    console.log(`✗ ${at} [${d.code || 'ERROR'}] ${d.message}${d.fix ? ` → ${d.fix}` : ''}`);
  }
  for (const f of report.frames) {
    const tag = f.id ? ` #${f.id}` : '';
    const h = f.health;
    const files = f.png ? `  → ${f.png}${f.preview ? ` + ${f.preview}` : ''}` : '';
    const facts = h
      ? `正文带 ${h.band} · 内容 ${h.content}${h.overflow ? ` · 超出 ${h.overflow}px` : ''} · 焦点 ${h.focus}${h.callout ? `+${h.callout}` : ''} · 最小字 ${h.minFont} · ${h.blocks.map((b) => `${b.vk} ${b.h}px@${b.font}`).join(' / ') || '空'}`
      : '';
    if (f.issues.length) {
      console.log(`✗ ${f.file}${tag}`);
      for (const x of f.issues) console.log(`   · [${x.code}]${x.line ? ` 第 ${x.line} 行` : ''} ${x.message}${x.fix ? ` → ${x.fix}` : ''}`);
    } else if (h?.overflow) {
      console.log(`! ${f.file}${tag}${files}`);
    } else {
      console.log(`✓ ${f.file}${tag}${files}`);
    }
    if (facts) console.log(`   ${facts}`);
    for (const w of f.warns) console.log(`   提示：${w}`);
  }
  const n = report.diagnostics.length + report.frames.reduce((k, f) => k + f.issues.length, 0);
  const over = report.frames.filter((f) => f.health?.overflow).length;
  const tail = [n ? `${n} 条问题` : '', over ? `${over} 帧放不下` : ''].filter(Boolean).join('，');
  console.log(tail ? `\n已出图：${report.frames.length} 帧（不拦出图）：${tail}` : `\n干净：${report.frames.length} 帧`);
}

/* ---------------------------------------------------------------- 命令 */
if (cmd === 'build') {
  try {
    buildDist();
  } catch (e) {
    die(`[vk] 构建失败：${String(e.stderr || e.message).trim()}`, 3);
  }
  process.exit(0);
}

if (cmd === 'render' || cmd === 'check') {
  if (!inputs.length) die(`用法：vk ${cmd} <file|dir> [--frame id] [--out DIR]`);
  const files = inputs.flatMap((i) => {
    const abs = path.resolve(process.cwd(), i);
    return fs.existsSync(abs) ? collect(abs) : [];
  });
  if (!files.length) die(`[vk] 找不到 ${inputs.join(' ')}`);
  try {
    ensureDist();
  } catch (e) {
    die(`[vk] ${e.message}`, 3);
  }
  const outAbs = path.resolve(process.cwd(), val('--out') || OUT);
  const forbidden = [path.join(ROOT, 'src'), path.join(ROOT, 'bin'), path.join(ROOT, 'tools'), path.join(ROOT, 'tests'), path.join(ROOT, 'docs')];
  if (forbidden.some((p) => outAbs === p || outAbs.startsWith(p + path.sep))) die(`[vk] --out 不能指向源码目录：${outAbs}`);
  let report;
  try {
    report = await renderFiles(files, {
      shots: cmd === 'render',
      output: outAbs,
      onlyFrame: val('--frame'),
      preview: !has('--no-preview'),
      sheet: has('--sheet'),
    });
  } catch (e) {
    die(`[vk] 出图失败：${e.message}`, 3);
  }
  if (has('--json')) console.log(JSON.stringify(report));
  else printReport(report);
  process.exitCode = report.frames.length === 0 ? 1 : 0;
} else if (cmd === 'doc') {
  const tag = inputs[0];
  if (!tag) die('用法：vk doc <tag> [--json]');
  if (!TAGS[tag]) die(`未知标签 ${tag}。可用：${TAG_NAMES.join(', ')}`);
  if (has('--json')) console.log(JSON.stringify(contract().tags[tag], null, 2));
  else console.log(docText(tag));
} else if (cmd === 'example') {
  const tag = inputs[0];
  const as = inputs[1];
  if (!tag) die('用法：vk example <tag> [as]');
  if (!TAGS[tag]) die(`未知标签 ${tag}。可用：${TAG_NAMES.join(', ')}`);
  if (tag === 'vk-callout' && as) die('[vk] vk-callout 用 mode="mark|note|arrow|measure"，不用 as');
  const text = exampleFrame(tag, as);
  if (!text) die(`[vk] ${tag}${as ? ` 没有 as="${as}"` : ''} 没有示例；callout 用 mode，不是 as。先看 vk doc ${tag}`);
  console.log(text);
} else if (cmd === 'brief') {
  const full = has('--full');
  const base = full ? contract() : compact();
  if (has('--codes')) {
    if (has('--json')) console.log(JSON.stringify(base.codes));
    else console.log(markdown().split('## 错误码')[1]?.trim() || '');
  } else if (has('--tag')) {
    if (!val('--tag')) die('[vk] --tag 需要值，例如 --tag vk-code,vk-board');
    const names = String(val('--tag') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => (n.startsWith('vk-') ? n : `vk-${n}`));
    const picked = Object.fromEntries(names.map((n) => [n, base.tags[n]]).filter(([, v]) => v));
    if (!has('--json')) {
      for (const n of Object.keys(picked)) console.log(docText(n) + '\n');
    } else console.log(JSON.stringify({ ...base, tags: picked }));
  } else if (has('--json')) console.log(JSON.stringify(base));
  else console.log(full ? markdownFull() : markdown());
} else if (cmd === 'icons') {
  const q = (inputs[0] || '').toLowerCase();
  if (!q) die('用法：vk icons <query>');
  const lucide = await import('lucide');
  const names = Object.keys(lucide.icons || {}).map((n) => n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase());
  const hit = names.filter((k) => k.includes(q)).slice(0, 60);
  console.log(hit.length ? hit.join('\n') : `没有匹配 "${q}" 的图标`);
} else if (cmd === 'clean') {
  for (const d of [TMP, ...(has('--all') ? [OUT] : [])]) {
    if (!fs.existsSync(d)) continue;
    fs.rmSync(d, { recursive: true, force: true });
    console.log('删掉 ' + rel(d));
  }
}
