import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluate, checkContract } from '../tools/capabilities.mjs';

/**
 * 能力矩阵的「记分板本身」也要有测试。
 *
 * 这里不重复三件套的内容，只锁两件事：
 *   1. 真实矩阵现在必须是全绿；
 *   2. 少任何一件（契约 / 标本 / 测试）都必须被 evaluate 判成红——
 *      否则「缺一件就报红」只是句口号。
 */

const real = JSON.parse(fs.readFileSync('docs/capabilities.json', 'utf8'));

test('能力矩阵：真实矩阵三件套齐全', () => {
  const results = evaluate(real);
  assert.ok(results.length >= 6, `矩阵至少 6 条能力，实际 ${results.length}`);
  const bad = results.filter((r) => !r.ok);
  assert.deepEqual(
    bad.map((r) => `${r.name}: ${r.issues.map((i) => i.message).join('；')}`),
    [],
    '能力矩阵有红条'
  );
  for (const r of results) {
    assert.ok(r.contracts.length, `${r.name} 没有契约断言`);
    assert.ok(r.tests.length, `${r.name} 没有测试`);
    assert.ok(r.specimen, `${r.name} 没有标本页`);
  }
});

test('能力矩阵：缺契约 / 缺标本 / 缺测试都会报红', () => {
  const baseTest = { file: 'tests/panel.test.mjs', name: 'vk-panel variant=plain：六种 tone 的底色' };

  const noContract = evaluate({
    capabilities: [{ id: 'x', name: '缺契约', contracts: ['vk-panel.nope'], specimen: 'vk-panel', tests: [baseTest] }],
  });
  assert.equal(noContract[0].ok, false, '不存在的契约断言必须判红');
  assert.ok(noContract[0].issues.some((i) => i.kind === 'contract'), '应该记一条 contract 缺件');

  const noSpecimen = evaluate({
    capabilities: [{ id: 'x', name: '缺标本', contracts: ['vk-panel.variant'], specimen: 'vk-nope', tests: [baseTest] }],
  });
  assert.equal(noSpecimen[0].ok, false, '不存在的标本页必须判红');
  assert.ok(noSpecimen[0].issues.some((i) => i.kind === 'specimen'), '应该记一条 specimen 缺件');

  const noTest = evaluate({
    capabilities: [
      {
        id: 'x',
        name: '缺测试',
        contracts: ['vk-panel.variant'],
        specimen: 'vk-panel',
        tests: [{ file: 'tests/panel.test.mjs', name: '这条 test 不存在' }],
      },
    ],
  });
  assert.equal(noTest[0].ok, false, '找不到 test 名字必须判红');
  assert.ok(noTest[0].issues.some((i) => i.kind === 'test'), '应该记一条 test 缺件');
});

test('能力矩阵：契约跳过的属性不算断言', () => {
  assert.equal(checkContract('vk-panel.variant'), null, 'variant 有真实断言');
  assert.equal(checkContract('vk-text.tone'), null, 'tone 有真实断言');
  assert.match(checkContract('vk-panel.at'), /会跳过/, 'motion 属性由 director 覆盖，不能算矩阵里的契约');
  assert.match(checkContract('vk-panel.nope'), /registry 没有/, '不存在的属性必须报错');
});
