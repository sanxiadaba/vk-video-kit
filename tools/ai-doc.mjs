/**
 * 生成 docs/ai.md 的「组件速查」块。
 *
 *   node tools/ai-doc.mjs          写入
 *   node tools/ai-doc.mjs --check  只校验（verify 用）
 *
 * 只改两个标记之间的内容：正文是手写的，生成块只负责“每标签一行”。
 * 例子取 SCENES 的开标签 —— 那里被门禁和契约验证过，不会写出不存在的属性。
 */
import fs from 'node:fs';
import path from 'node:path';
import { TAGS, LAYERS, byLayer } from '../src/registry.mjs';
import { SCENES } from '../src/scenes/scenes.mjs';

const START = '<!-- vk:tags:start -->';
const END = '<!-- vk:tags:end -->';
const file = path.join('docs', 'ai.md');
const check = process.argv.includes('--check');

const sceneOf = new Map(SCENES.map((s) => [s.tag, s.body]));
const openTag = (tag) => {
  const body = sceneOf.get(tag) || '';
  const m = body.match(new RegExp(`<${tag}\\b[^>]*>`));
  return m ? m[0] : `<${tag}>`;
};

const lines = [];
for (const layer of LAYERS) {
  const tags = byLayer(layer.id);
  if (!tags.length) continue;
  lines.push(`### ${layer.label} · ${layer.note}`);
  lines.push('');
  for (const tag of tags) {
    const def = TAGS[tag];
    const attrs = Object.keys(def.attrs || {});
    lines.push(`- **\`${tag}\`** · ${def.name} — ${def.summary}`);
    lines.push(`  - 属性：${attrs.length ? attrs.map((a) => `\`${a}\``).join(' · ') : '（无）'}`);
    lines.push(`  - 例：\`${openTag(tag)}\``);
  }
  lines.push('');
}
const block = lines.join('\n').trimEnd();

let doc;
try {
  doc = fs.readFileSync(file, 'utf8');
} catch {
  console.error(`✗ ${file} 不存在：ai.md 是手写正文 + 生成块，先建文件再跑这个。`);
  process.exitCode = 1;
  process.exit();
}

const a = doc.indexOf(START);
const b = doc.indexOf(END);
if (a < 0 || b < a) {
  console.error(`✗ ${file} 缺少 ${START} / ${END} 标记。`);
  process.exitCode = 1;
  process.exit();
}

const next = `${doc.slice(0, a + START.length)}\n${block}\n${doc.slice(b)}`;
if (next === doc) {
  console.log(`ai-doc: ${file} 已是最新（${block.split('\n').length} 行）`);
} else if (check) {
  console.error(`✗ ${file} 的组件速查已过期（registry 或 scenes 变了）。运行 node tools/ai-doc.mjs`);
  process.exitCode = 1;
} else {
  fs.writeFileSync(file, next);
  console.log(`ai-doc: ${file} 已更新`);
}
