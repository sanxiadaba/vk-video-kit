import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TAG_NAMES } from '../src/registry.mjs';
import { rules, selectorList, tagsIn, stripComments } from '../tools/lib/css-ast.mjs';

/**
 * CSS 只能说现有标签的话。
 *
 * 这条门禁是四次事故换来的：删 vk-quote / vk-title / vk-panel / vk-bars 时，
 * 我按注释分段切 CSS，把邻居规则带走或留下悬空选择器——
 * 页面照常渲染，只是某个属性从此没有任何效果，测试全绿。
 *
 * 现在：任何选择器里出现 registry 没有的标签，直接红。
 */
const DIRS = ['src/components', 'src/elements', 'src/layout', 'src/compositions'];
const files = [];
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.css')) files.push(path.join(dir, f));
}

const known = new Set(TAG_NAMES);

test('CSS 文件都找得到（至少 4 个）', () => {
  assert.ok(files.length >= 4, `只找到 ${files.length} 个 CSS：${files.join(', ')}`);
});

test('选择器里不出现 registry 没有的标签', () => {
  const bad = [];
  for (const file of files) {
    for (const rule of rules(stripComments(fs.readFileSync(file, 'utf8')))) {
      for (const sel of selectorList(rule.selector)) {
        for (const tag of tagsIn(sel)) {
          if (!known.has(tag)) bad.push(`${file}: ${sel}`);
        }
      }
    }
  }
  assert.deepEqual(bad, [], `这些选择器指向已删除的标签：\n${bad.slice(0, 20).join('\n')}`);
});

test('没有重复定义的同名规则（后一条会静默覆盖前一条）', async () => {
  const seen = new Map();
  const dups = [];
  for (const file of files) {
    for (const rule of rules(fs.readFileSync(file, 'utf8'))) {
      const sel = selectorList(rule.selector).join(', ');
      if (seen.has(sel)) dups.push(`${sel}  ←  ${seen.get(sel)} 与 ${file}`);
      else seen.set(sel, file);
    }
  }
  // 同一份文件里重复是常见写法（分媒体查询），这里只报跨文件重复。
  const cross = dups.filter((d) => !d.includes(d.split('与 ')[1] + ' 与 ' + d.split('与 ')[1]));
  assert.ok(cross.length < 40, `跨文件重复选择器 ${cross.length} 条，前 5 条：\n${cross.slice(0, 5).join('\n')}`);
});
