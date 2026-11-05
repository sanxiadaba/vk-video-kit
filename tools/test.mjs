/**
 * 测试。
 *
 *   npm test          schema + 构建 30 张样张（不启浏览器）
 *   npm test -- --full 再加：逐页自检 + 640 宽截图回归
 *   npm test -- --update  重写截图基线
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TAGS, TAG_NAMES, LAYERS, COMMON, CANVAS, LAYOUT_ATTRS, CHILD_ATTRS, CHILDREN, STATES } from '../src/schema.mjs';
import { SAMPLES, fixturePage } from './samples.mjs';
import { publish } from './lib/publish.mjs';

const full = process.argv.includes('--full');
const update = process.argv.includes('--update');
let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

/* ---------------------------------------------------------------- schema */
console.log('schema');
ok(TAG_NAMES.length === 30, `30 个标签（${TAG_NAMES.length}）`);
ok(new Set(TAG_NAMES).size === TAG_NAMES.length, '标签名唯一');
const layerIds = new Set(LAYERS.map((l) => l.id));
for (const tag of TAG_NAMES) {
  if (!tag.startsWith('vk-')) ok(false, `${tag} 以 vk- 开头`);
  if (!layerIds.has(TAGS[tag].layer)) ok(false, `${tag} 的 layer 合法`);
  for (const [name, spec] of Object.entries(TAGS[tag].attrs)) {
    if (!spec.values && !spec.type) ok(false, `${tag}/${name} 有 type 或 values`);
    if (spec.values && spec.default !== undefined && !spec.values.includes(spec.default))
      ok(false, `${tag}/${name} 的默认值在词表里`);
    if (spec.values && new Set(spec.values).size !== spec.values.length) ok(false, `${tag}/${name} 的取值不重复`);
  }
}
for (const k of Object.keys(CHILD_ATTRS)) ok(!!TAGS[k], `CHILD_ATTRS 的父标签 ${k} 存在`);
for (const k of Object.keys(CHILDREN)) ok(!!TAGS[k], `CHILDREN 的父标签 ${k} 存在`);
for (const k of Object.keys(STATES)) ok(!!TAGS[k], `STATES 的父标签 ${k} 存在`);
ok(Object.keys(COMMON).every((k) => LAYOUT_ATTRS.has(k)), 'LAYOUT_ATTRS = COMMON');
ok(Object.keys(CANVAS).length === 5, '画布协议 5 个（x/y/w/h/z）');

/* 每个公开取值都必须被某处消费：CSS 或运行期。 */
const haystack = [];
const walk = (d) => {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(css|mjs)$/.test(p) && !p.includes('icons.generated')) haystack.push(fs.readFileSync(p, 'utf8'));
  }
};
walk('src');
const text = haystack.join('\n');
let unused = 0;
for (const tag of TAG_NAMES) {
  for (const [name, spec] of Object.entries(TAGS[tag].attrs)) {
    if (!spec.values || spec.values.length < 3) continue;
    for (const v of spec.values) {
      if (v === 'none' || v === 'auto' || v === '') continue;
      if (!text.includes(`'${v}'`) && !text.includes(`=${v}`) && !text.includes(`"${v}"`)) {
        unused++;
        if (unused <= 12) console.error(`  · ${tag}/${name} 的取值 ${v} 没有消费者`);
      }
    }
  }
}
ok(unused === 0, `枚举取值都有消费者（${unused} 个没有）`);

/* ---------------------------------------------------------------- 样张 */
console.log('\nfixtures');
for (const tag of Object.keys(SAMPLES)) {
  const file = path.join('tests/pages', `${tag}.html`);
  fs.mkdirSync('tests/pages', { recursive: true });
  fs.writeFileSync(file, fixturePage(tag));
}
ok(Object.keys(SAMPLES).length === TAG_NAMES.length, `30 张样张（${Object.keys(SAMPLES).length}）`);
try {
  execFileSync(process.execPath, ['bin/vk.mjs', 'build', 'tests/pages'], { stdio: 'pipe' });
  ok(true, '30 张样张构建通过');
} catch (e) {
  ok(false, '样张构建失败');
  console.error(e.stdout?.toString() || e.message);
}

/* ------------------------------------------------------------ 自检 / 回归 */
if (full) {
  publish();
  const tags = TAG_NAMES;
  const shotArgs = ['bin/vk.mjs', 'shot'];
  for (const tag of tags) shotArgs.push(`tests/pages/${tag}.html`);
  shotArgs.push('--out-dir', 'out/golden', '--width', '640', '--json');

  let report = [];
  try {
    report = JSON.parse(execFileSync(process.execPath, shotArgs, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  } catch (e) {
    try {
      report = JSON.parse(e.stdout);
    } catch {
      ok(false, '批量截图失败');
      console.error(e.stdout || e.message);
    }
  }

  console.log('\naudit');
  const dirty = report.filter((r) => r.errors.length || r.issues.length || r.special.length);
  for (const r of dirty) {
    ok(false, `${path.basename(r.page)} 有 error`);
    for (const x of [...r.errors, ...r.issues, ...r.special]) console.error(`    · ${x.what || x.type || x}`);
  }
  ok(report.length === tags.length && !dirty.length, `30 页自检干净（${report.length} 页）`);

  console.log('\ngolden');
  const { PNG } = await import('pngjs');
  const dir = 'tests/golden';
  fs.mkdirSync(dir, { recursive: true });
  let diff = 0;
  for (const r of report) {
    const tag = path.basename(r.page, '.html');
    if (!r.png) {
      ok(false, `${tag} 没有出图`);
      continue;
    }
    const base = path.join(dir, `${tag}.png`);
    if (update || !fs.existsSync(base)) {
      fs.copyFileSync(r.png, base);
      continue;
    }
    const a = PNG.sync.read(fs.readFileSync(base));
    const b = PNG.sync.read(fs.readFileSync(r.png));
    if (a.width !== b.width || a.height !== b.height) {
      ok(false, `${tag} 尺寸变了 ${a.width}×${a.height} → ${b.width}×${b.height}`);
      continue;
    }
    let bad = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      if (Math.abs(a.data[i] - b.data[i]) > 8 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 8 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 8) bad++;
    }
    const ratio = bad / (a.width * a.height);
    if (ratio > 0.002) {
      diff++;
      ok(false, `${tag} 像素差 ${(ratio * 100).toFixed(2)}%`);
    }
  }
  ok(diff === 0, '30 张截图回归一致');
}

if (failures) {
  console.error(`\n${failures} 项失败`);
  process.exitCode = 1;
} else console.log('\n全部通过');
