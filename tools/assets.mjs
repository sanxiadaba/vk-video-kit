/**
 * 素材可追溯：code/ 里的 .s / .dis 都是从 .c 现编出来的。
 *
 *   npm run assets           重新生成（需要 gcc）
 *   npm run assets -- --check 只校验（不需要 gcc，进测试）
 *
 * 两道锁：
 *   1. .c 的哈希变了，但没重新生成 → "源改了"
 *   2. 生成物被手改了 → "输出被改过"
 * 汇编里的一条指令必须能追到一行 C，否则分镜就在讲假话。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const CODE = path.join(ROOT, 'code');
const MANIFEST = path.join(CODE, 'assets.json');

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);

/** 每个 .c 怎么变成 .s / .dis。加新素材就在这儿加一条。 */
const RECIPES = [
  {
    src: 'opt/sum.c',
    outputs: [
      { file: 'opt/o0.s', cmd: ['gcc', '-std=gnu99', '-S', '-O0', '-fno-asynchronous-unwind-tables', '-o', 'opt/o0.s', 'opt/sum.c'] },
      { file: 'opt/o2.s', cmd: ['gcc', '-std=gnu99', '-S', '-O2', '-fno-asynchronous-unwind-tables', '-o', 'opt/o2.s', 'opt/sum.c'] },
      { file: 'opt/o0.dis', dis: 'opt/o0.s', of: 'opt/o0.o', level: 'O0', objdump: true },
      { file: 'opt/add-o0.dis', sliceOf: 'opt/o0.dis', symbol: '_add' },
      { file: 'opt/o2.dis', dis: 'opt/o2.s', of: 'opt/o2.o', level: 'O2', objdump: true },
      { file: 'opt/add-o2.dis', sliceOf: 'opt/o2.dis', symbol: '_add' },
    ],
  },
  {
    src: 'pipe/main.c',
    outputs: [
      { file: 'pipe/main.i', cmd: ['gcc', '-std=gnu99', '-E', 'pipe/main.c', '-o', 'pipe/main.i'] },
      { file: 'pipe/main.s', cmd: ['gcc', '-std=gnu99', '-S', '-O0', 'pipe/main.c', '-o', 'pipe/main.s'] },
      { file: 'pipe/main.o', cmd: ['gcc', '-std=gnu99', '-c', 'pipe/main.s', '-o', 'pipe/main.o'] },
      { file: 'pipe/main.exe', cmd: ['gcc', 'pipe/main.o', '-o', 'pipe/main.exe'] },
    ],
  },
];

function walkC(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkC(p, out);
    else if (e.name.endsWith('.c')) out.push(path.relative(CODE, p).replace(/\\/g, '/'));
  }
  return out;
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  } catch {
    return {};
  }
}

function generate() {
  const manifest = {};
  for (const c of walkC(CODE)) {
    const recipe = RECIPES.find((r) => r.src === c);
    const entry = { src: c, srcHash: hash(path.join(CODE, c)), outputs: {}, needs: recipe ? recipe.outputs.map((o) => o.file) : [] };
    if (recipe) {
      for (const o of recipe.outputs) {
        if (o.objdump) {
          // 反汇编：先 -c 出 .o，再 objdump -d。
          try {
            execFileSync('gcc', ['-std=gnu99', '-c', '-' + o.level, '-o', o.of, c], { cwd: CODE, stdio: ['ignore', 'inherit', 'inherit'] });
            const dis = execFileSync('objdump', ['-d', o.of], { cwd: CODE, encoding: 'utf8' });
            fs.writeFileSync(path.join(CODE, o.file), dis);
            fs.rmSync(path.join(CODE, o.of), { force: true });
            entry.outputs[o.file] = hash(path.join(CODE, o.file));
          } catch (e) {
            console.warn(`· 跳过 ${o.file}：${e.message.split('\n')[0]}`);
          }
          continue;
        }
        if (o.sliceOf) {
          // 切片：从反汇编里只取一个符号的段落，别让它手抄。
          const text = fs.readFileSync(path.join(CODE, o.sliceOf), 'utf8').replace(/\r\n?/g, '\n');
          const lines = text.split('\n');
          const start = lines.findIndex((l) => l.includes(`<${o.symbol}>:`));
          if (start < 0) throw new Error(`${o.sliceOf} 里没有 <${o.symbol}>`);
          let end = start + 1;
          while (end < lines.length && lines[end].trim() !== '') end++;
          fs.writeFileSync(path.join(CODE, o.file), lines.slice(start, end).join('\n') + '\n');
          entry.outputs[o.file] = hash(path.join(CODE, o.file));
          continue;
        }
        execFileSync(o.cmd[0], o.cmd.slice(1), { cwd: CODE, stdio: ['ignore', 'inherit', 'inherit'] });
        entry.outputs[o.file] = hash(path.join(CODE, o.file));
      }
    }
    manifest[c] = entry;
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`已生成 ${Object.keys(manifest).length} 份素材清单 → code/assets.json`);
}

function check() {
  const manifest = load();
  const sources = walkC(CODE);
  const problems = [];

  for (const c of sources) {
    const entry = manifest[c];
    if (!entry) {
      problems.push(`code/${c} 还没登记：跑 npm run assets`);
      continue;
    }
    if (hash(path.join(CODE, c)) !== entry.srcHash) {
      problems.push(`code/${c} 改过了，但产物没重新生成：跑 npm run assets`);
      continue;
    }
    for (const [file, h] of Object.entries(entry.outputs)) {
      const abs = path.join(CODE, file);
      if (!fs.existsSync(abs)) {
        problems.push(`code/${file} 不见了：跑 npm run assets`);
      } else if (hash(abs) !== h) {
        problems.push(`code/${file} 被手改过：它必须由 ${c} 生成`);
      }
    }
  }

  for (const c of Object.keys(manifest)) {
    if (!sources.includes(c)) problems.push(`code/${c} 已删除，但清单里还在：跑 npm run assets`);
  }

  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
  console.log(`素材清单一致（${sources.length} 个源文件）`);
}

if (process.argv.includes('--check')) check();
else generate();
