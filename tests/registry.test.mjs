import test from 'node:test';
import assert from 'node:assert/strict';
import { TAGS, TAG_NAMES, LAYERS, byLayer, validate } from '../src/registry.mjs';
import { SCENES } from '../src/scenes/scenes.mjs';

test('registry 自检通过', () => {
  assert.deepEqual(validate(), []);
});

/**
 * 标签数是收敛指标，不是常数：14.0 要求它只减不增。
 * 写死一个数字会让每次收敛都要改测试；写"只减不增"才是在约束设计。
 */
const TAG_CEILING = 37;

test(`标签数不超过 ${TAG_CEILING}（只减不增）`, () => {
  assert.ok(TAG_NAMES.length <= TAG_CEILING, `标签数 ${TAG_NAMES.length} > 上限 ${TAG_CEILING}：新标签要先过"一个东西"的判据`);
  assert.equal(TAG_NAMES.length, Object.keys(TAGS).length, 'TAG_NAMES 与 TAGS 不一致');
  const counts = Object.fromEntries(LAYERS.map((l) => [l.id, byLayer(l.id).length]));
  assert.ok(counts.tokens === 0, 'token 层不该有标签');
  for (const [id, n] of Object.entries(counts)) {
    if (id === 'tokens') continue;
    assert.ok(n > 0, `${id} 层是空的`);
  }
});

test('每个标签都有说明和合法属性', () => {
  for (const [tag, def] of Object.entries(TAGS)) {
    assert.ok(def.summary.length > 8, `${tag} 缺说明`);
    for (const [name, spec] of Object.entries(def.attrs)) {
      assert.ok(spec.values || spec.type, `${tag}.${name} 没有类型`);
      if (spec.values) assert.ok(spec.values.length > 0, `${tag}.${name} 枚举为空`);
    }
  }
});

test('每个元件（除画布）都有且只有一个场景', () => {
  const seen = new Set();
  for (const scene of SCENES) {
    assert.ok(TAGS[scene.tag], `场景引用了不存在的 ${scene.tag}`);
    assert.ok(!seen.has(scene.tag), `${scene.tag} 有重复场景`);
    seen.add(scene.tag);
    assert.ok(scene.body.includes(`<${scene.tag}`), `${scene.tag} 的场景里没有这个标签`);
  }
  for (const tag of TAG_NAMES) {
    if (tag === 'vk-page') continue; // 画布工具：不是展台上的元件
    assert.ok(seen.has(tag), `${tag} 没有场景`);
  }
});



