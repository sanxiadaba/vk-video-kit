import test from 'node:test';
import assert from 'node:assert/strict';
import { TAGS, TAG_NAMES, ALL_TAG_NAMES, ALIASES, LAYERS, byLayer, validate } from '../src/registry.mjs';
import { SCENES } from '../src/scenes/scenes.mjs';

test('registry 自检通过', () => {
  assert.deepEqual(validate(), []);
});

/**
 * 标签数是收敛指标，不是常数：14.0 要求它只减不增。
 * 写死一个数字会让每次收敛都要改测试；写"只减不增"才是在约束设计。
 */
// 批次 A（表面与层次）经批准 +1：vk-panel 是「一块带标题/语义的分区」，
// 与 vk-box（无标题的面）是两个东西。上限跟着提一档，之后仍然只减不增。
// 批次 C（关系/图示）经批准 +1：vk-annotate 把 vk-edge / vk-pin / vk-ring
// 合成一个组件（旧标签保留为别名），净增 1。
// 批次 G（注解原语）经批准 +1：vk-note 是"边注 / 编号图例"，
// 与 vk-annotate note（气泡 / 引线标签 / 编号点）是两种东西：一个排进版面，一个画在内容上。
// 批次 R（根因原语）经批准 +2：vk-pair 是"两块并置 + 中轴"（grid 只分份，不表达关系）；
// vk-caption 是"贴在目标块上的归属说明"（label 是块内标签，caption 属于目标块）。
// 批次 N（流程原语）经批准 +1：vk-flow 是"N 块 + N-1 箭头"（pair 只有两块一条轴，
// 表达对照；flow 表达"东西怎么变的"）。
// 减法第一波经批准 -6：vk-icon / vk-rule / vk-caption / vk-pin / vk-ring / vk-window
// 并进 vk-text / vk-box / vk-label / vk-note / vk-box / vk-panel，旧名保留为别名，
// 标签清单不再单列（TAG_NAMES 30）。
const TAG_CEILING = 30;

test(`标签数不超过 ${TAG_CEILING}（别名不单列，只减不增）`, () => {
  assert.ok(TAG_NAMES.length <= TAG_CEILING, `标签数 ${TAG_NAMES.length} > 上限 ${TAG_CEILING}：新标签要先过"一个东西"的判据`);
  assert.equal(TAG_NAMES.length + Object.keys(ALIASES).length, ALL_TAG_NAMES.length, 'TAG_NAMES + 别名 应等于全部注册项');
  const counts = Object.fromEntries(LAYERS.map((l) => [l.id, byLayer(l.id).length]));
  assert.ok(counts.tokens === 0, 'token 层不该有标签');
  for (const [id, n] of Object.entries(counts)) {
    if (id === 'tokens') continue;
    assert.ok(n > 0, `${id} 层是空的`);
  }
});

test('别名只转发到一个公开标签，且不在清单里单列', () => {
  for (const [tag, a] of Object.entries(ALIASES)) {
    assert.ok(TAGS[a.to], `${tag} 的 aliasOf 指向不存在的 ${a.to}`);
    assert.ok(!TAGS[a.to].aliasOf, `${tag} 不能指向另一个别名 ${a.to}`);
    assert.ok(!TAG_NAMES.includes(tag), `${tag} 是别名，不该出现在 TAG_NAMES`);
    assert.ok(a.note && a.note.length > 8, `${tag} 缺迁移说明`);
  }
  assert.equal(Object.keys(ALIASES).length, 6, '减法第一波是 6 个旧名');
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



