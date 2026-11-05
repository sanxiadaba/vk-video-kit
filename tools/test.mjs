/**
 * 测试：契约 → 文档 → 渲染。
 *
 *   npm test
 *
 * 不测「像素没变」，测「契约没漂、文档没错、验收帧全部干净」。
 * 像素回归只会告诉你"变了"，不会告诉你"错了"。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as parse5 from 'parse5';
import { TAGS, TAG_NAMES, attrsOf } from '../src/schema.mjs';
import { FONT, GAP, TONE, SURFACE, STATE, INK } from '../src/vocab.mjs';

let bad = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    bad++;
    console.error(`  ✗ ${msg}`);
  }
};

/* ---------------------------------------------------------------- 契约 */
console.log('契约');
ok(TAG_NAMES.length === 27, `27 个件（${TAG_NAMES.length}）`);
ok(new Set(TAG_NAMES).size === TAG_NAMES.length, '件名唯一');

const layers = new Set(['page', 'layout', 'surface', 'content', 'diagram', 'relation']);
for (const tag of TAG_NAMES) {
  const t = TAGS[tag];
  ok(!!t.name && !!t.summary, `${tag} 有名字与一句话说明`);
  ok(layers.has(t.layer), `${tag} 的层合法（${t.layer}）`);
  const attrs = attrsOf(tag);
  const own = Object.keys(t.attrs).length;
  if (own > 12) {
    bad++;
    console.error(`  ✗ ${tag} 有 ${own} 个属性（上限 12）`);
  }
  for (const [name, spec] of Object.entries(attrs)) {
    if (!spec.label || !spec.group) {
      bad++;
      console.error(`  ✗ ${tag}/${name} 缺 label 或 group`);
    }
    if (!spec.values && !spec.type) {
      bad++;
      console.error(`  ✗ ${tag}/${name} 既没有 type 也没有 values`);
    }
    if (spec.values && spec.default !== undefined && !spec.values.includes(spec.default)) {
      bad++;
      console.error(`  ✗ ${tag}/${name} 的默认值 ${spec.default} 不在取值里`);
    }
    if (spec.values && new Set(spec.values).size !== spec.values.length) {
      bad++;
      console.error(`  ✗ ${tag}/${name} 的取值有重复`);
    }
  }
  if (t.children?.kind === 'item') {
    ok(!!t.children.attrs, `${tag} 的 <li> 契约存在`);
  }
}
console.log(`  · 属性总数 ${TAG_NAMES.reduce((n, t) => n + Object.keys(TAGS[t].attrs).length, 0)}`);

/* 词表本身就是取值来源：schema 里出现的枚举必须来自 vocab。 */
const VOCAB = new Set([...TONE, ...SURFACE, ...STATE, ...INK, ...Object.keys(FONT), ...Object.keys(GAP)]);
for (const tag of TAG_NAMES) {
  for (const [name, spec] of Object.entries(attrsOf(tag))) {
    if (name === 'tone' && spec.values && spec.values.join() !== TONE.join()) {
      bad++;
      console.error(`  ✗ ${tag}/tone 与词表不一致`);
    }
  }
}
ok(VOCAB.size > 20, '词表已加载');

/* 每个公开属性都要有消费者：声明了却没人读 = 作者写了没效果。 */
const GENERIC = new Set(['span', 'row-span', 'grow', 'bleed', 'state']);
const hay = [];
const walkSrc = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkSrc(p);
    else if (/\.(css|mjs)$/.test(p) && !p.endsWith('schema.mjs') && !p.includes('generated')) hay.push(fs.readFileSync(p, 'utf8'));
  }
};
walkSrc('src');
walkSrc('bin');
walkSrc('tools');
const text = hay.join('\n');
for (const tag of TAG_NAMES) {
  for (const name of Object.keys(attrsOf(tag))) {
    if (GENERIC.has(name) || name === 'class' || name === 'id') continue;
    const needle = name.includes('-') ? name : `'${name}'`;
    if (!text.includes(`'${name}'`) && !text.includes(`[${name}`) && !text.includes(`"${name}"`)) {
      bad++;
      console.error(`  ✗ ${tag}/${name} 声明了但没有消费者`);
    }
  }
}
ok(true, '属性都有消费者（逐条检查）');

/* ---------------------------------------------------------------- 文档 */
console.log('\n文档');
const spec = fs.readFileSync('SPEC.md', 'utf8');
for (const tag of TAG_NAMES) ok(spec.includes(`\`${tag}\``), `SPEC 提到 ${tag}`);
ok(!/--vk-s[1-8]/.test(spec), 'SPEC 里没有旧间距名');
ok(!/mass=/.test(spec), 'SPEC 里没有已删除的 mass');

const tokens = execFileSync(process.execPath, ['tools/css.mjs', '--check'], { encoding: 'utf8' });
ok(/一致/.test(tokens), 'tokens 与 vocab 一致');

// 分镜里用到的每个属性，SPEC 里都得写：新会话只读 SPEC 也能写出同样的帧。
{
  const used = new Map();
  const files = [];
  for (const dir of ['episodes', 'tests/acceptance']) {
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.html')) files.push(path.join(dir, f));
  }
  for (const f of files) {
    const doc = parse5.parse(fs.readFileSync(f, 'utf8'));
    const walk = (n) => {
      if (n.tagName?.startsWith('vk-')) {
        for (const a of n.attrs || []) used.set(`${n.tagName} ${a.name}`, `${f}:${n.sourceCodeLocation?.startTag?.startLine ?? '?'}`);
      }
      for (const c of n.childNodes || []) walk(c);
      if (n.content) walk(n.content);
    };
    walk(doc);
  }
  const misses = [];
  for (const [key, where] of used) {
    const attr = key.split(' ')[1];
    if (attr === 'id' && key.startsWith('vk-page')) continue;
    if (!spec.includes(`\`${attr}\``)) misses.push(`${key}（${where}）`);
  }
  ok(!misses.length, '分镜用到的属性都在 SPEC 里');
  for (const m of misses) console.error(`    · ${m}`);
}

/* ---------------------------------------------------------------- 素材 */
console.log('\n素材');
try {
  const r = execFileSync(process.execPath, ['tools/assets.mjs', '--check'], { encoding: 'utf8' });
  ok(/一致/.test(r), 'code/ 里的 .s / .dis 能追溯到 .c');
} catch (e) {
  bad++;
  console.error('  ✗ 素材清单不一致：\n' + String(e.stderr || e.message).trim());
}

/* ---------------------------------------------------------------- 渲染 */
console.log('\n验收帧');
let report = [];
try {
  const out = execFileSync(
    process.execPath,
    ['bin/vk.mjs', 'render', 'tests/acceptance', 'tests/sheet.html', 'tests/sheet2.html', 'tests/capabilities.html', 'episodes', '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  report = JSON.parse(out);
} catch (e) {
  try {
    report = JSON.parse(e.stdout || '[]');
  } catch {
    bad++;
    console.error('  ✗ 渲染失败：', (e.stdout || e.message).slice(0, 400));
  }
}
const frames = report.flatMap((r) => r.frames || []);
ok(frames.length >= 45, `渲染出 ${frames.length} 帧`);
let issues = 0;
for (const r of report) {
  for (const f of r.frames || []) {
    for (const x of f.issues) {
      issues++;
      console.error(`  ✗ ${path.basename(r.file)} #${f.id}: ${x.what}`);
    }
    if (f.metrics && f.metrics.fill > 100) {
      bad++;
      console.error(`  ✗ ${path.basename(r.file)} #${f.id} 占版心 ${f.metrics.fill}%，超出 100%`);
    }
  }
}
ok(issues === 0, '验收帧全部干净');
ok(report.every((r) => !r.errors || !r.errors.length), '没有控制台错误');

if (bad) {
  console.error(`\n${bad} 项失败`);
  process.exitCode = 1;
} else console.log('\n全部通过');

