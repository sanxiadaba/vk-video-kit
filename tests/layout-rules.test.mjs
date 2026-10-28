import test from 'node:test';
import assert from 'node:assert/strict';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';

/* 布局语言的守门人：分份（cols/rows/span）与后门（w/h/style）。
   这些规则是"锁词汇"的地基——它们一旦静默失效，AI 会立刻走回像素。 */

const hl = await createVkHighlighter(['c']);
const file = 'page.html';

test('span：父级是 vk-grid 时合法', async () => {
  const out = await transformHtml('<vk-grid cols="3"><vk-text span="2">宽</vk-text><vk-text>x</vk-text></vk-grid>', {
    file,
    highlighter: hl,
  });
  assert.ok(out.html.includes('span="2"'));
});

test('span：父级不是 vk-grid 时报错，并说明份数从哪来', async () => {
  await assert.rejects(
    () => transformHtml('<vk-stack><vk-text span="2">宽</vk-text></vk-stack>', { file, highlighter: hl }),
    /span 放错了地方[\s\S]*应该写[\s\S]*vk-grid/
  );
});

test('row-span：和 span 同一条语境规则，跨行也只在 vk-grid 里成立', async () => {
  const ok = await transformHtml(
    '<vk-grid cols="2" rows="2"><vk-code lang="c" row-span="2">int x;</vk-code><vk-text>旁注</vk-text></vk-grid>',
    { file, highlighter: hl }
  );
  assert.ok(ok.html.includes('row-span="2"'));
  await assert.rejects(
    () => transformHtml('<vk-stack><vk-code lang="c" row-span="2">int x;</vk-code></vk-stack>', { file, highlighter: hl }),
    /row-span 放错了地方[\s\S]*跨行/
  );
});

test('w/h：坐标空间之外一律报错', async () => {
  await assert.rejects(
    () => transformHtml('<vk-stack><vk-code w="900" lang="c">int x;</vk-code></vk-stack>', { file, highlighter: hl }),
    /w\/h 是像素摆位[\s\S]*span="2"/
  );
});

test('w/h：vk-canvas 的子节点合法（坐标空间）', async () => {
  const out = await transformHtml('<vk-canvas w="600" h="300"><vk-box x="0" y="0" w="200" h="100"></vk-box></vk-canvas>', {
    file,
    highlighter: hl,
  });
  assert.ok(out.html.includes('x="0"'));
});

test('style：不再是全局属性，写了就是未知属性', async () => {
  await assert.rejects(
    () => transformHtml('<vk-text style="color:red">红</vk-text>', { file, highlighter: hl }),
    /未知属性 style/
  );
});

test('omit：vk-code 的字符区间改名后仍校验格式', async () => {
  const ok = await transformHtml('<vk-code lang="c" omit="1:0-2">int x;</vk-code>', { file, highlighter: hl });
  assert.ok(ok.html.includes('data-vk-hl'));
  await assert.rejects(
    () => transformHtml('<vk-code lang="c" omit="1:5-2">int x;</vk-code>', { file, highlighter: hl }),
    /omit="1:5-2" 不是 行:起-止/
  );
});

test('rows：只收 1–6', async () => {
  await assert.rejects(
    () => transformHtml('<vk-grid rows="7"><vk-text>x</vk-text></vk-grid>', { file, highlighter: hl }),
    /rows 不在词表里/
  );
});
