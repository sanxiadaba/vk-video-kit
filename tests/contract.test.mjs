import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TAGS, CHILD_ATTRS } from '../src/registry.mjs';

const registryAttrs = new Set();
for (const def of Object.values(TAGS)) for (const name of Object.keys(def.attrs || {})) registryAttrs.add(name);
for (const list of Object.values(CHILD_ATTRS)) for (const name of list) registryAttrs.add(name);

// density 是 13.0 里的旧词：只在 base.mjs 的别名层读一次，registry 已经不声明它。
const ALLOW = new Set(['style', 'class', 'id', 'hidden', 'open', 'slot', 'viewBox', 'date', 'lane', 'at', 'text', 'bleed', 'density']);
const IGNORE = (name) => name.startsWith('data-') || name.startsWith('aria-') || ALLOW.has(name);

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.[a-z]+$/.test(f.name)) out.push(p);
  }
  return out;
}

test('运行时读取的属性都在 registry 里', () => {
  const bad = [];
  for (const file of walk('src/runtime')) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?:get|has|remove)Attribute\(\s*['"]([^'"]+)['"]/g)) {
      const name = m[1];
      if (!IGNORE(name) && !registryAttrs.has(name)) bad.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(bad, [], `未在 registry 声明的运行时属性：\n${bad.join('\n')}`);
});

test('CSS 选择器里的属性都在 registry 里', () => {
  const bad = [];
  for (const file of walk('src').filter((f) => f.endsWith('.css'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\[([a-zA-Z][\w-]*)(?:[\]=~|^$*]|\s*\])/g)) {
      const name = m[1];
      if (!IGNORE(name) && !registryAttrs.has(name) && name !== 'data-vk-motion') bad.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(bad, [], `未在 registry 声明的 CSS 属性：\n${bad.join('\n')}`);
});

test('CSS 里的 vk-tag[attr] 必须属于那个标签', () => {
  const bad = [];
  for (const file of walk('src').filter((f) => f.endsWith('.css'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?<![.\w-])(vk-[a-z0-9-]+)\[([a-zA-Z][\w-]*)/g)) {
      const [, tag, name] = m;
      if (!TAGS[tag]) {
        bad.push(`${file}: 选择器引用了不存在的 <${tag}>`);
        continue;
      }
      if (!TAGS[tag].attrs?.[name] && !IGNORE(name)) bad.push(`${file}: <${tag}> 没有属性 ${name}`);
    }
  }
  assert.deepEqual(bad, [], `标签写错属性：\n${bad.join('\n')}`);
});

test('registry 的默认值都在枚举里（validate 的强化版）', () => {
  for (const [tag, def] of Object.entries(TAGS)) {
    for (const [name, spec] of Object.entries(def.attrs || {})) {
      if (spec.default !== undefined && spec.values) {
        assert.ok(spec.values.includes(spec.default), `${tag}.${name} 默认 ${spec.default} 不在枚举`);
      }
    }
  }
});

test('build 只标在真正的构建期属性上', () => {
  // lang 也算构建期：词级高亮由 Shiki 在构建期编译，运行期改 lang 不会重新着色。
  const allowed = new Set(['src', 'lines', 'addr', 'offset', 'length', 'file', 'lang']);
  const bad = [];
  for (const [tag, def] of Object.entries(TAGS)) {
    for (const [name, spec] of Object.entries(def.attrs || {})) {
      if (spec.build && !allowed.has(name)) bad.push(`${tag}.${name}`);
    }
  }
  assert.deepEqual(bad, [], `可疑的构建期标记：${bad.join(', ')}`);
});


