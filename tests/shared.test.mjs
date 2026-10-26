import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LINE,
  buildRows,
  dedent,
  expandLeadingTabs,
  hash32,
  lineSet,
  parseDiffItems,
  sliceLines,
  tokenDiff,
} from '../src/shared/code.mjs';

test('dedent / tabs 与旧实现一致', () => {
  assert.equal(expandLeadingTabs('\tx'), '    x');
  assert.equal(expandLeadingTabs(' \tx'), '    x');
  assert.equal(dedent('\n    a\n      b\n'), 'a\n  b');
  assert.equal(dedent('a\r\nb'), 'a\nb');
});

test('hash32 稳定', () => {
  assert.equal(hash32('abc'), hash32('abc'));
  assert.notEqual(hash32('abc'), hash32('abd'));
  assert.match(hash32(''), /^[0-9a-f]+$/);
});

test('lineSet 有上限，恶意范围不会分配一亿项', () => {
  assert.deepEqual([...lineSet('4,6-8')], [4, 6, 7, 8]);
  const huge = lineSet(`1-${MAX_LINE * 1000}`);
  assert.equal(huge.size, MAX_LINE);
  assert.equal(lineSet('nope').size, 0);
});

test('sliceLines 夹紧越界，malformed 返回全文', () => {
  assert.equal(sliceLines('a\nb\nc\nd', '2-3'), 'b\nc');
  assert.equal(sliceLines('a\nb\nc', '2-99'), 'b\nc');
  assert.equal(sliceLines('a\nb\nc', '99-100'), '');
  assert.equal(sliceLines('a\nb', 'oops'), 'a\nb');
});

test('diff 行配对：上下文、替换、纯增删', () => {
  const rows = buildRows(parseDiffItems(' a\n-b\n+c\n d'));
  assert.equal(rows.length, 3);
  assert.equal(rows[0].ctx, true);
  assert.equal(rows[1].left.sign, '-');
  assert.equal(rows[1].right.sign, '+');
  assert.equal(rows[2].ctx, true);
});

test('tokenDiff 把 <= 与 < 当成整体', () => {
  const [a, b] = tokenDiff('i <= 3', 'i < 3');
  assert.ok(a.some(([s, e]) => 'i <= 3'.slice(s, e).includes('<=')));
  assert.ok(b.some(([s, e]) => 'i < 3'.slice(s, e) === '<'));
});
