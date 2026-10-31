import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 配方页不是文档，是可执行的样例。
 * 它们和组件一样过 `vk check`：字号、对比度、安全区、空帧、裁切，一条都不少。
 * 目的：删掉 title/stat/quote/figure 之后，"怎么写"这件事仍然有人替它把关，
 * 而不是三个月后在某个项目里漂移。
 *
 * 每一页都是 A/B 对照：左边配方，右边同一件事用原语硬写。
 */
const DIR = path.resolve('docs/recipes');
const pages = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.html'))
  .sort();

test('配方页至少五页（索引 + 四个 A/B）', () => {
  assert.ok(pages.length >= 5, `只有 ${pages.length} 页：${pages.join(', ')}`);
  assert.ok(pages.includes('index.html'), '缺索引页');
});

for (const page of pages) {
  test(`配方页 ${page} 必须干净（过 vk check）`, () => {
    const file = path.join(DIR, page);
    const r = spawnSync(process.execPath, [path.resolve('bin/vk.mjs'), 'check', file], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${page} 有问题：\n${r.stdout}\n${r.stderr}`);
  });
}

test('每一页 A/B 都两种写法齐全（配方 + 原语）', () => {
  for (const page of pages.filter((p) => p !== 'index.html')) {
    const html = fs.readFileSync(path.join(DIR, page), 'utf8');
    assert.match(html, /r-slab[^>]*>配方</, `${page} 缺"配方"一栏`);
    assert.match(html, /r-slab[^>]*>原语手写</, `${page} 缺"原语手写"一栏`);
  }
});
