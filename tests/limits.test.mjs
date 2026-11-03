import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LIMITS } from '../src/shared/limits.mjs';

/**
 * 数值只有一个来源：shared/limits.mjs。
 * 13.0 的教训是同一个门槛在 audit/gate/contract 各写一遍，同一页两个结论。
 * 这里锁住"CSS token 与 limits 一致"，防止有人改了一边忘了另一边。
 */

// 注释里也会出现 token 写法（例如"不要写成 --vk-t-label: var(--vk-t-label)"），读数前先剥掉。
const css = fs.readFileSync('src/tokens/tokens.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const raw = (name) => css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim() || null;
/** 读一个尺寸 token；允许一层 var() 别名（--vk-safe-x → --vk-margin）。 */
const px = (name) => {
  let v = raw(name);
  for (let i = 0; i < 3 && v; i++) {
    const alias = v.match(/^var\((--[\w-]+)\)$/);
    if (!alias) break;
    v = raw(alias[1]);
  }
  const m = String(v || '').match(/^(\d+)px$/);
  return m ? Number(m[1]) : null;
};

test('tokens.css 的字号与安全区 = limits', () => {
  assert.equal(px('--vk-t-label'), LIMITS.fontFloor, '--vk-t-label 应等于 fontFloor');
  assert.equal(px('--vk-t-body'), LIMITS.fontBody, '--vk-t-body 应等于 fontBody');
  assert.equal(px('--vk-margin'), LIMITS.safe.x, '--vk-margin 应等于 safe.x');
  assert.equal(px('--vk-safe-x'), LIMITS.safe.x, '--vk-safe-x 应等于 safe.x（它是 --vk-margin 的旧名）');
  assert.equal(px('--vk-safe-y'), LIMITS.safe.y, '--vk-safe-y 应等于 safe.y');
});

test('阈值分档：正文最严，标注最低，大字居中', () => {
  assert.ok(LIMITS.contrastText > LIMITS.contrastMuted, '正文对比度必须高于标注');
  assert.ok(LIMITS.contrastMuted <= LIMITS.contrastLarge, '标注不应比大字更严');
  assert.ok(LIMITS.fontFloor < LIMITS.fontBody, '地板必须低于正文');
});
