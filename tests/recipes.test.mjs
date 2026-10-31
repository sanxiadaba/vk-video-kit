import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * 配方页不是文档，是可执行的样例。
 * 它们和组件一样过 `vk check`：字号、对比度、安全区、空帧、裁切，一条都不少。
 * 目的：删掉 title/stat/quote/figure 之后，"怎么写"这件事仍然有人替它把关，
 * 而不是三个月后在某个项目里漂移。
 */
test('配方页必须干净（过 vk check）', () => {
  const file = path.resolve('docs/recipes/index.html');
  const r = spawnSync(process.execPath, [path.resolve('bin/vk.mjs'), 'check', file], { encoding: 'utf8' });
  assert.equal(r.status, 0, `配方页有问题：\n${r.stdout}\n${r.stderr}`);
});
