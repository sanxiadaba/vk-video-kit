import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TONES,
  SOLID_TOKENS,
  WASH_TOKENS,
  TINT_TOKENS,
  DARK_WASH_TOKENS,
  DARK_TINT_TOKENS,
  readHexTokens,
  surfaceTokenNames,
  tintTable,
  contrast,
  luminance,
  hueDistance,
} from './lib/surface-tokens.mjs';

/**
 * L0 · 语义淡底（wash / tint）
 *
 * 为什么要有这一层：14.0 只有「一种纸白 + 四档灰」，颜色只能往字上抹。
 * 这一批把颜色做成「面」：五色 × 两档 × 浅/深两套。
 *
 * 锁四件事：
 *   1. 十个名字都在（五色 × wash/tint），并且深色版也在；
 *   2. 亮度是阶：wash > tint > 实色（浅色）；base < wash < tint（深色）；
 *   3. 色相不新增：两档与实色的色相差 ≤ 6°；
 *   4. 对比度：浅色版上的正文墨 ≥ 7:1，深色版上的白字 ≥ 7:1。
 *
 * 不写用例的色不进 tokens：第 4 条同时把「野生 wash/tint 名」判红。
 */

const css = fs.readFileSync('src/tokens/tokens.css', 'utf8');
const tokens = readHexTokens(css);
const rows = tintTable(tokens);

const BLACK = '#0b0f14';
const WHITE = '#ffffff';
const DARK_BASE = '#0b0f14';

const get = (name, tone) => {
  const v = tokens[name];
  assert.ok(v, `缺少 token ${name}（${tone}）`);
  assert.match(v, /^#[0-9a-f]{6}$/, `${name} 必须是 6 位 hex（alpha=1），实际 ${v}`);
  return v;
};

test('语义淡底：五色 wash 齐全，浅色/深色两套各自成阶', () => {
  for (const { tone } of rows) {
    const wash = get(WASH_TOKENS[tone], tone);
    const darkWash = get(DARK_WASH_TOKENS[tone], tone);
    // 浅色 wash 比白纸暗、比 tint 亮（tint 在下一组验证）
    assert.ok(luminance(wash) < luminance(WHITE), `wash-${tone} 应比白纸暗`);
    assert.ok(luminance(wash) > luminance(get(TINT_TOKENS[tone], tone)), `wash-${tone} 应比 tint-${tone} 亮`);
    // 深色 wash 比深色底亮：深色块上的「分区」是抬一档，不是压黑
    assert.ok(luminance(darkWash) > luminance(DARK_BASE), `dark-wash-${tone} 应比深色底亮`);
  }
});

test('语义淡底：五色 tint 齐全，比 wash 深、比实色浅', () => {
  for (const { tone } of rows) {
    const tint = get(TINT_TOKENS[tone], tone);
    const wash = get(WASH_TOKENS[tone], tone);
    const solid = get(SOLID_TOKENS[tone], tone);
    const darkWash = get(DARK_WASH_TOKENS[tone], tone);
    const darkTint = get(DARK_TINT_TOKENS[tone], tone);

    assert.ok(luminance(tint) < luminance(wash), `tint-${tone} 应比 wash-${tone} 深`);
    assert.ok(luminance(tint) > luminance(solid), `tint-${tone} 应比实色 ${tone} 浅`);
    // 「两档」必须看得出来：亮度差至少 1.2:1（浅色）/ 1.1:1（深色）
    assert.ok(contrast(wash, tint) >= 1.2, `wash-${tone} → tint-${tone} 的亮度差太小（${contrast(wash, tint).toFixed(2)}:1）`);
    assert.ok(
      contrast(darkWash, darkTint) >= 1.1,
      `dark-wash-${tone} → dark-tint-${tone} 的亮度差太小（${contrast(darkWash, darkTint).toFixed(2)}:1）`
    );
  }
});

test('语义淡底：色相不变，正文对比度 ≥ 7:1', () => {
  for (const { tone } of rows) {
    const solid = get(SOLID_TOKENS[tone], tone);
    const wash = get(WASH_TOKENS[tone], tone);
    const tint = get(TINT_TOKENS[tone], tone);
    const darkWash = get(DARK_WASH_TOKENS[tone], tone);
    const darkTint = get(DARK_TINT_TOKENS[tone], tone);

    // 浅色两档由这个语义色与白混合：色相必须留在同一支上。
    // 深色两档混的是带冷调的墨 #0b0f14，色相会随底色偏 ≤16°，所以只锁浅色。
    for (const [name, c] of [
      ['wash', wash],
      ['tint', tint],
    ]) {
      assert.ok(hueDistance(solid, c) <= 6, `${tone} 的 ${name} 色相偏了 ${hueDistance(solid, c).toFixed(1)}°`);
    }

    // 面上仍然读得清：浅色用墨 1，深色用白。
    assert.ok(contrast(BLACK, wash) >= 7, `墨 1 在 wash-${tone} 上只有 ${contrast(BLACK, wash).toFixed(1)}:1`);
    assert.ok(contrast(BLACK, tint) >= 7, `墨 1 在 tint-${tone} 上只有 ${contrast(BLACK, tint).toFixed(1)}:1`);
    assert.ok(contrast(WHITE, darkWash) >= 7, `白字在 dark-wash-${tone} 上只有 ${contrast(WHITE, darkWash).toFixed(1)}:1`);
    assert.ok(contrast(WHITE, darkTint) >= 7, `白字在 dark-tint-${tone} 上只有 ${contrast(WHITE, darkTint).toFixed(1)}:1`);
  }
});

test('语义淡底：只有登记过的 20 个 wash / tint 色', () => {
  const expected = new Set([
    ...TONES.map((t) => WASH_TOKENS[t]),
    ...TONES.map((t) => TINT_TOKENS[t]),
    ...TONES.map((t) => DARK_WASH_TOKENS[t]),
    ...TONES.map((t) => DARK_TINT_TOKENS[t]),
  ]);
  const actual = surfaceTokenNames(css);
  const extra = [...actual].filter((n) => !expected.has(n));
  const missing = [...expected].filter((n) => !actual.has(n));
  assert.deepEqual(extra, [], `这些 wash/tint 色没有对应用例，不许进 tokens：${extra.join(', ')}`);
  assert.deepEqual(missing, [], `缺少登记过的 wash/tint：${missing.join(', ')}`);
  assert.equal(expected.size, 20, '五色 × 两档 × 浅/深 = 20');
});
