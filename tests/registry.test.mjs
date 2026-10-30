import test from 'node:test';
import assert from 'node:assert/strict';
import { TAGS, TAG_NAMES, LAYERS, byLayer, validate } from '../src/registry.mjs';
import { SCENES } from '../src/scenes/scenes.mjs';

test('registry 自检通过', () => {
  assert.deepEqual(validate(), []);
});

test('40 个标签，分在 5 个有内容的层', () => {
  assert.equal(TAG_NAMES.length, 40);
  const counts = Object.fromEntries(LAYERS.map((l) => [l.id, byLayer(l.id).length]));
  assert.deepEqual(counts, { tokens: 0, elements: 11, layout: 4, components: 19, relations: 5, page: 1 });
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


