import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LINE,
  buildRows,
  dedent,
  expandLeadingTabs,
  hash32,
  hasAnsi,
  lineSet,
  parseDiffItems,
  sliceLines,
  stripAnsi,
  tokenDiff,
} from '../src/shared/code.mjs';
import { formatNumber } from '../src/shared/format.mjs';

test('stripAnsi：剥掉颜色/光标/OSC 控制符，文本原样保留', () => {
  assert.equal(stripAnsi('\u001b[31mred\u001b[0m'), 'red');
  assert.equal(stripAnsi('\u001b[2J\u001b[Hclear'), 'clear');
  assert.equal(stripAnsi('\u001b]0;title\u0007body'), 'body');
  assert.equal(stripAnsi('plain'), 'plain');
  assert.equal(hasAnsi('\u001b[31mred'), true);
  assert.equal(hasAnsi('plain'), false);
});

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

test('diff：正文以 -- / index 开头时不能被当成表头吃掉', () => {
  // 删掉的一行以 "-- " 开头 → 源码里就是 "--- ..."，和表头长得一样。
  const rows = buildRows(parseDiffItems('--- a/q.sql\n+++ b/q.sql\n@@ -1,2 +1,2 @@\n select 1;\n--- 这行是注释\n+-- 新的注释\n'));
  const texts = rows.flatMap((r) => [r.left?.text, r.right?.text]).filter((t) => t != null);
  assert.ok(texts.includes('-- 这行是注释'), `删除的注释行被吞了：${texts.join(' | ')}`);
  assert.ok(texts.includes('-- 新的注释'));
  assert.ok(!texts.some((t) => t === 'q.sql'), '表头不该进正文');

  // 手写行段里的 "index = 0" 不是 git 的 index 表头。
  const items = parseDiffItems('index = 0\n+index = 1');
  assert.deepEqual(
    items.map((i) => `${i.sign}|${i.text}`),
    ['|index = 0', '+|index = 1']
  );
});

test('diff：真正的 git 表头仍然被跳过', () => {
  const items = parseDiffItems(
    'diff --git a/f.c b/f.c\nindex 3f9a2b1..8c4d5e6 100644\n--- a/f.c\n+++ b/f.c\n@@ -1 +1 @@\n-a\n+b'
  );
  assert.deepEqual(
    items.map((i) => `${i.sign}|${i.text}`),
    ['-|a', '+|b']
  );
  assert.equal(items[0].oldStart, 1);
  assert.equal(items[0].newStart, 1);
});

test('formatNumber：只重排开头的数字，正文与单位原样保留', () => {
  assert.equal(formatNumber('不是数字', 'thousands'), '不是数字');
  assert.equal(formatNumber('52980', 'thousands'), '52,980');
  assert.equal(formatNumber('52980 字节', 'thousands'), '52,980 字节');
  assert.equal(formatNumber('-1234', 'thousands'), '-1,234');
  assert.equal(formatNumber('255', 'hex'), '0xFF');
  assert.equal(formatNumber('x', 'none'), 'x');
});


test('tokenDiff 把 <= 与 < 当成整体', () => {
  const [a, b] = tokenDiff('i <= 3', 'i < 3');
  assert.ok(a.some(([s, e]) => 'i <= 3'.slice(s, e).includes('<=')));
  assert.ok(b.some(([s, e]) => 'i < 3'.slice(s, e) === '<'));
});
