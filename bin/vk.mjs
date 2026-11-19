#!/usr/bin/env node
/**
 * vk —— 单帧画面库 CLI（v27）
 *
 *   vk render [<file|dir>] [--check] [--frame id] [--out DIR] [--json] [--no-preview] [--sheet]
 *   vk doc    <tag> [--json]
 *   vk example <tag> [as]
 *   vk brief  [--tag a,b] [--facts] [--codes] [--all] [--json]
 *   vk build
 *   vk clean  [--all] [--dist]
 *
 * 这一层只做三件事：解析参数、调用、打印。出图在 tools/render.mjs，构建在 tools/build.mjs。
 * --json 时 stdout 只有 JSON，日志与构建输出全部走 stderr。
 */
import fs from 'node:fs';
import path from 'node:path';
import { VERSION, contract, docText, exampleFrame, markdownFull } from '../src/contract.mjs';
import { TAGS, TAG_NAMES, LAYOUT_FACTS, CAPACITY, RULES } from '../src/schema.mjs';
import { CANVAS, CONTENT, PHONE_W, INDEX_RULE } from '../src/vocab.mjs';
import { CODES_INFO } from '../src/contract/codes.mjs';
import { renderFiles, collect } from '../tools/render.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'out');
const TMP = path.join(ROOT, '.vk-tmp');
const DIST = path.join(ROOT, 'dist');
const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join('/') || '.';

/* ---------------------------------------------------------------- 参数
   `--k=v` 也认：先规整成 `--k v`，后面只处理一种形状。 */
const argv = [];
for (const a of process.argv.slice(2)) {
  const m = /^(--[\w-]+)=(.*)$/.exec(a);
  if (m) argv.push(m[1], m[2]);
  else argv.push(a);
}
const cmd = argv[0];
const rest = argv.slice(1);
const has = (n) => rest.includes(n);
const val = (n) => {
  const i = rest.indexOf(n);
  return i >= 0 ? rest[i + 1] : null;
};
const VALUE_FLAGS = new Set(['--out', '--frame', '--tag']);

const FLAGS = {
  render: new Set(['--check', '--frame', '--out', '--json', '--no-preview', '--sheet', '--help', '-h']),
  doc: new Set(['--json', '--help', '-h']),
  example: new Set(['--help', '-h']),
  brief: new Set(['--tag', '--facts', '--codes', '--all', '--json', '--help', '-h']),
  build: new Set(['--help', '-h']),
  clean: new Set(['--all', '--dist', '--help', '-h']),
};

const RENDER_USAGE = `vk render [<file|dir>] [--check] [--frame id] [--out DIR] [--json] [--no-preview] [--sheet]

  构建 + 自检 + 出三件：<name>.png（1920）/ <name>.phone.png（693）/ <name>.json
  --check       只构建 + 自检 + 写 json，不出图
  --frame id    只出这一帧（按 vk-page 的 id）
  --out DIR     产物目录（默认 out/）
  --json        stdout 只有报告 JSON
  --no-preview  不出 693 预览
  --sheet       再拼一张联系表`;

const usage = `vk ${VERSION} —— 单帧画面库（一帧一张 1920×1080，手机上约 ${PHONE_W} 宽）

  vk render <file|dir> [--check] [--frame id] [--out DIR] [--json] [--no-preview] [--sheet]
  vk doc    <tag> [--json]          一个件的属性表（含子项）
  vk example <tag> [as]             一个件的完整可跑最小帧
  vk brief  [--tag a,b] [--facts] [--codes] [--all] [--json]
                                    默认只给索引（≤4KB）；--tag 加属性表；--all 旧的全量
  vk build                          重建 dist/（gen → vendor → bundle，一个进程）
  vk clean  [--all] [--dist]        删 .vk-tmp；--all 连 out/，--dist 连 dist/
  vk --version | --help

默认只管出图：内容/版式有问题也出图，exit 0；只有一张图都没出来才 exit 1。
--json 的 stdout 只有 JSON，日志走 stderr。`;

const die = (msg, code = 2) => {
  console.error(msg);
  process.exit(code);
};

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
  if (v == null || v === '' || v.startsWith('-')) die(`[vk] ${f} 需要值`);
}
const inputs = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('-')) {
    if (VALUE_FLAGS.has(a)) i++;
    continue;
  }
  inputs.push(a);
}

if (has('--help') || has('-h')) {
  console.log(usage);
  process.exit(0);
}

/* 报表：只打印事实，不评价。 */
function printReport(report) {
  if (report.engine) console.log(`引擎：${report.engine.channel} ${report.engine.version}`);
  for (const d of report.diagnostics) {
    const at = d.line ? `${d.file}:${d.line}` : d.file;
    console.log(`✗ ${at} [${d.code || 'ERROR'}] ${d.message}${d.fix ? ` → ${d.fix}` : ''}`);
  }
  for (const d of report.hints || []) console.log(`· 事实 [${d.code}] ${d.message}${d.fix ? ` → ${d.fix}` : ''}`);
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
    for (const x of f.hints || []) console.log(`   事实 [${x.code}]${x.line ? ` 第 ${x.line} 行` : ''} ${x.message}${x.fix ? ` → ${x.fix}` : ''}`);
    for (const w of f.warns) console.log(`   提示：${w}`);
  }
  const n = report.diagnostics.length + report.frames.reduce((k, f) => k + f.issues.length, 0);
  const hits = (report.hints || []).length + report.frames.reduce((k, f) => k + (f.hints || []).length, 0);
  const over = report.frames.filter((f) => f.health?.overflow).length;
  const tail = [n ? `${n} 条问题` : '', over ? `${over} 帧放不下` : '', hits ? `${hits} 条事实` : ''].filter(Boolean).join('，');
  console.log(tail ? `\n已出图：${report.frames.length} 帧（不拦出图）：${tail}` : `\n干净：${report.frames.length} 帧`);
}

/* ---------------------------------------------------------------- brief
   默认只给索引：能用一句话说清的都压成一行，详细属性去 vk doc。 */
const ANCHORS = '#id / #id@line:3 / #id@item:2 / #id@bit:5 / #id@side:left';
const CHECK_FIELDS = [
  'ok / fits：没有 error / 内容放得下（overflow = 0）；hint 不算 error',
  'issues[]：{code, message, fix, line?, origin?}（origin=build 是构建期诊断）',
  'hints[]：{code, message, fix, line?}（severity=hint 的事实，不挡出图）',
  'health：{band, bodyWidth, content, overflow, slackTop, slackBottom, focus, callout, anchors, minFont, blocks[]}',
  'engine：{channel, version}（出图用的 Chromium）；每帧另有 file / id / warns',
];

/** 一句话：摘要的第一句，长句截断。 */
const oneLine = (s, max = 40) => {
  const t = String(s || '').split(/[。；;]/)[0].trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

/** 标签必填属性：本件 + 各变体的并集。 */
function requiredOf(tag) {
  const t = TAGS[tag];
  const own = Object.entries(t.attrs || {}).filter(([, s]) => s.required).map(([n]) => n);
  const inVariant = new Set();
  for (const v of Object.values(t.variants || {})) for (const [n, s] of Object.entries(v.attrs || {})) if (s.required) inVariant.add(n);
  return { own, all: [...new Set([...own, ...inVariant])], variantOnly: [...inVariant].filter((n) => !own.includes(n)) };
}

function headerLines() {
  return [
    `vk 契约 v${VERSION} · 索引`,
    `画布 ${CANVAS.w}×${CANVAS.h}（版心 ${CONTENT.w}×${CONTENT.h}）；手机横屏约 ${PHONE_W} 宽（${(PHONE_W / CANVAS.w).toFixed(3)}×）；索引 ${INDEX_RULE}。`,
  ];
}

function rulesLines() {
  return ['', '规则', ...RULES.map((r, i) => `${i + 1}. ${r}`)];
}

function anchorLines() {
  return ['', `锚点：${ANCHORS}（id 只写字母/数字/下划线/短横线/汉字；style 只写颜色 token）`];
}

function tagIndexLines() {
  const out = ['', '标签（详细：vk doc <tag>；可跑最小帧：vk example <tag>）'];
  for (const tag of TAG_NAMES) {
    const t = TAGS[tag];
    const { all, variantOnly } = requiredOf(tag);
    const req = all.length ? ` · 必填 ${all.join('/')}${variantOnly.length ? '（按变体）' : ''}` : '';
    out.push(`· ${tag} · ${t.name} —— ${oneLine(t.summary)}${req}`);
  }
  return out;
}

function factsLines() {
  const lf = LAYOUT_FACTS;
  return [
    '',
    '排版事实',
    `· 标题带 ${lf.head.withLede} / ${lf.head.withoutLede} / subhead ${lf.head.subhead}；正文带 ${lf.band.withLede} / ${lf.band.withoutLede} / ${lf.band.subhead}`,
    `· note：正文让出 ${lf.note.gutter}，注栏宽 ≤ ${lf.note.width}；半栏约 ${lf.halfColumnChars.body} 字（caption ${lf.halfColumnChars.caption}），有 note ${lf.halfColumnChars.withNote}`,
    `· ${lf.cellsCompact}；${lf.tableWithLede}；一帧一条 note`,
    '· 逐项拆帧预算：vk brief --facts',
  ];
}

function checkLines() {
  return ['', 'check 字段（每帧 <name>.json，也是报告 frames[] 的元素）', ...CHECK_FIELDS.map((x) => `· ${x}`)];
}

function nextLines() {
  return [
    '',
    '下一步',
    '· 写帧：vk doc <tag> 查属性、vk example <tag> 拿可跑最小帧；多帧写在同一文件里',
    '· 算版式：vk brief --facts；查错误码：vk brief --codes',
    `· 体检：vk render f.html --check；出图：vk render f.html [--sheet]`,
  ];
}

function indexText() {
  return [...headerLines(), ...rulesLines(), ...anchorLines(), ...tagIndexLines(), ...factsLines(), ...checkLines(), ...nextLines()].join('\n');
}

function indexJson() {
  return {
    version: VERSION,
    canvas: { w: CANVAS.w, h: CANVAS.h, contentW: CONTENT.w, contentH: CONTENT.h, marginX: CANVAS.marginX, marginY: CANVAS.marginY },
    phone: { width: PHONE_W, ratio: Number((PHONE_W / CANVAS.w).toFixed(3)) },
    indexRule: INDEX_RULE,
    rules: RULES,
    anchors: ANCHORS,
    tags: TAG_NAMES.map((tag) => {
      const t = TAGS[tag];
      const { all } = requiredOf(tag);
      return { tag, name: t.name, summary: oneLine(t.summary), required: all, doc: `vk doc ${tag}` };
    }),
    facts: { head: LAYOUT_FACTS.head, band: LAYOUT_FACTS.band, note: LAYOUT_FACTS.note, halfColumnChars: LAYOUT_FACTS.halfColumnChars },
    check: CHECK_FIELDS,
    next: ['vk doc <tag>', 'vk example <tag>', 'vk brief --facts', 'vk brief --codes', 'vk render <file> --check', 'vk render <file>'],
  };
}

/* 属性行由 vk 自己排版：只依赖 schema 的 spec 形状，不借 src 内部工具。 */
const TYPE_LABEL = { text: '文本', enum: '枚举', int: '整数', num: '数字', bool: '开关', lines: '行段', range: '单段行段', space: '间距', selector: '锚点', cols: '列', items: '项' };

function attrLine(name, spec) {
  const values = spec.values ? spec.values.join(' / ') : TYPE_LABEL[spec.type] || spec.type;
  const def = spec.default === undefined ? '' : `（默认 ${spec.default}）`;
  const range =
    spec.min !== undefined && spec.max !== undefined ? `（${spec.min}–${spec.max}）` : spec.min !== undefined ? `（≥ ${spec.min}）` : spec.max !== undefined ? `（≤ ${spec.max}）` : '';
  const label = [spec.label || '', spec.required ? '必填' : '', spec.when ? `只对 ${spec.when.attr}=${spec.when.values.join('|')}` : ''].filter(Boolean).join('；');
  return `  ${name} = ${values}${def}${range}  ${label}`;
}

/** 一个 tag 的属性表：只写文字，不带示例（示例用 vk example）。 */
function tagTableLines(tag) {
  const t = TAGS[tag];
  const out = ['', `## ${tag} · ${t.name}`, oneLine(t.summary, 80)];
  const own = t.attrs || {};
  if (t.variants) out.push(`as：${Object.entries(t.variants).map(([k, v]) => `${k}（${v.label}）`).join(' / ')}`);
  const ownRows = Object.entries(own).filter(([n]) => n !== 'as');
  if (ownRows.length) out.push('', '本件属性：', ...ownRows.map(([n, s]) => attrLine(n, s)));
  if (t.variants) {
    for (const [as, v] of Object.entries(t.variants)) {
      const delta = Object.entries(v.attrs || {}).filter(([k, s]) => JSON.stringify(own[k]) !== JSON.stringify(s));
      out.push('', `as=${as} · ${v.label} —— ${oneLine(v.summary, 45)}`);
      if (delta.length) out.push(...delta.map(([n, s]) => attrLine(n, s)));
      if (v.children?.hint) out.push(`  子项：${v.children.hint}`);
    }
  } else if (t.children?.hint) out.push('', `子项：${t.children.hint}`);
  const childRows = t.children?.attrs || t.children?.cellAttrs;
  if (childRows) out.push(...Object.entries(childRows).map(([n, s]) => attrLine(`li.${n}`, s)));
  out.push('', `示例：vk example ${tag}${t.variants ? ` ${Object.keys(t.variants)[0]}` : ''}`);
  return out;
}

function factsText() {
  const out = [
    `排版事实（vk ${VERSION}）`,
    `画布 ${CANVAS.w}×${CANVAS.h}，版心 ${CONTENT.w}×${CONTENT.h}，手机 ${PHONE_W}。`,
    '',
    '标题带 / 正文带（px）：',
    `  带 lede ${LAYOUT_FACTS.head.withLede} / ${LAYOUT_FACTS.band.withLede}；不带 ${LAYOUT_FACTS.head.withoutLede} / ${LAYOUT_FACTS.band.withoutLede}；subhead ${LAYOUT_FACTS.head.subhead} / ${LAYOUT_FACTS.band.subhead}；两行标题 ${LAYOUT_FACTS.head.twoLineHeadline}`,
    `  右注栏：正文让出 ${LAYOUT_FACTS.note.gutter}，注栏宽 ≤ ${LAYOUT_FACTS.note.width}，上/下注留 ${LAYOUT_FACTS.note.standoffY}`,
    `  半栏字数：正文 ${LAYOUT_FACTS.halfColumnChars.body} · caption ${LAYOUT_FACTS.halfColumnChars.caption} · 有 note ${LAYOUT_FACTS.halfColumnChars.withNote}`,
    `  ${LAYOUT_FACTS.cellsCompact}`,
    `  表格：${LAYOUT_FACTS.tableWithLede}`,
    `  一帧一条 note：${LAYOUT_FACTS.oneNotePerFrame ? '是' : '否'}`,
    '',
    '拆帧预算（实测参考，不是门禁）：',
    ...CAPACITY.map((x) => `  ${x.what}：${x.max}${x.note ? `（${x.note}）` : ''}`),
  ];
  return out.join('\n');
}

/** 码表只在 codes.mjs 写一份；老的 [when, fix] 数组形状也认。 */
const codeInfo = (v) => (Array.isArray(v) ? { when: v[0], fix: v[1] } : v || {});

function codesText() {
  return [
    `错误码与提示（vk ${VERSION}；标「提示」的不挡出图）`,
    ...Object.entries(CODES_INFO).map(([k, v]) => {
      const i = codeInfo(v);
      return `· ${k}${i.severity === 'hint' ? '（提示）' : ''}：${i.when || ''}${i.fix ? ` → ${i.fix}` : ''}`;
    }),
  ].join('\n');
}

function codesJson() {
  return { version: VERSION, codes: Object.fromEntries(Object.entries(CODES_INFO).map(([k, v]) => [k, codeInfo(v)])) };
}

/* ---------------------------------------------------------------- 命令 */
if (cmd === 'build') {
  try {
    const { build } = await import('../tools/build.mjs'); /* 构建相关按需加载：brief/doc 不碰 esbuild */
    build();
  } catch (e) {
    die(`[vk] 构建失败：${e.message}`, 3);
  }
  process.exit(0);
} else if (cmd === 'render') {
  if (!inputs.length) {
    console.log(RENDER_USAGE);
    process.exit(0);
  }
  const files = inputs.flatMap((i) => {
    const abs = path.resolve(process.cwd(), i);
    return fs.existsSync(abs) ? collect(abs) : [];
  });
  if (!files.length) die(`[vk] 找不到 ${inputs.join(' ')}`);
  const checkOnly = has('--check');
  const reportFallback = (diagnostics) => ({
    version: VERSION,
    ok: false,
    clean: false,
    engine: null,
    diagnostics,
    hints: [],
    frames: [],
    produced: 0,
    inputs: files.length,
  });

  try {
    const { ensure } = await import('../tools/build.mjs');
    ensure();
  } catch (e) {
    const report = reportFallback([{ file: 'dist', line: 1, code: 'BUILD', message: e.message, fix: '看构建输出；node tools/build.mjs' }]);
    if (has('--json')) console.log(JSON.stringify(report));
    else printReport(report);
    process.exit(1);
  }

  const outAbs = path.resolve(process.cwd(), val('--out') || OUT);
  const forbidden = [path.join(ROOT, 'src'), path.join(ROOT, 'bin'), path.join(ROOT, 'tools'), path.join(ROOT, 'tests'), path.join(ROOT, 'docs')];
  if (forbidden.some((p) => outAbs === p || outAbs.startsWith(p + path.sep))) die(`[vk] --out 不能指向源码目录：${outAbs}`);

  let report;
  try {
    report = await renderFiles(files, {
      shots: !checkOnly,
      output: outAbs,
      onlyFrame: val('--frame'),
      /* 只渲染显式文件时，别把 out/ 里其它帧当孤儿删掉（那是批量渲染的事）。 */
      keepPrior: inputs.every((p) => {
        try {
          return fs.statSync(path.resolve(p)).isFile();
        } catch {
          return false;
        }
      }),
      preview: !has('--no-preview'),
      sheet: has('--sheet'),
    });
  } catch (e) {
    report = reportFallback([{ file: inputs[0], line: 1, code: 'RUNTIME', message: `出图失败：${e.message}`, fix: '单个文件出错不该走到这里；看 stderr' }]);
  }
  if (has('--json')) console.log(JSON.stringify(report));
  else printReport(report);
  /* 一张图都没出来才 exit 1；--check 没图是正常的。 */
  const nothing = checkOnly ? report.frames.length === 0 : !report.frames.some((f) => f.png);
  process.exit(nothing ? 1 : 0);
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
  const variants = TAGS[tag].variants;
  if (as && variants && !variants[as]) die(`[vk] ${tag} 没有 as="${as}"；可用：${Object.keys(variants).join(', ')}`);
  const text = exampleFrame(tag, as);
  if (!text) die(`[vk] ${tag}${as ? ` 没有 as="${as}"` : ''} 没有示例；先看 vk doc ${tag}`);
  console.log(text);
} else if (cmd === 'brief') {
  const json = has('--json');
  const out = (text, obj) => console.log(json ? JSON.stringify(obj) : text);

  if (has('--all')) {
    out(markdownFull(), contract());
  } else if (has('--tag')) {
    const raw = String(val('--tag') || '');
    const names = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean).map((n) => (n.startsWith('vk-') ? n : `vk-${n}`)))];
    const unknown = names.filter((n) => !TAGS[n]);
    if (unknown.length) die(`未知标签 ${unknown.join(', ')}。可用：${TAG_NAMES.join(', ')}`);
    const text = [...headerLines(), ...rulesLines(), ...anchorLines(), ...names.flatMap((n) => tagTableLines(n)), '', `其它 ${TAG_NAMES.length} 个标签：vk brief；错误码：vk brief --codes；拆帧预算：vk brief --facts`, ...nextLines()].join('\n');
    const c = contract();
    out(text, { version: VERSION, rules: RULES, anchors: ANCHORS, tags: Object.fromEntries(names.map((n) => [n, c.tags[n]])) });
  } else if (has('--facts')) {
    out(factsText(), { version: VERSION, layoutFacts: LAYOUT_FACTS, capacity: CAPACITY });
  } else if (has('--codes')) {
    out(codesText(), codesJson());
  } else {
    out(indexText(), indexJson());
  }
} else if (cmd === 'clean') {
  const targets = [TMP, ...(has('--all') ? [OUT] : []), ...(has('--dist') ? [DIST] : [])];
  for (const d of targets) {
    if (!fs.existsSync(d)) continue;
    fs.rmSync(d, { recursive: true, force: true });
    console.log('删掉 ' + rel(d));
  }
}
