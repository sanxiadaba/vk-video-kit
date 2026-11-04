import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'parse5';
import { TAG_NAMES } from '../src/registry.mjs';

/**
 * 标本页的第二个门：一页只有「1 个主镜头 + ≤3 状态」。
 *
 * 状态带是补"换一档会变成什么"，不是属性表。属性表在 docs/reference.md，
 * 由 registry 生成；标本页再铺 7 档只会把首屏的注意力打散。
 */

const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value || '';
const classOf = (node) => attr(node, 'class').split(/\s+/).filter(Boolean);
const elementChildren = (node) => (node.childNodes || []).filter((n) => n.tagName);

function find(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const child of node.childNodes || []) find(child, pred, out);
  return out;
}

test('每个组件标本页的状态带 ≤3 项', () => {
  const missing = fs.existsSync('_site/specimen') ? [] : ['_site/specimen（先运行 npm run build）'];
  assert.deepEqual(missing, []);
  const bad = [];
  for (const tag of TAG_NAMES) {
    const file = `_site/specimen/${tag}.html`;
    assert.ok(fs.existsSync(file), `缺少标本页 ${file}`);
    const root = parse(fs.readFileSync(file, 'utf8'));
    const strips = find(root, (n) => classOf(n).includes('state-strip'));
    if (!strips.length) {
      bad.push(`${tag}: 没有 .state-strip`);
      continue;
    }
    if (strips.length > 1) bad.push(`${tag}: 有 ${strips.length} 个 .state-strip`);
    const items = elementChildren(strips[0]);
    if (items.length > 3) {
      const names = items.map((n) => (classOf(n)[0] || n.tagName).slice(0, 24));
      bad.push(`${tag}: 状态 ${items.length} 项（${names.join(' / ')}）`);
    }
  }
  assert.deepEqual(bad, [], `状态带超过 3 项：\n${bad.join('\n')}`);
});
