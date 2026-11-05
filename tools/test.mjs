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
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import * as parse5 from 'parse5';
import { TAGS, TAG_NAMES, attrsOf } from '../src/schema.mjs';
import { FONT, GAP, TONE, SURFACE, STATE, INK } from '../src/vocab.mjs';
import { parseAsm } from '../src/shared/asm.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

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

/* 词表本身就是取值来源：schema 里出现的枚举必须来自 vocab（可以是子集，不能自创）。 */
const VOCAB_BY_ATTR = { tone: TONE, surface: SURFACE, state: STATE, ink: INK, size: Object.keys(FONT), gap: Object.keys(GAP) };
for (const tag of TAG_NAMES) {
  for (const [name, spec] of Object.entries(attrsOf(tag))) {
    const pool = VOCAB_BY_ATTR[name];
    if (!pool || !spec.values) continue;
    const stray = spec.values.filter((v) => !pool.includes(v));
    if (stray.length) {
      bad++;
      console.error(`  ✗ ${tag}/${name} 有词表外的取值：${stray.join(' / ')}`);
    }
  }
}
ok(Object.values(VOCAB_BY_ATTR).flat().length > 20, '词表已加载');

/* 同一选择器在两个 CSS 文件里写同一属性 = 后加载的静默覆盖前者，改一处另一处就变成谎。
   （上一轮"层不会叠"的误判，就是因为没先看清规则写在哪个文件。） */
{
  const files = ['base.css', 'layout.css', 'components.css', 'callout.css'];
  const map = new Map();
  for (const f of files) {
    const css = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1].trim().replace(/\s+/g, ' ');
      if (!sel || sel.startsWith('@') || sel.includes('%')) continue;
      const decls = new Set(m[2].split(';').map((d) => d.split(':')[0].trim()).filter(Boolean));
      const cur = map.get(sel) || [];
      cur.push({ f, decls });
      map.set(sel, cur);
    }
  }
  const clashes = [];
  for (const [sel, list] of map) {
    if (list.length < 2) continue;
    const owners = new Map();
    for (const { f, decls } of list) for (const d of decls) owners.set(d, (owners.get(d) || new Set()).add(f));
    for (const [prop, fs2] of owners) if (fs2.size > 1) clashes.push(`${sel} { ${prop} } → ${[...fs2].join(' / ')}`);
  }
  ok(map.size > 200 && !clashes.length, '样式规则没有跨文件冲突');

  /* 声明了却没实现：样式和运行时都不读它。 */
  {
    const cssText = files.map((f) => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
    const rtText =
      fs.readdirSync(path.join(ROOT, 'src', 'runtime')).map((f) => fs.readFileSync(path.join(ROOT, 'src', 'runtime', f), 'utf8')).join('\n') +
      fs.readFileSync(path.join(ROOT, 'src', 'build.mjs'), 'utf8');
    const quotes = [39, 34, 96].map((c) => String.fromCharCode(c));
    const ghosts = [];
    for (const tag of TAG_NAMES) {
      for (const name of Object.keys(attrsOf(tag))) {
        if (['span', 'row-span', 'grow', 'bleed', 'id', 'class'].includes(name)) continue;
        const inCss = cssText.includes(tag + '[' + name) || cssText.includes('[' + name + '=') || cssText.includes('[' + name + ']');
        const inRt = quotes.some((c) => rtText.includes(c + name + c));
        if (!inCss && !inRt) ghosts.push(tag + "." + name);
      }
    }
    ok(!ghosts.length, '每个属性都有实现');
    for (const g of ghosts.slice(0, 6)) console.error('    · ' + g + ' 没有样式也没有运行时读取');
  }

  /* 同一个文件里把同一选择器的同一属性写两遍：后一处静默覆盖前一处。 */
  const twice = [];
  for (const f of files) {
    const css = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const seen = new Map();
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1].trim().replace(/\s+/g, ' ');
      if (!sel || sel.startsWith('@')) continue;
      for (const d of m[2].split(';').map((x) => x.split(':')[0].trim()).filter(Boolean)) {
        const key = sel + '|' + d;
        if (seen.has(key)) twice.push(`${f}: ${sel} { ${d} }`);
        seen.set(key, true);
      }
    }
  }
  ok(!twice.length, '同一文件里没有重复声明');

  /* 死样式：CSS 里定义了、但没有任何一帧或运行时产出这个类名。 */
  {
    const cssText = files.map((f) => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
    const names = new Set();
    for (const m of cssText.matchAll(/\.([a-zA-Z][\w-]*)/g)) names.add(m[1]);
    const runtime = fs
      .readdirSync(path.join(ROOT, 'src', 'runtime'))
      .map((f) => fs.readFileSync(path.join(ROOT, 'src', 'runtime', f), 'utf8'))
      .join('\n') + fs.readFileSync(path.join(ROOT, 'src', 'build.mjs'), 'utf8');
    const seen = new Set();
    const walkDir = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walkDir(full);
        else if (e.name.endsWith('.html')) for (const m of fs.readFileSync(full, 'utf8').matchAll(/[\w-]+/g)) seen.add(m[0]);
      }
    };
    for (const d of ['out', 'episodes', 'tests']) if (fs.existsSync(path.join(ROOT, d))) walkDir(path.join(ROOT, d));
    const dead = [...names].filter((c) => !seen.has(c) && !runtime.includes(c));
    ok(names.size > 80 && !dead.length, '没有写了却没人用的类');
    for (const d of dead.slice(0, 6)) console.error('    · .' + d + ' 没有任何一帧用到');
  }
  for (const t2 of twice.slice(0, 5)) console.error('    · ' + t2);
  for (const c of clashes.slice(0, 5)) console.error('    · ' + c);
}

  /* 文档漂移：CLI 上的每条命令、每个开关都得在 SPEC 里出现，否则作者看不到。 */
  {
    const bin = fs.readFileSync(path.join(ROOT, 'bin', 'vk.mjs'), 'utf8');
    const spec = fs.readFileSync(path.join(ROOT, 'SPEC.md'), 'utf8');
    const cmds = [...new Set([...bin.matchAll(/cmd === '([a-z]+)'/g)].map((m) => m[1]))];
    const flags = [...new Set([...bin.matchAll(/'(--[a-z]+)'/g)].map((m) => m[1]))].filter((f) => ['--phone', '--json', '--out', '--width', '--shot', '--cols'].includes(f));
    ok(cmds.length >= 6 && flags.length >= 4, 'CLI 解析出 ' + cmds.length + ' 条命令、' + flags.length + ' 个开关');
    const missCmd = cmds.filter((c) => !spec.includes('vk ' + c));
    const missFlag = flags.filter((f) => !spec.includes(f));
    ok(!missCmd.length && !missFlag.length, 'SPEC 与 CLI 一致');
    for (const c of missCmd) console.error('    · 命令没写进 SPEC：vk ' + c);
    for (const f of missFlag) console.error('    · 开关没写进 SPEC：' + f);
  }

  /* 调色板一致性：语义色有纸面原值，就必须有深色页覆盖，否则深色页上它会"暗下去"。 */
  {
    // 读源码而不是构建产物：这条检查在渲染之前跑，构建产物可能还是上一版。
    const css = ['base.css', 'components.css', 'callout.css'].map((f) => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
    const semantics = ['info', 'ok', 'warn', 'err', 'focus'];
    const tints = ['info', 'focus', 'ok', 'warn', 'err'];
    const missing = [];
    for (const k of semantics) {
      if (!css.includes(`--vk-${k}-paper:`)) missing.push(`--vk-${k}-paper 没定义`);
      if (!new RegExp(`--vk-${k}: var\\(--vk-dark|color-mix`).test(css)) missing.push(`--vk-${k} 没有深色版`);
    }
    for (const k of tints) {
      if (!css.includes(`--vk-tint-${k}-paper:`)) missing.push(`--vk-tint-${k}-paper 没定义`);
    }
    ok(!missing.length, '深色页的调色板是成套的');
    for (const m of missing) console.error('    · ' + m);
  }

  /* 汇编解析：没有机器码的输入（--no-show-raw-insn / 手写 .s）不能崩。 */
  {
    const noBytes = parseAsm('0: push %rbp\n1: mov %esp,%ebp\n');
    ok(noBytes.rows.filter((r) => r.kind === 'insn').length === 2 && noBytes.rows[0].bytes === '', '汇编行没有机器码也能解析');
    const withBytes = parseAsm('401136: 55            push   %rbp\n');
    ok(withBytes.rows[0].bytes === '55' && withBytes.rows[0].addr === '401136', '带机器码的 objdump 行照旧');
  }

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

/* ---------------------------------------------------------------- 覆盖 */
console.log('\n覆盖');
{
  const COMMON = new Set(['span', 'row-span', 'grow', 'bleed', 'state']);
  const seen = new Set();
  const seenTags = new Set();
  const files = [];
  for (const dir of ['episodes', 'tests/acceptance', 'tests']) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.html')) files.push(path.join(dir, f));
  }
  for (const f of files) {
    const doc = parse5.parse(fs.readFileSync(f, 'utf8'));
    const walk = (n) => {
      if (n.tagName?.startsWith('vk-')) {
        seenTags.add(n.tagName);
        for (const a of n.attrs || []) {
          seen.add(n.tagName + '.' + a.name);
          seen.add(n.tagName + '.' + a.name + '=' + a.value);
        }
      }
      for (const c of n.childNodes || []) walk(c);
      if (n.content) walk(n.content);
    };
    walk(doc);
  }
  const cold = [];
  for (const tag of TAG_NAMES) {
    for (const name of Object.keys(attrsOf(tag))) {
      if (COMMON.has(name)) continue;
      if (!seen.has(tag + '.' + name)) cold.push(tag + '.' + name);
    }
  }
  ok(!cold.length, '每个属性都被真帧用过（没被用过的功能几乎都是坏的）');

  /* SPEC「配方」里的每一段都要和 tests/recipes.html 逐字一致：抄错了例子比没有例子更糟。 */
  {
    const spec = fs.readFileSync(path.join(ROOT, 'SPEC.md'), 'utf8').replace(/\r/g, '');
    const sec = spec.slice(spec.indexOf('## 7.5 配方'), spec.indexOf('## 8 内容从哪来'));
    const blocks = [...sec.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
    const page = fs.readFileSync(path.join(ROOT, 'tests', 'recipes.html'), 'utf8').replace(/\s+/g, ' ').trim();
    const off = blocks.filter((b) => !page.includes(b));
    ok(blocks.length >= 5 && !off.length, 'SPEC 的配方与 recipes.html 一致');
    for (const b of off.slice(0, 3)) console.error('    · 对不上：' + b.slice(0, 60));
  }

  /* SPEC §7 的属性表要等于 schema：多写一个（作者写了会报错）和少写一个（作者不知道）都是漂移。 */
  {
    const spec = fs.readFileSync(path.join(ROOT, 'SPEC.md'), 'utf8').replace(/\\\|/g, '¦');
    const rows = [...spec.matchAll(/^\| `(vk-[a-z]+)`[^|]*\|[^|]*\|([^|]*)\|/gm)];
    const listed = new Map();
    for (const [, tag, cell] of rows) {
      const set = listed.get(tag) || new Set();
      for (const m of cell.matchAll(/`([a-z-]+)`/g)) set.add(m[1]);
      listed.set(tag, set);
    }
    ok(listed.size >= 25, 'SPEC 的属性表解析出 ' + listed.size + ' 个件');
    const COMMON_ATTRS = ['span', 'row-span', 'grow', 'bleed'];
    const drift = [];
    for (const tag of TAG_NAMES) {
      const have = listed.get(tag);
      if (!have) {
        drift.push(`${tag} 在 SPEC 的表里没有行`);
        continue;
      }
      const want = Object.keys(attrsOf(tag)).filter((a) => !COMMON_ATTRS.includes(a));
      for (const a of want) if (!have.has(a)) drift.push(`SPEC 缺 ${tag}.${a}`);
      for (const a of have) if (!want.includes(a)) drift.push(`SPEC 多写了 ${tag}.${a}（schema 里没有）`);
    }
    ok(!drift.length, 'SPEC 的属性表与 schema 一致');
    for (const d of drift.slice(0, 8)) console.error('    · ' + d);
  }

  /* 帧计数写错（插帧后忘了重排）：构建期要报。 */
  {
    const probe = path.join(os.tmpdir(), 'vk-count-' + Date.now() + '.html');
    fs.writeFileSync(
      probe,
      '<vk-page id="a"><vk-label counter="1 / 3">一</vk-label></vk-page>\n<vk-page id="b"><vk-label counter="3 / 3">二</vk-label></vk-page>\n<vk-page id="c"><vk-label counter="3 / 3">三</vk-label></vk-page>\n'
    );
    let caught = '';
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'bin/vk.mjs'), 'check', probe, '--json'], { stdio: 'pipe' });
    } catch (e) {
      caught = String(e.stdout || '') + String(e.stderr || '');
    }
    fs.rmSync(probe, { force: true });
    ok(caught.includes('帧的计数'), '帧计数写错会在构建期报错');
  }

  /* 重名 id 会静默覆盖出图、也会让锚点只指到第一个：构建期必须红。 */
  {
    const probe = path.join(os.tmpdir(), 'vk-dup-' + Date.now() + '.html');
    fs.writeFileSync(probe, '<vk-page id="same"><vk-text size="body">a</vk-text></vk-page>\n<vk-page id="same"><vk-text size="body">b</vk-text></vk-page>\n');
    let caught = '';
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'bin/vk.mjs'), 'render', probe, '--json'], { stdio: 'pipe' });
    } catch (e) {
      caught = String(e.stdout || '') + String(e.stderr || '');
    }
    fs.rmSync(probe, { force: true });
    ok(caught.includes('重复'), '重名 id 会在构建期报错');
  }
  // 非默认取值：写成默认值没意义，但"非默认的取值"必须有人写过——否则那个取值没人验过。
  const COMMON_ATTRS = new Set(['span', 'row-span', 'grow', 'bleed', 'state']);
  const coldVals = [];
  for (const tag of TAG_NAMES) {
    for (const [name, spec] of Object.entries(attrsOf(tag))) {
      if (COMMON_ATTRS.has(name) || !spec.values) continue;
      for (const v of spec.values) {
        if (v === spec.default) continue;
        if (!seen.has(`${tag}.${name}=${v}`)) coldVals.push(`${tag}.${name}=${v}`);
      }
    }
  }
  ok(!coldVals.length, '每个非默认取值都被真帧用过');
  for (const v of coldVals) console.error(`    · ${v} —— 写一帧用它，或把它从词表里删掉`);

  const coldTags = TAG_NAMES.filter((t) => !seenTags.has(t));
  ok(!coldTags.length, '每个件都被真帧用过');
  for (const c of coldTags) console.error(`    · ${c} —— 加一帧用它，否则它只是存在`);
  for (const c of cold) console.error(`    · ${c} —— 在 tests/capabilities*.html 里加一帧，或把它删掉`);
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

/* 录进分镜的程序输出不能和程序对不上：跑一遍，比文本。 */
try {
  const run = execFileSync(path.join(ROOT, 'code', 'read', 'pow2.exe'), { encoding: 'utf8' });
  const saved = fs.readFileSync(path.join(ROOT, 'code', 'read', 'run.txt'), 'utf8');
  ok(run.replace(/\r/g, '') === saved.replace(/\r/g, ''), 'code/read/run.txt 和程序实际输出一致');
} catch (e) {
  bad++;
  console.error('  ✗ 跑不动 code/read/pow2.exe：' + String(e.message).slice(0, 100));
}

/* ---------------------------------------------------------------- 渲染 */
console.log('\n自动适配');
{
  /* 库承诺的"自己会变好"：代码窗缩字号、步骤条竖排、数字列右对齐、注释不压内容。
     这些都是行为，不是属性，只能真跑一遍量。 */
  const { chromium: pw } = await import('playwright');
  const b = await pw.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file:///' + path.join(ROOT, 'out', 'tests', 'behaviour.html').split(path.sep).join('/'));
  await page.evaluate(() => window.vk.ready());
  const r = await page.evaluate(() => {
    const stages = [...document.querySelectorAll('.vk-stage')];
    const q = (i, sel) => stages[i]?.querySelector(sel);
    const box = (el) => (el ? el.getBoundingClientRect() : null);
    const overlap = (a, b) => !!a && !!b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
    const note = q(4, '.vk-callout-note');
    const target = q(4, 'vk-code');
    return {
      longFs: parseInt(getComputedStyle(q(0, '.vk-line')).fontSize),
      shortFs: parseInt(getComputedStyle(q(1, '.vk-line')).fontSize),
      stepsDir: q(2, 'vk-steps')?.dataset.direction,
      numAlign: getComputedStyle(q(3, 'tbody tr td:nth-child(2)')).textAlign,
      textAlign: getComputedStyle(q(3, 'tbody tr td:nth-child(1)')).textAlign,
      noteOverlaps: overlap(box(note), box(target)),
      // 层的高度要由图撑出来、说明要压在图上：图若用 bleed（不占高度），这条会挂。
      pairSplit: (() => {
        const l = box(q(6, '#pleft'));
        const r = box(q(6, '#pright'));
        return !!l && !!r && l.right <= r.left + 2 && Math.abs(l.width - r.width) < 4;
      })(),
    };
  });
  await b.close();
  ok(r.longFs < r.shortFs, `长代码行自动缩字号（${r.longFs}px < ${r.shortFs}px）`);
  ok(r.stepsDir === 'vertical', '窄容器里的步骤条自动竖排');
  ok(r.numAlign === 'right' && r.textAlign === 'left', '表格数字列右对齐、文字列不动');
  ok(!r.noteOverlaps, '注释不压在目标上');
  ok(r.pairSplit, '并置是两个等宽的并排块');
  /* 手写排版：等于开第二套字体系统，构建期要拦。 */
  {
    const probe = path.join(os.tmpdir(), 'vk-style-' + Date.now() + '.html');
    fs.writeFileSync(probe, '<vk-page id="x"><vk-text size="body" style="font-size: 20px">手写</vk-text></vk-page>');
    let caught = '';
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'bin/vk.mjs'), 'check', probe], { stdio: 'pipe' });
    } catch (e) {
      caught = String(e.stdout || '') + String(e.stderr || '');
    }
    fs.rmSync(probe, { force: true });
    ok(caught.includes('style 里写了'), '手写 font-size 会被拦下');
  }
}

console.log('\n验收帧');
let report = [];
try {
  const out = execFileSync(
    process.execPath,
    ['bin/vk.mjs', 'render', 'tests/acceptance', 'tests/sheet.html', 'tests/sheet2.html', 'tests/capabilities.html', 'tests/capabilities2.html', 'tests/capabilities3.html', 'tests/darks.html', 'tests/relations.html', 'tests/recipes.html', 'tests/behaviour.html', 'episodes', '--json'],
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
ok(frames.length >= 60, `渲染出 ${frames.length} 帧`);

/* README 里的预览图是仓库门面：内容与当前渲染对不上，它就在撒谎。 */
try {
  const tmp = path.join(ROOT, 'out', 'preview-check.png');
  execFileSync(process.execPath, ['bin/vk.mjs', 'sheet', 'episodes/09-memory.html', '--cols', '3', '--width', '560', '--out', tmp], {
    cwd: ROOT,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
  const { PNG } = await import('pngjs');
  const a = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'assets', 'preview.png')));
  const b = PNG.sync.read(fs.readFileSync(tmp));
  let diff = 0;
  if (a.width === b.width && a.height === b.height) {
    for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) diff++;
  } else diff = a.data.length;
  const ratio = diff / a.data.length;
  // 阈值来自实测：同一份内容重渲染抖动约 0.0005%，改一个字约 0.038%。
  const LIMIT = 0.0001;
  ok(ratio < LIMIT, 'README 的预览图与当前渲染一致');
  if (ratio >= LIMIT) console.error(`    · 预览图过期了（差异 ${(ratio * 100).toFixed(3)}%），跑 npm run preview`);
} catch (e) {
  bad++;
  console.error('  ✗ 预览图检查失败：' + String(e.message).slice(0, 120));
}

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

