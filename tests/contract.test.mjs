import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TAGS } from '../src/registry.mjs';

const registryAttrs = new Set();
for (const def of Object.values(TAGS)) for (const name of Object.keys(def.attrs || {})) registryAttrs.add(name);

const ALLOW = new Set(['style', 'class', 'id', 'hidden', 'open', 'slot', 'viewBox', 'date', 'lane', 'at']);
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

test('registry 的默认值都在枚举里（validate 的强化版）', () => {
  for (const [tag, def] of Object.entries(TAGS)) {
    for (const [name, spec] of Object.entries(def.attrs || {})) {
      if (spec.default !== undefined && spec.values) {
        assert.ok(spec.values.includes(spec.default), `${tag}.${name} 默认 ${spec.default} 不在枚举`);
      }
    }
  }
});
